from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
repls=[
("ctx.beginPath(); ctx.moveTo(26, 15); ctx.lineTo(44, 15); ctx.stroke();\n        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,224,150,.88)'; ctx.fillText('High Score', 49, 10);",
 "ctx.beginPath(); ctx.moveTo(26, 19); ctx.lineTo(44, 19); ctx.stroke();\n        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,224,150,.88)'; ctx.fillText('High Score', 49, 14);"),
("const padL = 26, padR = 12, padT = classicThrowRace ? 25 : (packet ? 19 : 8), padB = 18, W = cssW - padL - padR, H = cssH - padT - padB;",
 "const padL = 26, padR = 12, padT = classicThrowRace ? 29 : (packet ? 19 : 8), padB = 18, W = cssW - padL - padR, H = cssH - padT - padB;"),
("ctx.font = '800 7px system-ui,sans-serif'; ctx.fillStyle = 'rgba(160,178,208,.58)'; ctx.textAlign = 'left'; ctx.fillText('START', sx, padT + H + 4);",
 "ctx.font = '800 7px system-ui,sans-serif'; ctx.fillStyle = 'rgba(160,178,208,.58)'; ctx.textAlign = 'center'; ctx.fillText('START', sx, padT + H + 4);")
]
for old,new in repls:
    if s.count(old)!=1: raise SystemExit(f'expected one refinement anchor, found {s.count(old)}: {old[:60]}')
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
# Keep the synthetic ceiling assertion aligned with the Classic plot top.
v=Path('tools/ui-smoke/verify-classic-visual-fit.js')
t=v.read_text(encoding='utf-8')
old="topHits:record.path.filter(p=>Math.abs(p[1]-(classicThrowRace?25:19))<.75).length,"
new="topHits:record.path.filter(p=>Math.abs(p[1]-(classicThrowRace?29:19))<.75).length,"
if t.count(old)!=1: raise SystemExit(f'test refinement anchor count {t.count(old)}')
Path('tools/ui-smoke/verify-classic-visual-fit.js').write_text(t.replace(old,new,1),encoding='utf-8')
print('SC-021 legend/start spacing refined')
