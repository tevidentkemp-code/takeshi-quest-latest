from pathlib import Path
import hashlib, json

patch_path=Path('src/legacy/intentional-patches.json')
migration_path=Path('src/legacy/migration-manifest.json')
target=Path('src/legacy/scripts/inline-026.js')

patches=json.loads(patch_path.read_text())
migration=json.loads(migration_path.read_text())
entry=next((x for x in migration.get('scripts',[]) if x.get('file')==str(target)),None)
if not entry:
    raise SystemExit('inline-026 migration provenance missing')
body=target.read_bytes()
record={
    'file': str(target),
    'originalSha256': entry['sha256'],
    'sha256': hashlib.sha256(body).hexdigest(),
    'bytes': len(body),
    'task': 'SC-042 record and milestone integrity',
    'reason': 'Remove repeat-hit xN suffixes from Official Round Record holder presentation while preserving distinct holder/tie truth and all stored score history.',
    'protectedBehaviour': 'Round scores, darts, tie_count, Turbo records, scoring, modes, Supabase data/schema/RLS, ranking and persistence semantics are unchanged.'
}
arr=patches.setdefault('patches',[])
existing=[i for i,x in enumerate(arr) if x.get('file')==str(target)]
if len(existing)>1:
    raise SystemExit('duplicate inline-026 intentional patch entries')
if existing:
    arr[existing[0]]=record
else:
    arr.append(record)
patch_path.write_text(json.dumps(patches,indent=2,ensure_ascii=False)+'\n')
print(record)
