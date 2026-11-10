import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { STATS_THUMP_AUDIO } from '@/constants/artwork';
import { replayStatsThump } from '@/utils/replay-stats-thump';

export function useStatsThump(closingRef: RefObject<boolean>) {
  // Three voices preserve the full tail of the 984ms effect at 420ms stamp intervals.
  const first = useAudioPlayer(STATS_THUMP_AUDIO, { downloadFirst: true });
  const second = useAudioPlayer(STATS_THUMP_AUDIO, { downloadFirst: true });
  const third = useAudioPlayer(STATS_THUMP_AUDIO, { downloadFirst: true });
  const players = useMemo(() => [first, second, third], [first, second, third]);
  const nextVoice = useRef(0);
  const epoch = useRef(0);
  const mounted = useRef(false);
  const stop = useCallback(() => { epoch.current++; players.forEach(player => player.pause()); }, [players]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stop();
    });
    return () => { mounted.current = false; subscription.remove(); stop(); };
  }, [stop]);

  const play = useCallback(() => {
    if (closingRef.current || !mounted.current || (AppState.currentState != null && AppState.currentState !== 'active')) return;
    const player = players[nextVoice.current % players.length];
    if (player.duration <= 0) return;
    nextVoice.current++;
    const pending = epoch.current;
    void replayStatsThump(player, () => pending === epoch.current && mounted.current && !closingRef.current && (AppState.currentState == null || AppState.currentState === 'active'))
      .catch(() => { /* A missed sound must not delay or interrupt a stamp. */ });
  }, [closingRef, players]);
  return { play, stop };
}
