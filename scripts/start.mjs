import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createPhotoStore } from './photo-store.mjs';

const directory = fileURLToPath(new URL('../photos-store/', import.meta.url));
const entriesDirectory = fileURLToPath(new URL('../saved-pokedex-entries/', import.meta.url));
const token = randomBytes(32).toString('hex');
const addresses = Object.entries(networkInterfaces()).filter(([name]) => !/docker|virbr|veth|tun/i.test(name)).flatMap(([, entries]) => entries ?? []);
const host = process.env.PHOTO_STORE_HOST || addresses.find((entry) => entry.family === 'IPv4' && !entry.internal)?.address || '127.0.0.1';
const store = createPhotoStore({ directory, entriesDirectory, token });
store.on('error', (error) => { console.error(`Photo store could not start: ${error.message}`); process.exit(1); });
store.listen(8787, '0.0.0.0', () => {
  console.log(`Photos save to ${directory}`);
  console.log(`Captured Pokédex entries save to ${entriesDirectory}`);
  console.log('Pokédex entries use GPT-5.6 Terra and transparent 3D object generation. Run codex login if needed.');
  const cli = fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url));
  const expo = spawn(process.execPath, [cli, 'start', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_PHOTO_STORE_URL: `http://${host}:8787`,
      EXPO_PUBLIC_PHOTO_STORE_TOKEN: token,
    },
  });
  const stop = () => { expo.kill('SIGTERM'); store.close(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  expo.on('exit', (code) => { store.close(); process.exitCode = code ?? 0; });
});
