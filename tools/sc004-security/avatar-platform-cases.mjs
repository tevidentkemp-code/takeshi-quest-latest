/** Avatar boundary cases for the caller's isolated real Supabase transport.
 * Uses the production client and read SDK; no credentials or authority mocks. */
import assert from 'node:assert/strict';

export async function runAvatarCases({client, read, check, run = crypto.randomUUID().slice(0, 8)}) {
  const savedPlayer = async id => {
    const {data, error} = await read.from('players')
      .select('id,name,avatar_id').eq('id', id).single();
    if (error) throw error;
    return data;
  };
  const rejectedAvatar = error => error.status === 400;
  const invalidAvatars = [0, 33, 32.5, '32'];
  let match, baselinePlayers, acceptedRoster;

  await check('SC057 public registration persists appended avatars 30–32 exactly', async () => {
    for (const avatar_id of [30, 31, 32]) {
      const name = `SC004_AVATAR_${run}_REGISTER_${avatar_id}`;
      const player = await client.createPlayer({name, avatar_id});
      assert.equal(player.avatar_id, avatar_id);
      assert.deepEqual(await savedPlayer(player.id), {id: player.id, name, avatar_id});
    }
  });

  await check('SC057 invalid registration avatars deny without creating a fallback profile', async () => {
    for (const [index, avatar_id] of invalidAvatars.entries()) {
      const name = `SC004_AVATAR_${run}_INVALID_${index}`;
      await assert.rejects(() => client.createPlayer({name, avatar_id}), rejectedAvatar);
      const {data, error} = await read.from('players').select('id').eq('name', name);
      if (error) throw error;
      assert.deepEqual(data, []);
    }
  });

  await check('SC057 scoped roster accepts avatars 30–32 without changing global profiles', async () => {
    baselinePlayers = [];
    for (const avatar_id of [1, 2, 3]) {
      baselinePlayers.push(await client.createPlayer({
        name: `SC004_AVATAR_${run}_ROSTER_${avatar_id}`, avatar_id,
      }));
    }
    match = await client.createMatch({
      mode: 'official', match_format: 'series', target_wins: 3,
      roster: baselinePlayers.map(player => ({id: player.id})),
    }, crypto.randomUUID());
    const desired = baselinePlayers.map((player, index) => ({
      id: player.id, name: player.name, avatar_id: 30 + index,
    }));
    const changed = await client.command('update_roster', match.match_id, {roster: desired});
    acceptedRoster = changed.roster;
    assert.deepEqual(acceptedRoster.map(player => player.avatar_id), [30, 31, 32]);
    const resumed = await client.command('resume', match.match_id);
    assert.deepEqual(resumed.roster, acceptedRoster);
    for (const player of baselinePlayers) {
      assert.equal((await savedPlayer(player.id)).avatar_id, player.avatar_id);
    }
  });

  await check('SC057 invalid roster avatars deny atomically and retain the prior match display', async () => {
    assert(match && acceptedRoster, 'A valid issued roster is required before the negative cases');
    for (const avatar_id of invalidAvatars) {
      const desired = acceptedRoster.map((player, index) => ({
        id: player.id, name: player.name, avatar_id: index === 1 ? avatar_id : player.avatar_id,
      }));
      await assert.rejects(
        () => client.command('update_roster', match.match_id, {roster: desired}), rejectedAvatar,
      );
      assert.deepEqual((await client.command('resume', match.match_id)).roster, acceptedRoster);
      for (const player of baselinePlayers) {
        assert.equal((await savedPlayer(player.id)).avatar_id, player.avatar_id);
      }
    }
  });

  await check('SC057 authenticated admin profile accepts avatar 32 and rejects 33 without partial mutation', async () => {
    const player = await client.createPlayer({name: `SC004_AVATAR_${run}_ADMIN`, avatar_id: 1});
    const changed = await client.admin({
      operation: 'update_player', player_id: player.id, profile: {avatar_id: 32},
    });
    assert.equal(changed.player.id, player.id);
    assert.equal(changed.player.avatar_id, 32);
    assert.equal((await savedPlayer(player.id)).avatar_id, 32);
    await assert.rejects(() => client.admin({
      operation: 'update_player', player_id: player.id, profile: {avatar_id: 33},
    }), rejectedAvatar);
    assert.equal((await savedPlayer(player.id)).avatar_id, 32);
  });
}
