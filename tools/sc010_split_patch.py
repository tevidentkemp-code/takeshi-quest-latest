from pathlib import Path

root = Path(__file__).resolve().parents[1]
index_path = root / 'index.html'
fixture_path = root / 'tools' / 'ui-smoke' / 'pstats-fixture.js'

index = index_path.read_text(encoding='utf-8')
old = """  async forPlayerId(playerId){
    try{
      if (!playerId) return { available:false, map:{} };
      const SB = window.sb || window.__sb || null;
      if (!SB || typeof SB.from !== 'function') return { available:false, map:{} };
      const { data, error } = await SB.from('v_player_achievements').select('code,cnt,xp').eq('player_id', playerId);
      if (error || !Array.isArray(data)) return { available:false, map:{} };
      const map = {}; data.forEach(r => { map[r.code] = { cnt: Number(r.cnt) || 0, xp: Number(r.xp) || 0 }; });
      return { available:true, map };
    }catch(_){ return { available:false, map:{} }; }
  },
  async forName(name){"""
new = """  async forPlayerId(playerId){
    try{
      if (!playerId) return { available:false, map:{} };
      const SB = window.sb || window.__sb || null;
      if (!SB || typeof SB.from !== 'function') return { available:false, map:{} };
      const [baseRes, dgRes] = await Promise.all([
        SB.from('v_ach_base').select('code,cnt,xp').eq('player_id', playerId),
        SB.from('v_ach_david_goliath').select('code,cnt,xp').eq('player_id', playerId)
      ]);
      if (!baseRes || baseRes.error || !Array.isArray(baseRes.data) || !dgRes || dgRes.error || !Array.isArray(dgRes.data)) {
        return { available:false, map:{} };
      }
      const rows = [...baseRes.data, ...dgRes.data];
      const map = {};
      rows.forEach(r => {
        if (!r || !r.code) return;
        map[r.code] = { cnt:Number(r.cnt) || 0, xp:Number(r.xp) || 0 };
      });
      const distinctBaseCodes = new Set(rows.map(r => r && r.code).filter(Boolean)).size;
      if (distinctBaseCodes >= 10) map.collector = { cnt:1, xp:150 };
      if (distinctBaseCodes >= 20) map.trophy_hunter = { cnt:1, xp:350 };
      return { available:true, map };
    }catch(_){ return { available:false, map:{} }; }
  },
  async forName(name){"""
if index.count(old) != 1:
    raise SystemExit(f'Expected exactly one SQ_ACH per-player hot-path block, found {index.count(old)}')
index = index.replace(old, new, 1)
index_path.write_text(index, encoding='utf-8')

fixture = fixture_path.read_text(encoding='utf-8')
old_fixture = """    v_player_achievements: [
      { code: 'giant_slayer', cnt: 1, xp: 10 },
      { code: 'champion', cnt: 1, xp: 10 },
    ],
    v_player_misfires: ["""
new_fixture = """    v_player_achievements: [
      { code: 'giant_slayer', cnt: 1, xp: 10 },
      { code: 'champion', cnt: 1, xp: 10 },
    ],
    // SC-010 positive-history client path reads these two source views in parallel.
    v_ach_base: [
      { code: 'giant_slayer', cnt: 1, xp: 10 },
      { code: 'champion', cnt: 1, xp: 10 },
    ],
    v_ach_david_goliath: [],
    v_player_misfires: ["""
if fixture.count(old_fixture) != 1:
    raise SystemExit(f'Expected exactly one Player Stats achievement fixture block, found {fixture.count(old_fixture)}')
fixture = fixture.replace(old_fixture, new_fixture, 1)
fixture_path.write_text(fixture, encoding='utf-8')

print('SC-010 split-read patch applied: index.html + pstats fixture')
