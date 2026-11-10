import { useCallback, useEffect, type RefObject } from 'react';
import { Keyboard } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const LINE_MS = 60;
const EXPAND_MS = 660;
const SCAN_MS = 780;

// Shared by specimen details, profile, and stats so their opening/closing stays identical.
export function useEntryMenuAnimation(panelWidth: number, onClosed: () => void, closingRef: RefObject<boolean>) {
  const reduced = useReducedMotion();
  const expansion = useSharedValue(reduced ? 1 : 0.025);
  const scan = useSharedValue(reduced ? 1 : 0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.set(withTiming(1, { duration: reduced ? 150 : LINE_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    if (!reduced) {
      expansion.set(withDelay(LINE_MS, withTiming(1, { duration: EXPAND_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never));
      scan.set(withDelay(LINE_MS + EXPAND_MS, withTiming(1, { duration: SCAN_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never));
    }
    return () => { cancelAnimation(expansion); cancelAnimation(scan); cancelAnimation(opacity); };
  }, [expansion, opacity, reduced, scan]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    cancelAnimation(scan);
    cancelAnimation(expansion);
    cancelAnimation(opacity);
    if (reduced) {
      opacity.set(withTiming(0, { duration: 150, reduceMotion: ReduceMotion.Never }, done => { if (done) scheduleOnRN(onClosed); }));
    } else {
      scan.set(withTiming(0, { duration: SCAN_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
      expansion.set(withDelay(SCAN_MS, withTiming(0.025, { duration: EXPAND_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never));
      opacity.set(withDelay(SCAN_MS + EXPAND_MS, withTiming(0, { duration: LINE_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }, done => {
        if (done) scheduleOnRN(onClosed);
      }), ReduceMotion.Never));
    }
  }, [closingRef, expansion, opacity, onClosed, reduced, scan]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: reduced ? [] : [{ scaleY: expansion.get() }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: expansion.get() > 0.999 ? 1 : 0 }));
  const leftScanStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -panelWidth / 2 * scan.get() }] }));
  const rightScanStyle = useAnimatedStyle(() => ({ transform: [{ translateX: panelWidth / 2 * scan.get() }] }));
  return { close, reduced, backdropStyle, panelStyle, contentStyle, leftScanStyle, rightScanStyle, revealProgress: scan };
}
