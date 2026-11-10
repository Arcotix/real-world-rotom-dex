import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { CollectionStamp } from '@/components/collection-stamp';
import { STATS_FONTS } from '@/constants/typography';
import { STATS_COPY, statsLanguage, statsErrorMessage, unavailableStatsMessage } from '@/utils/stats-language';
import { useEntryMenuAnimation } from '@/hooks/use-entry-menu-animation';
import { useCollectionStamps } from '@/hooks/use-collection-stamps';
import { useStatsThump } from '@/hooks/use-stats-thump';
import { usePokedex } from '@/providers/pokedex-provider';
import { CREATURE_RARITIES, RARITY_BADGES } from '@/utils/creature-rarity';
import { type Profile } from '@/utils/profile-data';
import { loadProfile } from '@/utils/profile-store';

export function CollectionStatsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width - 24, 548);
  const [fontsLoaded] = useFonts(STATS_FONTS);
  const [profile, setProfile] = useState<Profile | null>(null);
  const language = statsLanguage(profile?.name ?? '');
  const copy = STATS_COPY[language];
  const fontFamily = fontsLoaded ? (language === 'hi' ? 'PokedexHindi' : 'PokedexPixel') : undefined;
  const [profileError, setProfileError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const profileReadGeneration = useRef(0);
  const [dismissible, setDismissible] = useState(false);
  const closingRef = useRef(false);
  const { play: playThump, stop: stopThump } = useStatsThump(closingRef);
  const closingMotion = useSharedValue(false);
  const finishClose = useCallback(() => setDismissible(true), []);
  const { close: animateClose, reduced, backdropStyle, panelStyle, contentStyle, leftScanStyle, rightScanStyle, revealProgress } = useEntryMenuAnimation(panelWidth, finishClose, closingRef);
  const close = useCallback(() => { stopThump(); closingMotion.set(true); animateClose(); }, [animateClose, closingMotion, stopThump]);
  usePreventRemove(!dismissible, close);
  const { entries, loading, error, unavailableCount, refresh, playMenuOpenSound } = usePokedex();
  const counts = useMemo(() => {
    const result = { common: 0, rare: 0, legendary: 0, mythical: 0 };
    for (const entry of entries ?? []) result[entry.rarity]++;
    return result;
  }, [entries]);
  const { clock, shakeStyle } = useCollectionStamps({ ready: entries !== null && !loading && (profile !== null || profileError), revealProgress, closing: closingMotion, reduced, onImpact: playThump });

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => { playMenuOpenSound(); }, [playMenuOpenSound]);
  useEffect(() => { if (dismissible) router.dismissTo('/pokedex'); }, [dismissible]);
  const readProfile = useCallback(() => {
    const request = ++profileReadGeneration.current;
    return loadProfile().then(value => {
      if (request === profileReadGeneration.current) { setProfile(value); setProfileError(false); }
    }).catch(() => { if (request === profileReadGeneration.current) setProfileError(true); });
  }, []);
  useFocusEffect(useCallback(() => {
    const cancelRead = () => { profileReadGeneration.current++; };
    void readProfile();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void readProfile(); });
    return () => { cancelRead(); subscription.remove(); };
  }, [readProfile]));
  useEffect(() => {
    if (process.env.EXPO_OS !== 'web') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [close]);

  return <View testID="collection-stats-modal" accessibilityLanguage={language === 'hi' ? 'hi-IN' : 'en'} accessibilityViewIsModal onAccessibilityEscape={close}
    onLayout={() => { void SplashScreen.hideAsync(); }}
    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
    <Stack.Screen options={{ title: copy.title }} />
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: '#041427d9' }, backdropStyle]} />
    <Animated.View testID="stats-impact-frame" style={[{ flex: 1, width: panelWidth }, shakeStyle]}>
      <Animated.View testID="collection-stats-panel" style={[{ flex: 1, borderWidth: 3, borderColor: '#e5f4e7', borderRadius: 9,
        backgroundColor: '#8fc5e2', overflow: 'hidden', boxShadow: '0 0 0 2px #284f69, 0 12px 40px #0009' }, panelStyle]}>
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f587c', borderBottomWidth: 2, borderBottomColor: '#cef1ed', gap: 7 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={close}
              style={({ pressed }) => ({ minWidth: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
              <Svg width={18} height={18} viewBox="0 0 18 18" aria-hidden><Path d="M2 2l14 14M16 2L2 16" stroke="#f7edd0" strokeWidth="3" /></Svg>
            </Pressable>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily, fontSize: 18, color: '#f8f0d5', paddingVertical: 10 }}>{copy.title}</Text>
          </View>
          <ScrollView testID="collection-stats-scroll" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 18 }}>
            {profile ? <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 104, height: 104, borderRadius: 20, borderCurve: 'continuous', borderWidth: 3, borderColor: '#e5f4e7',
                backgroundColor: '#266585', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {profile.photoUri && !photoError ? <Image testID="stats-profile-photo" source={{ uri: profile.photoUri }} accessibilityLabel={copy.photo}
                  onError={() => setPhotoError(true)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                  : <Svg width={64} height={64} viewBox="0 0 84 84" aria-hidden><Path d="M42 9a15 15 0 1 0 0 30 15 15 0 0 0 0-30ZM14 73v-8c0-15 12-23 28-23s28 8 28 23v8" fill="none" stroke="#bfe6e8" strokeWidth="4" /></Svg>}
              </View>
              <Text testID="stats-profile-name" selectable style={{ fontFamily, fontSize: 20, lineHeight: 28, color: '#203c55', textAlign: 'center' }}>{profile.name || copy.trainer}</Text>
            </View> : profileError ? <View style={{ gap: 8 }}>
              <Text selectable accessibilityLiveRegion="polite" style={{ fontFamily, color: '#75362c', fontSize: 13, lineHeight: 21 }}>{copy.profileError}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.profileRetryLabel} onPress={() => { setProfileError(false); void readProfile(); }} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ fontFamily, color: '#203c55', fontSize: 13 }}>{copy.profileRetry}</Text>
              </Pressable>
            </View> : <ActivityIndicator accessibilityLabel={copy.profileLoading} color="#203c55" />}

            {entries !== null ? <View style={{ gap: 8 }}>
              <CollectionStamp testID="collection-stamp-total" label={copy.total} language={language} count={entries.length} index={0} clock={clock} reduced={reduced} fontFamily={fontFamily} backgroundColor="#fff0cf" color="#203c55" />
              {CREATURE_RARITIES.map((rarity, index) => <CollectionStamp key={rarity} testID={`collection-stamp-${rarity}`} label={copy[rarity]} language={language}
                count={counts[rarity]} index={index + 1} clock={clock} reduced={reduced} fontFamily={fontFamily} {...RARITY_BADGES[rarity]} />)}
              {entries.length === 0 ? <Text selectable style={{ fontFamily, fontSize: 12, lineHeight: 20, color: '#203c55', textAlign: 'center', paddingTop: 6 }}>{copy.empty}</Text> : null}
            </View> : error ? <View style={{ gap: 8 }}>
              <Text selectable accessibilityLiveRegion="polite" style={{ fontFamily, color: '#75362c', fontSize: 13, lineHeight: 21 }}>{statsErrorMessage(error, language)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.collectionRetryLabel} onPress={() => void refresh()} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ fontFamily, color: '#203c55', fontSize: 13 }}>{copy.collectionRetry}</Text>
              </Pressable>
            </View> : <ActivityIndicator accessibilityLabel={copy.collectionLoading} color="#203c55" />}
            {loading && entries !== null ? <ActivityIndicator accessibilityLabel={copy.collectionUpdating} color="#203c55" /> : null}
            {entries !== null && error ? <Text selectable accessibilityLiveRegion="polite" style={{ fontFamily, color: '#75362c', fontSize: 12, lineHeight: 20 }}>{statsErrorMessage(error, language)} {copy.stale}</Text> : null}
            {unavailableCount > 0 ? <Text selectable style={{ fontFamily, color: '#75362c', fontSize: 12, lineHeight: 20 }}>{unavailableStatsMessage(unavailableCount, language)}</Text> : null}
          </ScrollView>
        </Animated.View>
        {!reduced ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Animated.View testID="stats-scan-left" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', backgroundColor: '#8fc5e2', borderRightWidth: 2, borderRightColor: '#e0ffff' }, leftScanStyle]} />
          <Animated.View testID="stats-scan-right" style={[{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', backgroundColor: '#8fc5e2', borderLeftWidth: 2, borderLeftColor: '#e0ffff' }, rightScanStyle]} />
        </View> : null}
      </Animated.View>
    </Animated.View>
  </View>;
}
