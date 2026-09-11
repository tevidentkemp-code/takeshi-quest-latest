from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
old = """      if (classicThrowRace && records.length){
        ctx.save();
        ctx.setLineDash([5,4]); ctx.strokeStyle = records[0].color || 'rgba(255,214,110,.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(26, 19); ctx.lineTo(44, 19); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,224,150,.88)'; ctx.fillText('High Score', 49, 14);
        ctx.restore();
      }"""
new = """      if (classicThrowRace && records.length){
        ctx.save();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,224,150,.88)';
        const hsLabel = 'High Score';
        ctx.fillText(hsLabel, 26, 14);
        const hsDashX = 31 + ctx.measureText(hsLabel).width;
        ctx.setLineDash([5,4]); ctx.strokeStyle = records[0].color || 'rgba(255,214,110,.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hsDashX, 19); ctx.lineTo(hsDashX + 18, 19); ctx.stroke();
        ctx.restore();
      }"""
if old not in s:
    if new in s:
        print('SC-021 legend refinement already applied')
        raise SystemExit(0)
    raise SystemExit('Expected SC-021 legend block not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('Applied SC-021 High Score --- legend order refinement')
