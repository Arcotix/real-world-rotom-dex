import { EMPTY_PROFILE, parseProfile, type Profile } from '@/utils/profile-data';

const KEY = 'rotom-dex-profile';

export async function loadProfile(): Promise<Profile> {
  const raw = localStorage.getItem(KEY);
  return raw ? parseProfile(raw) : { ...EMPTY_PROFILE };
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const saved = { name: profile.name.trim(), photoUri: profile.photoUri };
  localStorage.setItem(KEY, JSON.stringify(saved));
  return saved;
}
