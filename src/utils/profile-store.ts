import { Directory, File, Paths } from 'expo-file-system';
import { EMPTY_PROFILE, parseProfile, type Profile } from '@/utils/profile-data';

const directory = () => new Directory(Paths.document, 'trainer-profile');
const record = () => new File(directory(), 'profile.json');

export async function loadProfile(): Promise<Profile> {
  const file = record();
  if (!file.exists) return { ...EMPTY_PROFILE };
  const profile = parseProfile(await file.text());
  // Store a relative filename so iOS container path changes do not break the photo.
  if (profile.photoUri) profile.photoUri = new File(directory(), profile.photoUri).uri;
  return profile;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const folder = directory();
  folder.create({ intermediates: true, idempotent: true });
  const previous = await loadProfile();
  let photo = profile.photoUri ? new File(profile.photoUri) : null;
  let copied: File | null = null;
  try {
    if (photo && photo.uri !== previous.photoUri) {
      copied = new File(folder, `portrait-${Date.now()}.${photo.extension.replace(/^\./, '') || 'jpg'}`);
      await photo.copy(copied);
      photo = copied;
    }
    const saved = { name: profile.name.trim(), photoUri: photo?.uri ?? null };
    const pending = new File(folder, 'profile.pending.json');
    await pending.write(JSON.stringify({ ...saved, photoUri: photo?.name ?? null }));
    await pending.move(record(), { overwrite: true });
    if (previous.photoUri && previous.photoUri !== saved.photoUri) {
      try { new File(previous.photoUri).delete(); } catch { /* The saved record already points to the new photo. */ }
    }
    return saved;
  } catch (error) {
    try { copied?.delete(); } catch { /* Preserve the original save error. */ }
    throw error;
  }
}
