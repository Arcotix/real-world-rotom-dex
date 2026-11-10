import { parseRecognition } from '@/utils/recognition';

export async function uploadPhoto(fileName: string, body: Blob, uploadFetch: typeof fetch = fetch) {
  const baseUrl = process.env.EXPO_OS === 'web'
    ? `${window.location.protocol}//${window.location.hostname}:8787`
    : process.env.EXPO_PUBLIC_PHOTO_STORE_URL;
  if (!baseUrl) throw new Error('Start the app with npm start to connect photos-store.');
  const response = await uploadFetch(`${baseUrl}/photos/${encodeURIComponent(fileName)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_PHOTO_STORE_TOKEN ?? ''}`,
    },
    body,
    signal: AbortSignal.timeout(420000),
  });
  if (!response.ok) throw new Error(`Photo save failed (${response.status}).`);
  if (!response.headers.get('Content-Type')?.startsWith('image/png')) throw new Error('Expected a processed PNG.');
  const png = new Uint8Array(await response.arrayBuffer());
  let recognition = parseRecognition(response.headers.get('X-Object-Recognition'));
  let portrait: Uint8Array<ArrayBuffer> | null = null;
  if (recognition.status === 'recognized' && recognition.creature) {
    // Only fetch a portrait belonging to this capture, from our authenticated server.
    if (recognition.creature.imageName !== fileName.replace(/\.png$/, '.creature.png')) recognition = { status: 'unavailable' };
    else {
      try {
        const image = await uploadFetch(`${baseUrl}/photos/${recognition.creature.imageName}`, {
          headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_PHOTO_STORE_TOKEN ?? ''}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!image.ok || !image.headers.get('Content-Type')?.startsWith('image/png')) throw new Error('Portrait unavailable');
        portrait = new Uint8Array(await image.arrayBuffer());
      } catch { recognition = { status: 'unavailable' }; }
    }
  }
  return { png, portrait, recognition };
}
