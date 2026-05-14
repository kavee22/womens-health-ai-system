import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(uid: string) {
  return `profile-name:${uid}`;
}

export async function loadStoredProfileName(uid: string) {
  const stored = await AsyncStorage.getItem(storageKey(uid));
  const trimmed = stored?.trim();
  return trimmed ? trimmed : null;
}

export async function saveStoredProfileName(uid: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(storageKey(uid));
    return null;
  }

  await AsyncStorage.setItem(storageKey(uid), trimmed);
  return trimmed;
}

export async function clearStoredProfileName(uid: string) {
  await AsyncStorage.removeItem(storageKey(uid));
}
