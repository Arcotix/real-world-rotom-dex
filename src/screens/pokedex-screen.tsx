import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MountainHabitat } from '@/components/mountain-habitat';
import { PokedexSidebar, SidebarMenuButton } from '@/components/pokedex-sidebar';
import { POKEDEX_FONTS } from '@/constants/typography';
import { usePokedex } from '@/providers/pokedex-provider';
import { entryAssetSource, type SavedEntry } from '@/utils/pokedex';

const ink = '#203c55';

const SpecimenTile = memo(function SpecimenTile({ entry, index, size, fontFamily }: {
  entry: SavedEntry | null; index: number; size: number; fontFamily?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const source = useMemo(() => entry ? entryAssetSource(entry.id, 'thumbnail.png') : null, [entry]);
  const tile = <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    {entry ? <>
      <View testID={`specimen-shadow-${index}`} style={{ position: 'absolute', bottom: 9, width: '52%', height: 5, borderRadius: 20, backgroundColor: '#26354838', boxShadow: '0 1px 3px #26354822' }} />
      {failed ? <Text style={{ fontFamily, color: ink, fontSize: 18 }}>?</Text>
        : <Image key={attempt} testID={`specimen-sprite-${index}`} source={source!} contentFit="contain" cachePolicy="memory-disk"
          recyclingKey={entry.id} transition={0} onError={() => setFailed(true)} style={{ width: size - 6, height: size - 6 }} />}
    </> : null}
  </View>;
  if (!entry) return <View testID={`empty-slot-${index}`} style={{ width: size, height: size + 9, padding: 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{tile}</View>;
  return <Pressable testID={`specimen-tile-${index}`} accessibilityRole="button"
    accessibilityLabel={`Inspect ${entry.name}, ${entry.element} type${failed ? '. Portrait unavailable' : ''}`}
    onPress={() => { if (failed) { setFailed(false); setAttempt(value => value + 1); } router.push({ pathname: '/pokedex/entry/[id]', params: { id: entry.id } }); }}
    style={({ pressed }) => ({ width: size, height: size + 9, padding: 3, opacity: pressed ? 0.65 : 1 })}>
    {tile}
  </Pressable>;
});

export function PokedexScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(POKEDEX_FONTS);
  const fontFamily = fontsLoaded ? 'PokedexPixel' : undefined;
  const { entries, loading, error, unavailableCount, refresh } = usePokedex();
  const [gridWidth, setGridWidth] = useState(Math.min(width - 60, 500));
  const [gridHeight, setGridHeight] = useState(0);
  const columns = Math.max(3, Math.min(6, Math.floor(gridWidth / 49)));
  const size = gridWidth / columns;
  const slots = useMemo(() => Array.from({ length: Math.max(30, Math.ceil(gridHeight / (size + 9)) * columns, Math.ceil((entries?.length ?? 0) / columns) * columns) },
    (_, index) => entries?.[index] ?? null), [columns, entries, gridHeight, size]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const returnToCamera = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  return <PokedexSidebar fontFamily={fontFamily} onCamera={returnToCamera}><View testID="pokedex-screen" style={{ flex: 1, backgroundColor: '#071b30', paddingTop: insets.top, paddingBottom: insets.bottom }}
    onLayout={() => { void SplashScreen.hideAsync(); }}>
    <View style={{ flex: 1, width: '100%', maxWidth: 580, alignSelf: 'center', padding: 12, gap: 12 }}>
      <View style={{ flex: 1, minHeight: 180, backgroundColor: '#247baf', borderWidth: 3, borderColor: '#123a56', borderRadius: 9,
        padding: 8, gap: 8, boxShadow: 'inset 0 2px 0 #78c6de, 0 4px 0 #030e1a' }}>
        <View style={{ minHeight: 70, borderWidth: 3, borderColor: '#133c59', backgroundColor: '#84cae2', borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', inset: 0, opacity: 0.85 }}><MountainHabitat miniature /></View>
          <View style={{ minHeight: 70, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#11334a35' }}>
            <Text accessibilityRole="header" style={{ fontFamily, color: '#fff9e7', textShadowColor: '#234b65', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 0, fontSize: 28 }}>BOX 01</Text>
            <SidebarMenuButton />
          </View>
        </View>

        <View testID="specimen-box" style={{ flex: 1, minHeight: 100, borderWidth: 3, borderColor: '#193b57', borderRadius: 4, overflow: 'hidden', backgroundColor: '#c7b5d6' }}>
          <MountainHabitat />
          <View style={{ flex: 1, padding: 5 }} onLayout={event => { setGridWidth(Math.max(1, event.nativeEvent.layout.width - 10)); setGridHeight(Math.max(1, event.nativeEvent.layout.height - 10)); }}>
            <FlatList key={columns} testID="specimen-grid" data={slots} numColumns={columns}
              keyExtractor={(item, index) => item?.id ?? `empty-${index}`}
              renderItem={({ item, index }) => <SpecimenTile entry={item} index={index} size={size} fontFamily={fontFamily} />}
              showsVerticalScrollIndicator persistentScrollbar contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ paddingBottom: 5 }} initialNumToRender={36} maxToRenderPerBatch={24} windowSize={5}
              refreshing={loading} onRefresh={() => void refresh()} />
          </View>
          {entries === null ? <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d7e4eabb', padding: 22 }}>
            {error ? <>
              <Text selectable accessibilityLiveRegion="polite" style={{ fontFamily, fontSize: 15, lineHeight: 22, color: ink, textAlign: 'center' }}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ padding: 14, minHeight: 48, marginTop: 14, backgroundColor: '#fff5d5', borderWidth: 2, borderColor: ink, borderRadius: 5 }}>
                <Text style={{ fontFamily, color: ink, fontSize: 13 }}>RETRY CONNECTION</Text>
              </Pressable>
            </> : <><ActivityIndicator color={ink} /><Text style={{ fontFamily, color: ink, fontSize: 14, paddingTop: 12 }}>Reading your Pokédex…</Text></>}
          </View> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 4 }}>
          {entries?.length ? <Text style={{ fontFamily, color: '#e2f4ee', fontSize: 10 }}>TAP A SPECIMEN TO INSPECT</Text> : <View />}
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: loading ? '#f1c56c' : '#abe4b5' }} />
        </View>
      </View>

      {entries && error ? <Text selectable accessibilityLiveRegion="polite" style={{ fontFamily, color: '#ffd4a3', fontSize: 12, lineHeight: 18 }}>{error} Your last loaded collection is still here.</Text> : null}
      {unavailableCount > 0 ? <Text selectable style={{ fontFamily, color: '#ffd4a3', fontSize: 12 }}>{unavailableCount} saved {unavailableCount === 1 ? 'entry could' : 'entries could'} not be read.</Text> : null}
    </View>
  </View></PokedexSidebar>;
}
