import sharp from 'sharp';

// Only the model inputs are compressed; saved source photos stay intact.
export async function compressModelImage(image) {
  return sharp(image, { limitInputPixels: 80000000 })
    .rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#e8e8e8' })
    .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

export async function prepareCreatureCanvas(png) {
  const { data, info } = await sharp(png, { limitInputPixels: 80000000 })
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1, count = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 48) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
  }
  if (count < 64) return null;
  // Give Terra and the image generator a clear, tightly cropped identity
  // reference with the entire camera scene intact. Terra selects the main object.
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(672, 672, { fit: 'contain', background: '#0000' })
    .extend({ top: 48, bottom: 48, left: 48, right: 48, background: '#0000' })
    .png().toBuffer();
}
