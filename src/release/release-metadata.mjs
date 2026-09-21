export const RELEASE_METADATA = Object.freeze({
  schemaVersion: 1,
  versionScheme: 'semver',
  currentVersion: '1.1.0',
  releasedAt: '2026-09-21',
  historyStartsAt: '2026-09-21',
  historyNote: 'Public release-note tracking starts with v1.0.0 on 21 September 2026. Earlier production builds predate public version tracking.',
  releases: Object.freeze([
    Object.freeze({
      version: '1.1.0',
      date: '2026-09-21',
      title: 'Volde Misfires + Release Notes',
      changes: Object.freeze([
        'Added Volde-D’eux: each D1–D5 hit in the Doubles round records a Misfire and deducts 2 XP per qualifying dart.',
        'Added Volde-Trois: each T1–T5 hit in the Trebles round records a Misfire and deducts 2 XP per qualifying dart.',
        'Volde penalties stack independently and sit outside the ordinary worst-Misfire and 5 XP per-game cap.',
        'Added the Home version number and full public Release Notes view.'
      ])
    }),
    Object.freeze({
      version: '1.0.0',
      date: '2026-09-21',
      title: 'DMD Feedback Baseline',
      changes: Object.freeze([
        'Improved DMD throw and end-of-round message hold times.',
        'Made two- and three-miss animations quicker and more punchy.',
        'Corrected miss-sequence feedback so scored darts remain visible in the throw story.',
        'Refined live commentary pacing and message visibility.'
      ])
    })
  ])
});
