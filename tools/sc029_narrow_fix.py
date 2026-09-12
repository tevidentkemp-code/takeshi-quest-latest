from pathlib import Path
p = Path('index.html')
s = p.read_text()
old = "@media(max-width:360px){\n  .sq-player-stats-profile .pp-tabs{ gap:4px; }\n  .sq-player-stats-profile .pp-tab{ padding-inline:4px; font-size:11px; }\n}"
new = "@media(max-width:360px){\n  .sq-player-stats-profile .pp-tabs{ gap:4px; }\n  .sq-player-stats-profile .pp-tab{ padding-inline:2px; font-size:9px; letter-spacing:0; }\n}"
if s.count(old) != 1:
    raise SystemExit(f'narrow Player Stats tab block: expected 1 match, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
