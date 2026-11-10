import { photoName } from '@/utils/photo-name';
import { uploadPhoto } from '@/utils/photo-upload';

// Keep the captured data URI available for retry if the local server is offline.
export async function savePhoto(uri: string, takenAt: Date) {
  const fileName = photoName(takenAt);
  return { fileName, localUri: uri, ...await syncPhoto(uri, fileName) };
}

export async function syncPhoto(uri: string, fileName: string) {
  try {
    const image = await fetch(uri);
    const { png, portrait, recognition } = await uploadPhoto(fileName, await image.blob());
    const displayUri = URL.createObjectURL(new Blob([(portrait ?? png).buffer], { type: 'image/png' }));
    return { synced: true as const, recognition, displayUri };
  } catch {
    return { synced: false as const };
  }
}
