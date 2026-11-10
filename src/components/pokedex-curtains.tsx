import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, type SharedValue, useAnimatedStyle,
  useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { ClipPath, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

function Curtain({ side, width, height, progress, reduced }: {
  side: 'left' | 'right'; width: number; height: number; progress: SharedValue<number>; reduced: boolean;
}) {
  const right = side === 'right';
  const panelWidth = Math.ceil(width / 16) * 8 + 24;
  const panelHeight = height + 48;
  const steps = Array.from({ length: Math.ceil(panelHeight / 16) }, (_, row) =>
    `H${panelWidth - (row % 2 ? 8 : 0)}V${Math.min(panelHeight, (row + 1) * 16)}`).join('');
  const outline = `M0 0H${panelWidth}${steps}H0Z`;
  const id = `dex-curtain-${side}`;
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? progress.get() : 1,
    transform: reduced ? [] : [{ rotate: `${(right ? -1 : 1) * 98 * (1 - progress.get())}deg` }],
  }));
  return (
    <Animated.View testID={`pokedex-curtain-${side}`} pointerEvents="none" style={[{
      position: 'absolute', top: -16, left: right ? undefined : -16, right: right ? -16 : undefined,
      width: panelWidth, height: panelHeight, transformOrigin: [right ? panelWidth : 0, 0, 0],
    }, style]}>
      <Svg width={panelWidth} height={panelHeight} viewBox={`0 0 ${panelWidth} ${panelHeight}`}>
        <Defs>
          <Pattern id={`${id}-folds`} width="48" height="32" patternUnits="userSpaceOnUse">
            <Rect width="48" height="32" fill="#153955" />
            <Rect width="8" height="32" fill="#081d33" />
            <Rect x="8" width="8" height="32" fill="#295e7c" />
            <Rect x="32" width="8" height="32" fill="#102b46" />
            <Rect x="40" width="8" height="32" fill="#36748e" />
            <Rect x="18" y="8" width="4" height="4" fill="#78bfd0" opacity={0.16} />
          </Pattern>
          <ClipPath id={`${id}-clip`}><Path d={outline} /></ClipPath>
        </Defs>
        <G transform={right ? `translate(${panelWidth} 0) scale(-1 1)` : undefined}>
          <Path d={outline} fill="#081d33" />
          <G clipPath={`url(#${id}-clip)`}>
            <Rect width={panelWidth} height={panelHeight} fill={`url(#${id}-folds)`} />
            <Path d={outline} fill="none" stroke="#071626" strokeWidth="12" />
            <Path d={outline} fill="none" stroke="#b3edee" strokeWidth="4" />
            <Rect width={panelWidth} height="24" fill="#0a233a" />
            <Rect y="24" width={panelWidth} height="8" fill="#6faab8" />
          </G>
        </G>
      </Svg>
    </Animated.View>
  );
}

export function PokedexCurtains({ active, entryReady, onCovered, onComplete }: {
  active: boolean; entryReady: boolean; onCovered: () => void; onComplete: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    const motion = { easing: EASE_IN_OUT, reduceMotion: ReduceMotion.Never };
    if (!entryReady) {
      progress.set(withTiming(1, { ...motion, duration: reduced ? 150 : 520 }, (done) => {
        if (done) scheduleOnRN(onCovered);
      }));
    } else {
      // The entry mounts while both curtains are closed. Let its existing
      // entrance animations settle behind them before drawing them back.
      progress.set(withDelay(reduced ? 180 : 520, withTiming(0, {
        ...motion, duration: reduced ? 180 : 620,
      }, (done) => { if (done) scheduleOnRN(onComplete); }), ReduceMotion.Never));
    }
    return () => cancelAnimation(progress);
  }, [active, entryReady, onComplete, onCovered, progress, reduced]);

  return (
    <View testID="pokedex-curtains" accessibilityRole="progressbar" accessibilityLabel="Opening Pokédex"
      accessibilityState={{ busy: true }} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Curtain side="left" width={width} height={height} progress={progress} reduced={reduced} />
      <Curtain side="right" width={width} height={height} progress={progress} reduced={reduced} />
    </View>
  );
}
