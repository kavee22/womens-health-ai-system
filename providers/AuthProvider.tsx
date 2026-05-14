import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';

import { auth, db } from '@/lib/firebase';
import { loadStoredProfileAvatar } from '@/lib/profile-avatar';
import { loadStoredProfileName } from '@/lib/profile-name';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  profileAvatarUri: string | null;
  profileName: string | null;
  setProfileName: React.Dispatch<React.SetStateAction<string | null>>;
  setProfileAvatarUri: React.Dispatch<React.SetStateAction<string | null>>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileAvatarUri, setProfileAvatarUri] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAvatar() {
      if (!user) {
        setProfileAvatarUri(null);
        return;
      }

      const uri = await loadStoredProfileAvatar(user.uid);
      if (!cancelled) {
        setProfileAvatarUri(uri);
      }
    }

    hydrateAvatar();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateName() {
      if (!user) {
        setProfileName(null);
        return;
      }

      const localName = await loadStoredProfileName(user.uid);
      if (cancelled) return;

      if (localName) {
        setProfileName(localName);
        return;
      }

      setProfileName(user.displayName?.trim() || null);
    }

    hydrateName();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const profileRef = ref(db, `users/${user.uid}/profile/name`);
    const unsub = onValue(profileRef, (snap) => {
      const nextName = String(snap.val() ?? '').trim();
      if (!nextName) return;
      setProfileName(nextName);
    });
    return () => unsub();
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, profileAvatarUri, profileName, setProfileName, setProfileAvatarUri }),
    [user, initializing, profileAvatarUri, profileName],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

