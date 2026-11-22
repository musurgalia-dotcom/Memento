import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR || './private-storage');

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_VIDEO_MIME = new Set([
  'video/webm',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8',
  'video/mp4',
]);

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

export function resolveSafeStoragePath(relativeKey: string): string {
  const normalized = relativeKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(STORAGE_ROOT, normalized);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error('Invalid storage path.');
  }
  return resolved;
}

function extensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase().split(';')[0].trim();
  switch (lower) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'video/webm':
      return 'webm';
    case 'video/mp4':
      return 'mp4';
    default:
      return 'bin';
  }
}

export function validateUploadedImage(file: { mimetype: string; size: number }) {
  const baseMime = file.mimetype.toLowerCase().split(';')[0].trim();
  if (!ALLOWED_IMAGE_MIME.has(baseMime)) {
    throw new Error(`Unsupported image format (${file.mimetype}). Please select JPG, PNG, WEBP, or HEIC.`);
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Each photograph must be between 1 byte and 15 MB.');
  }
}

export async function saveOriginalPhoto(params: {
  userId: string;
  memoryId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const ext = extensionFromMime(params.mimeType);
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const key = `users/${params.userId}/memories/${params.memoryId}/originals/${fileName}`;
  const fullPath = resolveSafeStoragePath(key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, params.buffer);
  return key;
}

export async function saveGeneratedArtifact(params: {
  userId: string;
  memoryId: string;
  kind: 'collage' | 'video';
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const baseMime = params.mimeType.toLowerCase().split(';')[0].trim();
  if (params.kind === 'video') {
    if (!ALLOWED_VIDEO_MIME.has(params.mimeType.toLowerCase()) && !ALLOWED_VIDEO_MIME.has(baseMime)) {
      throw new Error('Unsupported video format.');
    }
    if (params.buffer.byteLength <= 0 || params.buffer.byteLength > MAX_VIDEO_BYTES) {
      throw new Error('Video size exceeds 80 MB limit.');
    }
  }
  const ext = extensionFromMime(params.mimeType);
  const fileName = `${params.kind}-${Date.now()}.${ext}`;
  const key = `users/${params.userId}/memories/${params.memoryId}/generated/${fileName}`;
  const fullPath = resolveSafeStoragePath(key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, params.buffer);
  return key;
}

export async function readPrivateFile(fileKey: string): Promise<Buffer> {
  const fullPath = resolveSafeStoragePath(fileKey);
  return fs.readFile(fullPath);
}

export async function deleteMemoryDirectory(userId: string, memoryId: string): Promise<void> {
  const dir = resolveSafeStoragePath(`users/${userId}/memories/${memoryId}`);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function deleteUserDirectory(userId: string): Promise<void> {
  const dir = resolveSafeStoragePath(`users/${userId}`);
  await fs.rm(dir, { recursive: true, force: true });
}
