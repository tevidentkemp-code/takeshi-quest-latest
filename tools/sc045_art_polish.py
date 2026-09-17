from pathlib import Path
import re, json, hashlib

ROOT = Path(__file__).resolve().parents[1]

def read(path): return (ROOT / path).read_text(encoding='utf-8')
def write(path, text): (ROOT / path).write_text(text, encoding='utf-8')

def sub_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, lambda _m: repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return out

path='src/legacy/scripts/inline-007.js'
s=read(path)

helpers=r'''  // >>> PATCH:SC045_PINBALL_PROCEDURAL_SCENES START
  // SC-045 premium pinball art direction.
  // Special scenes are composed on a coarse 128x32 logical DMD grid (5 native
  // pixels per logical dot), then passed through the existing amber-dot mask.
  // This deliberately favours bold silhouettes, chunky 1-bit timing and staged
  // impact beats over smooth web-canvas illustration.
  const __sqSc045ReducedMotion = () => {
    try{ return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }catch(_){ return false; }
  };
  const __SQ45_PX = 5;
  const __sq45Rect = (x,y,w=1,h=1) => {
    nctx.fillRect(Math.round(x)*__SQ45_PX, Math.round(y)*__SQ45_PX, Math.max(1,Math.round(w))*__SQ45_PX, Math.max(1,Math.round(h))*__SQ45_PX);
  };
  const __sq45Clear = (x,y,w=1,h=1) => {
    nctx.clearRect(Math.round(x)*__SQ45_PX, Math.round(y)*__SQ45_PX, Math.max(1,Math.round(w))*__SQ45_PX, Math.max(1,Math.round(h))*__SQ45_PX);
  };
  const __sq45Line = (x0,y0,x1,y1,th=1) => {
    x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
    const dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
    let err=dx+dy;
    while(true){
      __sq45Rect(x0-Math.floor((th-1)/2), y0-Math.floor((th-1)/2), th, th);
      if(x0===x1 && y0===y1) break;
      const e2=2*err;
      if(e2>=dy){ err+=dy; x0+=sx; }
      if(e2<=dx){ err+=dx; y0+=sy; }
    }
  };
  const __sq45Circle = (cx,cy,r,th=1) => {
    let x=r, y=0, err=0;
    const dot=(px,py)=>__sq45Rect(px-Math.floor((th-1)/2), py-Math.floor((th-1)/2), th, th);
    while(x>=y){
      [[x,y],[y,x],[-y,x],[-x,y],[-x,-y],[-y,-x],[y,-x],[x,-y]].forEach(([dx,dy])=>dot(cx+dx,cy+dy));
      y+=1;
      if(err<=0) err += 2*y+1;
      if(err>0){ x-=1; err -= 2*x+1; }
    }
  };
  const __sq45Poly = (pts, ox=0, oy=0, scale=1, flip=false) => {
    if(!Array.isArray(pts) || !pts.length) return;
    nctx.save();
    nctx.translate(Math.round(ox*__SQ45_PX), Math.round(oy*__SQ45_PX));
    nctx.scale((flip?-1:1)*scale, scale);
    nctx.beginPath();
    pts.forEach(([x,y],i)=>{
      const px=Math.round(x*__SQ45_PX), py=Math.round(y*__SQ45_PX);
      if(i===0) nctx.moveTo(px,py); else nctx.lineTo(px,py);
    });
    nctx.closePath(); nctx.fill();
    nctx.restore();
  };
  const __sq45Eye = (x,y,pupil=0,blink=false) => {
    if(blink){ __sq45Line(x,y+4,x+10,y+4,1); __sq45Line(x+1,y+3,x+9,y+3,1); return; }
    __sq45Rect(x+2,y,6,1); __sq45Rect(x+1,y+1,8,1); __sq45Rect(x,y+2,10,5); __sq45Rect(x+1,y+7,8,1); __sq45Rect(x+2,y+8,6,1);
    __sq45Clear(x+2,y+2,6,5);
    __sq45Rect(x+4+pupil,y+3,2,3);
  };
  const __sq45Dolphin = (x,y,scale=.7,flip=false,phase=0) => {
    const kick=(phase%2===0)?0:2;
    const pts=[
      [23,17],[35,10],[48,8],[51,5],[55,9],[68,9],[77,10],[83,12],[87,14],[94,14],[104,13],
      [97,16],[88,16],[80,18],[70,20],[60,21],[64,25+kick],[55,22],[40,23],[25,19],[16,19],
      [8,26+kick],[14,20],[23,18],[12,16],[6,10-kick],[15,11]
    ];
    __sq45Poly(pts,x,y,scale,flip);
    // punch a dark eye through the silhouette; clearRect respects the active transform only
    nctx.save(); nctx.translate(Math.round(x*__SQ45_PX),Math.round(y*__SQ45_PX)); nctx.scale((flip?-1:1)*scale,scale);
    nctx.clearRect(78*__SQ45_PX,12*__SQ45_PX,2*__SQ45_PX,2*__SQ45_PX);
    nctx.restore();
  };
  const __sq45Dart = (tipX,tipY) => {
    __sq45Line(tipX,tipY,tipX+20,tipY-2,1);
    __sq45Rect(tipX-1,tipY-1,2,2);
    __sq45Line(tipX+16,tipY-2,tipX+22,tipY-6,1);
    __sq45Line(tipX+16,tipY-1,tipX+23,tipY+3,1);
    __sq45Line(tipX+18,tipY-2,tipX+23,tipY-1,1);
  };
  // <<< PATCH:SC045_PINBALL_PROCEDURAL_SCENES END'''

s=sub_once(s,r'  // >>> PATCH:SC045_PINBALL_PROCEDURAL_SCENES START.*?  // <<< PATCH:SC045_PINBALL_PROCEDURAL_SCENES END',helpers,'helpers',re.S)

cases=r'''    // >>> PATCH:SC045_PINBALL_SCENE_TYPES START
    if (active && active.type === 'anticipationEyes') {
      const age=Math.max(0,now-active.start), dur=Math.max(700,Number(active.ms||1150)), reduce=__sqSc045ReducedMotion();
      const p=reduce?.36:Math.max(0,Math.min(1,age/dur));
      const text=(z2t||'CAN HE......?').toUpperCase();
      const px=Math.max(34,TEXT.topPx-8), w=measureTextPx(text,px,900);
      let x;
      if(reduce) x=28;
      else if(p<.22) x=Math.round(NATIVE_W+20-(p/.22)*(NATIVE_W-8));
      else if(p<.78) x=Math.round(28-((p-.22)/.56)*42);
      else x=Math.round(-14-((p-.78)/.22)*(w+36));
      const y=Math.floor(NATIVE_H*.60);
      drawTextPx(text,x,y,px,900);
      const blink=!reduce && ((Math.floor(age/170)%7)===5);
      const pupil=reduce?-1:(x<60?-2:(x>220?1:0));
      __sq45Line(101,6,110,5,1); __sq45Line(115,5,124,6,1);
      __sq45Eye(101,9,pupil,blink); __sq45Eye(115,9,pupil,blink);
      if(!reduce){
        const tick=Math.floor(age/95)%3;
        for(let i=0;i<3;i++) if(i!==tick) __sq45Rect(96+i*2,25+i%2,1,1);
      }
      thresholdNativeToAmber(); return;
    }
    if (active && active.type === 'dolphinSwim') {
      const age=Math.max(0,now-active.start), dur=Math.max(1300,Number(active.ms||2000)), reduce=__sqSc045ReducedMotion();
      const p=reduce?.52:Math.max(0,Math.min(1,age/dur)), phase=Math.floor(age/150)%2;
      const x1=reduce?27:(-78+p*216), y1=reduce?2:(8-Math.sin(Math.PI*p)*8);
      const x2=reduce?118:(186-p*214), y2=reduce?12:(11+Math.sin(Math.PI*p)*5);
      __sq45Dolphin(x1,y1,.72,false,phase);
      __sq45Dolphin(x2,y2,.46,true,phase+1);
      // scrolling water line and spray dots create the classic 1-bit cabinet motion cue
      for(let i=0;i<8;i++){
        const wx=((i*20-Math.round(p*70))%160+160)%160-16;
        __sq45Line(wx,30,wx+5,28,1); __sq45Line(wx+5,28,wx+10,30,1);
      }
      const sx=Math.round(x1+12), sy=Math.round(y1+20);
      [[0,0],[-3,-3],[-7,-1],[-10,-5],[-13,-2]].forEach(([dx,dy],i)=>{ if(reduce||((i+phase)%2===0)) __sq45Rect(sx+dx,sy+dy,1,1); });
      thresholdNativeToAmber(); return;
    }
    if (active && active.type === 'bullseyeHit') {
      const age=Math.max(0,now-active.start), dur=Math.max(850,Number(active.ms||1100)), reduce=__sqSc045ReducedMotion();
      const p=reduce?1:Math.max(0,Math.min(1,age/dur));
      const impactP=Math.min(1,p/.58), hit=p>=.58;
      const shake=(!reduce&&hit)?((Math.floor(age/55)%2)?1:-1):0;
      const cx=31+shake, cy=16;
      __sq45Circle(cx,cy,11,1); __sq45Circle(cx,cy,7,1); __sq45Circle(cx,cy,3,1);
      __sq45Line(cx-13,cy,cx+13,cy,1); __sq45Line(cx,cy-13,cx,cy+13,1);
      const tipX=reduce?31:Math.round(122-(122-31)*impactP);
      const tipY=reduce?16:Math.round(8+(16-8)*impactP);
      __sq45Dart(tipX,tipY);
      if(hit){
        const ray=Math.round(8+Math.min(1,(p-.58)/.24)*9);
        [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([dx,dy])=>__sq45Line(cx+dx*5,cy+dy*5,cx+dx*ray,cy+dy*ray,1));
        const flash=((Math.floor(age/90)%2)===0)||reduce;
        if(flash) drawTextPx('50',92*__SQ45_PX,24*__SQ45_PX,48,900);
      } else {
        // speed lines make the inbound dart read instantly at a glance
        __sq45Line(Math.min(126,tipX+28),tipY-4,Math.min(127,tipX+37),tipY-5,1);
        __sq45Line(Math.min(126,tipX+30),tipY+4,Math.min(127,tipX+39),tipY+5,1);
      }
      thresholdNativeToAmber(); return;
    }
    // <<< PATCH:SC045_PINBALL_SCENE_TYPES END'''

s=sub_once(s,r'    // >>> PATCH:SC045_PINBALL_SCENE_TYPES START.*?    // <<< PATCH:SC045_PINBALL_SCENE_TYPES END',cases,'scene cases',re.S)
write(path,s)

# refresh intentional legacy-patch evidence
mp=ROOT/'src/legacy/intentional-patches.json'
obj=json.loads(mp.read_text(encoding='utf-8'))
raw=(ROOT/path).read_bytes(); sha=hashlib.sha256(raw).hexdigest(); found=False
for item in obj.get('patches',[]):
    if item.get('file')==path:
        item['sha256']=sha; item['bytes']=len(raw)
        item['task']='SC-045 premium classic-pinball DMD art polish'
        item['reason']='Upgrade the approved anticipation-eyes, dolphin and bullseye scenes from thin vector-like canvas art to bold staged 128x32-logical-grid pinball animation while preserving the renderer API and interruption semantics.'
        item['protectedBehaviour']='Presentation only: scoring, game rules, mode routing, Supabase writes/schema/RLS, rankings, XP and persistence are untouched. Scenes remain interruptible through the existing DMD queue/hard-clear path and reduced-motion renders static equivalents.'
        found=True; break
if not found: raise SystemExit('inline-007 intentional patch entry missing')
mp.write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
print('SC-045 premium pinball art patch applied')
