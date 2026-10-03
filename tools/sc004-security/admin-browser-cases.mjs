/** Actual browser Auth/UI acceptance. No route mocks, JWT fabrication or UI flag grant.
 * Credentials stay in caller memory and are redacted from any thrown diagnostic. */
import assert from 'node:assert/strict';
export async function runAdminBrowserCases({page,check,email,password,ordinaryEmail,ordinaryPassword,playerId}){
  if(!email||!password)throw new Error('Real isolated Auth credentials are required.');
  const clean=e=>{
    let msg=String(e?.message||'Browser acceptance failed');
    for(const value of [email,password,ordinaryEmail,ordinaryPassword].filter(Boolean))msg=msg.split(value).join('[redacted]');
    msg=msg.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}/g,'[redacted token]');
    return new Error(msg);
  };
  const guarded=(name,fn)=>check(name,async()=>{try{await fn();}catch(e){throw clean(e);}});
  const open=async()=>{await page.click('#adminCodeBtn');await page.locator('#sqAdminSignInOverlay').waitFor({state:'visible'});};
  const signIn=async(e,p)=>{await page.locator('#sqAdminEmail').fill(e);await page.locator('#sqAdminPassword').fill(p);await page.getByRole('button',{name:'Sign in',exact:true}).click();};
  await guarded('Actual admin sign-in dialog has visible labels, focus trap and cancel return',async()=>{
    await open();assert.equal(await page.locator('#sqAdminEmail').getAttribute('type'),'email');assert.equal(await page.locator('#sqAdminPassword').getAttribute('type'),'password');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'sqAdminEmail');
    await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Sign in');
    await page.keyboard.press('Escape');await page.locator('#sqAdminSignInOverlay').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>document.getElementById('adminHubModal').classList.contains('hidden')),true);
  });
  if(ordinaryEmail&&ordinaryPassword)await guarded('Actual ordinary permanent Auth login does not unlock admin allowlist',async()=>{
    await open();await signIn(ordinaryEmail,ordinaryPassword);await page.getByText('This account is not enrolled as an administrator.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.getElementById('adminHubModal').classList.contains('hidden')),true);
    assert.equal(await page.locator('#sqAdminPassword').inputValue(),'');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await guarded('Actual enrolled permanent Auth login opens admin hub and signs out',async()=>{
    await open();await signIn(email,password);await page.waitForFunction(()=>!document.getElementById('adminHubModal').classList.contains('hidden'));
    await page.locator('#sqAdminSignInOverlay').waitFor({state:'detached'});
    assert.equal(await page.locator('#sqAdminSignOut').isVisible(),true);
    if(playerId){
      const result=await page.evaluate(async id=>cloudUpdatePlayerInitials({id,name:'Browser fixture'},'UI'),playerId);assert.equal(result.id,playerId);assert.equal(result.initials,'UI');
    }
    await page.locator('#sqAdminSignOut').click();await page.waitForFunction(()=>document.getElementById('adminHubModal').classList.contains('hidden'));
    assert.equal(await page.evaluate(()=>window.__sqAdminAuthed),false);
    await open();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
}

/** Existing profile/history UI plus callable legacy backfill helpers, all using
 * the real isolated Auth and command service. Synthetic setup uses public create. */
export async function runAdminBrowserWorkflow({page,email,password}){
  if(!email||!password)throw new Error('Actual isolated administrator credentials required.');
  try{
  const run=crypto.randomUUID().slice(0,8).toUpperCase();
  const first='ADMINUI_'+run+'_A',second='ADMINUI_'+run+'_B';
  const query=async(table,id,columns)=>page.evaluate(async({table,id,columns})=>{
    const {data,error}=await sb.from(table).select(columns).eq('id',id).maybeSingle();
    if(error)throw new Error(error.code||'Read failed');return data;
  },{table,id,columns});
  async function until(test){const end=Date.now()+20000;while(Date.now()<end){if(await test())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Admin UI mutation did not reach saved truth.');}
  const rowFor=async(name)=>{const rows=page.locator('#savedPlayersAdminBody tbody tr');for(let i=0;i<await rows.count();i++)if(await rows.nth(i).evaluate((tr,name)=>tr.querySelector('input')?.value===name,name))return rows.nth(i);throw new Error('Synthetic profile row not found.');};
  await page.click('#adminCodeBtn');await page.waitForSelector('#sqAdminSignInOverlay');
  await page.fill('#sqAdminEmail',email);await page.fill('#sqAdminPassword',password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('adminHubModal').classList.contains('hidden'),null,{timeout:25000});
  const profiles=await page.evaluate(async({first,second})=>[
    await cloudCreatePlayer(first,{first_name:first,initials:'A'}),
    await cloudCreatePlayer(second,{first_name:second,initials:'B'})
  ],{first,second});
  await page.click('#openSavedPlayersAdminBtn');await page.waitForSelector('#savedPlayersAdminBody tbody tr');
  const profileRow=await rowFor(first);await profileRow.locator('input').nth(1).fill('Actual UI');await profileRow.locator('input').nth(3).fill('AU');
  await profileRow.getByRole('button',{name:'Save',exact:true}).click();
  await until(async()=>{const p=await query('players',profiles[0].id,'id,name,nickname,initials');return p?.nickname==='Actual UI'&&p?.initials==='AU';});
  const edited=await query('players',profiles[0].id,'id,name,nickname,initials');assert.equal(edited.name,first);
  await page.click('#backSavedPlayersAdminBtn');await page.waitForSelector('#adminHubModal',{state:'visible'});
  const mid=crypto.randomUUID(),at=new Date().toISOString();
  const imported=await page.evaluate(async({profiles,mid,at})=>{
    const oldGames=safeLoad(GAMES_LOG_KEY),oldMatches=safeLoad(MATCHES_LOG_KEY);
    const board=profiles.map((_,i)=>Array.from({length:14},()=>({darts:[{kind:i?'Miss':'S',points:i?0:10},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:i?0:10})));
    const players=profiles.map(p=>({id:p.id,name:p.name}));
    try{
      safeSave(MATCHES_LOG_KEY,[{id:mid,ts:at,players,wins:[1,0],games:1,history:[{totals:[140,0]}]}]);
      safeSave(GAMES_LOG_KEY,[{ts:at,match_id:mid,game_number:1,players,board,totals:[140,0],state:{mode:'official'}}]);
      const match=await backfillLocalMatchesToCloud(),game=await backfillLocalGamesToCloud();
      const {data,error}=await sb.from('games').select('id,match_id,totals,state').eq('match_id',mid).single();if(error)throw new Error(error.code);
      const retry=await backfillLocalGamesToCloud();return{match,game,retry,row:data};
    }finally{if(oldGames==null)safeClear(GAMES_LOG_KEY);else safeSave(GAMES_LOG_KEY,oldGames);if(oldMatches==null)safeClear(MATCHES_LOG_KEY);else safeSave(MATCHES_LOG_KEY,oldMatches);}
  },{profiles,mid,at});
  assert.equal(imported.match.inserted,1);assert.equal(imported.game.inserted,1);assert.equal(imported.retry.inserted,0);assert.deepEqual(imported.row.totals,[140,0]);
  const gid=imported.row.id;
  await page.click('#openAllGamesBtn');const allGames=page.locator('.modal-backdrop').filter({has:page.getByRole('heading',{name:'All Games',exact:true})});
  const gameRow=()=>allGames.locator('tbody tr').filter({hasText:first}).filter({hasText:second});
  await gameRow().getByRole('button',{name:'Archive',exact:true}).click();
  await until(async()=>!!(await query('games',gid,'id,archived_at'))?.archived_at);
  await allGames.getByRole('button',{name:'Archived',exact:true}).click();await gameRow().getByRole('button',{name:'Reinstate',exact:true}).click();
  await until(async()=>{const g=await query('games',gid,'id,archived_at');return !!g&&g.archived_at===null;});
  await allGames.getByRole('button',{name:'Official',exact:true}).click();await gameRow().getByRole('button',{name:'Archive',exact:true}).click();
  await until(async()=>!!(await query('games',gid,'id,archived_at'))?.archived_at);
  await allGames.getByRole('button',{name:'Archived',exact:true}).click();
  // The application retains its explicit destructive confirmation. Existing
  // harness accepts confirms; replace only its prompt answer for this step.
  page.removeAllListeners('dialog');page.on('dialog',d=>d.accept(d.type()==='prompt'?'DELETE':undefined));
  await gameRow().getByRole('button',{name:'Delete',exact:true}).click();await until(async()=>await query('games',gid,'id')===null);
  const scores=await page.evaluate(async gid=>{const {data,error}=await sb.from('high_scores_sp').select('id').eq('game_id',gid);if(error)throw new Error(error.code);return data.length;},gid);assert.equal(scores,0);
  await allGames.getByRole('button',{name:'Back',exact:true}).click();await page.click('#openSavedPlayersAdminBtn');await page.waitForSelector('#savedPlayersAdminBody tbody tr');
  await(await rowFor(second)).getByRole('button',{name:'Delete',exact:true}).click();
  await until(async()=>!!(await query('players',profiles[1].id,'id,deleted_at'))?.deleted_at);
  assert(await query('players',profiles[0].id,'id'),'The other synthetic profile must remain.');
  await page.click('#backSavedPlayersAdminBtn');await page.locator('#sqAdminSignOut').click();
  assert.equal(await page.evaluate(()=>window.__sqAdminAuthed),false);
  return{profileUI:true,localImports:{matches:1,games:1,idempotentRetry:true},historyUI:{archive:true,reinstate:true,purge:true},softDeleteUI:true,readClientAnonymous:await page.evaluate(async()=>(await sb.auth.getSession()).data.session===null)};
  }catch(e){let message=String(e?.message||'Actual admin browser workflow failed');for(const value of [email,password])message=message.split(value).join('[redacted]');throw new Error(message.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}/g,'[redacted token]'));}
}
