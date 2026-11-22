import { FILM_FILTERS, TYPOGRAPHY_PAIRS, type DesignSpecification } from './artLibrary';
import type { AppLanguage } from './types';

export interface VideoRenderInput {
  photoUrls: string[];
  memoryDate: string;
  language?: AppLanguage;
  designSpec: DesignSpecification;
  storySnippet: string;
  handwrittenNotes: string[];
  audioPreviewUrl?: string | null;
  durationSec?: number;
  onProgress?: (pct: number) => void;
  abortSignal?: AbortSignal;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load photograph for video rendering.'));
    img.src = src;
  });
}

function wrapVideoLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderAnimatedMemoryVideo(input: VideoRenderInput): Promise<{
  blob: Blob;
  mimeType: string;
  durationSec: number;
  audioIncluded: boolean;
}> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Your browser does not support MediaRecorder video synthesis.');
  }

  const lang: AppLanguage = input.language === 'ru' ? 'ru' : 'en';
  const durationSec = Math.max(15, Math.min(30, input.durationSec ?? 18));
  const FPS = 30;
  const W = 1080;
  const H = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable.');

  const images = await Promise.all(input.photoUrls.slice(0, 6).map(loadImg));
  if (images.length === 0) throw new Error('At least one photograph is required.');

  const stream = canvas.captureStream(FPS);
  let audioIncluded = false;
  let audioEl: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;

  if (input.audioPreviewUrl) {
    try {
      audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioEl.src = input.audioPreviewUrl;
      audioEl.loop = true;
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      await audioEl.play();
      audioIncluded = true;
    } catch {
      audioIncluded = false;
      audioEl?.pause();
      await audioCtx?.close().catch(() => {});
      audioEl = null;
      audioCtx = null;
    }
  }

  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType: preferredMime,
    videoBitsPerSecond: 3_200_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: preferredMime }));
    recorder.onerror = () => reject(new Error('Video recording failed.'));
  });

  const { designSpec } = input;
  const typo = TYPOGRAPHY_PAIRS[designSpec.typography] || TYPOGRAPHY_PAIRS['editorial-serif'];
  const film = FILM_FILTERS[designSpec.filmEffect] || FILM_FILTERS['warm-kodak'];
  const speed = designSpec.animationSpeedMultiplier || 1;

  const particles = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 197) % W,
    y: (i * 313) % H,
    r: 2 + (i % 4),
    vy: (0.45 + (i % 5) * 0.25) * speed,
    vx: ((i % 3) - 1) * 0.25 * speed,
  }));

  const formattedDate = new Date(`${input.memoryDate.slice(0, 10)}T12:00:00`).toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : 'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  recorder.start(250);
  const startTime = performance.now();
  const totalMs = durationSec * 1000;

  await new Promise<void>((resolve, reject) => {
    const drawFrame = (now: number) => {
      if (input.abortSignal?.aborted) {
        recorder.stop();
        reject(new Error('Video rendering cancelled.'));
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalMs);
      input.onProgress?.(Math.round(progress * 100));

      ctx.fillStyle = designSpec.palette.background;
      ctx.fillRect(0, 0, W, H);

      const segment = 1 / images.length;
      const idx = Math.min(images.length - 1, Math.floor(progress / segment));
      const localP = (progress - idx * segment) / segment;
      const img = images[idx];

      const zoom = 1.02 + localP * 0.08 * speed;
      const panX = Math.sin(progress * Math.PI * 2 * speed) * 14;
      const fadeAlpha = localP < 0.12 ? localP / 0.12 : localP > 0.88 ? (1 - localP) / 0.12 : 1;

      const frameX = 110;
      const frameY = 175;
      const frameW = W - 220;
      const frameH = 720;

      ctx.save();
      ctx.fillStyle = designSpec.palette.surface;
      ctx.shadowColor = 'rgba(0,0,0,0.16)';
      ctx.shadowBlur = 28;
      ctx.fillRect(frameX - 24, frameY - 24, frameW + 48, frameH + 96);
      ctx.shadowColor = 'transparent';

      ctx.beginPath();
      ctx.rect(frameX, frameY, frameW, frameH);
      ctx.clip();

      ctx.globalAlpha = Math.max(0.15, fadeAlpha);
      ctx.filter = film.cssFilter;
      const imgRatio = img.width / img.height;
      const boxRatio = frameW / frameH;
      let drawW = frameW * zoom;
      let drawH = frameH * zoom;
      if (imgRatio > boxRatio) {
        drawW = drawH * imgRatio;
      } else {
        drawH = drawW / imgRatio;
      }
      ctx.drawImage(
        img,
        frameX + (frameW - drawW) / 2 + panX,
        frameY + (frameH - drawH) / 2,
        drawW,
        drawH
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = designSpec.palette.primaryAccent;
      ctx.fillStyle = designSpec.palette.primaryAccent;
      ctx.globalAlpha = 0.25;
      for (const p of particles) {
        p.y = (p.y + p.vy) % H;
        p.x = (p.x + p.vx + W) % W;
        if (designSpec.animationStyle === 'rainy-stillness') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 4, p.y + 18);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      const titleReveal = Math.min(1, progress * 5);
      ctx.save();
      ctx.globalAlpha = titleReveal;
      ctx.fillStyle = designSpec.palette.mutedInk;
      ctx.font = `500 20px ${typo.bodyFont}`;
      ctx.fillText(formattedDate, 110, 108);

      ctx.fillStyle = designSpec.palette.ink;
      let titleFontSize = 54;
      ctx.font = `600 ${titleFontSize}px ${typo.headingFont}`;
      let titleLines = wrapVideoLines(ctx, designSpec.generatedTitle, W - 220);
      if (titleLines.length > 2) {
        titleFontSize = 42;
        ctx.font = `600 ${titleFontSize}px ${typo.headingFont}`;
        titleLines = wrapVideoLines(ctx, designSpec.generatedTitle, W - 220);
      }
      let ty = 1020 + (1 - titleReveal) * 16;
      for (const line of titleLines.slice(0, 2)) {
        ctx.fillText(line, 110, ty);
        ty += Math.round(titleFontSize * 1.15);
      }

      const notes = input.handwrittenNotes.length ? input.handwrittenNotes : [designSpec.moodSummary];
      const noteIdx = Math.min(notes.length - 1, Math.floor(progress * notes.length));
      ctx.fillStyle = designSpec.palette.primaryAccent;
      ctx.font = `400 34px ${typo.noteFont}`;
      const noteLines = wrapVideoLines(ctx, `“${notes[noteIdx]}”`, W - 220).slice(0, 2);
      let ny = Math.max(ty + 14, 1128);
      for (const nLine of noteLines) {
        ctx.fillText(nLine, 110, ny);
        ny += 40;
      }

      const swatches = [
        designSpec.palette.chosenByUser,
        ...designSpec.palette.extractedFromPhoto.slice(0, 3),
      ];
      swatches.forEach((hex, sIdx) => {
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(130 + sIdx * 54, 1250, 16, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      if (elapsed < totalMs) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
        resolve();
      }
    };

    requestAnimationFrame(drawFrame);
  });

  if (audioEl) {
    audioEl.pause();
    await audioCtx?.close().catch(() => {});
  }

  const blob = await recordingDone;
  return { blob, mimeType: preferredMime, durationSec, audioIncluded };
}
