import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPortraitPrompt, createCreature, describeWithCodex, generateArtworkWithCodex, validateRecipe, CREATURE_SCHEMA, CREATURE_TYPES, EYEBROW_STYLES } from '../scripts/codex-creature.mjs';
import { compressModelImage, prepareCreatureCanvas } from '../scripts/creature-art.mjs';
import { CREATURE_RARITIES } from '../src/utils/creature-rarity.ts';

const recipe = { identified: true, object: 'stapler', name: 'Staplins', description: 'This tiny office tyrant staples mountains together and has declared a 900-year war on loose paperwork.', element: 'Steel', rarity: 'common', category: 'The Paperwork Tyrant', heightCm: 12, weightKg: 0.25 };

test('model copies are smaller JPEGs, keep their aspect ratio, and preserve source transparency', async () => {
  const source = await sharp(randomBytes(1024 * 768 * 3), { raw: { width: 1024, height: 768, channels: 3 } })
    .ensureAlpha().png().toBuffer();
  const original = Buffer.from(source);
  const compressed = await compressModelImage(source);
  const metadata = await sharp(compressed).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 384);
  assert.ok(compressed.length < source.length / 4);
  assert.deepEqual(source, original);
  const transparent = await sharp({ create: { width: 32, height: 20, channels: 4, background: '#0000' } }).png().toBuffer();
  const flattened = await compressModelImage(transparent);
  const { data, info } = await sharp(flattened).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 32, 'Small inputs must not be enlarged');
  assert.equal(info.channels, 3);
  assert.ok(data.every(value => Math.abs(value - 232) <= 2), 'Transparency should become neutral gray');
  assert.equal((await sharp(transparent).metadata()).hasAlpha, true);
});

test('empty images skip both calls; uncertain subjects skip portrait generation', async () => {
  let calls = 0;
  const empty = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#0000' } }).png().toBuffer();
  assert.equal(await prepareCreatureCanvas(empty), null);
  assert.deepEqual(await createCreature(empty, { describe: async () => { calls++; return recipe; }, generate: async () => { calls++; } }), { status: 'uncertain' });
  assert.equal(calls, 0);
  const visible = await sharp({ create: { width: 80, height: 80, channels: 4, background: '#af7254' } }).png().toBuffer();
  let portraits = 0;
  assert.deepEqual(await createCreature(visible, { describe: async () => ({ identified: false }), generate: async () => { portraits++; } }), { status: 'uncertain' });
  assert.equal(portraits, 0);
});

test('portrait waits for the selected type and uses the same photo, preserving the original', { timeout: 2000 }, async () => {
  const subject = await sharp({ create: { width: 200, height: 120, channels: 4, background: '#af7254' } }).png().toBuffer();
  const original = Buffer.from(subject);
  const artwork = await sharp({ create: { width: 512, height: 768, channels: 3, background: '#5f57bf' } }).png().toBuffer();
  let descriptionFinished = false;
  let describedCanvas;
  const result = await createCreature(subject, { describe: async (image) => {
    describedCanvas = image;
    await Promise.resolve();
    descriptionFinished = true;
    assert.equal((await sharp(image).metadata()).width, 768);
    return recipe;
  }, generate: async (canvas, eyebrow, { element }) => {
    assert.equal(descriptionFinished, true);
    assert.equal(element, recipe.element);
    assert.deepEqual(canvas, describedCanvas);
    assert.ok(EYEBROW_STYLES.includes(eyebrow));
    const prompt = buildPortraitPrompt(eyebrow, recipe.element);
    assert.ok(!prompt.includes(recipe.description));
    assert.ok(!prompt.includes(recipe.name));
    return artwork;
  } });
  assert.equal(result.status, 'recognized');
  assert.equal(result.creature.name, recipe.name);
  assert.equal(result.creature.description, recipe.description);
  assert.equal(result.creature.style, 'dex-v2');
  assert.equal(result.creature.category, recipe.category);
  assert.equal(result.creature.rarity, recipe.rarity);
  assert.equal(result.generation.portraitPrompt, buildPortraitPrompt(result.creature.eyebrow, recipe.element));
  assert.ok(EYEBROW_STYLES.includes(result.creature.eyebrow));
  assert.ok(result.generation.portraitPrompt.includes(result.creature.eyebrow));
  assert.doesNotMatch(result.generation.portraitPrompt, /card|grand|anime illustration/i);
  assert.match(result.generation.portraitPrompt, /photorealistic 3D/);
  assert.match(result.generation.portraitPrompt, /transparent_background option to true/);
  assert.deepEqual(result.portrait, artwork);
  assert.deepEqual(subject, original);
  assert.equal(result.generation.model, 'gpt-5.6-terra');
  assert.ok(result.generation.timingsMs.total >= result.generation.timingsMs.description);
  assert.ok(result.generation.timingsMs.total >= result.generation.timingsMs.portrait);
});

test('failed description skips artwork; failed artwork releases the queue for the next capture', { timeout: 2000 }, async () => {
  const subject = await sharp({ create: { width: 80, height: 80, channels: 4, background: '#af7254' } }).png().toBuffer();
  let portraits = 0;
  await assert.rejects(createCreature(subject, {
    describe: async () => { throw new Error('Description failed'); },
    generate: async () => { portraits++; },
  }), /Description failed/);
  assert.equal(portraits, 0);
  await assert.rejects(createCreature(subject, {
    describe: async () => recipe,
    generate: async () => { throw new Error('Portrait failed'); },
  }), /Portrait failed/);
  const next = await createCreature(subject, { describe: async () => recipe, generate: async () => subject });
  assert.equal(next.status, 'recognized');
});

test('every supported type has an aura and Fire and Electric use their selected effects', () => {
  for (const element of CREATURE_TYPES) {
    const prompt = buildPortraitPrompt(EYEBROW_STYLES[0], element);
    assert.ok(prompt.includes(`selected type is ${element}`));
    assert.match(prompt, /aura/);
    assert.match(prompt, /fully transparent/);
    assert.doesNotMatch(prompt, /undefined/);
  }
  assert.match(buildPortraitPrompt(undefined, 'Fire'), /fiery aura.*flames/);
  assert.match(buildPortraitPrompt(undefined, 'Electric'), /lightning aura.*electric arcs/);
  assert.throws(() => buildPortraitPrompt(undefined, 'Fire/Water'), /Invalid creature type/);
});

test('invalid description and entry fields are rejected', () => {
  for (const invalid of [null, { ...recipe, rarity: undefined }, { ...recipe, rarity: 'ultra rare' }, { ...recipe, name: 'x'.repeat(41) }, { ...recipe, description: 'x'.repeat(241) },
    { ...recipe, heightCm: 0 }, { ...recipe, heightCm: Infinity }, { ...recipe, weightKg: -1 }, { ...recipe, weightKg: '1' },
    { ...recipe, element: 'Static' }, { ...recipe, element: 'Fire/Water' }, { ...recipe, category: '' }, { ...recipe, category: 'x'.repeat(41) }, { ...recipe, element: 'x'.repeat(17) }]) assert.throws(() => validateRecipe(invalid));
  assert.deepEqual(validateRecipe(recipe), recipe);
  assert.equal(CREATURE_TYPES.length, 18);
  assert.deepEqual(CREATURE_SCHEMA.properties.element.enum, CREATURE_TYPES);
  assert.deepEqual(CREATURE_SCHEMA.properties.rarity.enum, CREATURE_RARITIES);
  for (const rarity of CREATURE_RARITIES) assert.equal(validateRecipe({ ...recipe, rarity }).rarity, rarity);
  for (const element of CREATURE_TYPES) assert.equal(validateRecipe({ ...recipe, element }).element, element);
});

test('Codex uses Terra for both steps, passes the selected type into the photo edit prompt, and returns actual decoded artwork', { timeout: 5000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rotom-fake-codex-'));
  const binary = join(directory, 'codex');
  const previous = process.env.CODEX_BIN;
  const image = await sharp({ create: { width: 512, height: 768, channels: 4, background: '#caad68' } }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#0000' }).png().toBuffer();
  try {
    await writeFile(binary, `#!${process.execPath}
const fs = require('node:fs/promises');
const path = require('node:path');
const args = process.argv.slice(2);
process.stdin.resume();
process.stdin.on('end', async () => {
  if (!args.includes('--ephemeral') || !args.includes('shell_tool') || !args.includes('--image') || args[args.indexOf('--model') + 1] !== 'gpt-5.6-terra' || !args.includes('model_reasoning_effort="none"')) process.exit(2);
  const schema = JSON.parse(await fs.readFile(args[args.indexOf('--output-schema') + 1], 'utf8'));
  if (schema.additionalProperties !== false) process.exit(3);
  const image = await fs.readFile(args[args.indexOf('--image') + 1]);
  if (image[0] !== 255 || image[1] !== 216 || !args[args.indexOf('--image') + 1].endsWith('.jpg')) process.exit(4);
  let result = ${JSON.stringify(recipe)};
  if (schema.properties.image_path) {
    if (!args.includes('--enable') || args.at(-1).includes(${JSON.stringify(recipe.description)}) || !args.at(-1).includes('TRUE TRANSPARENT ALPHA BACKGROUND') || !args.at(-1).includes('selected type is Electric') || !args.at(-1).includes('lightning aura') || args.filter(x => x === '--image').length !== 1) process.exit(5);
    const imagePath = path.join(process.cwd(), 'generated-artwork.png');
    await fs.writeFile(imagePath, Buffer.from('${image.toString('base64')}', 'base64'));
    result = { image_path: imagePath };
  }
  await fs.writeFile(args[args.indexOf('--output-last-message') + 1], JSON.stringify(result));
  console.log('Unstructured diagnostic text is not the result');
});
`, { mode: 0o700 });
    process.env.CODEX_BIN = binary;
    assert.deepEqual(await describeWithCodex(image), recipe);
    const artwork = await generateArtworkWithCodex(image, EYEBROW_STYLES[0], { element: 'Electric' });
    const metadata = await sharp(artwork).metadata();
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 1024);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.hasAlpha, true);
    assert.equal((await sharp(artwork).stats()).isOpaque, false);
    const opaque = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#fff' } }).png().toBuffer();
    await writeFile(binary, (await readFile(binary, 'utf8')).replace(image.toString('base64'), opaque.toString('base64')));
    await assert.rejects(generateArtworkWithCodex(image, EYEBROW_STYLES[0], { element: 'Electric' }), /transparent background/);
  } finally {
    if (previous === undefined) delete process.env.CODEX_BIN; else process.env.CODEX_BIN = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
