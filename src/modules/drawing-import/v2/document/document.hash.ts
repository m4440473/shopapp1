import { createHash } from 'node:crypto';

import sharp from 'sharp';

import type { PageDuplicateHashes } from './document.types';

export function sha256Hex(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex');
}

function bitsToHex(bits: boolean[]) {
  let result = '';
  for (let index = 0; index < bits.length; index += 4) {
    const nibble = bits.slice(index, index + 4).reduce((value, bit) => (value << 1) | Number(bit), 0);
    result += nibble.toString(16);
  }
  return result;
}

export async function normalizedRenderHash(image: Buffer) {
  const normalized = await sharp(image, { failOn: 'none' })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize(256, 256, { fit: 'contain', background: '#ffffff' })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
  return sha256Hex(normalized);
}

export async function differenceHash(image: Buffer) {
  const { data } = await sharp(image, { failOn: 'none' })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bits: boolean[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column;
      bits.push(data[offset] > data[offset + 1]);
    }
  }
  return bitsToHex(bits);
}

export async function buildPageDuplicateHashes({
  sourceBytes,
  pageBytes,
  previewBytes,
}: {
  sourceBytes: Buffer;
  pageBytes: Buffer;
  previewBytes?: Buffer | null;
}): Promise<PageDuplicateHashes> {
  return {
    sourceHash: sha256Hex(sourceBytes),
    pageContentHash: sha256Hex(pageBytes),
    normalizedRenderHash: previewBytes ? await normalizedRenderHash(previewBytes) : null,
    perceptualHash: previewBytes ? await differenceHash(previewBytes) : null,
  };
}
