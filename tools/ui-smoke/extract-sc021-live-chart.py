from pathlib import Path

text = Path('index.html').read_text(encoding='utf-8')
lines = text.splitlines()
needles = [
    '__sqVsShadowDisplayLabelForPlayer', '__sqIsVsShadow', 'practiceVsShadow',
    'vsShadow', 'Vs Shadow', 'shadowPlayer', 'forcePractice'
]
hits=[]
for i,line in enumerate(lines,1):
    if any(n in line for n in needles): hits.append(i)
# Deduplicate nearby hits into small bounded regions.
regions=[]
for i in hits:
    if not regions or i-regions[-1][1] > 12:
        regions.append([max(1,i-20), min(len(lines),i+35)])
    else:
        regions[-1][1]=min(len(lines),max(regions[-1][1],i+35))
print('SC021_MODE_HITS', hits)
for idx,(lo,hi) in enumerate(regions,1):
    print(f'\n===== MODE REGION {idx}: {lo}-{hi} =====')
    for n in range(lo,hi+1): print(f'{n:06d}: {lines[n-1]}')
