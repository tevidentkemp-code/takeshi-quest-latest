from pathlib import Path

text = Path('index.html').read_text(encoding='utf-8')
lines = text.splitlines()
needles = [
    'function __sqDrawArcadeRace',
    '__sqDrawArcadeRace(',
    'v2RaceCanvas',
    'raceCanvas',
    'High Score',
    "fillText('HS'",
    'fillText("HS"',
]

hits = []
for i, line in enumerate(lines, 1):
    if any(n in line for n in needles):
        hits.append(i)

# Keep only chart-adjacent hits: all renderer definitions/calls plus a bounded neighbourhood
# around them. This is temporary inspection evidence only.
anchors = []
for i in hits:
    line = lines[i-1]
    if '__sqDrawArcadeRace' in line or 'v2RaceCanvas' in line or 'raceCanvas' in line:
        anchors.append(i)

print('SC021_ANCHORS', anchors)
for idx, anchor in enumerate(anchors, 1):
    lo = max(1, anchor - 70)
    hi = min(len(lines), anchor + 180)
    print(f'\n===== SC021 CHUNK {idx}: lines {lo}-{hi}, anchor {anchor} =====')
    for n in range(lo, hi + 1):
        print(f'{n:06d}: {lines[n-1]}')

print('\n===== SC021 EXACT HS/HIGH SCORE HITS NEAR CHART REGION =====')
for i in hits:
    if 26000 <= i <= 29000 or any(abs(i-a) < 500 for a in anchors):
        print(f'{i:06d}: {lines[i-1]}')
