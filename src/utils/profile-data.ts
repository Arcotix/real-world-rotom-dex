export type Profile = { name: string; photoUri: string | null };
export const EMPTY_PROFILE: Profile = { name: '', photoUri: null };

export function parseProfile(raw: string): Profile {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string'
    || !('photoUri' in value) || (value.photoUri !== null && typeof value.photoUri !== 'string')) {
    throw new Error('The saved profile could not be read.');
  }
  return { name: value.name, photoUri: value.photoUri };
}
