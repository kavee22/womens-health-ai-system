import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { inMemoryPersistence } from '@firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBLgBVpvLQ5b_LamiN8EG0ed0XPf5FSbZw',
  authDomain: 'appoinment-af670.firebaseapp.com',
  databaseURL: 'https://appoinment-af670-default-rtdb.firebaseio.com',
  projectId: 'appoinment-af670',
  storageBucket: 'appoinment-af670.firebasestorage.app',
  messagingSenderId: '1068747474363',
  appId: '1:1068747474363:web:9e7d4726ea8fddfbcbb09e',
  measurementId: 'G-9ZQ2P7BH46',
};

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: inMemoryPersistence,
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();

export const db = getDatabase(firebaseApp);

