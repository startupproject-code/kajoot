import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFirebaseAuthCode, mapGoogleAuthError } from './authErrors';

describe('mapGoogleAuthError', () => {
  it('maps auth/admin-restricted-operation to explicit Moderator permission denied Thai message', () => {
    const res = mapGoogleAuthError({ code: 'auth/admin-restricted-operation' });
    assert.equal(res.code, 'auth/admin-restricted-operation');
    assert.equal(res.message, 'บัญชี Gmail นี้ไม่ได้รับสิทธิ์เข้าใช้งานสำหรับ Moderator');
    assert.equal(res.shouldLog, true);
  });

  it('maps auth/popup-closed-by-user to clear cancellation message', () => {
    const res = mapGoogleAuthError({ code: 'auth/popup-closed-by-user' });
    assert.equal(res.code, 'auth/popup-closed-by-user');
    assert.equal(res.message, 'ยกเลิกการเข้าสู่ระบบด้วย Google');
    assert.equal(res.shouldLog, false);
  });

  it('suppresses duplicate alerts for auth/cancelled-popup-request', () => {
    const res = mapGoogleAuthError({ code: 'auth/cancelled-popup-request' });
    assert.equal(res.code, 'auth/cancelled-popup-request');
    assert.equal(res.message, null);
    assert.equal(res.shouldLog, false);
  });

  it('maps auth/network-request-failed to Thai network error message', () => {
    const res = mapGoogleAuthError({ code: 'auth/network-request-failed' });
    assert.equal(res.code, 'auth/network-request-failed');
    assert.equal(res.message, 'การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาลองใหม่อีกครั้ง');
    assert.equal(res.shouldLog, true);
  });

  it('maps auth/popup-blocked and unknown errors cleanly while marking shouldLog true', () => {
    const blocked = mapGoogleAuthError({ code: 'auth/popup-blocked' });
    assert.equal(blocked.shouldLog, true);
    assert.ok(blocked.message?.includes('Pop-up'));

    const unknown = mapGoogleAuthError(new Error('Unexpected failure'));
    assert.equal(unknown.code, null);
    assert.equal(unknown.message, 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง');
    assert.equal(unknown.shouldLog, true);
    assert.equal(extractFirebaseAuthCode('raw string'), null);
  });
});
