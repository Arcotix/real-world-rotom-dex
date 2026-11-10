import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { POKEDEX_FONTS } from '@/constants/typography';
import { useEntryMenuAnimation } from '@/hooks/use-entry-menu-animation';
import { usePokedex } from '@/providers/pokedex-provider';
import { EMPTY_PROFILE, type Profile } from '@/utils/profile-data';
import { loadProfile, saveProfile } from '@/utils/profile-store';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width - 24, 548);
  const [fontsLoaded] = useFonts(POKEDEX_FONTS);
  const fontFamily = fontsLoaded ? 'PokedexPixel' : undefined;
  const [profile, setProfile] = useState<Profile>({ ...EMPTY_PROFILE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [dismissible, setDismissible] = useState(false);
  const finishClose = useCallback(() => setDismissible(true), []);
  const closing = useRef(false);
  const { close: animateClose, reduced, backdropStyle, panelStyle, contentStyle, leftScanStyle, rightScanStyle } = useEntryMenuAnimation(panelWidth, finishClose, closing);
  const { playMenuOpenSound } = usePokedex();
  const close = useCallback(() => { if (!busy.current) animateClose(); }, [animateClose]);
  usePreventRemove(!dismissible, close);

  useEffect(() => {
    if (dismissible) router.dismissTo('/pokedex');
  }, [dismissible]);
  useEffect(() => {
    playMenuOpenSound();
  }, [playMenuOpenSound]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const read = useCallback(() => loadProfile().then(value => {
    if (mounted.current) { setProfile(value); setLoadError(false); setError(null); }
  }).catch(() => {
    if (mounted.current) { setLoadError(true); setError('Your profile could not be loaded. Please retry.'); }
  }).finally(() => { if (mounted.current) setLoading(false); }), []);
  useEffect(() => { void read(); }, [read]);
  useEffect(() => {
    if (process.env.EXPO_OS !== 'web') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [close]);

  async function choosePhoto() {
    if (busy.current || closing.current) return;
    setError(null);
    try {
      // Keep the picker call directly in the press handler for mobile browsers.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        base64: process.env.EXPO_OS === 'web',
      });
      if (result.canceled || !mounted.current || closing.current) return;
      const photo = result.assets[0];
      if (!photo) return;
      const photoUri = process.env.EXPO_OS === 'web' && photo.base64
        ? `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}` : photo.uri;
      setProfile(value => ({ ...value, photoUri }));
      setSaved(false);
    } catch {
      if (mounted.current) setError('The photo could not be opened. Please choose a photo again.');
    }
  }

  async function save() {
    if (busy.current || closing.current) return;
    if (!profile.name.trim()) { setError('Enter your name to save your profile.'); return; }
    busy.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const value = await saveProfile(profile);
      if (mounted.current) { setProfile(value); setSaved(true); }
    } catch {
      if (mounted.current) setError('Your profile could not be saved. Try again, or choose a smaller photo.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <KeyboardAvoidingView testID="profile-modal" accessibilityViewIsModal onAccessibilityEscape={close}
    behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'android' ? 'height' : undefined}
    onLayout={() => { void SplashScreen.hideAsync(); }}
    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: '#041427d9' }, backdropStyle]} />
    <Animated.View testID="profile-panel" style={[{ flex: 1, width: panelWidth, borderWidth: 3, borderColor: '#e5f4e7', borderRadius: 9,
      backgroundColor: '#8fc5e2', overflow: 'hidden', boxShadow: '0 0 0 2px #284f69, 0 12px 40px #0009' }, panelStyle]}>
      <Animated.View style={[{ flex: 1 }, contentStyle]}>
        <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f587c', borderBottomWidth: 2, borderBottomColor: '#cef1ed', gap: 7 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close profile" disabled={saving} onPress={close}
            style={({ pressed }) => ({ minWidth: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center', opacity: pressed || saving ? 0.5 : 1 })}>
            <Svg width={18} height={18} viewBox="0 0 18 18" aria-hidden><Path d="M2 2l14 14M16 2L2 16" stroke="#f7edd0" strokeWidth="3" /></Svg>
          </Pressable>
          <Text accessibilityRole="header" style={{ flex: 1, fontFamily, fontSize: 18, color: '#f8f0d5', paddingVertical: 10 }}>PROFILE</Text>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={{ flexGrow: 1, padding: 22, gap: 22 }}>
          {loading ? <ActivityIndicator accessibilityLabel="Loading profile" color="#203c55" /> : loadError ? <>
            <Text selectable accessibilityLiveRegion="polite" style={{ color: '#6c4337', fontFamily, fontSize: 14, lineHeight: 22 }}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void read(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontFamily, color: '#203c55' }}>RETRY PROFILE</Text></Pressable>
          </> : <>
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Pressable testID="profile-photo-button" accessibilityRole="button" accessibilityLabel={profile.photoUri ? 'Change profile photo' : 'Add profile photo'}
                disabled={saving} onPress={() => void choosePhoto()} style={({ pressed }) => ({ width: '100%', maxWidth: 184, aspectRatio: 1,
                  borderRadius: 24, borderCurve: 'continuous', borderWidth: 3, borderColor: '#e5f4e7', backgroundColor: '#266585',
                  overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                {profile.photoUri ? <Image testID="profile-photo" source={{ uri: profile.photoUri }} accessibilityLabel="Your profile photo" contentFit="cover"
                  style={{ width: '100%', height: '100%' }} /> : <Svg width={84} height={84} viewBox="0 0 84 84" aria-hidden>
                  <Path d="M42 9a15 15 0 1 0 0 30 15 15 0 0 0 0-30ZM14 73v-8c0-15 12-23 28-23s28 8 28 23v8" fill="none" stroke="#bfe6e8" strokeWidth="4" />
                </Svg>}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={profile.photoUri ? 'Choose another photo' : 'Upload a photo'} onPress={() => void choosePhoto()} disabled={saving}
                style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontFamily, fontSize: 13, color: '#203c55', textAlign: 'center' }}>{profile.photoUri ? 'CHANGE PHOTO' : 'UPLOAD A PHOTO'}</Text>
              </Pressable>
            </View>
            <View style={{ gap: 10 }}>
              <Text nativeID="profile-name-label" style={{ fontFamily, fontSize: 14, color: '#203c55' }}>NAME</Text>
              <TextInput testID="profile-name" accessibilityLabel="Name" accessibilityLabelledBy="profile-name-label" value={profile.name}
                editable={!saving} maxLength={60} autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="done"
                onSubmitEditing={() => void save()} onChangeText={name => { setProfile(value => ({ ...value, name })); setSaved(false); setError(null); }}
                placeholder="Your name" placeholderTextColor="#647c8b" selectionColor="#266585"
                style={{ minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 6, borderWidth: 2, borderColor: '#477b94', backgroundColor: '#fff9e7', fontFamily, fontSize: 17, color: '#203c55' }} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Save profile" accessibilityState={{ busy: saving }} disabled={saving} onPress={() => void save()}
              style={({ pressed }) => ({ minHeight: 56, padding: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffe4a7',
                borderRadius: 5, backgroundColor: pressed ? '#e49c48' : '#f5bd6c', opacity: saving ? 0.6 : 1, boxShadow: '0 3px 0 #7f5e3e' })}>
              <Text style={{ fontFamily, fontSize: 15, color: '#3c3c3e' }}>{saving ? 'SAVING…' : 'SAVE PROFILE'}</Text>
            </Pressable>
            {error || saved ? <Text selectable accessibilityLiveRegion="polite" style={{ fontFamily, fontSize: 13, lineHeight: 21, color: error ? '#75362c' : '#234b41' }}>{error || 'Profile saved.'}</Text> : null}
          </>}
        </ScrollView>
      </Animated.View>
      {!reduced ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Animated.View testID="profile-scan-left" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', backgroundColor: '#8fc5e2', borderRightWidth: 2, borderRightColor: '#e0ffff' }, leftScanStyle]} />
        <Animated.View testID="profile-scan-right" style={[{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', backgroundColor: '#8fc5e2', borderLeftWidth: 2, borderLeftColor: '#e0ffff' }, rightScanStyle]} />
      </View> : null}
    </Animated.View>
  </KeyboardAvoidingView>;
}
