import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INACTIVITY_TIMEOUT_MS,
  isSessionExpired,
} from './sessionTimeout';

describe('Moderator 60-minute inactivity session timeout', () => {
  it('uses an exact 60-minute timeout constant', () => {
    assert.equal(INACTIVITY_TIMEOUT_MS, 3_600_000);
  });

  it('keeps active sessions valid strictly under 60 minutes', () => {
    const base = 1_700_000_000_000;
    assert.equal(isSessionExpired(base, base), false);
    assert.equal(isSessionExpired(base, base + INACTIVITY_TIMEOUT_MS - 1), false);
  });

  it('expires sessions at or beyond 60 minutes of inactivity', () => {
    const base = 1_700_000_000_000;
    assert.equal(isSessionExpired(base, base + INACTIVITY_TIMEOUT_MS), true);
    assert.equal(isSessionExpired(base, base + INACTIVITY_TIMEOUT_MS + 60_000), true);
  });

  it('does not falsely expire when no prior timestamp exists', () => {
    assert.equal(isSessionExpired(null, Date.now()), false);
    assert.equal(isSessionExpired(undefined, Date.now()), false);
    assert.equal(isSessionExpired(0, Date.now()), false);
  });
});
