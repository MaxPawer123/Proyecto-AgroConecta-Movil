export const ExpoKeepAwakeTag = 'expo-keep-awake-shim';

export function useKeepAwake(): void {
  // No-op shim to prevent dev-time crashes on devices where keep-awake activation fails.
}

export async function activateKeepAwake(): Promise<void> {
  return;
}

export async function activateKeepAwakeAsync(): Promise<void> {
  return;
}

export async function deactivateKeepAwake(): Promise<void> {
  return;
}

export default {
  ExpoKeepAwakeTag,
  useKeepAwake,
  activateKeepAwake,
  activateKeepAwakeAsync,
  deactivateKeepAwake,
};
