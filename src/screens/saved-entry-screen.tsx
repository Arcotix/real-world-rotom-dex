import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useEntryMenuAnimation } from '@/hooks/use-entry-menu-animation';
import Svg, { Path } from 'react-native-svg';
import { CreatureEntry } from '@/components/creature-entry';
import { POKEDEX_FONTS } from '@/constants/typography';
import { MENU_OPEN_AUDIO } from '@/constants/artwork';
import { usePokedex } from '@/providers/pokedex-provider';
import { entryAssetSource, type SavedEntry } from '@/utils/pokedex';

const goToBox = () => { router.dismissTo('/pokedex'); };

function EntryInspector({ entry }: { entry: SavedEntry }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width - 24, 548);
  const [fontLoaded] = useFonts(POKEDEX_FONTS);
  const fontFamily = fontLoaded ? 'PokedexPixel' : undefined;
  const closing = useRef(false);
  const { close: animateClose, reduced, backdropStyle, panelStyle, contentStyle, leftScanStyle, rightScanStyle } = useEntryMenuAnimation(panelWidth, goToBox, closing);
  const [audioError, setAudioError] = useState(false);
  const source = useMemo(() => entryAssetSource(entry.id, 'picture.png'), [entry.id]);
  const crySource = useMemo(() => entryAssetSource(entry.id, 'cry.mp3'), [entry.id]);
  const player = useAudioPlayer(crySource, { downloadFirst: true });
  const audio = useAudioPlayerStatus(player);
  const menuSound = useAudioPlayer(MENU_OPEN_AUDIO, { downloadFirst: true });
  const menuStatus = useAudioPlayerStatus(menuSound);
  const menuStarted = useRef(false);
  const menuCancelled = useRef(false);
  const focused = useIsFocused();
  const playEpoch = useRef(0);
  const invalidatePlayback = useCallback(() => { playEpoch.current++; }, []);

  useEffect(() => {
    if (!focused || !menuStatus.isLoaded || menuStarted.current || menuCancelled.current || closing.current) return;
    let cancelled = false;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false })
      .then(() => {
        if (!cancelled && !menuCancelled.current && !closing.current && (AppState.currentState === 'active' || AppState.currentState == null)) {
          menuStarted.current = true;
          menuSound.play();
        }
      }).catch(() => { /* A blocked sound must not prevent opening the entry. */ });
    return () => { cancelled = true; };
  }, [closing, focused, menuSound, menuStatus.isLoaded]);

  useEffect(() => {
    const stop = () => { invalidatePlayback(); player.pause(); menuCancelled.current = true; menuSound.pause(); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    if (!focused && menuStarted.current) stop();
    // useAudioPlayer releases its native resource on unmount.
    return () => { subscription.remove(); invalidatePlayback(); };
  }, [focused, invalidatePlayback, menuSound, player]);

  const close = useCallback(() => {
    if (closing.current) return;
    playEpoch.current++;
    player.pause();
    menuCancelled.current = true;
    menuSound.pause();
    animateClose();
  }, [animateClose, closing, menuSound, player]);

  useEffect(() => {
    if (process.env.EXPO_OS !== 'web') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [close]);

  async function playCry() {
    const epoch = ++playEpoch.current;
    setAudioError(false);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
      player.pause();
      await player.seekTo(0);
      if (epoch === playEpoch.current && !closing.current && focused && (AppState.currentState === 'active' || AppState.currentState == null)) player.play();
    } catch { setAudioError(true); }
  }

  return <View testID="saved-entry-modal" accessibilityViewIsModal onAccessibilityEscape={close}
    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: '#041427d9' }, backdropStyle]} />
    <Animated.View testID="saved-entry-panel" style={[{ flex: 1, width: panelWidth, borderWidth: 3, borderColor: '#e5f4e7', borderRadius: 9,
      backgroundColor: '#8fc5e2', overflow: 'hidden', boxShadow: '0 0 0 2px #284f69, 0 12px 40px #0009' }, panelStyle]}>
      <Animated.View testID="saved-entry-content" style={[{ flex: 1 }, contentStyle]}>
        <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f587c', borderBottomWidth: 2, borderBottomColor: '#cef1ed', paddingRight: 12, gap: 7 }}>
          <Pressable testID="close-saved-entry" accessibilityRole="button" accessibilityLabel="Close creature details" onPress={close}
            style={({ pressed }) => ({ minWidth: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
            <Svg width={18} height={18} viewBox="0 0 18 18" aria-hidden><Path d="M2 2l14 14M16 2L2 16" stroke="#f7edd0" strokeWidth="3" /></Svg>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: '#f8f0d5', fontFamily, fontSize: 12 }}>SPECIMEN RECORD</Text>
            <Text style={{ color: '#a7d5e0', fontFamily, fontSize: 9 }}>BOX 01</Text>
          </View>
          <View style={{ width: 6, height: 6, backgroundColor: '#bee5b5', borderRadius: 4 }} />
        </View>
        <View style={{ flex: 1 }}>
          <CreatureEntry imageUri={source.uri} imageHeaders={source.headers} object={entry.object} saved onRetake={close} onPlayCry={() => void playCry()}
            creature={{ ...entry, description: entry.fieldNotes, imageName: `${entry.id}.creature.png`,
              heightCm: entry.heightCm ?? undefined, weightKg: entry.weightKg ?? undefined }} />
        </View>
        {(audioError || audio.error) ? <Text selectable accessibilityLiveRegion="polite" style={{ backgroundColor: '#fff3d7', color: '#6c4337', padding: 8, fontFamily, fontSize: 12 }}>The cry could not play. Try Play Cry again.</Text> : null}
      </Animated.View>
      {!reduced ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Animated.View testID="entry-scan-left" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', backgroundColor: '#8fc5e2',
          borderRightWidth: 2, borderRightColor: '#e0ffff' }, leftScanStyle]} />
        <Animated.View testID="entry-scan-right" style={[{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', backgroundColor: '#8fc5e2',
          borderLeftWidth: 2, borderLeftColor: '#e0ffff' }, rightScanStyle]} />
      </View> : null}
    </Animated.View>
  </View>;
}

export function SavedEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, error, loading, refresh } = usePokedex();
  const entry = entries?.find(value => value.id === id);
  useEffect(() => { if (entries === null) void refresh(); }, [entries, refresh]);
  return <View style={{ flex: 1 }} onLayout={() => { void SplashScreen.hideAsync(); }}>
    {entry ? <EntryInspector key={entry.id} entry={entry} /> : <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: '#071b30ed', justifyContent: 'center', padding: 24, gap: 16 }}>
      {loading || (entries === null && !error) ? <ActivityIndicator color="#c8f4f0" /> : <Text selectable style={{ color: '#e3eee2', fontSize: 16, lineHeight: 24 }}>{error || 'This saved specimen is unavailable.'}</Text>}
      {error ? <Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: '#ffd29a' }}>Retry connection</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Close creature details" onPress={goToBox} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: '#c8f4f0' }}>× Back to Pokédex</Text></Pressable>
    </View>}
  </View>;
}
