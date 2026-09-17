from pathlib import Path
import re, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
renderer = ROOT / 'src/legacy/scripts/inline-007.js'
s = renderer.read_text(encoding='utf-8')

helper_pattern = r"  const __sq45Dolphin = \(x,y,scale=\.7,flip=false,phase=0\) => \{.*?\n  \};\n  const __sq45Dart"
helper_replacement = r'''  const __sq45Dolphin = (x,y,scale=.7,flip=false,phase=0) => {
    const kick=(phase%2===0)?0:1;
    // SC-045 final cabinet-distance dolphin: use a leaping, arched silhouette
    // rather than a straight fish/shark profile. Rounded melon + beak, swept
    // dorsal, low pectoral and separated tail flukes are intentionally exaggerated.
    const pts=[
      [5,17],[8,13],[14,11],[18,7],[26,5],[38,4],[50,5],[62,7],[74,10],[84,14],[92,20],[98,26],
      [103,28],[108,28-kick],[114,27-kick],[121,29],[114,31],[108,30+kick],[103,31+kick],[98,29],
      [93,27],[87,26],[76,25],[64,23],[52,21],[43,19],[38,20],[34,28],[30,26],[29,21],[22,20],[16,18],[10,18]
    ];
    __sq45Poly(pts,x,y,scale,flip);
    // Smaller, swept dorsal. Keeping it low avoids the shark-fin read.
    __sq45Poly([[48,5],[54,1],[58,2],[56,6]],x,y,scale,flip);
    // Tiny eye cutout is enough at DMD distance; keep the rest as one bold mass.
    nctx.save();
    nctx.translate(Math.round(x*__SQ45_PX),Math.round(y*__SQ45_PX));
    nctx.scale((flip?-1:1)*scale,scale);
    nctx.clearRect(14*__SQ45_PX,12*__SQ45_PX,1.5*__SQ45_PX,1.5*__SQ45_PX);
    nctx.restore();
  };
  const __sq45Dart'''
s, count = re.subn(helper_pattern, lambda _m: helper_replacement, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'dolphin helper replacement expected 1 match, found {count}')

scene_pattern = r"      const x=reduce\?14:\(-34\+p\*112\), y=reduce\?3:\(7-Math\.sin\(Math\.PI\*p\)\*6\);\n      __sq45Dolphin\(x,y,\.82,false,phase\);"
scene_replacement = "      const x=reduce?8:(-28+p*92), y=reduce?0:(2-Math.sin(Math.PI*p)*3);\n      __sq45Dolphin(x,y,.92,false,phase);"
s, count = re.subn(scene_pattern, scene_replacement, s, count=1)
if count != 1:
    raise SystemExit(f'dolphin scene placement replacement expected 1 match, found {count}')

renderer.write_text(s, encoding='utf-8')

manifest = ROOT / 'src/legacy/intentional-patches.json'
obj = json.loads(manifest.read_text(encoding='utf-8'))
raw = renderer.read_bytes(); sha = hashlib.sha256(raw).hexdigest(); found = False
for item in obj.get('patches', []):
    if item.get('file') == 'src/legacy/scripts/inline-007.js':
        item['sha256'] = sha
        item['bytes'] = len(raw)
        item['task'] = 'SC-045 premium classic-pinball DMD art polish'
        item['reason'] = 'Finalise GET IN THE SEA with a leaping dolphin silhouette that is immediately distinguishable from a shark/fish at cabinet distance while retaining the existing procedural renderer and 2-second scene.'
        item['protectedBehaviour'] = 'Presentation only: scoring, game rules, mode routing, Supabase writes/schema/RLS, rankings, XP and persistence are untouched. Existing DMD interruption/hard-clear semantics and reduced-motion fallback remain intact.'
        found = True
        break
if not found:
    raise SystemExit('inline-007 intentional patch entry missing')
manifest.write_text(json.dumps(obj, indent=2) + '\n', encoding='utf-8')
print('SC-045 final leaping dolphin silhouette applied')
