
(function(){
  if(window.__sqFix68RecoveryWarningSilence) return;
  window.__sqFix68RecoveryWarningSilence = true;
  try{
    if(window.__sqLocalStoragePolicy){
      window.__sqLocalStoragePolicy['shateki_quest_scorer_v6'] = ['safe-recovery-cache', 'in-progress recovery cache; guarded against completed/base state truth'];
      window.__sqLocalStoragePolicy['sq_match_active_v1'] = ['safe-recovery-cache', 'active match recovery cache; guarded against completed/base state truth'];
    }
    console.info('[SQ] Recovery localStorage warnings silenced for valid guarded recovery keys');
  }catch(e){ console.warn('[SQ] Fix68 recovery warning policy update failed', e); }
})();
