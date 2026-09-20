// Deterministic crop/resampling only. Never redraw or recolour the supplied mascot.
// Run from apps/web: node scripts/generate-app-icons.mjs
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = new URL("../assets/branding/boodschappenmaatje-original.jpeg", import.meta.url);
const output = new URL("../public/icons/", import.meta.url);
const bytes = await readFile(source);
const crop = { left: 72, top: 60, width: 1112, height: 1112 };
const { data, info } = await sharp(bytes).extract(crop).removeAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const blue = (offset) => data[offset + 2] - data[offset] > 55;

// The original rounded tile has white outside its corners. Extend only the
// surrounding blue into that exterior; every interior mascot pixel is kept.
for (let y = 0; y < info.height; y++) {
  const row = y * info.width * 3;
  let left = 0, right = info.width - 1;
  while (left < info.width / 4 && !blue(row + left * 3)) left++;
  while (right > info.width * 3 / 4 && !blue(row + right * 3)) right--;
  if (!blue(row + left * 3) || !blue(row + right * 3)) {
    throw new Error("Source crop no longer has the expected blue border");
  }
  if (left > 0) {
    const colour = data.subarray(row + (left + 4) * 3, row + (left + 5) * 3);
    for (let x = 0; x <= left; x++) data.set(colour, row + x * 3);
  }
  if (right < info.width - 1) {
    const colour = data.subarray(row + (right - 4) * 3, row + (right - 3) * 3);
    for (let x = right; x < info.width; x++) data.set(colour, row + x * 3);
  }
}

const master = () => sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
await mkdir(output, { recursive: true });
for (const [name, size] of [
  ["maatje-v1-apple-touch", 180], ["maatje-v1-192", 192], ["maatje-v1-512", 512],
  ["maatje-v1-favicon-16", 16], ["maatje-v1-favicon-32", 32],
]) {
  await master().resize(size, size, { kernel: "lanczos3" }).png()
    .toFile(new URL(`${name}.png`, output).pathname);
}

// Fit the actual foreground (white receipt/hands and navy outlines) inside
// the 40%-radius maskable safe circle, with another 4px safety margin.
let foregroundRadius = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const i = (y * info.width + x) * 3;
  const navy = data[i + 2] < 135 && data[i + 1] < 95;
  const white = data[i] > 170 && Math.abs(data[i] - data[i + 1]) < 25 && Math.abs(data[i + 1] - data[i + 2]) < 25;
  if (navy || white) {
    foregroundRadius = Math.max(foregroundRadius,
      Math.hypot(x - (info.width - 1) / 2, y - (info.height - 1) / 2));
  }
}
const maskSize = Math.floor(Math.min(390, (512 * 0.4 - 4) * info.width / foregroundRadius) / 2) * 2;
const pad = (512 - maskSize) / 2;
// Blue-only padding: sample the source's top/bottom background colours. A
// rounded alpha mask affects only blue outer corners, never the mascot.
const background = Buffer.alloc(512 * 512 * 3);
const top = data.subarray(Math.floor(info.width / 2) * 3, Math.floor(info.width / 2) * 3 + 3);
const bottomOffset = ((info.height - 1) * info.width + Math.floor(info.width / 2)) * 3;
const bottom = data.subarray(bottomOffset, bottomOffset + 3);
for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) for (let c = 0; c < 3; c++) {
  background[(y * 512 + x) * 3 + c] = Math.round(top[c] * (1 - y / 511) + bottom[c] * y / 511);
}
const roundMask = Buffer.from(`<svg width="${maskSize}" height="${maskSize}"><rect width="100%" height="100%" rx="${maskSize * 0.2}" fill="white"/></svg>`);
const paddedLogo = await master().resize(maskSize, maskSize, { kernel: "lanczos3" })
  .composite([{ input: roundMask, blend: "dest-in" }]).png().toBuffer();
await sharp(background, { raw: { width: 512, height: 512, channels: 3 } })
  .composite([{ input: paddedLogo, left: pad, top: pad }]).removeAlpha()
  .png().toFile(new URL("maatje-v1-maskable-512.png", output).pathname);

// PNG-compressed ICO directory, supported by modern browsers, 16/32/48px.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(size => master().resize(size, size, { kernel: "lanczos3" }).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
pngs.forEach((png, index) => {
  const p = 6 + index * 16;
  header[p] = header[p + 1] = sizes[index];
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(png.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += png.length;
});
await writeFile(new URL("maatje-v1-favicon.ico", output), Buffer.concat([header, ...pngs]));
console.log(JSON.stringify({ sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  crop, maskSize, pad, foregroundRadius, maskableForegroundRadius: foregroundRadius * maskSize / info.width }));
