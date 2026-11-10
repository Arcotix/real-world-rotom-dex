import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle,
  useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
export type CaptureProgress = 'idle' | 'working' | 'saved' | 'failed';

export function CaptureEdgeLoader({ phase, active }: { phase: CaptureProgress; active: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const expansion = useSharedValue(1);
  const lap = useSharedValue(0);
  const radius = 26;
  const borderWidth = Math.max(1, width - 16);
  const borderHeight = Math.max(1, height - 16);
  const perimeter = 2 * (borderWidth + borderHeight - 4 * radius) + 2 * Math.PI * radius;

  useEffect(() => {
    cancelAnimation(lap);
    if (!active || phase === 'idle') {
      opacity.set(0);
      expansion.set(1);
    } else if (phase === 'working') {
      expansion.set(1);
      opacity.set(withTiming(1, { duration: 120, reduceMotion: ReduceMotion.Never }));
      lap.set(0);
      if (!reduced) lap.set(withRepeat(withTiming(1, {
        duration: 2100, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
      }), -1, false));
    } else {
      // On save, the blue rail lifts beyond the glass and dissolves over 0.5s.
      const duration = phase === 'saved' ? 500 : 150;
      const easing = Easing.bezier(0.23, 1, 0.32, 1);
      expansion.set(withTiming(reduced ? 1 : 1.035, { duration, easing }));
      opacity.set(withTiming(0, { duration, easing, reduceMotion: ReduceMotion.Never }));
    }
    return () => { cancelAnimation(lap); cancelAnimation(opacity); cancelAnimation(expansion); };
  }, [active, expansion, lap, opacity, phase, reduced]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: expansion.get() }] }));
  const runnerProps = useAnimatedProps(() => ({ strokeDashoffset: -lap.get() * perimeter }));
  const headProps = useAnimatedProps(() => ({ strokeDashoffset: -lap.get() * perimeter - perimeter * 0.29 }));
  const geometry = { x: 8, y: 8, width: borderWidth, height: borderHeight, rx: radius, fill: 'none' };

  return (
    <Animated.View
      testID="capture-edge-loader"
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel="Saving photo and bringing your creature to life"
      accessibilityState={{ busy: phase === 'working' }}
      accessibilityElementsHidden={phase !== 'working' || !active}
      importantForAccessibility={phase === 'working' && active ? 'yes' : 'no-hide-descendants'}
      style={[{ position: 'absolute', inset: 0 }, containerStyle]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="capture-edge-stripes" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(35)">
            <Rect width={20} height={20} fill="#25c9e8" />
            <Rect width={9} height={20} fill="#91f5ff" />
          </Pattern>
        </Defs>
        <Rect {...geometry} stroke="#13a9cf" strokeWidth={11} opacity={0.16} />
        <Rect {...geometry} stroke="url(#capture-edge-stripes)" strokeWidth={5} opacity={0.22} />
        <AnimatedRect {...geometry} animatedProps={runnerProps} stroke="#2ce6ff" strokeWidth={13} opacity={0.22} strokeDasharray={[perimeter * 0.32, perimeter * 0.68]} />
        <AnimatedRect testID="capture-edge-runner" {...geometry} animatedProps={runnerProps} stroke="url(#capture-edge-stripes)" strokeWidth={6} strokeDasharray={[perimeter * 0.32, perimeter * 0.68]} />
        <AnimatedRect {...geometry} animatedProps={headProps} stroke="#e5fdff" strokeWidth={2} strokeLinecap="round" strokeDasharray={[perimeter * 0.03, perimeter * 0.97]} />
      </Svg>
    </Animated.View>
  );
}
