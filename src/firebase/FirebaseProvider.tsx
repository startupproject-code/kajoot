import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  clearLastActivityMs,
  INACTIVITY_TIMEOUT_MS,
  isSessionExpired,
  readLastActivityMs,
  writeLastActivityMs,
} from '../utils/sessionTimeout';
import { mapGoogleAuthError } from './authErrors';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebaseClient';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  sessionExpiredNotice: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

const EXPIRED_SESSION_MESSAGE =
  'ออกจากระบบอัตโนมัติเนื่องจากไม่ได้เข้าใช้งานเกิน 60 นาที กรุณาเข้าสู่ระบบด้วย Google ใหม่อีกครั้ง';

async function syncUserProfile(user: User): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email.split('@')[0] || 'ผู้เล่น').trim().slice(0, 80);
  const email = user.email.trim().slice(0, 160);
  const photoUrl = user.photoURL?.trim().slice(0, 512);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email,
        ...(photoUrl ? { photoUrl } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        email,
        ...(photoUrl ? { photoUrl } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(readLastActivityMs() ?? Date.now());
  const lastWriteThrottleRef = useRef<number>(0);
  const signingInRef = useRef<boolean>(false);

  const performAutoLogout = useCallback(async () => {
    clearLastActivityMs();
    setSessionExpiredNotice(EXPIRED_SESSION_MESSAGE);
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // ignore signOut failure during auto-expiry cleanup
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      if (nextUser) {
        const storedLast = readLastActivityMs();
        if (storedLast !== null && isSessionExpired(storedLast, Date.now(), INACTIVITY_TIMEOUT_MS)) {
          void performAutoLogout();
          setAuthReady(true);
          return;
        }
        const now = Date.now();
        lastActivityRef.current = now;
        writeLastActivityMs(now);
        setSessionExpiredNotice(null);
        setUser(nextUser);
        setAuthReady(true);
        void syncUserProfile(nextUser).catch((err) => {
          console.error('Failed to sync user profile:', err);
        });
      } else {
        setUser(null);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [performAutoLogout]);

  // Track Moderator activity & automatically log out after 60 minutes of inactivity
  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      const now = Date.now();
      if (isSessionExpired(lastActivityRef.current, now, INACTIVITY_TIMEOUT_MS)) {
        void performAutoLogout();
        return;
      }
      lastActivityRef.current = now;
      if (now - lastWriteThrottleRef.current >= 15_000) {
        lastWriteThrottleRef.current = now;
        writeLastActivityMs(now);
      }
    };

    const checkInactivity = () => {
      const latest = Math.max(lastActivityRef.current, readLastActivityMs() ?? 0);
      if (latest > 0 && isSessionExpired(latest, Date.now(), INACTIVITY_TIMEOUT_MS)) {
        void performAutoLogout();
      }
    };

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'mousemove',
      'touchstart',
      'scroll',
    ];
    for (const ev of events) {
      window.addEventListener(ev, recordActivity, { passive: true });
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const intervalId = window.setInterval(checkInactivity, 15_000);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, recordActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [user, performAutoLogout]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    if (signingInRef.current) {
      return null;
    }

    signingInRef.current = true;
    setSigningIn(true);
    setAuthError(null);
    setSessionExpiredNotice(null);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const now = Date.now();
      lastActivityRef.current = now;
      lastWriteThrottleRef.current = now;
      writeLastActivityMs(now);
      setSessionExpiredNotice(null);
      setUser(cred.user);
      void syncUserProfile(cred.user).catch((syncErr) => {
        console.error('Failed to sync user profile after sign-in:', syncErr);
      });
      return cred.user;
    } catch (error) {
      const mapped = mapGoogleAuthError(error);
      if (mapped.shouldLog) {
        console.error('Google sign-in error:', mapped.code ?? 'unknown', error);
      }
      if (mapped.message) {
        setAuthError(mapped.message);
      }
      return null;
    } finally {
      signingInRef.current = false;
      setSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    clearLastActivityMs();
    setSessionExpiredNotice(null);
    await signOut(auth);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setSessionExpiredNotice(null);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        signingIn,
        authError,
        sessionExpiredNotice,
        signInWithGoogle,
        signOutUser,
        clearAuthError,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
