import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { PokedexProvider } from '@/providers/pokedex-provider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PokedexMusic } from '@/components/pokedex-music';

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><PokedexProvider>
    <StatusBar hidden />
    <PokedexMusic />
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#071b30' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="pokedex/index" options={{ title: 'Pokédex' }} />
      <Stack.Screen name="pokedex/profile" options={{ title: 'Profile', presentation: 'transparentModal', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="pokedex/stats" options={{ title: 'Collection stats', presentation: 'transparentModal', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="pokedex/entry/[id]" options={{ title: 'Saved specimen', presentation: 'transparentModal', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
    </Stack>
  </PokedexProvider></GestureHandlerRootView>;
}
