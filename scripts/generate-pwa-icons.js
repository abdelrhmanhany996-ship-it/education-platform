import fs from 'node:fs';
import path from 'node:path';

function createSolidPngBuffer(width, height, rVal, gVal, bVal) {
  const p = (n) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = data.length;
    const t = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([t, data]));
    return Buffer.concat([Buffer.from(p(len)), t, data, Buffer.from(p(crc))]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.from([
    ...p(width),
    ...p(height),
    8, // bit depth
    2, // RGB
    0, 0, 0
  ]);
  const ihdr = chunk('IHDR', ihdrData);

  const rowLen = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const idx = offset + 1 + x * 3;
      const isCenter = Math.abs(x - width / 2) < width * 0.35 && Math.abs(y - height / 2) < height * 0.35;
      if (isCenter) {
        rawData[idx] = 56;
        rawData[idx + 1] = 189;
        rawData[idx + 2] = 248;
      } else {
        rawData[idx] = rVal;
        rawData[idx + 1] = gVal;
        rawData[idx + 2] = bVal;
      }
    }
  }

  const zlibHeader = Buffer.from([0x78, 0x01]);
  let blocks = [];
  const maxBlock = 65535;
  for (let i = 0; i < rawData.length; i += maxBlock) {
    const chunkData = rawData.subarray(i, i + maxBlock);
    const isLast = i + maxBlock >= rawData.length;
    const len = chunkData.length;
    const nlen = len ^ 0xffff;
    const h = Buffer.from([isLast ? 0x01 : 0x00, len & 0xff, (len >> 8) & 0xff, nlen & 0xff, (nlen >> 8) & 0xff]);
    blocks.push(h, chunkData);
  }

  let adlerA = 1, adlerB = 0;
  for (let i = 0; i < rawData.length; i++) {
    adlerA = (adlerA + rawData[i]) % 65521;
    adlerB = (adlerB + adlerA) % 65521;
  }
  const adler = Buffer.from(p((adlerB << 16) | adlerA));

  const idat = chunk('IDAT', Buffer.concat([zlibHeader, ...blocks, adler]));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createSolidPngBuffer(192, 192, 15, 23, 42));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createSolidPngBuffer(512, 512, 15, 23, 42));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createSolidPngBuffer(512, 512, 15, 23, 42));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createSolidPngBuffer(180, 180, 15, 23, 42));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createSolidPngBuffer(64, 64, 15, 23, 42));

console.log('✓ Generated PWA PNG icon assets in public/');
