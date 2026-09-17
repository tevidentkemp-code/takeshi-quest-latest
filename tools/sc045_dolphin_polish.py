from pathlib import Path
import re, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'src/legacy/scripts/inline-007.js'
s = path.read_text(encoding='utf-8')

old_fn = r'''  const __sq45Dolphin = \(x,y,scale=\.7,flip=false,phase=0\) => \{.*?\n  \};'''
new_fn = r'''  const __sq45Dolphin = (x,y,scale=.7,flip=false,phase=0) => {
    const kick=(phase%2===0)?0:2;
    // Deliberately exaggerated dolphin profile for instant cabinet-distance recognition:
    // rounded melon + long beak, small dorsal fin, pectoral fin and forked tail.
    const pts=[
      [14,14],[25,12],[38,8],[48,7],[52,3],[59,8],[72,9],[83,10],[90,12],[96,12],[103,11],[112,13],
      [104,16],[96,16],[90,17],[80,19],[68,21],[72,26+kick],[62,22],[45,23],[30,20],[18,18],
      [10,23+kick],[13,18],[4,20],[10,16],[3,11-kick]
    ];
    __sq45Poly(pts,x,y,scale,flip);
    nctx.save(); nctx.translate(Math.round(x*__SQ45_PX),Math.round(y*__SQ45_PX)); nctx.scale((flip?-1:1)*scale,scale);
    nctx.clearRect(88*__SQ45_PX,12*__SQ45_PX,2*__SQ45_PX,2*__SQ45_PX);
    nctx.restore();
  };'''
s, n = re.subn(old_fn, lambda _m:new_fn, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'dolphin helper replacement expected 1 match, found {n}')

old_path = "const x1=reduce?27:(-78+p*216), y1=reduce?2:(8-Math.sin(Math.PI*p)*8);\n      const x2=reduce?118:(186-p*214), y2=reduce?12:(11+Math.sin(Math.PI*p)*5);"
new_path = "const x1=reduce?24:(-38+p*132), y1=reduce?2:(8-Math.sin(Math.PI*p)*8);\n      const x2=reduce?108:(154-p*126), y2=reduce?12:(11+Math.sin(Math.PI*p)*5);"
if old_path not in s:
    raise SystemExit('dolphin motion path anchor missing')
s = s.replace(old_path, new_path, 1)
path.write_text(s, encoding='utf-8')

mp = ROOT / 'src/legacy/intentional-patches.json'
obj = json.loads(mp.read_text(encoding='utf-8'))
raw = path.read_bytes(); sha = hashlib.sha256(raw).hexdigest(); found = False
for item in obj.get('patches', []):
    if item.get('file') == 'src/legacy/scripts/inline-007.js':
        item['sha256'] = sha
        item['bytes'] = len(raw)
        item['task'] = 'SC-045 premium classic-pinball DMD art polish'
        item['reason'] = 'Refine the approved dolphin scene into an unmistakable cabinet-distance dolphin silhouette and keep the subject materially visible throughout the full 2-second animation, without changing renderer ownership or gameplay.'
        item['protectedBehaviour'] = 'Presentation only: scoring, game rules, mode routing, Supabase writes/schema/RLS, rankings, XP and persistence are untouched. Existing DMD interruption/hard-clear semantics and reduced-motion fallback remain intact.'
        found = True
        break
if not found:
    raise SystemExit('inline-007 intentional patch entry missing')
mp.write_text(json.dumps(obj, indent=2) + '\n', encoding='utf-8')
print('SC-045 dolphin silhouette/path polish applied')
