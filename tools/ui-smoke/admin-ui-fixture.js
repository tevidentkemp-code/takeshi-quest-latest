// Popup-only credential seam for the offline UI harness. No production Auth or
// SEC-05 claim. The isolated command fixture still requires this explicit header.
async function installAdminUiFixture(page){
  await page.evaluate(()=>{
    window.SQ_ADMIN_AUTH={
      require:async()=>({ok:true}),
      getToken:async()=>'sc004-ui-fixture-admin',
      signOut:async()=>{window.__sqAdminAuthed=false;}
    };
  });
}
async function enterAdmin(page){
  await installAdminUiFixture(page);
  await page.click('#adminCodeBtn');
  await page.waitForFunction(()=>!document.getElementById('adminHubModal')?.classList.contains('hidden'));
}
module.exports={enterAdmin,installAdminUiFixture};
