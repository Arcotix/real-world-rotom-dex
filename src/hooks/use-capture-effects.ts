import { useCallback, useEffect, useRef } from 'react';
import {
  cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const FADE = { duration: 120, easing: EASE_OUT, reduceMotion: ReduceMotion.Never };

export function useCaptureEffects({ width, height, viewport }: {
  width: number; height: number; viewport: { left: number; top: number; width: number; height: number };
}) {
  const reduced = useReducedMotion();
  const shade = useSharedValue(0);
  const rotation = useSharedValue(0);
  const ballScale = useSharedValue(1);
  const frameScale = useSharedValue(1);
  const frameOpacity = useSharedValue(1);
  const expansion = useSharedValue(0);
  const bezelOpacity = useSharedValue(1);
  const dim = useSharedValue(0);
  const waveScale = useSharedValue(1);
  const waveOpacity = useSharedValue(0);
  const lifecycle = useRef({ committed: false, started: 0, epoch: 0, expanded: false });
  const releaseFrame = useRef<number | null>(null);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());

  const wait = useCallback((milliseconds: number) => new Promise<void>((resolve) => {
    const timer = setTimeout(() => { timers.current.delete(timer); resolve(); }, milliseconds);
    timers.current.set(timer, resolve);
  }), []);

  const reset = useCallback(() => {
    lifecycle.current.epoch++;
    lifecycle.current.committed = false;
    if (releaseFrame.current !== null) cancelAnimationFrame(releaseFrame.current);
    for (const [timer, resolve] of timers.current) { clearTimeout(timer); resolve(); }
    timers.current.clear();
    for (const value of [shade, rotation, dim, waveOpacity, expansion]) { cancelAnimation(value); value.set(0); }
    for (const value of [ballScale, frameScale, frameOpacity, waveScale, bezelOpacity]) { cancelAnimation(value); value.set(1); }
  }, [ballScale, bezelOpacity, dim, expansion, frameOpacity, frameScale, rotation, shade, waveOpacity, waveScale]);

  useEffect(() => () => reset(), [reset]);

  const pressIn = useCallback(() => {
    if (lifecycle.current.committed) return;
    shade.set(withTiming(0.44, FADE));
    dim.set(withTiming(reduced ? 0.06 : 0.2, FADE));
    if (!reduced) ballScale.set(withSpring(0.94, { duration: 400, dampingRatio: 1 }));
  }, [ballScale, dim, reduced, shade]);

  const pressOut = useCallback(() => {
    // Pressable fires press-out before onPress. Give a committed release one
    // frame to start spinning; a cancelled press simply returns to idle.
    releaseFrame.current = requestAnimationFrame(() => {
      if (lifecycle.current.committed) return;
      shade.set(withTiming(0, FADE));
      dim.set(withTiming(0, FADE));
      ballScale.set(withSpring(1, { duration: 400, dampingRatio: 1 }));
    });
  }, [ballScale, dim, shade]);

  const startSpin = useCallback(() => {
    shade.set(withTiming(0.44, FADE));
    dim.set(withTiming(reduced ? 0.1 : 0.22, FADE));
    rotation.set(0);
    if (!reduced) rotation.set(withRepeat(withTiming(360, {
      duration: 680, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
    }), -1, false));
  }, [dim, reduced, rotation, shade]);

  const expand = useCallback(() => {
    if (!lifecycle.current.committed || lifecycle.current.expanded) return;
    lifecycle.current.expanded = true;
    const motion = { duration: reduced ? 180 : 660, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.Never };
    expansion.set(withTiming(1, motion));
    bezelOpacity.set(withTiming(0, motion));
    if (!reduced) {
      frameScale.set(withTiming(4.5, motion));
      frameOpacity.set(withTiming(0, motion));
    }
  }, [bezelOpacity, expansion, frameOpacity, frameScale, reduced]);

  const begin = useCallback(() => {
    lifecycle.current = { committed: true, started: Date.now(), epoch: lifecycle.current.epoch + 1, expanded: false };
    if (releaseFrame.current !== null) cancelAnimationFrame(releaseFrame.current);
    startSpin();
    expansion.set(0);
    bezelOpacity.set(1);
    ballScale.set(withTiming(1, { ...FADE, duration: 180 }));
    if (!reduced) {
      waveScale.set(1);
      waveOpacity.set(withDelay(110, withSequence(withTiming(0.8, { ...FADE, duration: 70 }), withTiming(0, { ...FADE, duration: 600 }))));
      waveScale.set(withDelay(110, withTiming(10, { duration: 800, easing: EASE_OUT, reduceMotion: ReduceMotion.Never })));
    }
  }, [ballScale, bezelOpacity, expansion, reduced, startSpin, waveOpacity, waveScale]);

  const resumeProcessing = useCallback(() => {
    lifecycle.current = { committed: true, started: Date.now() - 1400, epoch: lifecycle.current.epoch + 1, expanded: false };
    startSpin();
    expand();
  }, [expand, startSpin]);

  const finish = useCallback(async (reveal = false) => {
    if (!lifecycle.current.committed) return;
    const epoch = lifecycle.current.epoch;
    // Let the 1.79-second capture sound and the reveal complete, even if saving fails quickly.
    await wait(Math.max(0, 1800 - (Date.now() - lifecycle.current.started)));
    if (epoch !== lifecycle.current.epoch) return;
    cancelAnimation(rotation);
    if (reveal) {
      // Keep the dimmed capture beneath the outward pixel wipe. The reveal
      // owns the handoff, so there is no black frame or premature entry here.
      shade.set(withTiming(0, FADE));
      rotation.set(0);
      lifecycle.current.committed = false;
      return;
    }
    rotation.set(withTiming(reduced ? 0 : 360, { ...FADE, duration: 240 }));
    shade.set(withTiming(0, { ...FADE, duration: 240 }));
    dim.set(withTiming(0, { ...FADE, duration: 330 }));
    expansion.set(withTiming(0, { ...FADE, duration: reduced ? 0 : 480 }));
    bezelOpacity.set(withTiming(1, { ...FADE, duration: 350 }));
    frameScale.set(withTiming(1, { ...FADE, duration: reduced ? 0 : 480 }));
    frameOpacity.set(withTiming(1, { ...FADE, duration: 350 }));
    ballScale.set(withSpring(1, { duration: 400, dampingRatio: 1 }));
    await wait(reduced ? 240 : 480);
    if (epoch !== lifecycle.current.epoch) return;
    rotation.set(0);
    lifecycle.current.committed = false;
  }, [ballScale, bezelOpacity, dim, expansion, frameOpacity, frameScale, reduced, rotation, shade, wait]);

  const startScale = Math.max(viewport.width / width, viewport.height / height);
  const offsetX = viewport.left + viewport.width / 2 - width / 2;
  const offsetY = viewport.top + viewport.height / 2 - height / 2;
  const photoStyle = useAnimatedStyle(() => ({ transform: reduced ? [] : [
    { translateX: offsetX * (1 - expansion.get()) },
    { translateY: offsetY * (1 - expansion.get()) },
    { scale: startScale + (1 - startScale) * expansion.get() },
  ] }));
  const bezelTopStyle = useAnimatedStyle(() => ({ opacity: bezelOpacity.get(), transform: [{ translateY: reduced ? 0 : -viewport.top * expansion.get() }] }));
  const bezelBottomStyle = useAnimatedStyle(() => ({ opacity: bezelOpacity.get(), transform: [{ translateY: reduced ? 0 : (height - viewport.top - viewport.height) * expansion.get() }] }));
  const bezelLeftStyle = useAnimatedStyle(() => ({ opacity: bezelOpacity.get(), transform: [{ translateX: reduced ? 0 : -viewport.left * expansion.get() }] }));
  const bezelRightStyle = useAnimatedStyle(() => ({ opacity: bezelOpacity.get(), transform: [{ translateX: reduced ? 0 : (width - viewport.left - viewport.width) * expansion.get() }] }));
  const ballStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }, { scale: ballScale.get() }] }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.get() }));
  const frameStyle = useAnimatedStyle(() => ({ opacity: frameOpacity.get(), transform: [{ scale: frameScale.get() }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));
  const waveStyle = useAnimatedStyle(() => ({ opacity: waveOpacity.get(), transform: [{ scale: waveScale.get() }] }));

  return { pressIn, pressOut, begin, expand, resumeProcessing, finish, reset, photoStyle, bezelTopStyle, bezelBottomStyle, bezelLeftStyle, bezelRightStyle, ballStyle, shadeStyle, frameStyle, dimStyle, waveStyle };
}
