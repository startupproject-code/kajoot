export interface MappedAuthError {
  code: string | null;
  message: string | null;
  shouldLog: boolean;
}

export function extractFirebaseAuthCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const rawCode = (error as { code?: unknown }).code;
    if (typeof rawCode === 'string' && rawCode.trim().length > 0) {
      return rawCode.trim();
    }
  }
  return null;
}

export function mapGoogleAuthError(error: unknown): MappedAuthError {
  const code = extractFirebaseAuthCode(error);

  switch (code) {
    case 'auth/admin-restricted-operation':
      return {
        code,
        message: 'บัญชี Gmail นี้ไม่ได้รับสิทธิ์เข้าใช้งานสำหรับ Moderator',
        shouldLog: true,
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        message: 'ยกเลิกการเข้าสู่ระบบด้วย Google',
        shouldLog: false,
      };
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: null,
        shouldLog: false,
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: 'การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาลองใหม่อีกครั้ง',
        shouldLog: true,
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาต Pop-up แล้วกดอีกครั้ง',
        shouldLog: true,
      };
    case 'auth/user-disabled':
      return {
        code,
        message: 'บัญชี Google นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
        shouldLog: true,
      };
    default:
      return {
        code,
        message: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง',
        shouldLog: true,
      };
  }
}
