import { Directory, File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { photoName } from '@/utils/photo-name';
import { uploadPhoto } from '@/utils/photo-upload';

export async function savePhoto(uri: string, takenAt: Date) {
  const fileName = photoName(takenAt);
  const directory = new Directory(Paths.cache, 'pending-captures');
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, fileName.replace(/\.png$/, '.jpg'));
  await new File(uri).copy(destination);
  return { fileName, localUri: destination.uri, ...await syncPhoto(destination.uri, fileName) };
}

export async function syncPhoto(uri: string, fileName: string) {
  try {
    const { png, portrait, recognition } = await uploadPhoto(fileName, new File(uri), expoFetch as typeof fetch);
    const directory = new Directory(Paths.document, 'photos-store');
    directory.create({ intermediates: true, idempotent: true });
    const destination = new File(directory, fileName);
    await destination.write(png);
    let displayUri = destination.uri;
    if (portrait) {
      const image = new File(directory, fileName.replace(/\.png$/, '.creature.png'));
      await image.write(portrait);
      displayUri = image.uri;
    }
    if (recognition.status === 'recognized' && recognition.creature) {
      await new File(directory, fileName.replace(/\.png$/, '.creature.json')).write(JSON.stringify(recognition));
    }
    new File(uri).delete();
    return { synced: true as const, recognition, displayUri };
  } catch {
    return { synced: false as const };
  }
}
