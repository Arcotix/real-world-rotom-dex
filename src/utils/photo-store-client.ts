export function photoStoreUrl() {
  const url = process.env.EXPO_OS === 'web'
    ? `${window.location.protocol}//${window.location.hostname}:8787`
    : process.env.EXPO_PUBLIC_PHOTO_STORE_URL;
  if (!url) throw new Error('Start the app with npm start to connect to your Pokédex.');
  return url;
}

export function photoStoreHeaders() {
  return { Authorization: `Bearer ${process.env.EXPO_PUBLIC_PHOTO_STORE_TOKEN ?? ''}` };
}
