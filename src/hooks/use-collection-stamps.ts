import { useEffect } from 'react';
import { cancelAnimation, Easing, Extrapolation, interpolate, ReduceMotion, type SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const STAMP_LEAD_MS = 180;
export const STAMP_INTERVAL_MS = 420;
export const STAMP_IMPACT_MS = 140;
const STAMP_SETTLE_MS = 220;
const DURATION_MS = STAMP_LEAD_MS + 4 * STAMP_INTERVAL_MS + STAMP_IMPACT_MS + STAMP_SETTLE_MS;

// One UI-thread clock keeps every stamp and the surrounding panel's recoil in sync.
export function useCollectionStamps({ ready, revealProgress, closing, reduced, onImpact }: {
  ready: boolean; revealProgress: SharedValue<number>; closing: SharedValue<boolean>; reduced: boolean; onImpact: () => void;
}) {
  const clock = useSharedValue(-1);
  useAnimatedReaction(
    () => closing.get() ? -1 : ready && revealProgress.get() >= 0.999 ? 1 : 0,
    (stage, previous) => {
      if (stage === -1) cancelAnimation(clock);
      else if (stage === 1 && previous !== 1) {
        clock.set(0);
        clock.set(withTiming(reduced ? 150 : DURATION_MS, {
          duration: reduced ? 150 : DURATION_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
        }));
      }
    },
  );
  useEffect(() => () => cancelAnimation(clock), [clock]);

  useAnimatedReaction(
    () => {
      if (closing.get()) return -1;
      if (reduced) return clock.get() >= 150 ? 0 : -1;
      // Trigger one frame after contact, using the same clock as the panel recoil.
      return Math.max(-1, Math.min(4, Math.floor((clock.get() - STAMP_LEAD_MS - STAMP_IMPACT_MS - 16) / STAMP_INTERVAL_MS)));
    },
    (index, previous) => {
      if (index >= 0 && index !== previous) scheduleOnRN(onImpact);
    },
  );

  const shakeStyle = useAnimatedStyle(() => {
    const time = clock.get();
    const index = Math.min(4, Math.floor((time - STAMP_LEAD_MS - STAMP_IMPACT_MS) / STAMP_INTERVAL_MS));
    const impact = time - STAMP_LEAD_MS - index * STAMP_INTERVAL_MS - STAMP_IMPACT_MS;
    const shaking = !reduced && !closing.get() && index >= 0 && impact <= STAMP_SETTLE_MS;
    const x = shaking ? interpolate(impact, [0, 24, 52, 84, 124, 168, 220], [0, 6, -5, 3, -2, 1, 0], Extrapolation.CLAMP) : 0;
    const y = shaking ? interpolate(impact, [0, 24, 62, 110, 170, 220], [0, 4, -2, 2, -1, 0], Extrapolation.CLAMP) : 0;
    return { transform: [{ translateX: x }, { translateY: y }, { rotate: `${x * 0.06}deg` }] };
  });
  return { clock, shakeStyle };
}

export function useStampStyle(clock: SharedValue<number>, index: number, reduced: boolean) {
  return useAnimatedStyle(() => {
    const time = clock.get();
    if (reduced) return { opacity: Math.max(0, Math.min(1, time / 150)), transform: [] };
    const local = time - STAMP_LEAD_MS - index * STAMP_INTERVAL_MS;
    const direction = index % 2 ? 1 : -1;
    return {
      opacity: interpolate(local, [0, 36], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(local, [0, 140, 210, 360], [-26, 2, -1, 0], Extrapolation.CLAMP) },
        { scale: interpolate(local, [0, 140, 210, 360], [1.5, 0.95, 1.025, 1], Extrapolation.CLAMP) },
        { rotate: `${interpolate(local, [0, 140, 210, 360], [direction * 9, -direction * 1.5, direction * 0.5, 0], Extrapolation.CLAMP)}deg` },
      ],
    };
  });
}
