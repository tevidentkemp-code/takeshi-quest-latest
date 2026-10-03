// Popup-only credential seam for the offline UI harness. No production Auth or
// SEC-05 claim. The isolated command fixture still requires this explicit header.
async function installAdminUiFixture(page){
  await page.evaluate(()=>{
    window.SQ_ADMIN_AUTH={
      require:async()=>({ok:true}),
      getToken:async()=>'sc004-ui-fixture-admin',
      signOut:async()=>{window.__sqAdminAuthed=false;}
    };
    // The production helper closes over its original real Auth requirement.
    // Bind only this offline helper to the explicit seam, keeping the actual
    // production command transport, envelope and Authorization construction.
    window.sqAdminAction=async body=>{
      await window.SQ_ADMIN_AUTH.require();
      return window.SQ_SECURITY.admin(body);
    };
  });
}
async function enterAdmin(page){
  await installAdminUiFixture(page);
  await page.click('#adminCodeBtn');
  await page.waitForFunction(()=>!document.getElementById('adminHubModal')?.classList.contains('hidden'));
}
module.exports={enterAdmin,installAdminUiFixture};
