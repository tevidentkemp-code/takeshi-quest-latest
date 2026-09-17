from pathlib import Path
import re, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
renderer = ROOT / 'src/legacy/scripts/inline-007.js'
s = renderer.read_text(encoding='utf-8')

helper_pattern = r"  const __sq45Dolphin = \(x,y,scale=\.7,flip=false,phase=0\) => \{.*?\n  \};\n  const __sq45Dart"
helper_replacement = r'''  const __sq45Dolphin = (x,y,scale=.7,flip=false,phase=0) => {
    const kick=(phase%2===0)?0:2;
    // Cabinet-distance dolphin silhouette: one bold readable mass with an
    // unmistakable rounded melon, short beak, swept dorsal, pectoral fin and tail flukes.
    const pts=[
      [17,13],[29,10],[43,8],[56,7],[61,3],[66,8],[79,8],[88,7],[95,8],[100,10],[103,12],[115,13],
      [104,15],[100,17],[95,18],[85,20],[75,21],[68,27+kick],[70,21],[57,22],[43,21],[29,19],[18,17],
      [10,21+kick],[13,17],[3,19],[10,15],[4,10-kick],[14,13]
    ];
    __sq45Poly(pts,x,y,scale,flip);
    nctx.save();
    nctx.translate(Math.round(x*__SQ45_PX),Math.round(y*__SQ45_PX));
    nctx.scale((flip?-1:1)*scale,scale);
    // Tiny cut-out eye; everything else remains a strong one-bit silhouette.
    nctx.clearRect(96*__SQ45_PX,11*__SQ45_PX,2*__SQ45_PX,2*__SQ45_PX);
    nctx.restore();
  };
  const __sq45Dart'''
s, count = re.subn(helper_pattern, lambda _m: helper_replacement, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'dolphin helper replacement expected 1 match, found {count}')

scene_pattern = r"    if \(active && active\.type === 'dolphinSwim'\) \{.*?      thresholdNativeToAmber\(\); return;\n    \}"
scene_replacement = r'''    if (active && active.type === 'dolphinSwim') {
      const age=Math.max(0,now-active.start), dur=Math.max(1300,Number(active.ms||2000)), reduce=__sqSc045ReducedMotion();
      const p=reduce?.52:Math.max(0,Math.min(1,age/dur)), phase=Math.floor(age/145)%2;
      // One hero dolphin is more recognisable than overlapping fish-like silhouettes.
      // It arcs across the cabinet while remaining materially visible for the full scene.
      const x=reduce?14:(-34+p*112), y=reduce?3:(7-Math.sin(Math.PI*p)*6);
      __sq45Dolphin(x,y,.82,false,phase);
      // Scrolling water/spray provides unmistakable sea motion without competing with the silhouette.
      for(let i=0;i<7;i++){
        const wx=((i*22-Math.round(p*64))%164+164)%164-18;
        __sq45Line(wx,30,wx+5,28,1); __sq45Line(wx+5,28,wx+10,30,1);
      }
      const sx=Math.round(x+13), sy=Math.round(y+20);
      [[0,0],[-4,-3],[-8,-1],[-12,-5],[-16,-2]].forEach(([dx,dy],i)=>{ if(reduce||((i+phase)%2===0)) __sq45Rect(sx+dx,sy+dy,1,1); });
      thresholdNativeToAmber(); return;
    }'''
s, count = re.subn(scene_pattern, lambda _m: scene_replacement, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'dolphin scene replacement expected 1 match, found {count}')

renderer.write_text(s, encoding='utf-8')

manifest = ROOT / 'src/legacy/intentional-patches.json'
obj = json.loads(manifest.read_text(encoding='utf-8'))
raw = renderer.read_bytes(); sha = hashlib.sha256(raw).hexdigest(); found = False
for item in obj.get('patches', []):
    if item.get('file') == 'src/legacy/scripts/inline-007.js':
        item['sha256'] = sha
        item['bytes'] = len(raw)
        item['task'] = 'SC-045 premium classic-pinball DMD art polish'
        item['reason'] = 'Finalise the approved special-scene renderer with a single cabinet-distance dolphin silhouette that is immediately recognisable and remains materially visible throughout the 2-second scene.'
        item['protectedBehaviour'] = 'Presentation only: scoring, game rules, mode routing, Supabase writes/schema/RLS, rankings, XP and persistence are untouched. Existing DMD interruption/hard-clear semantics and reduced-motion fallback remain intact.'
        found = True
        break
if not found:
    raise SystemExit('inline-007 intentional patch entry missing')
manifest.write_text(json.dumps(obj, indent=2) + '\n', encoding='utf-8')
print('SC-045 final dolphin art polish applied')
