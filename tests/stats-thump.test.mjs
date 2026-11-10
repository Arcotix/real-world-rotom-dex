import assert from 'node:assert/strict';
import test from 'node:test';
import { replayStatsThump } from '../src/utils/replay-stats-thump.ts';

function androidPlayer() {
  return {
    duration: 0.984, isLoaded: true, plays: 0, seeks: [],
    pause() {},
    async seekTo(time) { this.seeks.push(time); this.isLoaded = true; },
    play() { assert.equal(this.isLoaded, true); this.plays++; this.isLoaded = false; },
  };
}

test('all five stamps play when Android marks completed voices unloaded', async () => {
  const voices = [androidPlayer(), androidPlayer(), androidPlayer()];
  for (let stamp = 0; stamp < 5; stamp++) {
    const voice = voices[stamp % voices.length];
    if (stamp >= 3) assert.equal(voice.isLoaded, false, 'Legendary and Mythical reuse finished players');
    await replayStatsThump(voice, () => true);
  }
  assert.deepEqual(voices.map(voice => voice.plays), [2, 2, 1]);
  assert.deepEqual(voices.map(voice => voice.seeks), [[0, 0], [0, 0], [0]]);
});

test('closing or hiding Stats during a seek cancels the pending sound', async () => {
  const voice = androidPlayer();
  let active = true;
  voice.seekTo = async () => { active = false; };
  await replayStatsThump(voice, () => active);
  assert.equal(voice.plays, 0);
});

test('an asset without loaded metadata does not seek or play', async () => {
  const voice = androidPlayer();
  voice.duration = 0;
  await replayStatsThump(voice, () => true);
  assert.deepEqual(voice.seeks, []);
  assert.equal(voice.plays, 0);
});
