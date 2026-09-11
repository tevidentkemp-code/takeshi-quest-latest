from pathlib import Path
p = Path('tools/ui-smoke/verify-sc009.js')
text = p.read_text()
old = "  await page.click('.pp-misfire-detail button');\n  await page.waitForFunction(() => !document.querySelector('.pp-misfire-detail'));"
new = """  await page.evaluate(() => {\n    const d = document.querySelector('.pp-misfire-detail');\n    const close = d && Array.from(d.querySelectorAll('button')).find(b => /^close$/i.test((b.textContent || '').trim()));\n    if (!close) throw new Error('Misfire Close button missing');\n    close.click();\n  });\n  await page.waitForFunction(() => !document.querySelector('.pp-misfire-detail'));"""
if text.count(old) != 1:
    raise SystemExit(f'Expected one legacy Misfire generic-button close block; found {text.count(old)}')
text = text.replace(old, new, 1)
p.write_text(text)
