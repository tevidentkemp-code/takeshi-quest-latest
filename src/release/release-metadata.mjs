export const RELEASE_METADATA = Object.freeze({
  scheme: 'CalVer YYYY.MM.DD.N',
  current: '2026.09.21.1',
  historyStart: '2026-09-21',
  releases: Object.freeze([
    Object.freeze({
      version: '2026.09.21.1',
      date: '2026-09-21',
      title: 'DMD polish, Volde Misfires & Release Notes',
      notes: Object.freeze([
        'Added Volde-D’eux and Volde-Trois to Misfires and launch-forward XP.',
        'Improved DMD commentary readability, end-of-go / end-of-round pacing and MISS xN animation.',
        'Added the public version badge and scrollable Release Notes.'
      ])
    })
  ])
});

export const PUBLIC_VERSION = RELEASE_METADATA.current;
