import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// หากต้องการกำหนดค่า Firebase / Google API Key เองในโค้ดหรือไฟล์ .env (เช่น ก่อนอัปขึ้น GitHub)
// ให้ใส่ค่าจริงแทนที่ 'xxxxxxxx' ด้านล่างหรือผ่าน VITE_FIREBASE_* environment variables
const MANUAL_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'xxxxxxxx',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'xxxxxxxx',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'xxxxxxxx',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'xxxxxxxx',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'xxxxxxxx',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'xxxxxxxx',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || 'xxxxxxxx',
};

const firebaseConfig =
  MANUAL_FIREBASE_CONFIG.apiKey && MANUAL_FIREBASE_CONFIG.apiKey !== 'xxxxxxxx'
    ? MANUAL_FIREBASE_CONFIG
    : appletConfig;

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
