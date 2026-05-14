import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const AVATAR_DIRECTORY = new Directory(Paths.document, 'profile-avatars');

function storageKey(uid: string) {
  return `profile-avatar:${uid}`;
}

function normalizeExtension(extension: string | undefined) {
  if (!extension) return '.jpg';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

function avatarFile(uid: string, extension: string | undefined) {
  return new File(AVATAR_DIRECTORY, `${uid}${normalizeExtension(extension)}`);
}

async function ensureAvatarDirectory() {
  AVATAR_DIRECTORY.create({ intermediates: true, idempotent: true });
}

export async function loadStoredProfileAvatar(uid: string) {
  const uri = await AsyncStorage.getItem(storageKey(uid));
  if (!uri) return null;

  const file = new File(uri);
  if (!file.exists) {
    await AsyncStorage.removeItem(storageKey(uid));
    return null;
  }

  return uri;
}

export async function saveProfileAvatar(uid: string, sourceUri: string) {
  await ensureAvatarDirectory();

  const currentUri = await AsyncStorage.getItem(storageKey(uid));
  if (currentUri) {
    const currentFile = new File(currentUri);
    if (currentFile.exists) {
      currentFile.delete();
    }
  }

  const sourceFile = new File(sourceUri);
  const destination = avatarFile(uid, sourceFile.extension || '.jpg');
  if (destination.exists) {
    destination.delete();
  }

  sourceFile.copy(destination);
  await AsyncStorage.setItem(storageKey(uid), destination.uri);
  return destination.uri;
}

export async function clearProfileAvatar(uid: string) {
  const currentUri = await AsyncStorage.getItem(storageKey(uid));
  if (currentUri) {
    const currentFile = new File(currentUri);
    if (currentFile.exists) {
      currentFile.delete();
    }
  }

  await AsyncStorage.removeItem(storageKey(uid));
}
