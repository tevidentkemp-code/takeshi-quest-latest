from pathlib import Path

src_path = Path('tools/sc029_apply_original.py')
src = src_path.read_text()
start_marker = "\nqa = Path('.github/workflows/setup-qa.yml')\n"
end_marker = "\nPath('tools/ui-smoke/verify-sc029.js').write_text"
start = src.find(start_marker)
end = src.find(end_marker, start + 1)
if start < 0 or end < 0:
    raise SystemExit('SC-029 wrapper: setup-qa block markers not found')
exec(compile(src[:start] + src[end:], str(src_path), 'exec'))
