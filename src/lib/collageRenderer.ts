import { FILM_FILTERS, TYPOGRAPHY_PAIRS, type DesignSpecification } from './artLibrary';
import {
  COLLAGE_H,
  COLLAGE_W,
  buildArtisticComposition,
  type DetailItemSpec,
  type PaperScrapSpec,
  type PhotoSlotSpec,
} from './collageComposition';
import type { AppLanguage, MemoryAnswerRecord } from './types';

export interface CollageRenderInput {
  seedKey?: string;
  title?: string;
  photoUrls: string[];
  memoryDate: string;
  language?: AppLanguage;
  designSpec: DesignSpecification;
  storySnippet: string;
  isAiOnlyText?: boolean;
  handwrittenNotes: string[];
  answers?: MemoryAnswerRecord[];
  whereOrWho?: string;
  musicLabel?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Splits any text into clean wrapped lines without EVER dropping words mid-phrase.
 */
function measureLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function tracePolygonNorm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pts: Array<[number, number]>
) {
  ctx.beginPath();
  pts.forEach(([nx, ny], idx) => {
    const px = x + nx * w;
    const py = y + ny * h;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function traceArchRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const rx = w / 2;
  const ry = h * 0.34;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + ry);
  ctx.ellipse(x + w / 2, y + ry, rx, ry, 0, Math.PI, 0, false);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function traceOval(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function drawPaperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity = 0.04) {
  ctx.save();
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${intensity})` : `rgba(0,0,0,${intensity})`;
    ctx.fillRect(x, y, 2.5, 2.5);
  }
  ctx.restore();
}

function drawMixedMediaBackdrop(
  ctx: CanvasRenderingContext2D,
  spec: DesignSpecification,
  W: number,
  H: number
) {
  const techniques = spec.scrapbookPlan?.artisticTechniques || [];

  if (techniques.includes('watercolor-wash')) {
    ctx.save();
    const w1 = ctx.createRadialGradient(W * 0.2, H * 0.34, 40, W * 0.2, H * 0.34, 620);
    w1.addColorStop(0, `${spec.palette.primaryAccent}2C`);
    w1.addColorStop(0.55, `${spec.palette.secondaryAccent}16`);
    w1.addColorStop(1, 'transparent');
    ctx.fillStyle = w1;
    ctx.fillRect(0, 0, W, H);

    const w2 = ctx.createRadialGradient(W * 0.82, H * 0.7, 20, W * 0.82, H * 0.7, 540);
    w2.addColorStop(0, `${spec.palette.secondaryAccent}26`);
    w2.addColorStop(1, 'transparent');
    ctx.fillStyle = w2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (techniques.includes('linen-fibers') || spec.paperTexture === 'linen-archival') {
    ctx.save();
    ctx.strokeStyle = `${spec.palette.ink}0B`;
    ctx.lineWidth = 1;
    for (let y = 60; y < H - 60; y += 16) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(W - 50, y);
      ctx.stroke();
    }
    for (let x = 60; x < W - 60; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 50);
      ctx.lineTo(x, H - 50);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (techniques.includes('halftone-newsprint')) {
    ctx.save();
    ctx.fillStyle = `${spec.palette.ink}18`;
    for (let x = 90; x < 310; x += 14) {
      for (let y = 1720; y < 1880; y += 14) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (techniques.includes('light-leak')) {
    ctx.save();
    const leak = ctx.createLinearGradient(0, 0, 560, 860);
    leak.addColorStop(0, `${spec.palette.secondaryAccent}28`);
    leak.addColorStop(0.5, `${spec.palette.primaryAccent}12`);
    leak.addColorStop(1, 'transparent');
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, 640, 920);
    ctx.restore();
  }
}

function drawPaperScrap(ctx: CanvasRenderingContext2D, scrap: PaperScrapSpec, ink: string) {
  ctx.save();
  const cx = scrap.x + scrap.w / 2;
  const cy = scrap.y + scrap.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((scrap.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  ctx.globalAlpha = scrap.opacity;
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  if (scrap.kind === 'solid-block' || scrap.kind === 'envelope-flap') {
    ctx.fillStyle = scrap.color;
    ctx.fillRect(scrap.x, scrap.y, scrap.w, scrap.h);
  } else {
    tracePolygonNorm(ctx, scrap.x, scrap.y, scrap.w, scrap.h, scrap.polygonNorm);
    ctx.fillStyle = scrap.color;
    ctx.fill();
  }

  ctx.shadowColor = 'transparent';

  if (scrap.kind === 'vellum') {
    ctx.strokeStyle = `${ink}20`;
    ctx.lineWidth = 1.5;
    tracePolygonNorm(ctx, scrap.x, scrap.y, scrap.w, scrap.h, scrap.polygonNorm);
    ctx.stroke();
  } else if (scrap.kind === 'envelope-flap') {
    ctx.strokeStyle = `${ink}44`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scrap.x, scrap.y);
    ctx.lineTo(scrap.x + scrap.w / 2, scrap.y + scrap.h * 0.52);
    ctx.lineTo(scrap.x + scrap.w, scrap.y);
    ctx.stroke();
  } else if (scrap.kind === 'fabric-swatch') {
    ctx.strokeStyle = `${ink}24`;
    ctx.lineWidth = 1.5;
    for (let fy = scrap.y + 16; fy < scrap.y + scrap.h - 12; fy += 18) {
      ctx.beginPath();
      ctx.moveTo(scrap.x + 14, fy);
      ctx.lineTo(scrap.x + scrap.w - 14, fy);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawWashiTapeCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angleDeg: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-54, -15);
  ctx.lineTo(54, -14);
  ctx.lineTo(51, -4);
  ctx.lineTo(55, 6);
  ctx.lineTo(52, 15);
  ctx.lineTo(-54, 15);
  ctx.lineTo(-51, 5);
  ctx.lineTo(-55, -5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPaperClipCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.14);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, 68);
  ctx.arc(10, 68, 10, Math.PI, 0, true);
  ctx.lineTo(20, 10);
  ctx.arc(8, 10, 12, 0, Math.PI, true);
  ctx.lineTo(-4, 78);
  ctx.arc(10, 78, 14, Math.PI, 0, true);
  ctx.lineTo(24, 24);
  ctx.stroke();
  ctx.restore();
}

function drawTactileDetailCanvas(
  ctx: CanvasRenderingContext2D,
  item: DetailItemSpec,
  ink: string,
  surface: string,
  lang: AppLanguage
) {
  ctx.save();
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.translate(-item.w / 2, -item.h / 2);

  const w = item.w;
  const h = item.h;
  const p = item.primaryColor;
  const s = item.secondaryColor;

  ctx.strokeStyle = p;
  ctx.fillStyle = p;
  ctx.lineWidth = 2.4;

  switch (item.kind) {
    case 'pressed-flower': {
      ctx.beginPath();
      ctx.moveTo(w * 0.48, h * 0.94);
      ctx.quadraticCurveTo(w * 0.5, h * 0.6, w * 0.58, h * 0.24);
      ctx.stroke();
      const fx = w * 0.58;
      const fy = h * 0.24;
      for (let a = 0; a < 6; a++) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((a * Math.PI) / 3);
        ctx.beginPath();
        ctx.ellipse(0, -24, 11, 22, 0, 0, Math.PI * 2);
        ctx.fillStyle = `${s}44`;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(fx, fy, 8, 0, Math.PI * 2);
      ctx.fillStyle = p;
      ctx.fill();
      break;
    }

    case 'pressed-leaf': {
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-0.22);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.38);
      ctx.lineTo(w * 0.14, -h * 0.14);
      ctx.lineTo(w * 0.36, -h * 0.18);
      ctx.lineTo(w * 0.2, h * 0.08);
      ctx.lineTo(w * 0.3, h * 0.34);
      ctx.lineTo(0, h * 0.2);
      ctx.lineTo(-w * 0.3, h * 0.34);
      ctx.lineTo(-w * 0.2, h * 0.08);
      ctx.lineTo(-w * 0.36, -h * 0.18);
      ctx.lineTo(-w * 0.14, -h * 0.14);
      ctx.closePath();
      ctx.fillStyle = `${s}4C`;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.25);
      ctx.lineTo(0, h * 0.44);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'tiny-branch': {
      ctx.strokeStyle = `${ink}99`;
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h * 0.9);
      ctx.quadraticCurveTo(w * 0.45, h * 0.55, w * 0.82, h * 0.12);
      ctx.stroke();
      ctx.strokeStyle = p;
      [
        [0.32, 0.72, -0.7],
        [0.44, 0.58, 0.5],
        [0.58, 0.42, -0.65],
        [0.7, 0.28, 0.55],
      ].forEach(([nx, ny, rot]) => {
        ctx.save();
        ctx.translate(w * nx, h * ny);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = `${p}36`;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
      break;
    }

    case 'seashell-sketch': {
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.58, Math.min(w, h) * 0.34, Math.PI, 0);
      ctx.lineTo(w * 0.65, h * 0.84);
      ctx.lineTo(w * 0.35, h * 0.84);
      ctx.closePath();
      ctx.fillStyle = `${s}34`;
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'wave-ripples': {
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        const by = h * (0.28 + row * 0.22);
        for (let px = 8; px <= w - 8; px += 10) {
          const py = by + Math.sin(px * 0.04 + row) * 9;
          if (px === 8) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }

    case 'sun-doodle': {
      const rx = w * 0.5;
      const ry = h * 0.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 28, 0, Math.PI * 2);
      ctx.fillStyle = `${s}36`;
      ctx.fill();
      ctx.stroke();
      for (let a = 0; a < 12; a++) {
        const ang = (a * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(ang) * 38, ry + Math.sin(ang) * 38);
        ctx.lineTo(rx + Math.cos(ang) * (a % 2 === 0 ? 58 : 48), ry + Math.sin(ang) * (a % 2 === 0 ? 58 : 48));
        ctx.stroke();
      }
      break;
    }

    case 'rain-streaks': {
      ctx.globalAlpha = 0.65;
      for (let i = 0; i < 14; i++) {
        const rx = 20 + ((i * 37) % (w - 30));
        const ry = 16 + ((i * 43) % (h - 60));
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 12, ry + 42);
        ctx.stroke();
      }
      break;
    }

    case 'umbrella-doodle': {
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.48, 52, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = `${s}34`;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.2);
      ctx.lineTo(w * 0.5, h * 0.78);
      ctx.arc(w * 0.5 + 12, h * 0.78, 12, Math.PI, 0, true);
      ctx.stroke();
      break;
    }

    case 'camera-doodle': {
      ctx.strokeStyle = `${ink}99`;
      ctx.strokeRect(w * 0.16, h * 0.28, w * 0.68, h * 0.52);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.54, 28, 0, Math.PI * 2);
      ctx.strokeStyle = p;
      ctx.stroke();
      break;
    }

    case 'candle-doodle': {
      ctx.fillStyle = `${s}AA`;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.22, 9, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = surface;
      ctx.fillRect(w * 0.38, h * 0.36, w * 0.24, h * 0.48);
      ctx.strokeRect(w * 0.38, h * 0.36, w * 0.24, h * 0.48);
      break;
    }

    case 'confetti-scraps': {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = p;
      ctx.fillRect(w * 0.2, h * 0.2, 18, 10);
      ctx.fillStyle = s;
      ctx.beginPath();
      ctx.arc(w * 0.65, h * 0.35, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p;
      ctx.beginPath();
      ctx.moveTo(w * 0.45, h * 0.7);
      ctx.lineTo(w * 0.55, h * 0.6);
      ctx.lineTo(w * 0.52, h * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'tiny-stars': {
      const pts = [
        [w * 0.18, h * 0.72],
        [w * 0.44, h * 0.38],
        [w * 0.68, h * 0.56],
        [w * 0.86, h * 0.22],
      ];
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      break;
    }

    case 'coffee-ring-mark': {
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = s;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.52, h * 0.49, Math.min(w, h) * 0.31, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'ticket-stub':
    case 'receipt-fragment': {
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, w, h);
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = `${ink}55`;
      ctx.strokeRect(0, 0, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.font = '600 16px monospace';
      ctx.fillText(item.labelText || (lang === 'ru' ? 'БИЛЕТ' : 'MEMORY PASS'), 20, h * 0.5);
      ctx.font = '500 12px sans-serif';
      ctx.fillStyle = `${ink}99`;
      ctx.fillText('MEMENTO ARCHIVE', 20, h * 0.78);
      break;
    }

    case 'date-stamp':
    case 'postmark-seal': {
      ctx.globalAlpha = 0.68;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      ctx.font = '600 13px sans-serif';
      ctx.fillText(lang === 'ru' ? 'АРХИВ' : 'ARCHIVE', w * 0.5, h * 0.42);
      ctx.font = '600 15px monospace';
      ctx.fillText(item.labelText || '', w * 0.5, h * 0.56);
      ctx.textAlign = 'left';
      break;
    }

    case 'city-map-fragment': {
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `${ink}35`;
      ctx.strokeRect(0, 0, w, h);
      ctx.strokeStyle = `${p}55`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72);
      ctx.quadraticCurveTo(w * 0.5, h * 0.55, w, h * 0.66);
      ctx.stroke();
      ctx.strokeStyle = `${ink}44`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0);
      ctx.lineTo(w * 0.36, h);
      ctx.moveTo(w * 0.6, 0);
      ctx.lineTo(w * 0.72, h);
      ctx.moveTo(0, h * 0.35);
      ctx.lineTo(w, h * 0.45);
      ctx.stroke();
      break;
    }

    default: {
      ctx.strokeStyle = `${ink}66`;
      ctx.beginPath();
      ctx.moveTo(12, 24);
      ctx.lineTo(54, 24);
      ctx.moveTo(12, 24);
      ctx.lineTo(12, 62);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

function drawPhotoSlotCanvas(
  ctx: CanvasRenderingContext2D,
  slot: PhotoSlotSpec,
  img: HTMLImageElement,
  spec: DesignSpecification,
  film: (typeof FILM_FILTERS)[keyof typeof FILM_FILTERS],
  typo: (typeof TYPOGRAPHY_PAIRS)[keyof typeof TYPOGRAPHY_PAIRS]
) {
  ctx.save();
  const cx = slot.x + slot.w / 2;
  const cy = slot.y + slot.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((slot.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;

  const { x, y, w, h, cutoutShape } = slot;
  const pad =
    cutoutShape === 'polaroid'
      ? 22
      : cutoutShape === 'film-frame'
      ? 18
      : cutoutShape === 'raw-cut' || cutoutShape === 'torn' || cutoutShape === 'scissors-poly'
      ? 0
      : 14;
  const bottomPad = cutoutShape === 'polaroid' ? 76 : cutoutShape === 'film-frame' ? 32 : pad;
  const topPad = cutoutShape === 'film-frame' ? 32 : pad;

  // Backing Frame
  if (cutoutShape === 'torn' || cutoutShape === 'deckled') {
    tracePolygonNorm(ctx, x - 12, y - 12, w + 24, h + 24, slot.polygonNorm);
    ctx.fillStyle = spec.palette.surface;
    ctx.fill();
  } else if (cutoutShape === 'arch') {
    traceArchRect(ctx, x - 10, y - 10, w + 20, h + 20);
    ctx.fillStyle = spec.palette.surface;
    ctx.fill();
  } else if (cutoutShape === 'oval') {
    traceOval(ctx, x - 10, y - 10, w + 20, h + 20);
    ctx.fillStyle = spec.palette.surface;
    ctx.fill();
  } else if (cutoutShape === 'film-frame') {
    ctx.fillStyle = '#181818';
    ctx.fillRect(x - pad, y - topPad, w + pad * 2, h + topPad + bottomPad);
  } else if (cutoutShape === 'polaroid') {
    ctx.fillStyle = spec.palette.surface;
    ctx.fillRect(x - pad, y - topPad, w + pad * 2, h + topPad + bottomPad);
  }

  ctx.shadowColor = 'transparent';

  // Sprocket Holes on film-frame
  if (cutoutShape === 'film-frame') {
    ctx.fillStyle = 'rgba(235, 232, 224, 0.8)';
    for (let sx = x; sx < x + w - 18; sx += 56) {
      ctx.fillRect(sx, y - 24, 22, 14);
      ctx.fillRect(sx, y + h + 10, 22, 14);
    }
  }

  // Image Cutout Clip & Film Grading
  ctx.save();
  if (cutoutShape === 'torn' || cutoutShape === 'scissors-poly' || cutoutShape === 'deckled') {
    tracePolygonNorm(ctx, x, y, w, h, slot.polygonNorm);
    ctx.clip();
  } else if (cutoutShape === 'arch') {
    traceArchRect(ctx, x, y, w, h);
    ctx.clip();
  } else if (cutoutShape === 'oval') {
    traceOval(ctx, x, y, w, h);
    ctx.clip();
  }

  try {
    if ('filter' in ctx) ctx.filter = film.cssFilter;
  } catch {
    // Ignore filter fallback
  }
  drawCoverImage(ctx, img, x, y, w, h);
  ctx.restore();

  if (film.warmthTint !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = film.warmthTint;
    ctx.fillRect(x, y, w, h);
  }

  if (cutoutShape === 'polaroid' && slot.polaroidCaption) {
    ctx.fillStyle = spec.palette.mutedInk;
    ctx.font = `400 28px ${typo.noteFont}`;
    const line = measureLines(ctx, slot.polaroidCaption, w)[0];
    if (line) ctx.fillText(line, x + 6, y + h + 46);
  }

  // Photo Mounting Corners
  if (slot.hasPhotoCorners) {
    ctx.fillStyle = `${spec.palette.ink}BB`;
    ctx.beginPath();
    ctx.moveTo(x - pad - 6, y - topPad - 6);
    ctx.lineTo(x - pad + 32, y - topPad - 6);
    ctx.lineTo(x - pad - 6, y - topPad + 32);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + w + pad + 6, y + h + bottomPad + 6);
    ctx.lineTo(x + w + pad - 32, y + h + bottomPad + 6);
    ctx.lineTo(x + w + pad + 6, y + h + bottomPad - 32);
    ctx.closePath();
    ctx.fill();
  }

  // Washi Tape Corners
  slot.tapeCorners?.forEach((c) => {
    if (c === 'tl') drawWashiTapeCanvas(ctx, x + 10, y - 6, -24, spec.palette.secondaryAccent);
    if (c === 'tr') drawWashiTapeCanvas(ctx, x + w - 10, y - 6, 22, spec.palette.secondaryAccent);
    if (c === 'bl') drawWashiTapeCanvas(ctx, x + 10, y + h + 6, 20, spec.palette.secondaryAccent);
    if (c === 'br') drawWashiTapeCanvas(ctx, x + w - 10, y + h + 6, -22, spec.palette.secondaryAccent);
    if (c === 'top-center')
      drawWashiTapeCanvas(ctx, x + w / 2, y - 10, -2.5, spec.palette.secondaryAccent);
  });

  ctx.restore();
}

export async function renderStaticCollageToBlob(input: CollageRenderInput): Promise<{
  blob: Blob;
  previewDataUrl: string;
}> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  const lang: AppLanguage = input.language === 'ru' ? 'ru' : 'en';
  const W = COLLAGE_W;
  const H = COLLAGE_H;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable.');

  const { designSpec } = input;
  const typo = TYPOGRAPHY_PAIRS[designSpec.typography] || TYPOGRAPHY_PAIRS['editorial-serif'];
  const film = FILM_FILTERS[designSpec.filmEffect] || FILM_FILTERS['warm-kodak'];

  const loadedResults = await Promise.allSettled(input.photoUrls.slice(0, 8).map(loadImage));
  const loadedImages = loadedResults
    .filter((r): r is PromiseFulfilledResult<HTMLImageElement> => r.status === 'fulfilled')
    .map((r) => r.value);

  const plan = buildArtisticComposition({
    seedKey: input.seedKey || designSpec.generatedTitle,
    photoCount: Math.max(1, loadedImages.length || input.photoUrls.length),
    memoryDate: input.memoryDate,
    language: lang,
    title: input.title || designSpec.generatedTitle,
    storyText: input.storySnippet || '',
    isAiOnlyText: input.isAiOnlyText ?? !input.storySnippet?.trim(),
    designSpec,
    answers: input.answers,
    sensoryNotes: input.handwrittenNotes,
    whereOrWho: input.whereOrWho,
    musicLabel: input.musicLabel,
  });

  // Z-PLANE 0: Paper Base & Mixed-Media Washes
  ctx.fillStyle = designSpec.palette.background;
  ctx.fillRect(0, 0, W, H);
  drawPaperGrain(ctx, W, H, designSpec.paperTexture === 'charcoal-matte' ? 0.03 : 0.045);
  drawMixedMediaBackdrop(ctx, designSpec, W, H);

  ctx.strokeStyle = `${designSpec.palette.ink}18`;
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, W - 88, H - 88);

  if (plan.titleBlock.verticalSpineLabel) {
    ctx.save();
    ctx.translate(40, 1140);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = designSpec.palette.mutedInk;
    ctx.font = `500 18px ${typo.bodyFont}`;
    ctx.fillText(plan.titleBlock.verticalSpineLabel, 0, 0);
    ctx.restore();
  }

  // Z-ORDERED DRAW QUEUE (Paper scraps, tucked foliage/details, photos, stitches, foreground details)
  type DrawOp = { z: number; fn: () => void };
  const ops: DrawOp[] = [];

  plan.paperScraps.forEach((scrap) => {
    ops.push({ z: scrap.zIndex, fn: () => drawPaperScrap(ctx, scrap, designSpec.palette.ink) });
  });

  plan.details.forEach((item) => {
    ops.push({
      z: item.zIndex,
      fn: () =>
        drawTactileDetailCanvas(ctx, item, designSpec.palette.ink, designSpec.palette.surface, lang),
    });
  });

  plan.photoSlots.forEach((slot) => {
    const img = loadedImages[slot.photoIndex];
    if (!img) return;
    ops.push({
      z: slot.zIndex,
      fn: () => drawPhotoSlotCanvas(ctx, slot, img, designSpec, film, typo),
    });
  });

  if (plan.filmstripSlot) {
    const fs = plan.filmstripSlot;
    ops.push({
      z: fs.zIndex,
      fn: () => {
        ctx.save();
        const cx = fs.x + fs.w / 2;
        const cy = fs.y + fs.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((fs.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);

        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#181818';
        ctx.fillRect(fs.x, fs.y, fs.w, fs.h);
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = 'rgba(235, 232, 224, 0.78)';
        for (let sx = fs.x + 18; sx < fs.x + fs.w - 24; sx += 52) {
          ctx.fillRect(sx, fs.y + 10, 20, 12);
          ctx.fillRect(sx, fs.y + fs.h - 22, 20, 12);
        }

        const n = Math.max(1, fs.photoIndices.length);
        const innerPad = 24;
        const gap = 18;
        const fw = (fs.w - innerPad * 2 - gap * (n - 1)) / n;
        const fh = fs.h - 68;
        fs.photoIndices.forEach((pIdx, idx) => {
          const img = loadedImages[pIdx];
          if (!img) return;
          const fx = fs.x + innerPad + idx * (fw + gap);
          const fy = fs.y + 34;
          drawCoverImage(ctx, img, fx, fy, fw, fh);
        });
        ctx.restore();
      },
    });
  }

  plan.stitchedThreads.forEach((st) => {
    ops.push({
      z: st.zIndex,
      fn: () => {
        ctx.save();
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 3.2;
        ctx.setLineDash([12, 8]);
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(st.x1, st.y1);
        ctx.quadraticCurveTo(st.cx, st.cy, st.x2, st.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.arc(st.x1, st.y1, 6, 0, Math.PI * 2);
        ctx.arc(st.x2, st.y2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
  });

  ops.sort((a, b) => a.z - b.z).forEach((op) => op.fn());

  // EDITORIAL HEADER BLOCK
  {
    const tb = plan.titleBlock;
    ctx.save();
    const eyebrow = `MEMENTO · ${plan.formattedDate.toUpperCase()}${
      plan.locationOrWho ? ` · ${plan.locationOrWho.toUpperCase()}` : ''
    }`;
    ctx.font = `600 18px ${typo.bodyFont}`;
    ctx.fillStyle = designSpec.palette.mutedInk;
    ctx.textAlign = tb.align;
    ctx.fillText(eyebrow, tb.x, tb.y + 20);

    let titleFontSize = 68;
    const rawTitle = input.title || designSpec.generatedTitle;
    let titleLines: string[] = [];
    while (titleFontSize >= 42) {
      ctx.font = `600 ${titleFontSize}px ${typo.headingFont}`;
      titleLines = measureLines(ctx, rawTitle, tb.maxW);
      if (titleLines.length <= 2) break;
      titleFontSize -= 6;
    }

    if (tb.boxed) {
      ctx.fillStyle = designSpec.palette.surface;
      ctx.strokeStyle = `${designSpec.palette.ink}25`;
      ctx.lineWidth = 1.5;
      ctx.fillRect(tb.x - 24, tb.y - 16, Math.min(tb.maxW, 920), 66 + titleLines.length * (titleFontSize * 1.1));
      ctx.strokeRect(tb.x - 24, tb.y - 16, Math.min(tb.maxW, 920), 66 + titleLines.length * (titleFontSize * 1.1));
      ctx.font = `600 18px ${typo.bodyFont}`;
      ctx.fillStyle = designSpec.palette.mutedInk;
      ctx.fillText(eyebrow, tb.x, tb.y + 20);
    }

    ctx.fillStyle = designSpec.palette.ink;
    ctx.font = `600 ${titleFontSize}px ${typo.headingFont}`;
    let currY = tb.y + 88;
    for (const line of titleLines) {
      ctx.fillText(line, tb.x, currY);
      currY += Math.round(titleFontSize * 1.1);
    }
    ctx.restore();
  }

  // HANDWRITTEN CURSIVE MARGIN WORDS
  plan.handwrittenMargins.forEach((hm) => {
    ctx.save();
    ctx.translate(hm.x, hm.y);
    ctx.rotate((hm.rotation * Math.PI) / 180);
    ctx.fillStyle = hm.color;
    ctx.font = `400 ${hm.fontSize}px ${typo.noteFont}`;
    ctx.fillText(hm.text, 0, 0);
    ctx.restore();
  });

  // PERSONAL DIARY STORY NOTE CARD (ZERO COLOR SWATCH CIRCLES!)
  {
    const sn = plan.storyNote;
    ctx.save();
    const cx = sn.x + sn.w / 2;
    const cy = sn.y + sn.minH / 2;
    ctx.translate(cx, cy);
    ctx.rotate((sn.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle =
      sn.style === 'vellum-sheet' ? `${designSpec.palette.surface}D8` : designSpec.palette.surface;

    if (sn.style === 'folded-note') {
      const fold = 42;
      ctx.beginPath();
      ctx.moveTo(sn.x, sn.y);
      ctx.lineTo(sn.x + sn.w - fold, sn.y);
      ctx.lineTo(sn.x + sn.w, sn.y + fold);
      ctx.lineTo(sn.x + sn.w, sn.y + sn.minH);
      ctx.lineTo(sn.x, sn.y + sn.minH);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = `${designSpec.palette.ink}22`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Folded corner triangle
      ctx.fillStyle = `${designSpec.palette.ink}14`;
      ctx.beginPath();
      ctx.moveTo(sn.x + sn.w - fold, sn.y);
      ctx.lineTo(sn.x + sn.w - fold, sn.y + fold);
      ctx.lineTo(sn.x + sn.w, sn.y + fold);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(sn.x, sn.y, sn.w, sn.minH);
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = `${designSpec.palette.ink}1E`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sn.x, sn.y, sn.w, sn.minH);
    }

    if (sn.hasTape) {
      drawWashiTapeCanvas(ctx, sn.x + 70, sn.y - 6, -14, designSpec.palette.primaryAccent);
    }
    if (sn.hasPaperClip) {
      drawPaperClipCanvas(ctx, sn.x + sn.w - 64, sn.y - 34, designSpec.palette.mutedInk);
    }

    let textY = sn.y + 48;
    const textX = sn.x + 38;
    const textMaxW = sn.w - 76;

    if (plan.aiCaptionLabel) {
      ctx.fillStyle = designSpec.palette.mutedInk;
      ctx.font = `600 15px ${typo.bodyFont}`;
      ctx.fillText(plan.aiCaptionLabel.toUpperCase(), textX, textY - 10);
      textY += 26;
    }

    ctx.fillStyle = designSpec.palette.ink;
    ctx.font = `400 28px ${typo.bodyFont}`;
    const storyLines = measureLines(ctx, plan.storyText, textMaxW).slice(0, 6);
    for (const line of storyLines) {
      ctx.fillText(line, textX, textY);
      textY += 40;
    }

    if (plan.sensoryNotes.length > 0) {
      textY += 10;
      ctx.fillStyle = designSpec.palette.primaryAccent;
      ctx.font = `400 35px ${typo.noteFont}`;
      for (const note of plan.sensoryNotes.slice(0, 2)) {
        const noteLines = measureLines(ctx, note, textMaxW).slice(0, 2);
        for (const nl of noteLines) {
          if (textY < sn.y + sn.minH - 42) {
            ctx.fillText(nl, textX, textY);
            textY += 42;
          }
        }
      }
    }

    if (plan.musicLabel) {
      const musicY = Math.min(sn.y + sn.minH - 26, Math.max(textY + 18, sn.y + sn.minH - 30));
      ctx.fillStyle = designSpec.palette.mutedInk;
      ctx.font = `500 19px ${typo.bodyFont}`;
      ctx.fillText(
        `${lang === 'ru' ? 'Музыка' : 'Soundtrack'} · ${plan.musicLabel}`,
        textX,
        musicY
      );
    }

    ctx.restore();
  }

  // Subtle archival signature footer line
  ctx.fillStyle = designSpec.palette.mutedInk;
  ctx.font = `500 18px ${typo.bodyFont}`;
  ctx.fillText(
    lang === 'ru'
      ? 'MEMENTO — Не просто то, что вы видели. То, что вы чувствовали.'
      : 'MEMENTO — Not just what you saw. What you felt.',
    110,
    H - 64
  );

  const previewDataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png', 0.95);
  });

  return { blob, previewDataUrl };
}
