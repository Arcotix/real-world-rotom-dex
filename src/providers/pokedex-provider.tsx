import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { MENU_OPEN_AUDIO } from '@/constants/artwork';
import { fetchPokedex, type SavedEntry } from '@/utils/pokedex';

type PokedexState = {
  entries: SavedEntry[] | null; loading: boolean; error: string | null; unavailableCount: number;
  refresh: () => Promise<void>;
  playMenuOpenSound: () => void;
};
const PokedexContext = createContext<PokedexState | null>(null);

export function PokedexProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SavedEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const request = useRef<AbortController | null>(null);
  // This player lives above the routes so navigation cannot cut off the cue.
  const menuSound = useAudioPlayer(MENU_OPEN_AUDIO, { downloadFirst: true });
  const soundEpoch = useRef(0);
  const playMenuOpenSound = useCallback(() => {
    const epoch = ++soundEpoch.current;
    menuSound.pause();
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false })
      .then(async () => {
        if (epoch !== soundEpoch.current) return;
        await menuSound.seekTo(0);
        if (epoch === soundEpoch.current && (AppState.currentState === 'active' || AppState.currentState == null)) menuSound.play();
      }).catch(() => { /* Navigation remains available if playback is blocked. */ });
  }, [menuSound]);
  useEffect(() => {
    const stop = () => { soundEpoch.current++; menuSound.pause(); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    const invalidate = () => { soundEpoch.current++; };
    return () => { subscription.remove(); invalidate(); };
  }, [menuSound]);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(new Error('Connection timed out. Try refreshing your Pokédex.')), 15000);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPokedex(controller.signal);
      if (controller !== request.current) return;
      setEntries(data.entries);
      setUnavailableCount(data.unavailableCount);
    } catch (reason) {
      if (controller === request.current) setError(controller.signal.aborted
        ? 'The connection timed out. Try refreshing your Pokédex.'
        : reason instanceof Error ? reason.message : 'Could not connect to your Pokédex.');
    } finally {
      clearTimeout(timeout);
      if (controller === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => () => { const pending = request.current; request.current = null; pending?.abort(); }, []);
  const value = useMemo(() => ({ entries, loading, error, unavailableCount, refresh, playMenuOpenSound }), [entries, loading, error, unavailableCount, refresh, playMenuOpenSound]);
  return <PokedexContext value={value}>{children}</PokedexContext>;
}

export function usePokedex() {
  const value = use(PokedexContext);
  if (!value) throw new Error('Pokédex provider is missing.');
  return value;
}
