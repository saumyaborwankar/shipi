import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

function webStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available');
  }
  return localStorage;
}

export async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    return webStorage().getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    webStorage().setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    webStorage().removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function readStateFile(filename: string): Promise<string | null> {
  if (isWeb) {
    return webStorage().getItem(filename);
  }
  const file = new File(Paths.document, filename);
  if (!file.exists) {
    return null;
  }
  return file.text();
}

export async function writeStateFile(filename: string, content: string): Promise<void> {
  if (isWeb) {
    webStorage().setItem(filename, content);
    return;
  }
  const file = new File(Paths.document, filename);
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  file.write(content);
}
