from pathlib import Path
text=Path('index.html').read_text(encoding='utf-8')
lines=text.splitlines()
for lo,hi in [(23820,24080),(27127,27315)]:
    print(f'===== EXACT {lo}-{hi} =====')
    for n in range(lo,hi+1): print(f'{n:06d}: {lines[n-1]}')
