import { type ComponentProps } from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type CaptureButtonProps = {
  label: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  ballStyle: ComponentProps<typeof Animated.View>['style'];
  shadeStyle: ComponentProps<typeof Animated.View>['style'];
  waveStyle: ComponentProps<typeof Animated.View>['style'];
};

export function CaptureButton({ label, disabled, busy, onPress, onPressIn, onPressOut, ballStyle, shadeStyle, waveStyle }: CaptureButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={8}
      pressRetentionOffset={16}
      style={{ width: 84, height: 84, opacity: disabled && !busy ? 0.5 : 1, borderRadius: 42 }}
    >
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 4, borderRadius: 40, borderWidth: 2, borderColor: '#39e5ff' }, waveStyle]} />
      <Animated.View testID="capture-ball" style={[{ width: 84, height: 84 }, ballStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 96 96" pointerEvents="none">
        <Circle cx={48} cy={48} r={42} fill="#fffaf6" />
        <Path d="M6 48a42 42 0 0 1 84 0Z" fill="#f2484b" />
        <Line x1={6} y1={48} x2={90} y2={48} stroke="#17232c" strokeWidth={8} />
        <Circle cx={48} cy={48} r={42} fill="none" stroke="#17232c" strokeWidth={5} />
        <Circle cx={48} cy={48} r={13} fill="#fffaf6" stroke="#17232c" strokeWidth={6} />
        <Circle cx={48} cy={48} r={5} fill="none" stroke="#c2cbd0" strokeWidth={1.5} />
      </Svg>
        <Animated.View testID="capture-ball-shade" pointerEvents="none" style={[{ position: 'absolute', inset: 4, borderRadius: 40, backgroundColor: '#000' }, shadeStyle]} />
      </Animated.View>
    </Pressable>
  );
}
