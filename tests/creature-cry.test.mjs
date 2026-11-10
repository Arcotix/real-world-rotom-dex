import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseCreatureCry, CREATURE_CRIES } from '../src/utils/creature-cry.ts';

test('all six local cries can be selected, including both ends of the random range', () => {
  assert.equal(CREATURE_CRIES.length, 6);
  assert.equal(new Set(CREATURE_CRIES).size, 6);
  assert.deepEqual(CREATURE_CRIES.map((_, index) => chooseCreatureCry(() => index / 6)), CREATURE_CRIES);
  assert.equal(chooseCreatureCry(() => 1 - Number.EPSILON), 'bellossom');
});
