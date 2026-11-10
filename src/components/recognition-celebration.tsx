import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

const COLORS = ['#ffe477', '#76f5ff', '#ff86ba', '#a9ffb0', '#b9a0ff', '#ffffff'];
const PIECES = Array.from({ length: 56 }, (_, index) => ({
  index, side: index % 2 === 0 ? -1 : 1, star: Math.floor(index / 2) % 4 === 0,
  spread: ((index * 37) % 101) / 100,
  lift: ((index * 61) % 97) / 96,
  delay: ((index * 13) % 9) / 100,
}));
type Piece = (typeof PIECES)[number];

function Particle({ piece, clock, width, height, reduced }: {
  piece: Piece; clock: SharedValue<number>; width: number; height: number; reduced: boolean;
}) {
  const size = piece.star ? 18 + piece.spread * 9 : 6 + piece.spread * 5;
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (clock.get() - piece.delay) / (1 - piece.delay)));
    const direction = piece.side === -1 ? 1 : -1;
    return {
      opacity: clock.get() < piece.delay ? 0 : Math.min(1, t * 22) * Math.max(0, Math.min(1, (1 - t) * 4)),
      transform: reduced ? [] : [
        { translateX: direction * width * (0.18 + piece.spread * 0.9) * t },
        { translateY: -height * (1.5 + piece.lift * 0.9) * t + height * 2.5 * t * t },
        { rotate: `${direction * (180 + piece.spread * 540) * t}deg` },
        { rotateX: `${piece.star ? 0 : t * 540}deg` },
      ],
    };
  });
  const color = COLORS[piece.index % COLORS.length];
  return (
    <Animated.View
      testID={`recognition-${piece.star ? 'star' : 'confetti'}-${piece.index}`}
      style={[{ position: 'absolute', left: piece.side === -1 ? 8 : width - size - 8, bottom: 40,
        width: size, height: piece.star ? size : size * 0.48,
        backgroundColor: piece.star ? 'transparent' : color, borderRadius: piece.star ? 0 : 2 }, style]}
    >
      {piece.star ? <Svg width={size} height={size} viewBox="0 0 24 24"><Polygon points="12,0 15.5,7.6 24,9 17.8,15 19.3,23.5 12,19.5 4.7,23.5 6.2,15 0,9 8.5,7.6" fill={color} /></Svg> : null}
    </Animated.View>
  );
}

export function RecognitionCelebration({ onComplete }: { onComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.set(0);
    clock.set(withTiming(1, { duration: reduced ? 900 : 2200, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
    const timer = setTimeout(onComplete, reduced ? 950 : 2300);
    return () => { clearTimeout(timer); cancelAnimation(clock); };
  }, [clock, onComplete, reduced]);
  const pieces = reduced ? PIECES.filter((piece) => piece.index === 0 || piece.index === 5).map((piece) => ({ ...piece, star: true })) : PIECES;
  return (
    <View testID="recognition-celebration" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {pieces.map((piece) => <Particle key={piece.index} piece={piece} clock={clock} width={width} height={height} reduced={reduced} />)}
    </View>
  );
}
