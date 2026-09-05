from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
old = """    achPanel.__ppReplay = () => {
      timers.forEach(clearTimeout); timers = [];
      if (__ppReduced){ vcB.textContent = String(earnedN); vfill.style.width = Math.round(pctDone * 100) + '%'; chips.forEach(c => c.classList.add('in')); return; }
      vcB.textContent = '0'; vfill.style.width = '0%';
      chips.forEach(c => c.classList.remove('in', 'shine'));
      countUp(vcB, String(earnedN), 1000);
      requestAnimationFrame(() => requestAnimationFrame(() => { vfill.style.width = Math.round(pctDone * 100) + '%'; }));
      chips.forEach((c, i) => { timers.push(setTimeout(() => { c.classList.add('in', 'shine'); }, 120 + i * 90)); });
    };
"""
new = """    achPanel.__ppReplay = () => {
      timers.forEach(clearTimeout); timers = [];
      if (!achAvailable){ vcB.textContent = '—'; vfill.style.width = '0%'; chips.forEach(c => c.classList.remove('in', 'shine')); return; }
      if (__ppReduced){ vcB.textContent = String(earnedN); vfill.style.width = Math.round(pctDone * 100) + '%'; chips.forEach(c => c.classList.add('in')); return; }
      vcB.textContent = '0'; vfill.style.width = '0%';
      chips.forEach(c => c.classList.remove('in', 'shine'));
      countUp(vcB, String(earnedN), 1000);
      requestAnimationFrame(() => requestAnimationFrame(() => { vfill.style.width = Math.round(pctDone * 100) + '%'; }));
      chips.forEach((c, i) => { timers.push(setTimeout(() => { c.classList.add('in', 'shine'); }, 120 + i * 90)); });
    };
"""
count = s.count(old)
if count != 1:
    raise SystemExit(f'vault replay patch expected 1 match, found {count}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('patched vault unavailable replay state')
