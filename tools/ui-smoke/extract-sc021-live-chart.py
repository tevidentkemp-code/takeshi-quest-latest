from pathlib import Path
text=Path('index.html').read_text(encoding='utf-8')
lines=text.splitlines()
for needle,before,after in [
    ('function __sqDrawArcadeRace',5,330),
    ('function buildLiveSeries(){',15,85),
]:
    hits=[i for i,l in enumerate(lines,1) if needle in l]
    print('NEEDLE',needle,'HITS',hits)
    for i in hits[-1:]:
        lo=max(1,i-before); hi=min(len(lines),i+after)
        print(f'===== {needle} {lo}-{hi} =====')
        for n in range(lo,hi+1): print(f'{n:06d}: {lines[n-1]}')
