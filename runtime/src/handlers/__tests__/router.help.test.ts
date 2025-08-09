import test from 'node:test';
import assert from 'node:assert/strict';
import { routeInteraction } from '../interaction_router.js';
import type { Interaction } from '../../discord/types.js';

test('help command returns help message', () => {
  const interaction: Interaction = {
    type: 2,
    id: '1',
    token: 't',
    application_id: 'a',
    data: { name: 'help' },
  };

  const res = routeInteraction(interaction);
  assert.equal(res.type, 4);
  assert.ok(res.data?.content?.includes('/ask'));
  assert.equal(res.data?.flags, 64);
});

test('ping interaction', () => {
  const interaction: Interaction = {
    type: 1,
    id: '1',
    token: 't',
    application_id: 'a',
  };

  const res = routeInteraction(interaction);
  assert.deepEqual(res, { type: 1 });
});
