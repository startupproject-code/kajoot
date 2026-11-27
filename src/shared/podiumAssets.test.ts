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
  it('stores optimized .webp stage and char_12 winner assets on disk', () => {
    assert.equal(FIREWORKS_DURATION_MS, 5000);
    assert.match(PODIUM_STAGE_IMAGE, /\.webp$/);
    assert.equal(fs.existsSync(`public${PODIUM_STAGE_IMAGE}`), true);

    const char12Path = PODIUM_WINNER_ASSETS.char_12;
    assert.ok(char12Path);
    assert.match(char12Path, /\.webp$/);
    assert.equal(fs.existsSync(`public${char12Path}`), true);
  });

  it('uses dedicated trophy asset only when char_12 is 1st place and falls back safely for all avatars', () => {
    const char12First = resolvePodiumCharacterAsset('char_12', 1);
    assert.equal(char12First.isFullBodyWinner, true);
    assert.equal(char12First.imagePath, '/assets/podium/winners/char_12.webp');

    const char12Second = resolvePodiumCharacterAsset('char_12', 2);
    assert.equal(char12Second.isFullBodyWinner, false);
    assert.match(char12Second.imagePath, /\.webp$/);
    assert.equal(fs.existsSync(`public${char12Second.imagePath}`), true);

    for (const av of AVATARS) {
      for (const place of [1, 2, 3] as const) {
        const resolved = resolvePodiumCharacterAsset(av.id, place);
        assert.match(resolved.imagePath, /\.webp$/);
        assert.equal(fs.existsSync(`public${resolved.imagePath}`), true);
      }
    }
  });
});
