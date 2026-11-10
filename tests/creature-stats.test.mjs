import assert from 'node:assert/strict';
import test from 'node:test';
import { createCreatureStats, STAT_AXES, statPoint } from '../src/utils/creature-stats.ts';

test('six independent random draws include both 70 and 140', () => {
  const draws = [0, 1 - Number.EPSILON, 0.5, 0.25, 0.75, 0.1];
  let calls = 0;
  const stats = createCreatureStats(() => draws[calls++]);
  assert.equal(calls, 6);
  assert.deepEqual(Object.values(stats), [70, 140, 105, 87, 123, 77]);
  assert.deepEqual(Object.keys(stats), STAT_AXES.map(axis => axis.key));
});

test('70 is halfway to each vertex, 140 is the vertex, and intermediate values lie on the same spoke', () => {
  for (let index = 0; index < 6; index++) {
    const center = statPoint(index, 0);
    const vertex = statPoint(index, 140);
    for (const value of [70, 105, 140]) {
      const point = statPoint(index, value);
      assert.ok(Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - 100 * value / 140) < 1e-9);
      const crossProduct = (point.x - center.x) * (vertex.y - center.y) - (point.y - center.y) * (vertex.x - center.x);
      assert.ok(Math.abs(crossProduct) < 1e-9);
    }
  }
});
