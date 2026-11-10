import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { POKEDEX_BACKGROUND_AUDIO } from '@/constants/artwork';

function BackgroundTrack() {
  const player = useAudioPlayer(POKEDEX_BACKGROUND_AUDIO, { downloadFirst: true, updateInterval: 1000 });
  const status = useAudioPlayerStatus(player);
  // On web, the initial status can say "loaded" before the downloaded source is attached.
  const ready = status.isLoaded && status.duration > 0;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let epoch = 0;
    const foreground = () => AppState.currentState === 'active' || AppState.currentState == null;
    /* eslint-disable react-hooks/immutability -- expo-audio configures its native player through mutable properties. */
    player.loop = true;
    player.volume = 0.3;
    /* eslint-enable react-hooks/immutability */
    const resume = () => {
      const pending = ++epoch;
      void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false })
        .then(() => {
          if (!cancelled && pending === epoch && foreground() && !player.playing) player.play();
        }).catch(() => { /* The Pokédex remains usable if audio is unavailable. */ });
    };
    const pause = () => { epoch++; player.pause(); };
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') resume(); else pause(); });
    resume();

    // A browser may block autoplay on a direct link; retry within the next user gesture.
    const retry = () => { if (!cancelled && foreground() && !player.playing) player.play(); };
    if (process.env.EXPO_OS === 'web') {
      document.addEventListener('pointerdown', retry);
      document.addEventListener('keydown', retry);
    }
    return () => {
      cancelled = true;
      epoch++;
      subscription.remove();
      player.pause();
      if (process.env.EXPO_OS === 'web') {
        document.removeEventListener('pointerdown', retry);
        document.removeEventListener('keydown', retry);
      }
    };
  }, [ready, player]);

  return null;
}

export function PokedexMusic() {
  const pathname = usePathname();
  // Keep a single player across box, entry, profile, and stats routes. Unmounting
  // on the camera route stops playback and releases the player automatically.
  return pathname === '/pokedex' || pathname.startsWith('/pokedex/') ? <BackgroundTrack /> : null;
}
