import fs from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS } from './types';
import {
  FIREWORKS_DURATION_MS,
  PODIUM_SECOND_ASSETS,
  PODIUM_STAGE_IMAGE,
  PODIUM_WINNER_ASSETS,
  resolvePodiumCharacterAsset,
} from './podiumAssets';

describe('podiumAssets', () => {
  it('stores optimized .webp stage, all 19 winner assets, and 2nd-place assets on disk', () => {
    assert.equal(FIREWORKS_DURATION_MS, 5000);
    assert.match(PODIUM_STAGE_IMAGE, /\.webp$/);
    assert.equal(fs.existsSync(`public${PODIUM_STAGE_IMAGE}`), true);

    assert.equal(Object.keys(PODIUM_WINNER_ASSETS).length, AVATARS.length);
    for (const av of AVATARS) {
      const assetPath = PODIUM_WINNER_ASSETS[av.id];
      assert.ok(assetPath, `Missing winner asset for ${av.id}`);
      assert.match(assetPath, /\.webp$/);
      assert.equal(fs.existsSync(`public${assetPath}`), true, `Missing file public${assetPath}`);
    }

    assert.equal(PODIUM_SECOND_ASSETS.char_19, '/assets/podium/second/char_19.webp');
    for (const [id, assetPath] of Object.entries(PODIUM_SECOND_ASSETS)) {
      assert.ok(assetPath, `Missing 2nd-place asset for ${id}`);
      assert.match(assetPath, /\.webp$/);
      assert.equal(fs.existsSync(`public${assetPath}`), true, `Missing file public${assetPath}`);
    }
  });

  it('uses dedicated full-body assets for registered 1st & 2nd place characters and falls back safely for all avatars', () => {
    for (const [id, expectedPath] of Object.entries(PODIUM_WINNER_ASSETS)) {
      const first = resolvePodiumCharacterAsset(id as typeof AVATARS[number]['id'], 1);
      assert.equal(first.isFullBodyWinner, true);
      assert.equal(first.imagePath, expectedPath);
    }

    const char19Second = resolvePodiumCharacterAsset('char_19', 2);
    assert.equal(char19Second.isFullBodyWinner, true);
    assert.equal(char19Second.imagePath, '/assets/podium/second/char_19.webp');

    const char03Second = resolvePodiumCharacterAsset('char_03', 2);
    assert.equal(char03Second.isFullBodyWinner, false);
    assert.match(char03Second.imagePath, /\.webp$/);

    for (const av of AVATARS) {
      for (const place of [1, 2, 3] as const) {
        const resolved = resolvePodiumCharacterAsset(av.id, place);
        assert.match(resolved.imagePath, /\.webp$/);
        assert.equal(fs.existsSync(`public${resolved.imagePath}`), true);
      }
    }
  });
});
