import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedDrawerLayout, { DrawerPosition, DrawerType, type DrawerLayoutMethods } from 'react-native-gesture-handler/ReanimatedDrawerLayout';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { usePokedex } from '@/providers/pokedex-provider';

const SidebarContext = createContext<(() => void) | null>(null);

export function SidebarMenuButton() {
  const openMenu = use(SidebarContext);
  return <Pressable accessibilityRole="button" accessibilityLabel="Open sidebar" onPress={openMenu ?? undefined}
    style={({ pressed }) => ({ position: 'absolute', left: 6, top: 10, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
    <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden><Path d="M3 5h18M3 12h18M3 19h18" stroke="#fff9e7" strokeWidth="3" /></Svg>
  </Pressable>;
}

export function PokedexSidebar({ children, fontFamily, onCamera }: {
  children: ReactNode; fontFamily?: string; onCamera: () => void;
}) {
  const drawer = useRef<DrawerLayoutMethods>(null);
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { loading, refresh, playMenuOpenSound } = usePokedex();
  const closeMenu = useCallback(() => drawer.current?.closeDrawer(), []);
  const openMenu = useCallback(() => drawer.current?.openDrawer(), []);
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeMenu(); return true; });
    if (process.env.EXPO_OS !== 'web') return () => subscription.remove();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); closeMenu(); } };
    window.addEventListener('keydown', escape);
    return () => { subscription.remove(); window.removeEventListener('keydown', escape); };
  }, [closeMenu, open]);
  const action = (callback: () => void) => { playMenuOpenSound(); closeMenu(); callback(); };

  return <SidebarContext value={openMenu}><ReanimatedDrawerLayout ref={drawer} drawerPosition={DrawerPosition.LEFT} drawerType={DrawerType.FRONT}
    drawerWidth={Math.min(300, width - 48)} edgeWidth={28} minSwipeDistance={12} enableTrackpadTwoFingerGesture
    drawerBackgroundColor="#12334b" overlayColor="rgba(2, 13, 25, 0.65)"
    onDrawerOpen={() => setOpen(true)} onDrawerClose={() => setOpen(false)}
    renderNavigationView={() => <View testID="pokedex-sidebar" accessibilityViewIsModal={open} aria-hidden={!open}
      accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      onAccessibilityEscape={closeMenu} style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16,
        paddingHorizontal: 16, borderRightWidth: 3, borderRightColor: '#81c8d8', gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#487b95' }}>
        <Text accessibilityRole="header" style={{ fontFamily, fontSize: 24, color: '#fff0cf' }}>MENU</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sidebar" onPress={closeMenu}
          style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
          <Svg width={18} height={18} viewBox="0 0 18 18" aria-hidden><Path d="M2 2l14 14M16 2L2 16" stroke="#f7edd0" strokeWidth="3" /></Svg>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => { closeMenu(); router.push('/pokedex/profile'); }}
        style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 16, borderWidth: 2, borderColor: '#d7e7df', borderRadius: 5,
          backgroundColor: pressed ? '#bdd4d4' : '#edf0df', justifyContent: 'center', boxShadow: '0 3px 0 #748b91' })}>
        <Text style={{ fontFamily, fontSize: 16, color: '#203c55' }}>PROFILE</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Stats" onPress={() => { closeMenu(); router.push('/pokedex/stats'); }}
        style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 16, borderWidth: 2, borderColor: '#d7e7df', borderRadius: 5,
          backgroundColor: pressed ? '#bdd4d4' : '#edf0df', justifyContent: 'center', boxShadow: '0 3px 0 #748b91' })}>
        <Text style={{ fontFamily, fontSize: 16, color: '#203c55' }}>STATS</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh Pokédex" disabled={loading} onPress={() => action(() => { void refresh(); })}
        style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 16, borderWidth: 2, borderColor: '#d7e7df', borderRadius: 5,
          backgroundColor: pressed ? '#bdd4d4' : '#edf0df', justifyContent: 'center', opacity: loading ? 0.6 : 1, boxShadow: '0 3px 0 #748b91' })}>
        <Text style={{ fontFamily, fontSize: 16, color: '#203c55' }}>{loading ? 'REFRESHING…' : 'REFRESH'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to camera" onPress={() => action(onCamera)}
        style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 16, borderWidth: 2, borderColor: '#ffe4a7', borderRadius: 5,
          backgroundColor: pressed ? '#e49c48' : '#f5bd6c', justifyContent: 'center', boxShadow: '0 3px 0 #7f5e3e' })}>
        <Text style={{ fontFamily, fontSize: 16, color: '#3c3c3e' }}>BACK TO CAMERA</Text>
      </Pressable>
    </View>}>
    <View style={{ flex: 1 }} aria-hidden={open} accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
  </ReanimatedDrawerLayout></SidebarContext>;
}
