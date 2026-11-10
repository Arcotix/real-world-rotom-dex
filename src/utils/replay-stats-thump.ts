import type { AudioPlayer } from 'expo-audio';

type ThumpPlayer = Pick<AudioPlayer, 'duration' | 'pause' | 'seekTo' | 'play'>;

export async function replayStatsThump(player: ThumpPlayer, canPlay: () => boolean) {
  // Android reports isLoaded=false after a clip ends. Its duration is still
  // available, and seeking back to zero makes that finished player ready again.
  if (!canPlay() || player.duration <= 0) return;
  player.pause();
  await player.seekTo(0);
  if (canPlay()) player.play();
}
