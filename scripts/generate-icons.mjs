import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(__dirname, '..', 'build');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function renderIconPixels(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const rCorner = size * 0.22;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter None

    for (let x = 0; x < size; x += 1) {
      const idx = rowStart + 1 + x * 4;
      const nx = x / size;
      const ny = y / size;

      // Rounded rect distance check
      const cx = Math.max(rCorner, Math.min(size - rCorner - 1, x));
      const cy = Math.max(rCorner, Math.min(size - rCorner - 1, y));
      const dist = Math.hypot(x - cx, y - cy);

      if (dist > rCorner + 0.5) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Base dark gradient background
      let r = Math.round(18 + nx * 16);
      let g = Math.round(22 + ny * 22);
      let b = Math.round(36 + (nx + ny) * 20);
      let a = dist > rCorner - 0.5 ? Math.round((rCorner + 0.5 - dist) * 255) : 255;

      // Glowing border ring
      if (dist > rCorner - size * 0.045) {
        r = 79;
        g = 140;
        b = 255;
      }

      // Chat bubble + code brackets motif inside center
      const inBubble = nx >= 0.22 && nx <= 0.78 && ny >= 0.24 && ny <= 0.70;
      const inTail = nx >= 0.28 && nx <= 0.40 && ny >= 0.70 && ny <= 0.80 && (nx - 0.28) <= (0.80 - ny);
      if (inBubble || inTail) {
        r = 31;
        g = 41;
        b = 64;
      }

      // Left '<' chevron
      const leftDx = Math.abs((nx - 0.34) - Math.abs(ny - 0.47) * 0.75);
      // Right '>' chevron
      const rightDx = Math.abs((0.66 - nx) - Math.abs(ny - 0.47) * 0.75);
      // Center '/' slash
      const slashDx = Math.abs((nx - 0.50) + (ny - 0.47) * 0.38);

      const inY = ny >= 0.36 && ny <= 0.58;
      if (inY && (leftDx < 0.032 || rightDx < 0.032)) {
        r = 106;
        g = 176;
        b = 255;
      } else if (inY && slashDx < 0.025) {
        r = 46;
        g = 194;
        b = 126;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }
  return raw;
}

function encodePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = deflateSync(renderIconPixels(size));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(sizes) {
  const pngs = sizes.map((size) => ({ size, data: encodePng(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const dirEntries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngs.map((p) => p.data)]);
}

function encodeIcnsFallback() {
  const entries = [
    { type: 'ic07', data: encodePng(128) },
    { type: 'ic08', data: encodePng(256) },
    { type: 'ic09', data: encodePng(512) },
  ];
  const chunks = entries.map(({ type, data }) => {
    const hdr = Buffer.alloc(8);
    hdr.write(type, 0, 4, 'ascii');
    hdr.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([hdr, data]);
  });
  const totalLen = 8 + chunks.reduce((sum, c) => sum + c.length, 0);
  const icnsHdr = Buffer.alloc(8);
  icnsHdr.write('icns', 0, 4, 'ascii');
  icnsHdr.writeUInt32BE(totalLen, 4);
  return Buffer.concat([icnsHdr, ...chunks]);
}

mkdirSync(buildDir, { recursive: true });
const png512 = encodePng(512);
writeFileSync(resolve(buildDir, 'icon.png'), png512);
writeFileSync(resolve(buildDir, 'icon.ico'), encodeIco([16, 32, 64, 256]));

if (process.platform === 'darwin') {
  const iconsetDir = resolve(buildDir, 'icon.iconset');
  try {
    mkdirSync(iconsetDir, { recursive: true });
    for (const size of [16, 32, 128, 256, 512]) {
      writeFileSync(resolve(iconsetDir, `icon_${size}x${size}.png`), encodePng(size));
      if (size <= 256) {
        writeFileSync(resolve(iconsetDir, `icon_${size}x${size}@2x.png`), encodePng(size * 2));
      }
    }
    execSync(`iconutil -c icns "${iconsetDir}" -o "${resolve(buildDir, 'icon.icns')}"`, {
      stdio: 'ignore',
    });
    rmSync(iconsetDir, { recursive: true, force: true });
  } catch {
    rmSync(iconsetDir, { recursive: true, force: true });
    writeFileSync(resolve(buildDir, 'icon.icns'), encodeIcnsFallback());
  }
} else {
  writeFileSync(resolve(buildDir, 'icon.icns'), encodeIcnsFallback());
}

console.log('Generated build/icon.png, build/icon.ico, and build/icon.icns');
