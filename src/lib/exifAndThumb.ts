import type { ImageVisualAnalysis } from './artLibrary';
import type { AppLanguage } from './types';

export interface ExtractedPhotoMeta {
  captureDate: string | null;
  captureTime: string | null; // HH:MM:SS
  captureMinutes: number | null; // 0..1439
  dateSource: 'exif' | 'file-modified' | 'manual' | 'unknown';
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1980 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function parseExifDateTimeString(raw: string): {
  date: string;
  time: string | null;
  minutes: number | null;
} | null {
  const m = raw.match(/(\d{4})[:\-](\d{2})[:\-](\d{2})(?:[\sT]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidCalendarDate(y, mo, d)) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] !== undefined && m[5] !== undefined) {
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] !== undefined ? Number(m[6]) : 0;
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59) {
      return {
        date,
        time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
        minutes: hh * 60 + mm,
      };
    }
  }
  return { date, time: null, minutes: null };
}

function parseFilenameDateTime(name: string): {
  date: string;
  time: string | null;
  minutes: number | null;
} | null {
  // Matches IMG_20240718_091522, 2024-07-18_14-30-00, PXL_20241104_194500, etc.
  const fullMatch = name.match(
    /(19\d{2}|20\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_T](\d{2})[-_:]?(\d{2})[-_:]?(\d{2})?/
  );
  if (fullMatch) {
    const y = Number(fullMatch[1]);
    const m = Number(fullMatch[2]);
    const d = Number(fullMatch[3]);
    const hh = Number(fullMatch[4]);
    const mm = Number(fullMatch[5]);
    const ss = fullMatch[6] !== undefined ? Number(fullMatch[6]) : 0;
    if (isValidCalendarDate(y, m, d) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return {
        date: `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`,
        time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(Math.min(59, ss)).padStart(2, '0')}`,
        minutes: hh * 60 + mm,
      };
    }
  }

  const dashMatch = name.match(/(19\d{2}|20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (dashMatch) {
    const y = Number(dashMatch[1]);
    const m = Number(dashMatch[2]);
    const d = Number(dashMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { date: `${dashMatch[1]}-${dashMatch[2]}-${dashMatch[3]}`, time: null, minutes: null };
    }
  }
  const compactMatch = name.match(/(19\d{2}|20\d{2})(\d{2})(\d{2})/);
  if (compactMatch) {
    const y = Number(compactMatch[1]);
    const m = Number(compactMatch[2]);
    const d = Number(compactMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { date: `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`, time: null, minutes: null };
    }
  }
  return null;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  const max = Math.min(view.byteLength, offset + length);
  for (let i = offset; i < max; i++) {
    const code = view.getUint8(i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

/**
 * Fast zero-dependency JPEG EXIF APP1 scanner reading TIFF IFD0/ExifIFD
 * DateTimeOriginal (0x9003), DateTimeDigitized (0x9004), and DateTime (0x0132)
 * including time-of-day (HH:MM:SS) for sub-day event clustering.
 */
export async function extractExifCaptureDate(file: File): Promise<ExtractedPhotoMeta> {
  try {
    const headerSlice = file.slice(0, 131072);
    const buffer = await headerSlice.arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength >= 12 && view.getUint16(0, false) === 0xffd8) {
      let offset = 2;
      while (offset + 4 < view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          const length = view.getUint16(offset, false);
          if (offset + 8 < view.byteLength && readAscii(view, offset + 2, 4) === 'Exif') {
            const tiffStart = offset + 8;
            if (tiffStart + 8 < view.byteLength) {
              const byteOrder = view.getUint16(tiffStart, false);
              const little = byteOrder === 0x4949;
              if (little || byteOrder === 0x4d4d) {
                const ifd0Offset = view.getUint32(tiffStart + 4, little);
                const scanIfd = (
                  absStart: number
                ): { parsed: { date: string; time: string | null; minutes: number | null } | null; exifPtr: number | null } => {
                  if (absStart + 2 > view.byteLength) return { parsed: null, exifPtr: null };
                  const entries = view.getUint16(absStart, little);
                  let found: { date: string; time: string | null; minutes: number | null } | null = null;
                  let exifPtr: number | null = null;
                  for (let i = 0; i < entries; i++) {
                    const entryPos = absStart + 2 + i * 12;
                    if (entryPos + 12 > view.byteLength) break;
                    const tag = view.getUint16(entryPos, little);
                    const count = view.getUint32(entryPos + 4, little);
                    const valOrOffset = view.getUint32(entryPos + 8, little);

                    if (tag === 0x8769) {
                      exifPtr = tiffStart + valOrOffset;
                    } else if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
                      const strPos = count <= 4 ? entryPos + 8 : tiffStart + valOrOffset;
                      const parsed = parseExifDateTimeString(readAscii(view, strPos, Math.min(count, 26)));
                      if (parsed) {
                        if (tag === 0x9003) return { parsed, exifPtr };
                        if (!found) found = parsed;
                      }
                    }
                  }
                  return { parsed: found, exifPtr };
                };

                const ifd0 = scanIfd(tiffStart + ifd0Offset);
                if (ifd0.exifPtr) {
                  const exifSub = scanIfd(ifd0.exifPtr);
                  if (exifSub.parsed) {
                    return {
                      captureDate: exifSub.parsed.date,
                      captureTime: exifSub.parsed.time,
                      captureMinutes: exifSub.parsed.minutes,
                      dateSource: 'exif',
                    };
                  }
                }
                if (ifd0.parsed) {
                  return {
                    captureDate: ifd0.parsed.date,
                    captureTime: ifd0.parsed.time,
                    captureMinutes: ifd0.parsed.minutes,
                    dateSource: 'exif',
                  };
                }
              }
            }
          }
          offset += length;
        } else if ((marker & 0xff00) !== 0xff00) {
          break;
        } else if (marker === 0xffda || marker === 0xffd9) {
          break;
        } else {
          if (offset + 2 > view.byteLength) break;
          offset += view.getUint16(offset, false);
        }
      }
    }
  } catch {
    // Ignore malformed EXIF and fall through safely
  }

  const fromName = parseFilenameDateTime(file.name);
  if (fromName) {
    return {
      captureDate: fromName.date,
      captureTime: fromName.time,
      captureMinutes: fromName.minutes,
      dateSource: 'exif',
    };
  }

  if (file.lastModified && file.lastModified > 0) {
    const d = new Date(file.lastModified);
    if (!Number.isNaN(d.getTime())) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return {
        captureDate: iso,
        captureTime: `${hh}:${mm}:${ss}`,
        captureMinutes: d.getHours() * 60 + d.getMinutes(),
        dateSource: 'file-modified',
      };
    }
  }

  return { captureDate: null, captureTime: null, captureMinutes: null, dateSource: 'unknown' };
}

const ANALYSIS_CACHE_KEY = 'memento_photo_analysis_cache_v1';

export function readCachedPhotoAnalysis(
  fingerprint: string,
  language: AppLanguage
): ImageVisualAnalysis | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { lang: AppLanguage; analysis: ImageVisualAnalysis }>;
    const hit = map[fingerprint];
    if (hit && hit.lang === language && hit.analysis) return hit.analysis;
    return null;
  } catch {
    return null;
  }
}

export function writeCachedPhotoAnalysis(
  entries: Array<{ fingerprint: string; language: AppLanguage; analysis: ImageVisualAnalysis }>
): void {
  if (entries.length === 0) return;
  try {
    const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
    const map: Record<string, { lang: AppLanguage; analysis: ImageVisualAnalysis; ts: number }> = raw
      ? JSON.parse(raw)
      : {};
    const now = Date.now();
    for (const e of entries) {
      map[e.fingerprint] = { lang: e.language, analysis: e.analysis, ts: now };
    }
    const keys = Object.keys(map);
    if (keys.length > 400) {
      keys
        .sort((a, b) => (map[a].ts || 0) - (map[b].ts || 0))
        .slice(0, keys.length - 400)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues
  }
}

export function clearCachedPhotoAnalyses(): void {
  try {
    localStorage.removeItem(ANALYSIS_CACHE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Generates a lightweight 512px JPEG thumbnail data URL and extracts dominant RGB colors
 * directly on canvas without holding full-resolution bitmaps in memory.
 */
export async function compressPhotoThumbnail(
  file: File,
  maxEdge = 512
): Promise<{
  thumbnailDataUrl: string;
  previewUrl: string;
  dominantColors: string[];
  brightnessScore: number;
}> {
  await yieldToMain();
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Unable to decode ${file.name}`));
      el.src = objectUrl;
    });

    const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth || maxEdge, img.naturalHeight || maxEdge));
    const w = Math.max(48, Math.round((img.naturalWidth || maxEdge) * ratio));
    const h = Math.max(48, Math.round((img.naturalHeight || maxEdge) * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable.');
    ctx.drawImage(img, 0, 0, w, h);

    // Sample pixel brightness + palette cheaply from a 48x48 downscale
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 48;
    sampleCanvas.height = 48;
    const sctx = sampleCanvas.getContext('2d');
    let brightnessScore = 0.55;
    let dominantColors = ['#C2B29F', '#6B7785', '#4E443B'];

    if (sctx) {
      sctx.drawImage(canvas, 0, 0, 48, 48);
      const data = sctx.getImageData(0, 0, 48, 48).data;
      const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
      let lumSum = 0;
      const totalPx = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        lumSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
        const curr = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
        curr.r += r;
        curr.g += g;
        curr.b += b;
        curr.count += 1;
        buckets.set(key, curr);
      }
      brightnessScore = Number((lumSum / Math.max(1, totalPx)).toFixed(2));
      const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count).slice(0, 3);
      if (sorted.length > 0) {
        dominantColors = sorted.map((c) => {
          const toHex = (n: number) => Math.round(n / c.count).toString(16).padStart(2, '0');
          return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
        });
      }
    }

    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.74);
    return {
      thumbnailDataUrl,
      previewUrl: objectUrl,
      dominantColors,
      brightnessScore,
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

export function computePhotoFingerprint(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function buildLocalFallbackAnalysis(
  dominantColors: string[],
  brightnessScore: number,
  language: AppLanguage
): ImageVisualAnalysis {
  const isDark = brightnessScore < 0.35;
  return {
    dominantColors,
    secondaryColors: dominantColors.slice(0, 2),
    lighting:
      language === 'ru'
        ? isDark
          ? 'Вечерний или камерный приглушённый свет'
          : 'Естественный дневной свет'
        : isDark
        ? 'Evening or low-key ambient light'
        : 'Natural balanced daylight',
    composition: language === 'ru' ? 'Документальный кадр' : 'Candid photographic frame',
    visibleObjects: [],
    sceneCategory: isDark ? 'night-street' : 'moment',
    timeOfDay: isDark ? 'night' : 'afternoon',
    scenery: language === 'ru' ? 'Памятный снимок из личной галереи' : 'Personal photograph from your year',
    visualTextures: [language === 'ru' ? 'Живой свет' : 'Natural grain'],
    photographicCharacteristics: 'Local preview quantization',
    brightnessScore,
    saturationScore: 0.45,
    provider: 'local-pixel-quantizer',
  };
}
