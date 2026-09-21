import { RELEASE_METADATA, PUBLIC_VERSION } from '../release/release-metadata.mjs';

const STYLE_ID = 'sq-release-info-style';
const BADGE_ID = 'sqReleaseBadge';
const OVERLAY_ID = 'sqReleaseNotesOverlay';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #details .home-arcade-hero{ position:relative; }
    #${BADGE_ID}{
      position:absolute; right:10px; bottom:9px; z-index:5;
      min-height:30px; padding:0 10px;
      display:inline-flex; align-items:center; justify-content:center; gap:6px;
      border-radius:999px; border:1px solid rgba(255,164,72,.34);
      background:rgba(5,8,15,.78); color:rgba(255,225,185,.92);
      box-shadow:0 7px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06);
      backdrop-filter:blur(6px);
      font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
      letter-spacing:.045em; cursor:pointer; -webkit-tap-highlight-color:transparent;
    }
    #${BADGE_ID}:active{ transform:translateY(1px); }
    #${BADGE_ID}:focus-visible{ outline:2px solid #35a7ff; outline-offset:2px; }
    .sq-release-overlay{
      position:fixed; inset:0; z-index:10080; padding:max(16px,env(safe-area-inset-top)) 14px max(16px,env(safe-area-inset-bottom));
      display:flex; align-items:center; justify-content:center;
      background:rgba(2,5,10,.78); backdrop-filter:blur(8px);
    }
    .sq-release-modal{
      width:min(92vw,520px); max-height:min(82vh,700px);
      display:flex; flex-direction:column; overflow:hidden;
      border-radius:20px; border:1px solid rgba(255,140,42,.28);
      background:linear-gradient(180deg,#121927 0%,#090e18 100%);
      box-shadow:0 28px 80px rgba(0,0,0,.62),0 0 36px rgba(255,122,0,.10);
      color:#eef2ff;
    }
    .sq-release-head{
      flex:0 0 auto; padding:17px 18px 14px;
      border-bottom:1px solid rgba(255,255,255,.08);
      background:linear-gradient(180deg,rgba(255,122,0,.09),rgba(255,122,0,0));
    }
    .sq-release-kicker{ font-size:10px; font-weight:900; letter-spacing:.13em; color:#ffb061; text-transform:uppercase; }
    .sq-release-title{ margin-top:4px; font-size:22px; font-weight:950; letter-spacing:.02em; }
    .sq-release-current{ margin-top:5px; font:800 11px/1.3 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; color:#ffd3a3; }
    .sq-release-body{ flex:1 1 auto; min-height:0; overflow-y:auto; padding:16px 18px 18px; -webkit-overflow-scrolling:touch; }
    .sq-release-entry{ padding:0 0 18px; margin:0 0 18px; border-bottom:1px solid rgba(255,255,255,.07); }
    .sq-release-entry:last-child{ border-bottom:0; margin-bottom:0; padding-bottom:0; }
    .sq-release-entrytop{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .sq-release-version{ font:900 13px/1.2 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; color:#ffbc78; }
    .sq-release-date{ font-size:10px; font-weight:800; color:#8f9bb3; white-space:nowrap; }
    .sq-release-entrytitle{ margin:7px 0 8px; font-size:14px; font-weight:900; color:#fff; }
    .sq-release-list{ margin:0; padding-left:18px; display:grid; gap:7px; color:#d9dfeb; font-size:12px; line-height:1.5; }
    .sq-release-note{ margin-top:14px; padding:10px 11px; border-radius:11px; background:rgba(255,122,0,.055); border:1px solid rgba(255,122,0,.13); color:#aeb8ca; font-size:10px; line-height:1.45; }
    .sq-release-foot{
      flex:0 0 auto; display:flex; justify-content:space-between; gap:10px; padding:12px 14px;
      border-top:1px solid rgba(255,255,255,.08); background:rgba(4,7,13,.92);
    }
    .sq-release-foot button{
      min-height:44px; min-width:92px; padding:0 18px; border-radius:12px;
      border:1px solid rgba(255,255,255,.14); background:#151d2a; color:#eef2ff;
      font-size:12px; font-weight:900; cursor:pointer;
    }
    .sq-release-foot button:last-child{ border-color:rgba(255,146,48,.42); background:rgba(255,122,0,.12); color:#ffd1a0; }
    @media(max-width:360px){
      #${BADGE_ID}{ right:7px; bottom:7px; min-height:28px; padding:0 8px; font-size:9px; }
      .sq-release-modal{ width:94vw; max-height:84vh; border-radius:17px; }
      .sq-release-head{ padding:14px 15px 12px; }
      .sq-release-title{ font-size:19px; }
      .sq-release-body{ padding:14px 15px 16px; }
    }
    @media(prefers-reduced-motion:reduce){
      #${BADGE_ID}{ transition:none; }
    }
  `;
  document.head.appendChild(style);
}

function closeReleaseNotes() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.remove();
  try { document.getElementById(BADGE_ID)?.focus({ preventScroll:true }); } catch (_) {}
}

function openReleaseNotes() {
  closeReleaseNotes();
  ensureStyles();
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'sq-release-overlay';

  const modal = document.createElement('section');
  modal.className = 'sq-release-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','sqReleaseNotesTitle');
  modal.tabIndex = -1;

  const head = document.createElement('header');
  head.className = 'sq-release-head';
  const kicker = document.createElement('div'); kicker.className = 'sq-release-kicker'; kicker.textContent = 'Shateki Quest';
  const title = document.createElement('div'); title.id = 'sqReleaseNotesTitle'; title.className = 'sq-release-title'; title.textContent = 'Release Notes';
  const current = document.createElement('div'); current.className = 'sq-release-current'; current.textContent = 'CURRENT · v' + PUBLIC_VERSION;
  head.append(kicker,title,current);

  const body = document.createElement('div');
  body.className = 'sq-release-body';
  RELEASE_METADATA.releases.forEach(release => {
    const entry = document.createElement('article'); entry.className = 'sq-release-entry';
    const top = document.createElement('div'); top.className = 'sq-release-entrytop';
    const ver = document.createElement('div'); ver.className = 'sq-release-version'; ver.textContent = 'v' + release.version;
    const date = document.createElement('time'); date.className = 'sq-release-date'; date.dateTime = release.date; date.textContent = release.date;
    top.append(ver,date);
    const entryTitle = document.createElement('div'); entryTitle.className = 'sq-release-entrytitle'; entryTitle.textContent = release.title;
    const list = document.createElement('ul'); list.className = 'sq-release-list';
    release.notes.forEach(note => { const li=document.createElement('li'); li.textContent=note; list.appendChild(li); });
    entry.append(top,entryTitle,list); body.appendChild(entry);
  });
  const note = document.createElement('div'); note.className = 'sq-release-note';
  note.textContent = 'Public version history begins with this release. Earlier Shateki deployments were not assigned public version numbers.';
  body.appendChild(note);

  const foot = document.createElement('footer'); foot.className = 'sq-release-foot';
  const back = document.createElement('button'); back.type='button'; back.textContent='Back'; back.onclick=closeReleaseNotes;
  const close = document.createElement('button'); close.type='button'; close.textContent='Close'; close.onclick=closeReleaseNotes;
  foot.append(back,close);

  modal.append(head,body,foot); overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeReleaseNotes(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeReleaseNotes(); });
  requestAnimationFrame(() => modal.focus());
}

function ensureBadge() {
  ensureStyles();
  const hero = document.querySelector('#details .home-arcade-hero');
  if (!hero) return false;
  let badge = document.getElementById(BADGE_ID);
  if (!badge) {
    badge = document.createElement('button');
    badge.id = BADGE_ID;
    badge.type = 'button';
    badge.setAttribute('aria-label','Open Shateki Quest release notes');
    badge.onclick = openReleaseNotes;
    hero.appendChild(badge);
  } else if (badge.parentElement !== hero) {
    hero.appendChild(badge);
  }
  badge.textContent = 'v' + PUBLIC_VERSION + ' ▾';
  badge.dataset.version = PUBLIC_VERSION;
  return true;
}

function install() {
  ensureBadge();
  const observer = new MutationObserver(() => {
    if (document.body?.getAttribute('data-page') === 'details' || document.getElementById('details')) ensureBadge();
  });
  observer.observe(document.documentElement,{ childList:true, subtree:true });
  [80,240,700].forEach(ms => setTimeout(ensureBadge,ms));
  return observer;
}

window.__sqReleaseInfo = Object.freeze({
  version: PUBLIC_VERSION,
  metadata: RELEASE_METADATA,
  open: openReleaseNotes,
  close: closeReleaseNotes,
  ensure: ensureBadge,
});

install();
