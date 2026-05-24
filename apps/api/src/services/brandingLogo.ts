import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const BRANDING_LOGO_CLEANUP_VERSION = 1;

const WHITE_THRESHOLD = 245;
const MIN_VISIBLE_ALPHA = 12;
const OUTPUT_PADDING = 18;
const MAX_OUTPUT_WIDTH = 900;
const MAX_OUTPUT_HEIGHT = 320;
const PWA_ICON_SIZE = 512;

type LogoStorageOptions = {
  assetsDir: string;
  assetFolder: string;
  assetBaseName: string;
};

export async function normalizeAndStoreBrandingLogoFromDataUrl(dataUrl: string, options: LogoStorageOptions) {
  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) {
    return null;
  }

  return normalizeAndStoreBrandingLogoBuffer(parsed.buffer, options);
}

export async function normalizeExistingBrandingLogoAsset(logoUrl: string, options: LogoStorageOptions) {
  const filePath = resolveExistingLogoPath(logoUrl, options);
  if (!filePath) {
    return null;
  }

  const source = await readFile(filePath);
  return normalizeAndStoreBrandingLogoBuffer(source, options);
}

export async function normalizeAndStoreBrandingPwaIconFromDataUrl(dataUrl: string, options: LogoStorageOptions) {
  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) {
    return null;
  }

  return normalizeAndStoreBrandingPwaIconBuffer(parsed.buffer, options);
}

function parseDataUrlImage(dataUrl: string): { buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match?.[2]) {
    return null;
  }

  return {
    buffer: Buffer.from(match[2], "base64")
  };
}

function resolveExistingLogoPath(logoUrl: string, options: LogoStorageOptions) {
  if (!logoUrl.startsWith("/uploads/")) {
    return null;
  }

  const fileName = path.basename(logoUrl.split("?")[0] ?? "");
  if (!fileName) {
    return null;
  }

  return path.join(options.assetsDir, options.assetFolder, fileName);
}

async function normalizeAndStoreBrandingLogoBuffer(source: Buffer, options: LogoStorageOptions) {
  const prepared = await sharp(source)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = prepared;
  const pixels = new Uint8ClampedArray(data);
  floodTransparentAndNearWhiteBorders(pixels, info.width, info.height);

  const bounds = computeOpaqueBounds(pixels, info.width, info.height);
  const outputBuffer = await renderNormalizedLogo(pixels, info.width, info.height, bounds);

  const folderPath = path.join(options.assetsDir, options.assetFolder);
  await mkdir(folderPath, { recursive: true });

  const filename = `${options.assetBaseName}.png`;
  const filePath = path.join(folderPath, filename);
  await writeFile(filePath, outputBuffer);

  return `/uploads/${options.assetFolder}/${filename}?v=${Date.now()}`;
}

async function normalizeAndStoreBrandingPwaIconBuffer(source: Buffer, options: LogoStorageOptions) {
  const prepared = await sharp(source)
    .rotate()
    .resize({
      width: PWA_ICON_SIZE,
      height: PWA_ICON_SIZE,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  const folderPath = path.join(options.assetsDir, options.assetFolder);
  await mkdir(folderPath, { recursive: true });

  const filename = `${options.assetBaseName}.png`;
  const filePath = path.join(folderPath, filename);
  await writeFile(filePath, prepared);

  return `/uploads/${options.assetFolder}/${filename}?v=${Date.now()}`;
}

function floodTransparentAndNearWhiteBorders(pixels: Uint8ClampedArray, width: number, height: number) {
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  const pushIfCandidate = (x: number, y: number) => {
    const index = y * width + x;
    if (visited[index]) return;
    if (!isBackgroundCandidate(pixels, index * 4)) return;
    visited[index] = 1;
    queue[queueEnd++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    pushIfCandidate(x, 0);
    pushIfCandidate(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    pushIfCandidate(0, y);
    pushIfCandidate(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart++]!;
    const pixelOffset = index * 4;
    pixels[pixelOffset + 3] = 0;

    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) pushIfCandidate(x - 1, y);
    if (x < width - 1) pushIfCandidate(x + 1, y);
    if (y > 0) pushIfCandidate(x, y - 1);
    if (y < height - 1) pushIfCandidate(x, y + 1);
  }
}

function isBackgroundCandidate(pixels: Uint8ClampedArray, offset: number) {
  const alpha = pixels[offset + 3] ?? 0;
  if (alpha <= MIN_VISIBLE_ALPHA) {
    return true;
  }

  const red = pixels[offset] ?? 0;
  const green = pixels[offset + 1] ?? 0;
  const blue = pixels[offset + 2] ?? 0;

  return red >= WHITE_THRESHOLD && green >= WHITE_THRESHOLD && blue >= WHITE_THRESHOLD;
}

function computeOpaqueBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= MIN_VISIBLE_ALPHA) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      left: 0,
      top: 0,
      width,
      height
    };
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

async function renderNormalizedLogo(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: { left: number; top: number; width: number; height: number }
) {
  const extracted = await sharp(Buffer.from(pixels), {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .extract(bounds)
    .extend({
      top: OUTPUT_PADDING,
      bottom: OUTPUT_PADDING,
      left: OUTPUT_PADDING,
      right: OUTPUT_PADDING,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .resize({
      width: MAX_OUTPUT_WIDTH,
      height: MAX_OUTPUT_HEIGHT,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();

  return extracted;
}
