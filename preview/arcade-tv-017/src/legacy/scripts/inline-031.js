
(function(){
  'use strict';
  if(window.__sqFix120PracticePbCompareForceStyle) return;
  window.__sqFix120PracticePbCompareForceStyle = true;

  function toNum(el){
    if(!el) return NaN;
    var txt = String(el.textContent || '').replace(/[^0-9.-]/g,'').trim();
    if(!txt || txt === '-' || txt === '–') return NaN;
    var n = Number(txt);
    return Number.isFinite(n) ? n : NaN;
  }

  function clearScoreCell(cell){
    if(!cell) return;
    cell.classList.remove('sq-score-beats-pb');
    cell.removeAttribute('data-sq-beats-pb');
    var num = cell.querySelector('.v2CellNum');
    if(num){
      num.classList.remove('sq-score-beats-pb-text');
      if(num.dataset.sqPbInline === '1'){
        num.style.removeProperty('color');
        num.style.removeProperty('text-shadow');
        delete num.dataset.sqPbInline;
      }
    }
  }

  function markScoreCell(cell){
    if(!cell) return;
    cell.classList.add('sq-score-beats-pb');
    cell.setAttribute('data-sq-beats-pb','1');
    var num = cell.querySelector('.v2CellNum');
    if(num){
      num.classList.add('sq-score-beats-pb-text');
      // Inline final fallback beats older overly-specific CSS branches.
      num.style.setProperty('color','rgba(70,255,145,.98)','important');
      num.style.setProperty('text-shadow','0 0 10px rgba(70,255,145,.24)','important');
      num.dataset.sqPbInline = '1';
    }
  }

  function previousScoreCell(pbCell){
    var node = pbCell ? pbCell.previousElementSibling : null;
    while(node){
      if(node.classList && node.classList.contains('v2Cell') && !node.classList.contains('v2SoloPbCell') && !node.classList.contains('v2Badge')) return node;
      node = node.previousElementSibling;
    }
    return null;
  }

  function applyPracticePbCompare(){
    var results = [];
    try{
      var rowsHosts = Array.from(document.querySelectorAll('.v2Rows'));
      rowsHosts.forEach(function(rows){
        Array.from(rows.querySelectorAll('.v2Cell.sq-score-beats-pb, .v2Cell[data-sq-beats-pb="1"]')).forEach(clearScoreCell);
        Array.from(rows.querySelectorAll('.v2Cell.v2SoloPbCell')).forEach(function(pbCell){
          var scoreCell = previousScoreCell(pbCell);
          var scoreNum = scoreCell && scoreCell.querySelector('.v2CellNum');
          var pbNum = pbCell.querySelector('.v2SoloPbScore');
          var score = toNum(scoreNum);
          var pb = toNum(pbNum);
          var shouldMark = Number.isFinite(score) && Number.isFinite(pb) && pb > 0 && score > pb;
          if(shouldMark) markScoreCell(scoreCell);
          results.push({score:score, pb:pb, marked:shouldMark, scoreCell:!!scoreCell, scoreText:scoreCell?String(scoreCell.textContent||'').trim():'', pbText:String(pbCell.textContent||'').trim()});
        });
      });
    }catch(e){
      try{ console.warn('[SQ] Fix120 Practice PB compare failed', e); }catch(_){ }
    }
    return results;
  }

  window.__sqApplyPracticePbCompare = applyPracticePbCompare;
  window.__sqPracticePbCompareDebug = function(){
    var rows = applyPracticePbCompare();
    console.table(rows);
    return rows;
  };

  var queued = false;
  function schedule(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(function(){
      queued = false;
      applyPracticePbCompare();
    });
  }

  try{ new MutationObserver(schedule).observe(document.body, {childList:true, subtree:true}); }catch(_){ }
  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('click', function(){ setTimeout(applyPracticePbCompare, 60); }, true);
  document.addEventListener('keyup', function(){ setTimeout(applyPracticePbCompare, 60); }, true);
  setTimeout(applyPracticePbCompare, 50);
  setTimeout(applyPracticePbCompare, 250);
  setTimeout(applyPracticePbCompare, 750);
  setInterval(applyPracticePbCompare, 1000);
  try{ console.info('[SQ] Fix120 Practice PB compare force style active'); }catch(_){ }
})();
