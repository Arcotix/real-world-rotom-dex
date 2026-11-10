import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import Animated, { cancelAnimation, Easing, FadeIn, FadeInUp, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Line, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type CreatureDetails } from '@/utils/recognition';
import { POKEDEX_FONTS } from '@/constants/typography';
import { CreatureStats } from '@/components/creature-stats';
import { RARITY_BADGES } from '@/utils/creature-rarity';

const ink = '#24465a';
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const IMAGE_ENTER = FadeInUp.duration(380).easing(EASE_OUT).withInitialValues({ translateY: 18 }).reduceMotion(ReduceMotion.System);
const INFO_ENTER = FadeInUp.delay(160).duration(300).easing(EASE_OUT).withInitialValues({ translateY: 14 }).reduceMotion(ReduceMotion.System);
const GENTLE_ENTER = FadeIn.duration(150).reduceMotion(ReduceMotion.Never);

function ScanBackdrop() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <Defs><Pattern id="dex-scan-lines" width="8" height="10" patternUnits="userSpaceOnUse">
        <Rect width="8" height="10" fill="#e9f6fa" /><Rect width="8" height="4" fill="#cce8f3" />
      </Pattern></Defs>
      <Rect width="100%" height="100%" fill="url(#dex-scan-lines)" />
      <Circle cx="50%" cy="47%" r="92" fill="#ffffff" opacity={0.26} />
      <Ellipse cx="50%" cy="84%" rx="76" ry="9" fill="#739eb1" opacity={0.17} />
      <Line x1="12" y1="14" x2="32" y2="14" stroke="#7eaec3" strokeWidth="2" />
      <Line x1="12" y1="14" x2="12" y2="34" stroke="#7eaec3" strokeWidth="2" />
    </Svg>
  );
}

function DetailRow({ label, value, badge = false, badgeColors, fontFamily }: {
  label: string; value: string; badge?: boolean; badgeColors?: { backgroundColor: string; color: string }; fontFamily?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 37, borderBottomWidth: 1, borderBottomColor: '#b4d6db' }}>
      <View style={{ width: 100, alignSelf: 'stretch', justifyContent: 'center', backgroundColor: '#69b3d3', paddingHorizontal: 12 }}>
        <Text style={{ color: '#fff', fontFamily, fontSize: 11, lineHeight: 18, fontWeight: '400' }}>{label}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text testID={label === 'Rarity' ? 'creature-rarity' : undefined} selectable style={{ color: badgeColors?.color ?? (badge ? '#fff' : ink), backgroundColor: badge ? badgeColors?.backgroundColor ?? '#d5a51e' : undefined,
          alignSelf: 'flex-start', borderRadius: badge ? 4 : 0, paddingHorizontal: badge ? 9 : 0, paddingVertical: badge ? 3 : 0,
          fontFamily, fontSize: badge ? 10 : 11, lineHeight: 18, fontWeight: '400' }}>{value}</Text>
      </View>
    </View>
  );
}

export function CreatureEntry({ imageUri, imageHeaders, creature, object, onRetake, onPlayCry, onOpenPokedex, saved = false }: {
  imageUri: string; creature: CreatureDetails; object: string; onRetake: () => void; onPlayCry: () => void;
  imageHeaders?: Record<string, string>; onOpenPokedex?: () => void; saved?: boolean;
}) {
  const [fontLoaded] = useFonts(POKEDEX_FONTS);
  const fontFamily = fontLoaded ? 'PokedexPixel' : undefined;
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const imageHeight = Math.max(210, Math.min(height * 0.35, 330));
  const reduced = useReducedMotion();
  const opacity = useSharedValue(saved ? 1 : 0);
  const glow = useSharedValue(reduced ? 0 : 1);
  const [leaving, setLeaving] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [portraitAttempt, setPortraitAttempt] = useState(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saved) return;
    opacity.set(withTiming(1, { duration: reduced ? 150 : 300, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    glow.set(withTiming(0, { duration: reduced ? 0 : 700, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    return () => { cancelAnimation(opacity); cancelAnimation(glow); if (exitTimer.current) clearTimeout(exitTimer.current); };
  }, [glow, opacity, reduced, saved]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() * 0.8, transform: [{ scale: 1 + (1 - glow.get()) * 0.15 }] }));
  function leave(onComplete: () => void = onRetake) {
    if (leaving) return;
    setLeaving(true);
    opacity.set(withTiming(0, { duration: 180, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    exitTimer.current = setTimeout(onComplete, 180);
  }
  return (
    <Animated.View testID="creature-display" style={[{ position: 'absolute', inset: 0, backgroundColor: '#8fc5e2' }, revealStyle]}>
      {!saved && onOpenPokedex ? <View style={{ paddingTop: insets.top, backgroundColor: '#388abd' }}>
        <Pressable testID="close-new-entry" accessibilityRole="button" accessibilityLabel="Close new entry and open Pokédex" disabled={leaving}
          onPress={() => leave(onOpenPokedex)} style={({ pressed }) => ({ width: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.55 : 1 })}>
          <Svg width={18} height={18} viewBox="0 0 18 18" aria-hidden><Path d="M2 2l14 14M16 2L2 16" stroke="#fff0bb" strokeWidth="3" /></Svg>
        </Pressable>
      </View> : null}
      <ScrollView testID="creature-entry-scroll" contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}
        style={{ flex: 1 }} contentContainerStyle={{ padding: 13, paddingTop: saved ? 10 : 32, paddingBottom: 22, gap: 13, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <View testID="creature-entry" style={{ gap: 13 }}>
          <Animated.View entering={saved ? undefined : reduced ? GENTLE_ENTER : IMAGE_ENTER} testID="creature-image-panel" style={{ height: imageHeight, borderWidth: 3, borderColor: '#f1cf64', padding: 4, borderRadius: 15, backgroundColor: '#fff8d3', boxShadow: '0 3px 0 #5e9bbd' }}>
            <View style={{ flex: 1, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#92bfd5' }}>
              <ScanBackdrop />
              <Text style={{ position: 'absolute', top: 11, right: 12, color: '#53839d', fontFamily, fontSize: 10, fontWeight: '400' }}>SPECIMEN VIEW</Text>
              {saved && portraitFailed ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily, fontSize: 12, color: ink }}>Picture unavailable</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Retry specimen picture" onPress={() => { setPortraitFailed(false); setPortraitAttempt(value => value + 1); }}
                  style={{ minHeight: 44, padding: 12, justifyContent: 'center' }}><Text style={{ fontFamily, color: ink }}>RETRY PICTURE</Text></Pressable>
              </View> : <Image key={portraitAttempt} testID="creature-portrait" source={{ uri: imageUri, headers: imageHeaders }} accessibilityLabel={`${creature.name}, a realistic 3D ${object} with googly eyes`}
                onError={saved ? () => setPortraitFailed(true) : undefined}
                style={{ flex: 1, margin: 18, marginTop: 28, marginBottom: 46 }} contentFit="contain" transition={0} />}
              <View style={{ position: 'absolute', bottom: 0, right: 8 }}>
                <Pressable testID="play-creature-cry" accessibilityRole="button" accessibilityLabel="Play Cry" disabled={leaving} onPress={onPlayCry}
                  style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', gap: 7, alignItems: 'center', opacity: pressed ? 0.55 : 1 })}>
                  <Svg width={18} height={18} viewBox="0 0 18 18" aria-hidden pointerEvents="none">
                    <Rect x={1} y={6} width={4} height={6} fill={ink} />
                    <Rect x={5} y={4} width={2} height={10} fill={ink} />
                    <Rect x={7} y={2} width={2} height={14} fill={ink} />
                    <Rect x={11} y={6} width={2} height={6} fill={ink} />
                    <Rect x={13} y={2} width={2} height={2} fill={ink} />
                    <Rect x={15} y={4} width={2} height={10} fill={ink} />
                    <Rect x={13} y={14} width={2} height={2} fill={ink} />
                  </Svg>
                  <Text style={{ color: ink, fontFamily, fontSize: 10, fontWeight: '400' }}>PLAY CRY</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
          <Animated.View entering={saved ? undefined : reduced ? GENTLE_ENTER : INFO_ENTER} testID="creature-info-panel" style={{ borderWidth: 2, borderColor: '#e4f2d1', borderRadius: 12, overflow: 'hidden', backgroundColor: '#d3e9c8', boxShadow: '0 3px 0 #689fb7' }}>
            <View style={{ backgroundColor: '#f6a24d', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#ffe0a7' }}>
              <Text style={{ color: '#81512d', fontFamily, fontSize: 10, lineHeight: 16, fontWeight: '400', marginBottom: 8 }}>{saved ? '●  SAVED SPECIMEN' : '●  ENTRY REGISTERED'}</Text>
              <Text testID="creature-name" selectable accessibilityRole="header" style={{ color: '#443e36', fontFamily, fontSize: 18, lineHeight: 26, fontWeight: '400', textAlign: 'center' }}>{creature.name}</Text>
            </View>
            <View style={{ backgroundColor: '#edf2d9', paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text selectable style={{ color: '#66714b', fontFamily, fontSize: 11, lineHeight: 20, fontWeight: '400' }}>{creature.category || 'The Everyday Wonder'}</Text>
            </View>
            <DetailRow label="Type" value={(creature.element || 'Normal').toUpperCase()} badge fontFamily={fontFamily} />
            <DetailRow label="Rarity" value={(creature.rarity ?? 'common').toUpperCase()} badge badgeColors={RARITY_BADGES[creature.rarity ?? 'common']} fontFamily={fontFamily} />
            <DetailRow label="Height" value={creature.heightCm ? `≈ ${creature.heightCm.toLocaleString()} cm` : 'Not estimated'} fontFamily={fontFamily} />
            <DetailRow label="Weight" value={creature.weightKg ? `≈ ${creature.weightKg.toLocaleString(undefined, { maximumFractionDigits: 4 })} kg` : 'Not estimated'} fontFamily={fontFamily} />
            <View style={{ padding: 10 }}>
              <View style={{ borderWidth: 1, borderColor: '#c4cc91', backgroundColor: '#fbfbe5', padding: 14, gap: 8, borderRadius: 5 }}>
                <Text style={{ color: '#879254', fontFamily, fontSize: 10, lineHeight: 16, fontWeight: '400' }}>FIELD NOTES</Text>
                <Text testID="creature-description" selectable style={{ color: '#434b3c', fontFamily, fontSize: 12, lineHeight: 20, fontWeight: '400' }}>{creature.description}</Text>
              </View>
            </View>
          </Animated.View>
          <CreatureStats stats={creature.stats} fontFamily={fontFamily} />
        </View>
      </ScrollView>
      {!saved ? <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 8, borderTopWidth: 2, borderTopColor: '#d4ebf7', backgroundColor: '#388abd', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Take picture of new creature" disabled={leaving} onPress={() => leave()}
          style={({ pressed }) => ({ minHeight: 48, width: '100%', maxWidth: 534, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
            borderColor: '#fff0bb', borderRadius: 10, backgroundColor: pressed ? '#e38b36' : '#ffb258', paddingHorizontal: 16, paddingVertical: 12 })}>
          <Text style={{ color: '#4b4238', fontFamily, fontSize: 10, lineHeight: 16, fontWeight: '400', letterSpacing: 0, textAlign: 'center' }}>TAKE PICTURE OF NEW CREATURE</Text>
        </Pressable>
        {onOpenPokedex ? <Pressable accessibilityRole="button" accessibilityLabel="View saved Pokédex" onPress={onOpenPokedex} disabled={leaving}
          style={({ pressed }) => ({ minHeight: 44, width: '100%', maxWidth: 534, justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: '#f0f7e4', fontFamily, fontSize: 11 }}>VIEW SAVED POKÉDEX</Text>
        </Pressable> : null}
      </View> : null}
      {!reduced && !saved ? <Animated.View testID="entry-reveal-glow" pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, glowStyle]}>
        <Svg width="100%" height="100%">
          <Defs><RadialGradient id="entry-glow" cx="50%" cy="32%" r="80%"><Stop offset="0" stopColor="#fff" /><Stop offset={0.4} stopColor="#9ff5ff" stopOpacity={0.75} /><Stop offset="1" stopColor="#348cbf" stopOpacity={0} /></RadialGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#entry-glow)" />
        </Svg>
      </Animated.View> : null}
    </Animated.View>
  );
}
