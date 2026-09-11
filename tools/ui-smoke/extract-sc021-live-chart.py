from pathlib import Path

text = Path('index.html').read_text(encoding='utf-8')
lines = text.splitlines()
needles = [
    'function __sqDrawArcadeRace', '__sqDrawArcadeRace(', 'v2RaceCanvas', 'raceCanvas',
    '__sqVsShadowDisplayLabelForPlayer', '__sqIsVsShadow', 'practiceVsShadow',
    'High Score', "fillText('HS'", 'fillText("HS"',
]
hits = []
for i, line in enumerate(lines, 1):
    if any(n in line for n in needles): hits.append(i)
anchors = []
for i in hits:
    line = lines[i-1]
    if ('__sqDrawArcadeRace' in line or 'v2RaceCanvas' in line or 'raceCanvas' in line
        or '__sqVsShadowDisplayLabelForPlayer' in line or '__sqIsVsShadow' in line or 'practiceVsShadow' in line):
        if not anchors or min(abs(i-a) for a in anchors) > 15: anchors.append(i)
print('SC021_ANCHORS', anchors)
for idx, anchor in enumerate(anchors, 1):
    radius = 180 if '__sqDrawArcadeRace' in lines[anchor-1] else 45
    lo = max(1, anchor - radius)
    hi = min(len(lines), anchor + radius)
    print(f'\n===== SC021 CHUNK {idx}: lines {lo}-{hi}, anchor {anchor} =====')
    for n in range(lo, hi + 1): print(f'{n:06d}: {lines[n-1]}')
print('\n===== SC021 HS/HIGH SCORE HITS =====')
for i in hits:
    if 23000 <= i <= 29000: print(f'{i:06d}: {lines[i-1]}')
