import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, Ellipse, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { POKEDEX_FONTS } from '@/constants/typography';

// A circle drawn in square steps, like a handheld's low-resolution battle wipe.
// The shape is static; only its scale and opacity change on the UI thread.
const PIXEL_DISC = Array.from({ length: 64 }, (_, row) => {
  const halfWidth = Math.floor(Math.sqrt(32 ** 2 - (row - 31.5) ** 2));
  return `M${32 - halfWidth} ${row}h${halfWidth * 2}v1H${32 - halfWidth}Z`;
}).join('');

const FLASH_EXPAND_MS = 440;
const FLASH_HOLD_MS = 1000;
const FLASH_FADE_MS = 480;
const FLASH_FADE_START_MS = FLASH_EXPAND_MS + FLASH_HOLD_MS;
const REVEAL_DURATION_MS = FLASH_FADE_START_MS + FLASH_FADE_MS;

function SpotlightBackdrop() {
  return (
    <Svg testID="creature-spotlight" pointerEvents="none" width="100%" height="100%" viewBox="0 0 400 850" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
      <Defs>
        <LinearGradient id="reveal-blue" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#061a32" />
          <Stop offset="0.3" stopColor="#114e7c" />
          <Stop offset="0.62" stopColor="#328fbb" />
          <Stop offset="1" stopColor="#bbf2ff" />
        </LinearGradient>
        <RadialGradient id="reveal-halo" cx="50%" cy="72%" rx="78%" ry="62%">
          <Stop offset="0" stopColor="#ccfaff" stopOpacity={0.7} />
          <Stop offset="0.55" stopColor="#62d6f0" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#05162d" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="reveal-floor">
          <Stop offset="0" stopColor="#fff" />
          <Stop offset="0.4" stopColor="#f0feff" stopOpacity={0.98} />
          <Stop offset="0.7" stopColor="#b3f4ff" stopOpacity={0.72} />
          <Stop offset="1" stopColor="#80d9f5" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="reveal-shadow">
          <Stop offset="0" stopColor="#1a638c" stopOpacity={0.33} />
          <Stop offset="1" stopColor="#1a638c" stopOpacity={0} />
        </RadialGradient>
        <Pattern id="reveal-dither" width="8" height="8" patternUnits="userSpaceOnUse">
          <Rect width="2" height="2" fill="#c2f5ff" opacity={0.08} />
          <Rect x="4" y="4" width="2" height="2" fill="#041f3c" opacity={0.12} />
        </Pattern>
      </Defs>
      <Rect width="400" height="850" fill="url(#reveal-blue)" />
      <Rect width="400" height="850" fill="url(#reveal-halo)" />
      <Rect width="400" height="850" fill="url(#reveal-dither)" />
      <Ellipse cx="200" cy="692" rx="340" ry="200" fill="url(#reveal-floor)" />
      <Ellipse cx="200" cy="615" rx="112" ry="17" fill="url(#reveal-shadow)" />
    </Svg>
  );
}

export function CreatureReveal({ imageUri, name, active, celebration, onCry, onFlashStart, onRevealed, onOpen, onImageError }: {
  imageUri: string; name: string; active: boolean; onCry: () => void; onFlashStart: () => void; onRevealed: () => void; onOpen: () => void; onImageError: () => void;
  celebration?: ReactNode;
}) {
  const [fontLoaded] = useFonts(POKEDEX_FONTS);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const [imageReady, setImageReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const opened = useRef(false);
  const portraitSize = Math.min(width * 0.86, height * 0.51, 520);
  // Farthest corner from the flash origin; add room for the stepped edge.
  const flashDiameter = Math.ceil((Math.hypot(width / 2, height * 0.54) + 80) / 16) * 32;

  useEffect(() => {
    if (!active || !imageReady || finished) return;
    function complete() {
      setFinished(true);
      onRevealed();
    }
    clock.set(0);
    onFlashStart();
    const duration = reduced ? 300 : REVEAL_DURATION_MS;
    clock.set(withTiming(duration, {
      duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
    }, (done) => { if (done) scheduleOnRN(complete); }));
    return () => cancelAnimation(clock);
  }, [active, clock, finished, imageReady, onFlashStart, onRevealed, reduced]);

  useEffect(() => {
    if (!active || !finished) return;
    const timer = setTimeout(() => setShowHint(true), 2200);
    const cryTimer = setTimeout(onCry, 700);
    const messageTimer = setTimeout(() => setShowMessage(true), 1300);
    return () => { clearTimeout(timer); clearTimeout(messageTimer); clearTimeout(cryTimer); };
  }, [active, finished, onCry]);

  const sceneStyle = useAnimatedStyle(() => ({
    opacity: reduced ? clock.get() / 300 : clock.get() >= FLASH_EXPAND_MS ? 1 : 0,
  }));
  const portraitStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : Math.min(1, Math.max(0, (clock.get() - FLASH_FADE_START_MS) / 360)),
  }));
  const flashStyle = useAnimatedStyle(() => {
    const t = clock.get();
    const step = Math.floor(Math.min(1, t / FLASH_EXPAND_MS) * 28) / 28;
    return {
      opacity: t === 0 ? 0 : t <= FLASH_FADE_START_MS ? 1 : Math.max(0, (REVEAL_DURATION_MS - t) / FLASH_FADE_MS),
      // Render at the final resolution, then shrink: scaling up a 64px native
      // SVG would blur the square edges on iOS and Android.
      transform: [{ scale: (64 + step * (flashDiameter - 64)) / flashDiameter }],
    };
  });

  return (
    <View testID="creature-reveal" accessibilityViewIsModal style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Animated.View testID="creature-reveal-scene" style={[{ position: 'absolute', inset: 0, backgroundColor: '#061a32' }, sceneStyle]}>
        <SpotlightBackdrop />
        <Animated.View testID="creature-reveal-portrait" style={[{
          position: 'absolute', width: portraitSize, height: portraitSize,
          left: (width - portraitSize) / 2, bottom: height * 0.27,
        }, portraitStyle]}>
          <Image source={{ uri: imageUri }} accessibilityLabel={name} contentFit="contain" contentPosition="bottom"
            onDisplay={() => setImageReady(true)} onError={onImageError} transition={0} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      </Animated.View>
      {!reduced ? <Animated.View testID="creature-radial-flash" pointerEvents="none" style={[{
        position: 'absolute', left: (width - flashDiameter) / 2, top: height * 0.46 - flashDiameter / 2,
        width: flashDiameter, height: flashDiameter,
      }, flashStyle]}>
        <Svg width={flashDiameter} height={flashDiameter} viewBox="0 0 64 64">
          <Path d={PIXEL_DISC} fill="#97eaff" />
          <Path d={PIXEL_DISC} fill="#fff" transform="translate(1 1) scale(0.96875)" />
        </Svg>
      </Animated.View> : null}
      <Pressable testID="open-pokedex" accessibilityRole="button" accessibilityLabel={`Open Pokédex entry for ${name}`}
        accessibilityHint="Shows the creature's name, type, and field notes" disabled={!finished || !active}
        onPress={() => { if (!opened.current) { opened.current = true; onOpen(); } }}
        style={{ position: 'absolute', inset: 0 }}>
      </Pressable>
      {celebration}
      {showMessage ? <View testID="capture-textbox" pointerEvents="none" style={{
        position: 'absolute', width: Math.min(width - 32, 520), left: (width - Math.min(width - 32, 520)) / 2,
        bottom: Math.max(24, height * 0.05), padding: 4, backgroundColor: '#112b43', borderWidth: 2, borderColor: '#e4fcff',
      }}>
        <View style={{ backgroundColor: '#fffce8', borderWidth: 3, borderColor: '#81b9ca', paddingHorizontal: 14, paddingVertical: 16, gap: 14 }}>
          <Text testID="capture-announcement" accessibilityLiveRegion="polite" style={{
            fontFamily: fontLoaded ? 'PokedexPixel' : undefined, fontSize: 16, lineHeight: 24, color: '#203e52',
          }}>{name} Has Been Captured!</Text>
          {showHint ? <Text style={{ fontFamily: fontLoaded ? 'PokedexPixel' : undefined, color: '#3c6e85', fontSize: 12, lineHeight: 16, textAlign: 'right' }}>VIEW POKÉDEX  ▼</Text> : null}
        </View>
      </View> : null}
    </View>
  );
}
