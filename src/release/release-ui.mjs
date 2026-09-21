import { RELEASE_METADATA } from './release-metadata.mjs';

const VERSION_BUTTON_ID = 'sqReleaseVersionBtn';
const MODAL_ID = 'sqReleaseNotesModal';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  if (!year || !month || !day) return String(iso || '');
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function renderReleaseNotesMarkup(metadata = RELEASE_METADATA) {
  return metadata.releases.map((release, index) => {
    const changes = release.changes.map(change => '<li>' + esc(change) + '</li>').join('');
    return '<article class="sq-release-card' + (index === 0 ? ' is-current' : '') + '" data-release-version="' + esc(release.version) + '">'
      + '<div class="sq-release-card-head"><div>'
      + '<div class="sq-release-card-version">v' + esc(release.version) + '</div>'
      + '<div class="sq-release-card-title">' + esc(release.title) + '</div>'
      + '</div><time datetime="' + esc(release.date) + '">' + esc(formatDate(release.date)) + '</time></div>'
      + '<ul>' + changes + '</ul></article>';
  }).join('');
}

export function openReleaseNotes() {
  const existing = document.getElementById(MODAL_ID);
  if (existing) {
    existing.querySelector('button')?.focus();
    return existing;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-release-backdrop';
  overlay.id = MODAL_ID;
  overlay.setAttribute('role', 'presentation');

  const modal = document.createElement('div');
  modal.className = 'modal sq-release-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'sqReleaseNotesTitle');
  modal.tabIndex = -1;

  modal.innerHTML =
    '<div class="sq-release-head"><div>'
    + '<div class="sq-release-kicker">SHATEKI QUEST</div>'
    + '<h2 id="sqReleaseNotesTitle">RELEASE NOTES</h2>'
    + '<div class="sq-release-current">CURRENT VERSION · v' + esc(RELEASE_METADATA.currentVersion) + '</div>'
    + '</div></div>'
    + '<div class="modal-body sq-release-body">'
    + renderReleaseNotesMarkup(RELEASE_METADATA)
    + '<p class="sq-release-history-note">' + esc(RELEASE_METADATA.historyNote) + '</p>'
    + '</div>'
    + '<div class="modal-footer sq-release-footer">'
    + '<button type="button" class="btn ms2-back" data-release-action="back"><span class="ms2-back-ar" aria-hidden="true">←</span><span class="ms2-back-txt">BACK</span></button>'
    + '<button type="button" class="btn sq-pill" data-release-action="close">CLOSE</button>'
    + '</div>';

  const close = () => {
    overlay.remove();
    document.getElementById(VERSION_BUTTON_ID)?.focus();
  };

  modal.querySelector('[data-release-action="back"]')?.addEventListener('click', close);
  modal.querySelector('[data-release-action="close"]')?.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try {
    if (window.sqModal && typeof window.sqModal.register === 'function') {
      window.sqModal.register(overlay, modal, close);
    }
  } catch (_) {}
  requestAnimationFrame(() => modal.querySelector('[data-release-action="back"]')?.focus());
  return overlay;
}

function install() {
  const button = document.getElementById(VERSION_BUTTON_ID);
  if (!button) return;
  button.textContent = 'v' + RELEASE_METADATA.currentVersion;
  button.setAttribute('aria-label', 'Version ' + RELEASE_METADATA.currentVersion + '. Open release notes.');
  button.dataset.releaseVersion = RELEASE_METADATA.currentVersion;
  button.addEventListener('click', openReleaseNotes);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
