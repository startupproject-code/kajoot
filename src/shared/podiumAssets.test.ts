import fs from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS } from './types';
import {
  FIREWORKS_DURATION_MS,
  PODIUM_STAGE_IMAGE,
  PODIUM_WINNER_ASSETS,
  resolvePodiumCharacterAsset,
} from './podiumAssets';

describe('podiumAssets', () => {
  it('stores optimized .webp stage and all registered winner assets on disk', () => {
    assert.equal(FIREWORKS_DURATION_MS, 5000);
    assert.match(PODIUM_STAGE_IMAGE, /\.webp$/);
    assert.equal(fs.existsSync(`public${PODIUM_STAGE_IMAGE}`), true);

    const expectedIds = [
      'char_03',
      'char_04',
      'char_05',
      'char_06',
      'char_07',
      'char_08',
      'char_09',
      'char_10',
      'char_11',
      'char_12',
    ] as const;

    assert.equal(Object.keys(PODIUM_WINNER_ASSETS).length, expectedIds.length);
    for (const id of expectedIds) {
      const assetPath = PODIUM_WINNER_ASSETS[id];
      assert.ok(assetPath, `Missing winner asset for ${id}`);
      assert.match(assetPath, /\.webp$/);
      assert.equal(fs.existsSync(`public${assetPath}`), true, `Missing file public${assetPath}`);
    }
  });

  it('uses dedicated trophy asset for registered characters in 1st place and falls back safely for all avatars', () => {
    for (const [id, expectedPath] of Object.entries(PODIUM_WINNER_ASSETS)) {
      const first = resolvePodiumCharacterAsset(id as typeof AVATARS[number]['id'], 1);
      assert.equal(first.isFullBodyWinner, true);
      assert.equal(first.imagePath, expectedPath);

      const second = resolvePodiumCharacterAsset(id as typeof AVATARS[number]['id'], 2);
      assert.equal(second.isFullBodyWinner, false);
      assert.match(second.imagePath, /\.webp$/);
      assert.equal(fs.existsSync(`public${second.imagePath}`), true);
    }

    for (const av of AVATARS) {
      for (const place of [1, 2, 3] as const) {
        const resolved = resolvePodiumCharacterAsset(av.id, place);
        assert.match(resolved.imagePath, /\.webp$/);
        assert.equal(fs.existsSync(`public${resolved.imagePath}`), true);
      }
    }
  });
});
