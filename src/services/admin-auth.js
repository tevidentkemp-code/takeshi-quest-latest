/* SC-004: persistent admin writes require a permanent Auth user and server enrollment. */
(function(){
  let authClient = null;
  let dialogPromise = null;
  function client(){
    if(authClient) return authClient;
    const config = window.SQ_SECURITY_CONFIG || {};
    const url = config.supabaseUrl || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
    const key = config.publicKey || (typeof SUPABASE_ANON !== 'undefined' ? SUPABASE_ANON : '');
    if(!url || !key || !window.supabase?.createClient) throw new Error('Admin sign-in is unavailable. Please reload the app.');
    authClient = window.supabase.createClient(url,key,{auth:{storageKey:'sq.admin.auth.v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    authClient.auth.onAuthStateChange((_event,session)=>{ if(!session) window.__sqAdminAuthed=false; });
    return authClient;
  }
  function clearHint(){ window.__sqAdminAuthed=false; }
  async function getToken(){
    const sdk=client();
    const {data,error}=await sdk.auth.getSession();
    if(error || !data?.session?.access_token){clearHint();throw new Error('Sign in as an enrolled administrator to make this change.');}
    const verified=await sdk.auth.getUser(data.session.access_token);
    const user=verified.data?.user;
    if(verified.error || !user || user.is_anonymous!==false || !user.email_confirmed_at || user.deleted_at){clearHint();throw new Error('An enrolled administrator account is required.');}
    return data.session.access_token;
  }
  async function verify(){
    await getToken();
    if(!window.SQ_SECURITY?.admin) throw new Error('The secure admin service is unavailable.');
    let result;
    try{result=await window.SQ_SECURITY.admin({operation:'status'});}catch(e){clearHint();if(e.status===403||e.code==='permission_denied')throw new Error('This account is not enrolled as an administrator.');throw e;}
    if(result?.ok!==true){clearHint();throw new Error('This account is not enrolled as an administrator.');}
    window.__sqAdminAuthed=true; // Presentation hint only; every write is checked on the server.
    return result;
  }
  function login(){
    if(dialogPromise) return dialogPromise;
    dialogPromise=new Promise((resolve,reject)=>{
      const prior=document.activeElement;
      const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.id='sqAdminSignInOverlay';
      const modal=document.createElement('div');modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','sqAdminSignInTitle');
      modal.style.width='min(92vw,420px)';modal.style.maxHeight='90vh';modal.style.overflow='auto';
      const title=document.createElement('h3');title.id='sqAdminSignInTitle';title.textContent='Admin sign in';
      const body=document.createElement('div');body.className='modal-body';body.style.display='grid';body.style.gap='12px';
      const hint=document.createElement('p');hint.className='muted';hint.textContent='Use your enrolled administrator account.';
      const emailLabel=document.createElement('label');emailLabel.textContent='Email';emailLabel.htmlFor='sqAdminEmail';
      const email=document.createElement('input');email.id='sqAdminEmail';email.type='email';email.className='input';email.autocomplete='username';email.required=true;
      const passwordLabel=document.createElement('label');passwordLabel.textContent='Password';passwordLabel.htmlFor='sqAdminPassword';
      const password=document.createElement('input');password.id='sqAdminPassword';password.type='password';password.className='input';password.autocomplete='current-password';password.required=true;
      for(const input of [email,password]){input.style.width='100%';input.style.boxSizing='border-box';input.style.minHeight='44px';}
      const error=document.createElement('p');error.setAttribute('role','status');error.setAttribute('aria-live','polite');error.style.minHeight='24px';
      const footer=document.createElement('div');footer.className='modal-footer';
      const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='Cancel';cancel.style.minHeight='44px';
      const enter=document.createElement('button');enter.className='btn primary';enter.textContent='Sign in';enter.style.minHeight='44px';
      let closing=false;
      function close(value,failure){
        if(closing)return;closing=true;password.value='';overlay.remove();dialogPromise=null;
        if(prior?.isConnected)prior.focus();
        failure?reject(failure):resolve(value);
      }
      cancel.onclick=()=>close(null,new Error('Admin sign-in cancelled.'));
      async function submit(){
        if(enter.disabled)return;
        if(!email.checkValidity() || !password.value){error.textContent='Enter your email and password.';return;}
        enter.disabled=true;error.textContent='Signing in…';
        try{
          const response=await client().auth.signInWithPassword({email:email.value.trim(),password:password.value});
          password.value='';
          if(response.error)throw new Error('Sign-in failed. Check your account details.');
          if(closing){await client().auth.signOut({scope:'local'});return;}
          const result=await verify();
          if(closing){clearHint();await client().auth.signOut({scope:'local'});return;}
          close(result);
        }catch(e){
          clearHint();if(closing)return;error.textContent=e?.message || 'Sign-in failed.';
          try{await client().auth.signOut({scope:'local'});}catch(_){}
          password.focus();
        }finally{enter.disabled=false;}
      }
      enter.onclick=submit;
      overlay.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();cancel.click();}
        if(event.key==='Enter' && event.target.tagName==='INPUT'){event.preventDefault();submit();}
        if(event.key==='Tab'){
          const focusables=[email,password,cancel,enter].filter(el=>!el.disabled);
          const first=focusables[0],last=focusables.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      });
      body.append(hint,emailLabel,email,passwordLabel,password,error);footer.append(cancel,enter);modal.append(title,body,footer);overlay.append(modal);document.body.append(overlay);email.focus();
    });
    return dialogPromise;
  }
  async function requireAdmin(){try{return await verify();}catch(_){return login();}}
  async function signOut(){clearHint();await client().auth.signOut({scope:'local'});}
  window.SQ_ADMIN_AUTH=Object.freeze({getToken,require:requireAdmin,signOut,verify});
  window.sqAdminAction=async function(body){
    if(!window.SQ_SECURITY?.admin)throw new Error('The secure admin service is unavailable.');
    await requireAdmin();
    return window.SQ_SECURITY.admin(body);
  };
  window.openAdminPasswordModal=async function(){
    try{
      await requireAdmin();
      const open=window.__sqOriginalOpenAdminHub || window.__openAdminHubUnsafe;
      if(typeof open==='function')return open();
    }catch(e){if(typeof toast==='function')toast(e?.message || 'Admin sign-in failed.');}
  };
})();
