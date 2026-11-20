
(function(){
  'use strict';
  if (window.__sqFix102LeagueRanksCleanup) return;
  window.__sqFix102LeagueRanksCleanup = true;
  function pad2(n){ return String(n).padStart(2,'0'); }
  function parseShortDateText(txt){
    var raw = String(txt || '').trim();
    if (!raw || /^[-–—]$/.test(raw)) return '';
    var cleaned = raw.replace(/\bat\b/ig,' ').replace(/,/g,' ').replace(/\s+/g,' ').trim();
    var m = cleaned.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m){
      var dd=+m[1], mo=+m[2], yy=+m[3]; if (yy>99) yy%=100;
      var hh=m[4]!=null?+m[4]:0, mi=m[5]!=null?+m[5]:0;
      if(dd>=1&&dd<=31&&mo>=1&&mo<=12) return pad2(dd)+'.'+pad2(mo)+'.'+pad2(yy)+' '+pad2(hh)+':'+pad2(mi);
    }
    m = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m){
      var months={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
      var mo2=months[String(m[2]).toLowerCase()], dd2=+m[1], yy2=+m[3]; if(yy2>99) yy2%=100;
      var hh2=m[4]!=null?+m[4]:0, mi2=m[5]!=null?+m[5]:0;
      if(mo2) return pad2(dd2)+'.'+pad2(mo2)+'.'+pad2(yy2)+' '+pad2(hh2)+':'+pad2(mi2);
    }
    var ms = Date.parse(raw);
    if (Number.isFinite(ms)){ var d=new Date(ms); return pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.'+pad2(d.getFullYear()%100)+' '+pad2(d.getHours())+':'+pad2(d.getMinutes()); }
    return raw;
  }
  function isLeagueRanksModal(root){
    var el = root && root.nodeType === 1 ? root : document;
    var txt=''; try{ txt=String(el.textContent||'').slice(0,3000).toLowerCase(); }catch(_){}
    return /latest scores|top 50 scores|round high scores|high score league|premier league|power rankings/.test(txt);
  }
  function normalizeLeagueRanks(root){
    try{
      var host = root && root.nodeType === 1 ? root : document;
      var modals=[];
      if(host.matches && (host.matches('.modal,.modal-backdrop') || host.querySelector('.modal'))) modals.push(host);
      if(host.querySelectorAll) host.querySelectorAll('.modal,.modal-backdrop').forEach(function(m){modals.push(m);});
      if(!modals.length && isLeagueRanksModal(host)) modals=[host];
      modals.forEach(function(modal){
        if(!isLeagueRanksModal(modal)) return;
        modal.querySelectorAll('th').forEach(function(th){
          var t=String(th.textContent||'').trim().toUpperCase();
          if(t==='WHEN'||t==='DATE/TIME'||t==='DATE / TIME') th.textContent='';
          else if(t==='AVG TOTAL'||t==='AVG / ROUND'||t==='AVG/ROUND') th.textContent='AVG';
          else th.textContent=t;
        });
        var walker=document.createTreeWalker(modal, NodeFilter.SHOW_TEXT, {acceptNode:function(n){return /\bbeats?\b/.test(n.nodeValue||'') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;}});
        var nodes=[], n; while((n=walker.nextNode())) nodes.push(n);
        nodes.forEach(function(node){ node.nodeValue = node.nodeValue.replace(/\bbeats\b/g,'Bt').replace(/\bbeat\b/g,'Bt'); });
        modal.querySelectorAll('td.date-cell').forEach(function(td){ var v=parseShortDateText(td.textContent); if(v) td.textContent=v; });
        modal.querySelectorAll('table').forEach(function(tbl){
          var heads=Array.from(tbl.querySelectorAll('thead th'));
          var dateIdx=-1; heads.forEach(function(th,i){ var t=String(th.textContent||'').trim(); if(!t && i===heads.length-1) dateIdx=i; });
          if(dateIdx<0) return;
          tbl.querySelectorAll('tbody tr').forEach(function(tr){
            var td=tr.children && tr.children[dateIdx]; if(!td) return;
            var txt=String(td.textContent||'').trim(); if(!txt || /loading|no .*found|failed/i.test(txt)) return;
            var v=parseShortDateText(txt); if(v) td.textContent=v;
          });
        });
      });
    }catch(e){ console.warn('[SQ] Fix102 League/Ranks cleanup failed', e); }
  }
  window.__sqLeagueRanksFormatCleanup = normalizeLeagueRanks;
  // ACTIVE ROUND HIGH SCORES WRAPPER
  // Final global wrapper for openRoundHighScoresDialog.
  // Preserves active Fix97 implementation and applies shared League & Rankings formatting/normalisation.
  ['openLatestScoresDialog','openTop50ScoresDialog','openHighScoreLeagueDialog','openPremierLeagueDialog','openRoundHighScoresDialog'].forEach(function(name){
    var fn=window[name]; if(typeof fn!=='function' || fn.__sqFix102Wrapped) return;
    var wrapped=async function(){ var res=await fn.apply(this, arguments); [0,150,600].forEach(function(ms){setTimeout(function(){normalizeLeagueRanks(document);},ms);}); return res; };
    wrapped.__sqFix102Wrapped=true; window[name]=wrapped;
  });
  var mo=new MutationObserver(function(){ setTimeout(function(){normalizeLeagueRanks(document);},30); });
  try{ mo.observe(document.body,{childList:true,subtree:true,characterData:true}); }catch(_){}
  setTimeout(function(){normalizeLeagueRanks(document);},0);
  console.info('[SQ] Fix102 League & Ranks text/date cleanup active');
})();
