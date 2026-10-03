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
