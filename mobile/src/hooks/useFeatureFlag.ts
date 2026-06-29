import { useAppSelector } from '../store';

/**
 * Returns whether a feature flag is enabled.
 * Fails open (returns true) while flags haven't loaded from the server yet.
 */
export function useFeatureFlag(key: string): boolean {
  const loaded = useAppSelector((s) => s.flags.loaded);
  const flags  = useAppSelector((s) => s.flags.flags);
  if (!loaded) return true;
  return flags[key] ?? true;
}
