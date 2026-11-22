import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  FILM_FILTERS,
  TYPOGRAPHY_PAIRS,
  localizeCollageStyleLabel,
  type DesignSpecification,
  type SmallDetailId,
} from '../lib/artLibrary';
import {
  COLLAGE_H,
  COLLAGE_W,
  buildArtisticComposition,
  type DetailItemSpec,
  type PaperScrapSpec,
  type PhotoSlotSpec,
} from '../lib/collageComposition';
import { useI18n } from '../lib/i18n';
import type { AppLanguage, MemoryRecord } from '../lib/types';

interface ScrapbookCanvasProps {
  memory: MemoryRecord;
}

const pctX = (v: number) => `${(v / COLLAGE_W) * 100}%`;
const pctY = (v: number) => `${(v / COLLAGE_H) * 100}%`;

function polygonPointsAttr(norm: Array<[number, number]>): string {
  return norm.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`).join(', ');
}

function getClipPathCss(slot: PhotoSlotSpec): string | undefined {
  if (slot.cutoutShape === 'torn' || slot.cutoutShape === 'scissors-poly' || slot.cutoutShape === 'deckled') {
    return `polygon(${polygonPointsAttr(slot.polygonNorm)})`;
  }
  if (slot.cutoutShape === 'arch') {
    return 'inset(0 round 50% 50% 0 0 / 34% 34% 0 0)';
  }
  if (slot.cutoutShape === 'oval') {
    return 'ellipse(49% 49% at 50% 50%)';
  }
  return undefined;
}

function PaperScrapElement({ scrap, ink }: { scrap: PaperScrapSpec; ink: string }) {
  const baseClip =
    scrap.kind === 'torn-paper' || scrap.kind === 'vellum' || scrap.kind === 'fabric-swatch'
      ? `polygon(${polygonPointsAttr(scrap.polygonNorm)})`
      : undefined;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: pctX(scrap.x),
        top: pctY(scrap.y),
        width: pctX(scrap.w),
        height: pctY(scrap.h),
        zIndex: scrap.zIndex,
        transform: `rotate(${scrap.rotation}deg)`,
        opacity: scrap.opacity,
        clipPath: baseClip,
        backgroundColor: scrap.color,
        backdropFilter: scrap.kind === 'vellum' ? 'blur(1.5px)' : undefined,
        boxShadow:
          scrap.kind === 'vellum'
            ? `inset 0 0 0 1px ${ink}15`
            : '0 4px 14px rgba(0,0,0,0.06)',
      }}
      aria-hidden="true"
    >
      {scrap.kind === 'fabric-swatch' && (
        <div
          className="h-full w-full opacity-35"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 5px), repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.12) 4px, rgba(0,0,0,0.12) 5px)',
          }}
        />
      )}
      {scrap.kind === 'envelope-flap' && (
        <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            points="0,0 50,42 100,0"
            fill="none"
            stroke={ink}
            strokeOpacity="0.28"
            strokeWidth="0.9"
          />
          <rect
            x="2"
            y="2"
            width="96"
            height="76"
            fill="none"
            stroke={ink}
            strokeOpacity="0.16"
            strokeWidth="0.6"
          />
        </svg>
      )}
    </div>
  );
}

function WashiTapeStrip({
  corner,
  color,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br' | 'top-center';
  color: string;
}) {
  const pos: Record<typeof corner, string> = {
    tl: '-left-4 -top-2.5 rotate-[-24deg]',
    tr: '-right-4 -top-2.5 rotate-[22deg]',
    bl: '-left-4 -bottom-2.5 rotate-[20deg]',
    br: '-right-4 -bottom-2.5 rotate-[-22deg]',
    'top-center': '-top-3 left-1/2 -translate-x-1/2 rotate-[-2.5deg]',
  };
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-30 h-[1.5cqw] w-[6.2cqw] shadow-xs ${pos[corner]}`}
      style={{
        backgroundColor: `${color}99`,
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 4px, transparent 4px 8px)',
        clipPath:
          'polygon(2% 0%, 98% 2%, 96% 18%, 100% 36%, 97% 58%, 100% 80%, 97% 98%, 2% 100%, 4% 76%, 0% 52%, 4% 28%, 0% 10%)',
      }}
    />
  );
}

function PaperClipSvg({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 44 108"
      className="pointer-events-none absolute -top-[2.6cqw] right-[2.2cqw] z-30 h-[5.2cqw] w-[2.1cqw] rotate-[8deg] drop-shadow-sm"
      aria-hidden="true"
    >
      <path
        d="M14 22 V78 C14 90, 30 90, 30 78 V20 C30 7, 10 7, 10 20 V86 C10 100, 34 100, 34 86 V34"
        fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.82"
      />
      <path
        d="M15 22 V78 C15 88, 29 88, 29 78 V20"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

function TactileDetailElement({
  item,
  ink,
  surface,
  lang,
}: {
  item: DetailItemSpec;
  ink: string;
  surface: string;
  lang: AppLanguage;
}) {
  const { kind, primaryColor, secondaryColor, labelText } = item;

  const renderInner = (k: SmallDetailId) => {
    switch (k) {
      case 'pressed-flower':
        return (
          <svg viewBox="0 0 180 220" className="h-full w-full drop-shadow-xs" aria-hidden="true">
            <path d="M88 208 Q92 138 106 54" fill="none" stroke={primaryColor} strokeWidth="2.1" />
            <path d="M95 142 Q64 128 52 108" fill="none" stroke={primaryColor} strokeWidth="1.6" />
            <ellipse
              cx="60"
              cy="120"
              rx="18"
              ry="7"
              transform="rotate(-32 60 120)"
              fill={secondaryColor}
              fillOpacity="0.28"
              stroke={primaryColor}
              strokeWidth="1.2"
            />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <ellipse
                key={deg}
                cx="106"
                cy="34"
                rx="9"
                ry="20"
                transform={`rotate(${deg} 106 54)`}
                fill={secondaryColor}
                fillOpacity="0.28"
                stroke={primaryColor}
                strokeWidth="1.2"
              />
            ))}
            <circle cx="106" cy="54" r="7" fill={primaryColor} fillOpacity="0.7" />
          </svg>
        );

      case 'pressed-leaf':
        return (
          <svg viewBox="0 0 180 180" className="h-full w-full drop-shadow-xs" aria-hidden="true">
            <g transform="translate(24, 18) rotate(-14)">
              <path
                d="M58 6 L72 34 L106 24 L84 54 L118 76 L76 80 L82 114 L58 92 L34 114 L40 80 L0 76 L32 54 L10 24 L44 34 Z"
                fill={secondaryColor}
                fillOpacity="0.34"
                stroke={primaryColor}
                strokeWidth="1.6"
              />
              <line x1="58" y1="22" x2="58" y2="128" stroke={primaryColor} strokeWidth="1.4" />
              <line x1="58" y1="54" x2="84" y2="38" stroke={primaryColor} strokeWidth="1" />
              <line x1="58" y1="68" x2="32" y2="50" stroke={primaryColor} strokeWidth="1" />
            </g>
          </svg>
        );

      case 'tiny-branch':
        return (
          <svg viewBox="0 0 180 200" className="h-full w-full" aria-hidden="true">
            <path d="M22 184 Q82 118 148 22" fill="none" stroke={ink} strokeOpacity="0.65" strokeWidth="1.8" />
            {[
              [56, 146, -42],
              [78, 120, 28],
              [104, 86, -38],
              [126, 56, 30],
            ].map(([x, y, rot], idx) => (
              <ellipse
                key={idx}
                cx={x}
                cy={y}
                rx="16"
                ry="6.5"
                transform={`rotate(${rot} ${x} ${y})`}
                fill={primaryColor}
                fillOpacity="0.24"
                stroke={primaryColor}
                strokeWidth="1.2"
              />
            ))}
          </svg>
        );

      case 'seashell-sketch':
        return (
          <svg viewBox="0 0 160 130" className="h-full w-full" aria-hidden="true">
            <path
              d="M28 92 C16 48, 48 18, 80 18 C112 18, 144 48, 132 92 L100 108 L60 108 Z"
              fill={secondaryColor}
              fillOpacity="0.22"
              stroke={primaryColor}
              strokeWidth="1.6"
            />
            {[46, 62, 80, 98, 114].map((xTop, idx) => (
              <line
                key={idx}
                x1={xTop}
                y1={idx === 2 ? 20 : 28}
                x2={64 + idx * 8}
                y2="108"
                stroke={primaryColor}
                strokeWidth="1.1"
              />
            ))}
          </svg>
        );

      case 'wave-ripples':
        return (
          <svg viewBox="0 0 260 80" className="h-full w-full opacity-75" aria-hidden="true">
            {[16, 36, 56].map((y, idx) => (
              <path
                key={y}
                d={`M6 ${y} Q48 ${y - 10 + idx * 2} 90 ${y} T174 ${y} T254 ${y}`}
                fill="none"
                stroke={primaryColor}
                strokeWidth="1.7"
              />
            ))}
          </svg>
        );

      case 'sun-doodle':
        return (
          <svg viewBox="0 0 130 130" className="h-full w-full opacity-75" aria-hidden="true">
            <circle cx="65" cy="65" r="22" fill={secondaryColor} fillOpacity="0.24" stroke={primaryColor} strokeWidth="1.7" />
            {Array.from({ length: 12 }, (_, i) => {
              const rad = (i * Math.PI) / 6;
              return (
                <line
                  key={i}
                  x1={65 + Math.cos(rad) * 29}
                  y1={65 + Math.sin(rad) * 29}
                  x2={65 + Math.cos(rad) * (i % 2 === 0 ? 48 : 39)}
                  y2={65 + Math.sin(rad) * (i % 2 === 0 ? 48 : 39)}
                  stroke={primaryColor}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        );

      case 'rain-streaks':
        return (
          <svg viewBox="0 0 180 150" className="h-full w-full opacity-65" aria-hidden="true">
            {[
              [22, 16, 52],
              [50, 32, 68],
              [84, 14, 58],
              [118, 28, 72],
              [148, 12, 50],
              [66, 82, 46],
            ].map(([x, y, len], idx) => (
              <line
                key={idx}
                x1={x}
                y1={y}
                x2={x - 11}
                y2={y + len}
                stroke={primaryColor}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ))}
          </svg>
        );

      case 'umbrella-doodle':
        return (
          <svg viewBox="0 0 140 140" className="h-full w-full opacity-80" aria-hidden="true">
            <path
              d="M22 68 C22 32, 118 32, 118 68 Q94 58 70 68 Q46 58 22 68 Z"
              fill={secondaryColor}
              fillOpacity="0.22"
              stroke={primaryColor}
              strokeWidth="1.7"
            />
            <path
              d="M70 28 V104 C70 116, 86 116, 86 105"
              fill="none"
              stroke={primaryColor}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'camera-doodle':
        return (
          <svg viewBox="0 0 160 120" className="h-full w-full opacity-75" aria-hidden="true">
            <rect
              x="20"
              y="32"
              width="120"
              height="70"
              rx="6"
              fill={surface}
              fillOpacity="0.5"
              stroke={ink}
              strokeOpacity="0.65"
              strokeWidth="1.7"
            />
            <path d="M52 32 L62 18 H98 L108 32" fill="none" stroke={ink} strokeOpacity="0.65" strokeWidth="1.6" />
            <circle cx="80" cy="67" r="20" fill={primaryColor} fillOpacity="0.18" stroke={primaryColor} strokeWidth="1.8" />
            <circle cx="80" cy="67" r="9" fill="none" stroke={ink} strokeOpacity="0.55" strokeWidth="1.2" />
            <circle cx="122" cy="46" r="4" fill={secondaryColor} />
          </svg>
        );

      case 'candle-doodle':
        return (
          <svg viewBox="0 0 110 150" className="h-full w-full opacity-80" aria-hidden="true">
            <path d="M55 18 C64 30, 62 42, 55 46 C48 42, 46 30, 55 18 Z" fill={secondaryColor} fillOpacity="0.7" />
            <line x1="55" y1="46" x2="55" y2="56" stroke={ink} strokeWidth="1.6" />
            <rect x="42" y="56" width="26" height="72" rx="3" fill={surface} stroke={primaryColor} strokeWidth="1.6" />
            <line x1="42" y1="74" x2="68" y2="82" stroke={primaryColor} strokeOpacity="0.5" strokeWidth="1.3" />
          </svg>
        );

      case 'confetti-scraps':
        return (
          <svg viewBox="0 0 180 140" className="h-full w-full opacity-80" aria-hidden="true">
            <polygon points="24,24 44,18 36,38" fill={primaryColor} fillOpacity="0.7" />
            <polygon points="122,30 142,42 126,54" fill={secondaryColor} fillOpacity="0.75" />
            <rect x="74" y="64" width="18" height="9" transform="rotate(24 74 64)" fill={primaryColor} fillOpacity="0.6" />
            <circle cx="48" cy="96" r="6" fill={secondaryColor} fillOpacity="0.7" />
            <polygon points="108,104 128,96 122,118" fill={primaryColor} fillOpacity="0.65" />
            <circle cx="144" cy="84" r="4" fill={ink} fillOpacity="0.45" />
          </svg>
        );

      case 'tiny-stars':
        return (
          <svg viewBox="0 0 160 120" className="h-full w-full opacity-75" aria-hidden="true">
            <polyline
              points="24,84 60,44 102,62 138,22"
              fill="none"
              stroke={primaryColor}
              strokeWidth="1.1"
              strokeDasharray="3 4"
            />
            {[
              [24, 84, 3.5],
              [60, 44, 4.5],
              [102, 62, 3],
              [138, 22, 5],
            ].map(([cx, cy, r], idx) => (
              <circle key={idx} cx={cx} cy={cy} r={r} fill={primaryColor} />
            ))}
          </svg>
        );

      case 'coffee-ring-mark':
        return (
          <svg viewBox="0 0 160 160" className="h-full w-full opacity-35" aria-hidden="true">
            <circle cx="80" cy="80" r="54" fill="none" stroke={secondaryColor} strokeWidth="5.5" />
            <circle cx="83" cy="78" r="51" fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="1.5" />
            <circle cx="128" cy="112" r="4" fill={secondaryColor} />
          </svg>
        );

      case 'ticket-stub':
      case 'receipt-fragment':
        return (
          <div
            className="flex h-full w-full flex-col justify-between border border-dashed px-[0.9cqw] py-[0.7cqw] shadow-sm"
            style={{
              backgroundColor: surface,
              borderColor: `${ink}40`,
              color: ink,
            }}
          >
            <div className="flex items-center justify-between text-[0.65cqw] uppercase tracking-[0.18em] opacity-65">
              <span>{k === 'receipt-fragment' ? (lang === 'ru' ? 'ЧЕК' : 'RECEIPT') : (lang === 'ru' ? 'БИЛЕТ' : 'PASS')}</span>
              <span>№ 042</span>
            </div>
            <div className="font-mono text-[0.75cqw] font-semibold tracking-wider">
              {labelText || (lang === 'ru' ? 'АРХИВ ПАМЯТИ' : 'MEMORY PASS')}
            </div>
            <div className="border-t border-dotted pt-[0.3cqw] text-[0.6cqw] opacity-65" style={{ borderColor: `${ink}35` }}>
              MEMENTO ARCHIVE
            </div>
          </div>
        );

      case 'date-stamp':
      case 'postmark-seal':
        return (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="flex h-[7.6cqw] w-[7.6cqw] flex-col items-center justify-center rounded-full border-[1.5px] border-dashed text-center opacity-70"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              <span className="text-[0.55cqw] font-semibold uppercase tracking-[0.22em]">
                {lang === 'ru' ? 'АРХИВ' : 'ARCHIVE'}
              </span>
              <span className="mt-0.5 font-mono text-[0.68cqw] font-medium tabular-nums">
                {labelText || ''}
              </span>
              <span className="text-[0.5cqw] uppercase tracking-[0.18em] opacity-80">MEMENTO</span>
            </div>
          </div>
        );

      case 'city-map-fragment':
        return (
          <div
            className="h-full w-full overflow-hidden border p-[0.5cqw] opacity-80 shadow-xs"
            style={{ backgroundColor: surface, borderColor: `${ink}25` }}
          >
            <svg viewBox="0 0 180 130" className="h-full w-full" aria-hidden="true">
              <path d="M0 96 Q70 72 180 86" fill="none" stroke={primaryColor} strokeWidth="6" strokeOpacity="0.28" />
              <line x1="20" y1="0" x2="64" y2="130" stroke={ink} strokeOpacity="0.26" strokeWidth="1.2" />
              <line x1="90" y1="0" x2="122" y2="130" stroke={ink} strokeOpacity="0.26" strokeWidth="1.2" />
              <line x1="0" y1="34" x2="180" y2="54" stroke={ink} strokeOpacity="0.26" strokeWidth="1.2" />
              <line x1="0" y1="74" x2="180" y2="44" stroke={ink} strokeOpacity="0.2" strokeWidth="1" />
              <circle cx="104" cy="48" r="5" fill={secondaryColor} />
            </svg>
          </div>
        );

      case 'envelope-scrap':
        return (
          <div
            className="h-full w-full border shadow-xs"
            style={{ backgroundColor: `${secondaryColor}24`, borderColor: `${ink}28` }}
          >
            <svg viewBox="0 0 160 120" className="h-full w-full" aria-hidden="true">
              <polyline points="0,0 80,62 160,0" fill="none" stroke={ink} strokeOpacity="0.32" strokeWidth="1.4" />
            </svg>
          </div>
        );

      case 'pencil-marks':
      case 'ink-sketch-object':
      default:
        return (
          <svg viewBox="0 0 180 110" className="h-full w-full opacity-55" aria-hidden="true">
            <path d="M12 24 H48 M12 24 V56" fill="none" stroke={ink} strokeWidth="1.4" />
            <path d="M168 86 H132 M168 86 V54" fill="none" stroke={ink} strokeWidth="1.4" />
            <path
              d="M36 74 Q88 54 146 68"
              fill="none"
              stroke={primaryColor}
              strokeWidth="1.3"
              strokeDasharray="4 3"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: pctX(item.x),
        top: pctY(item.y),
        width: pctX(item.w),
        height: pctY(item.h),
        zIndex: item.zIndex,
        transform: `rotate(${item.rotation}deg)`,
      }}
      aria-hidden="true"
    >
      {renderInner(kind)}
    </div>
  );
}

export function ScrapbookCanvas({ memory }: ScrapbookCanvasProps) {
  const { t, lang } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const dragOrigin = useRef({ x: 0, y: 0 });

  const memoryLang: AppLanguage = memory.language || lang;
  const spec: DesignSpecification | undefined = memory.design?.designSpec;
  const typo = spec
    ? TYPOGRAPHY_PAIRS[spec.typography] || TYPOGRAPHY_PAIRS['editorial-serif']
    : TYPOGRAPHY_PAIRS['editorial-serif'];
  const film = spec
    ? FILM_FILTERS[spec.filmEffect] || FILM_FILTERS['warm-kodak']
    : FILM_FILTERS['warm-kodak'];

  const bg = spec?.palette.background || '#F6F2EA';
  const surface = spec?.palette.surface || '#FCF9F3';
  const ink = spec?.palette.ink || '#1E1B18';
  const mutedInk = spec?.palette.mutedInk || '#645D53';
  const accent = spec?.palette.primaryAccent || '#5D8AA8';
  const secondary = spec?.palette.secondaryAccent || '#B96B4B';

  const photos = memory.photos || [];
  const musicLabel =
    memory.music && memory.music.mode !== 'none'
      ? `${memory.music.trackTitle || memory.music.queryOrMood}${
          memory.music.artist ? ` — ${memory.music.artist}` : ''
        }`
      : undefined;

  const plan = useMemo(() => {
    if (!spec) return null;
    return buildArtisticComposition({
      seedKey: memory.id,
      photoCount: Math.max(1, photos.length),
      memoryDate: memory.memoryDate,
      language: memoryLang,
      title: memory.title,
      storyText: memory.storyText || '',
      isAiOnlyText: !memory.storyText?.trim(),
      designSpec: spec,
      answers: memory.answers,
      musicLabel,
    });
  }, [memory, photos.length, memoryLang, spec, musicLabel]);

  const techniques = spec?.scrapbookPlan?.artisticTechniques || [];

  const handleMouseDown = (e: MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    dragOrigin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y });
  };

  const handleMouseUp = () => setDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!spec || !plan) return null;

  return (
    <div className="space-y-4">
      {/* Separate Canvas Inspection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-stone-200/80 bg-white/85 px-4 py-2.5 text-stone-800 backdrop-blur-sm">
        <p className="text-xs text-stone-600">
          {localizeCollageStyleLabel(plan.collageStyle, lang)} ·{' '}
          {spec.scrapbookPlan?.backgroundMaterial || 'Archival art paper'} · {t('canvas.inspectHint')}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
            aria-label="Zoom out"
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-stone-200 hover:bg-stone-100"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[52px] text-center text-xs font-medium tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
            aria-label="Zoom in"
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-stone-200 hover:bg-stone-100"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset zoom"
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-stone-200 hover:bg-stone-100"
          >
            {zoom === 1 ? <Maximize2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive Collage Sheet Viewport */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative overflow-hidden border p-2 sm:p-6 ${
          zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{
          borderColor: `${ink}20`,
          backgroundColor: `${ink}06`,
        }}
      >
        {/* 4:5 BESPOKE ART JOURNAL COLLAGE PAGE (container-query cqw typography matches 1600×2000 PNG 1:1) */}
        <div
          className="relative mx-auto aspect-[4/5] w-full max-w-[880px] overflow-hidden shadow-2xl transition-transform duration-200 select-none"
          style={{
            containerType: 'inline-size',
            backgroundColor: bg,
            color: ink,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Z-PLANE 0: Textured Paper Base + Watercolor / Light Leak / Linen Backdrop */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                spec.paperTexture === 'linen-archival' || techniques.includes('linen-fibers')
                  ? 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.028) 3px, rgba(0,0,0,0.028) 4px), repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.02) 3px, rgba(0,0,0,0.02) 4px)'
                  : 'radial-gradient(rgba(0,0,0,0.075) 0.65px, transparent 0.65px)',
              backgroundSize:
                spec.paperTexture === 'linen-archival' || techniques.includes('linen-fibers')
                  ? 'auto'
                  : '5px 5px',
            }}
          />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: techniques.includes('watercolor-wash')
                ? `radial-gradient(circle at 20% 34%, ${accent}2a 0%, transparent 48%), radial-gradient(circle at 82% 70%, ${secondary}24 0%, transparent 46%)`
                : techniques.includes('light-leak')
                ? `linear-gradient(128deg, ${secondary}2a 0%, transparent 46%, ${accent}1c 100%)`
                : `radial-gradient(circle at 80% 18%, ${accent}20 0%, transparent 55%)`,
            }}
          />

          {techniques.includes('halftone-newsprint') && (
            <div
              className="pointer-events-none absolute bottom-[6%] left-[5%] h-[8%] w-[16%] opacity-20"
              style={{
                backgroundImage: `radial-gradient(${ink} 1.1px, transparent 1.1px)`,
                backgroundSize: '7px 7px',
              }}
            />
          )}

          {/* Delicate Archival Margin Hairline */}
          <div
            className="pointer-events-none absolute inset-[2.6%] border"
            style={{ borderColor: `${ink}16` }}
          />

          {/* Vertical Spine Archive Timestamp */}
          {plan.titleBlock.verticalSpineLabel && (
            <div
              className="pointer-events-none absolute left-[2.2%] top-[56%] z-10 origin-top-left -rotate-90 text-[0.95cqw] uppercase tracking-[0.28em] opacity-55"
              style={{ color: mutedInk, fontFamily: typo.bodyFont }}
            >
              {plan.titleBlock.verticalSpineLabel}
            </div>
          )}

          {/* Z-PLANE 1: Torn Colored Paper Scraps, Translucent Vellum & Fabric Swatches */}
          {plan.paperScraps.map((scrap) => (
            <PaperScrapElement key={scrap.id} scrap={scrap} ink={ink} />
          ))}

          {/* HEADER / TITLE COMPOSITION */}
          <header
            className={`pointer-events-none absolute z-20 ${
              plan.titleBlock.boxed ? 'border px-[1.8cqw] py-[1.2cqw] shadow-xs' : ''
            } ${plan.titleBlock.align === 'center' ? '-translate-x-1/2 text-center' : ''}`}
            style={{
              left: pctX(plan.titleBlock.x),
              top: pctY(plan.titleBlock.y),
              maxWidth: pctX(plan.titleBlock.maxW),
              transform: `rotate(${plan.titleBlock.rotation}deg)`,
              backgroundColor: plan.titleBlock.boxed ? surface : undefined,
              borderColor: plan.titleBlock.boxed ? `${ink}20` : undefined,
            }}
          >
            <p
              className="text-[1.15cqw] uppercase tracking-[0.22em]"
              style={{ color: mutedInk, fontFamily: typo.bodyFont }}
            >
              MEMENTO · {plan.formattedDate}
              {plan.locationOrWho ? ` · ${plan.locationOrWho}` : ''}
            </p>
            <h2
              className="mt-[0.4cqw] text-[4.1cqw] font-medium leading-[1.06]"
              style={{ fontFamily: typo.headingFont, color: ink }}
            >
              {memory.title}
            </h2>
          </header>

          {/* Z-PLANE 2..6: PHOTOGRAPH CUTOUTS */}
          {plan.photoSlots.map((slot) => {
            const photo = photos[slot.photoIndex];
            if (!photo) return null;

            const isPolaroid = slot.cutoutShape === 'polaroid';
            const clipCss = getClipPathCss(slot);

            return (
              <div
                key={`${photo.id}-${slot.photoIndex}`}
                className="group absolute transition-transform duration-300 hover:z-30 hover:scale-[1.015]"
                style={{
                  left: pctX(slot.x),
                  top: pctY(slot.y),
                  width: pctX(slot.w),
                  height: pctY(slot.h),
                  zIndex: slot.zIndex,
                  transform: `rotate(${slot.rotation}deg)`,
                }}
              >
                {/* Backing Cutout Paper Sheet for Torn/Deckled Depth */}
                {(slot.cutoutShape === 'torn' || slot.cutoutShape === 'deckled') && (
                  <div
                    className="pointer-events-none absolute -inset-[0.8cqw] shadow-md"
                    style={{
                      backgroundColor: surface,
                      clipPath: clipCss,
                    }}
                  />
                )}

                {/* Washi Tape Corners */}
                {slot.tapeCorners?.map((c) => (
                  <WashiTapeStrip key={c} corner={c} color={secondary} />
                ))}

                {/* Photo Mounting Corners */}
                {slot.hasPhotoCorners && (
                  <>
                    <span
                      className="pointer-events-none absolute -left-[0.5cqw] -top-[0.5cqw] z-30 h-[2.2cqw] w-[2.2cqw]"
                      style={{
                        backgroundColor: ink,
                        opacity: 0.72,
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                      }}
                    />
                    <span
                      className="pointer-events-none absolute -bottom-[0.5cqw] -right-[0.5cqw] z-30 h-[2.2cqw] w-[2.2cqw]"
                      style={{
                        backgroundColor: ink,
                        opacity: 0.72,
                        clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                      }}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setLightboxUrl(photo.url)}
                  aria-label={photo.originalName || memory.title}
                  className="relative block h-full w-full cursor-zoom-in overflow-hidden text-left shadow-lg"
                  style={{
                    backgroundColor:
                      slot.cutoutShape === 'torn' || slot.cutoutShape === 'scissors-poly'
                        ? 'transparent'
                        : slot.cutoutShape === 'film-frame'
                        ? '#181818'
                        : surface,
                    padding: isPolaroid
                      ? '1.1cqw 1.1cqw 3.8cqw 1.1cqw'
                      : slot.cutoutShape === 'film-frame'
                      ? '2.1cqw 1.2cqw'
                      : slot.cutoutShape === 'raw-cut'
                      ? '0'
                      : slot.cutoutShape === 'torn' || slot.cutoutShape === 'scissors-poly'
                      ? '0'
                      : '0.7cqw',
                    clipPath: clipCss,
                    border:
                      slot.cutoutShape === 'torn' ||
                      slot.cutoutShape === 'scissors-poly' ||
                      slot.cutoutShape === 'arch' ||
                      slot.cutoutShape === 'oval'
                        ? 'none'
                        : `1px solid ${ink}22`,
                  }}
                >
                  {/* Top & Bottom 35mm Sprockets for film-frame */}
                  {slot.cutoutShape === 'film-frame' && (
                    <div className="pointer-events-none absolute inset-x-[1cqw] top-[0.5cqw] flex justify-between">
                      {Array.from({ length: 16 }).map((_, sIdx) => (
                        <span
                          key={sIdx}
                          className="h-[0.9cqw] w-[1.2cqw] rounded-[1px] bg-stone-200/80"
                        />
                      ))}
                    </div>
                  )}

                  <div
                    className="relative h-full w-full overflow-hidden"
                    style={
                      slot.cutoutShape === 'arch'
                        ? { borderRadius: '50% 50% 0 0 / 34% 34% 0 0' }
                        : slot.cutoutShape === 'oval'
                        ? { borderRadius: '50%' }
                        : undefined
                    }
                  >
                    <img
                      src={photo.url}
                      alt={photo.originalName || memory.title}
                      referrerPolicy="no-referrer"
                      style={{ filter: film.cssFilter }}
                      className="h-full w-full object-cover"
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ backgroundColor: film.warmthTint }}
                    />
                  </div>

                  {slot.cutoutShape === 'film-frame' && (
                    <div className="pointer-events-none absolute inset-x-[1cqw] bottom-[0.5cqw] flex justify-between">
                      {Array.from({ length: 16 }).map((_, sIdx) => (
                        <span
                          key={sIdx}
                          className="h-[0.9cqw] w-[1.2cqw] rounded-[1px] bg-stone-200/80"
                        />
                      ))}
                    </div>
                  )}

                  {isPolaroid && slot.polaroidCaption && (
                    <p
                      className="mt-[0.55cqw] truncate px-[0.3cqw] text-[1.45cqw] leading-none"
                      style={{ fontFamily: typo.noteFont, color: mutedInk }}
                    >
                      {slot.polaroidCaption}
                    </p>
                  )}
                </button>
              </div>
            );
          })}

          {/* MULTI-PHOTO 35MM FILMSTRIP RAIL */}
          {plan.filmstripSlot && (
            <div
              className="absolute flex items-center gap-[1.1cqw] bg-stone-900 px-[1.4cqw] py-[1.8cqw] shadow-xl"
              style={{
                left: pctX(plan.filmstripSlot.x),
                top: pctY(plan.filmstripSlot.y),
                width: pctX(plan.filmstripSlot.w),
                height: pctY(plan.filmstripSlot.h),
                zIndex: plan.filmstripSlot.zIndex,
                transform: `rotate(${plan.filmstripSlot.rotation}deg)`,
              }}
            >
              <div className="pointer-events-none absolute inset-x-[1.2cqw] top-[0.5cqw] flex justify-between">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="h-[0.75cqw] w-[1.1cqw] rounded-[1px] bg-stone-300/75" />
                ))}
              </div>
              {plan.filmstripSlot.photoIndices.map((pIdx) => {
                const ph = photos[pIdx];
                if (!ph) return null;
                return (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => setLightboxUrl(ph.url)}
                    className="relative h-full flex-1 cursor-zoom-in overflow-hidden border border-stone-700"
                  >
                    <img
                      src={ph.url}
                      alt={ph.originalName}
                      referrerPolicy="no-referrer"
                      style={{ filter: film.cssFilter }}
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
              <div className="pointer-events-none absolute inset-x-[1.2cqw] bottom-[0.5cqw] flex justify-between">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="h-[0.75cqw] w-[1.1cqw] rounded-[1px] bg-stone-300/75" />
                ))}
              </div>
            </div>
          )}

          {/* EMBROIDERED STITCHED THREAD CONNECTIONS */}
          {plan.stitchedThreads.map((st, idx) => (
            <svg
              key={idx}
              viewBox={`0 0 ${COLLAGE_W} ${COLLAGE_H}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ zIndex: st.zIndex }}
              aria-hidden="true"
            >
              <path
                d={`M${st.x1} ${st.y1} Q${st.cx} ${st.cy} ${st.x2} ${st.y2}`}
                fill="none"
                stroke={st.color}
                strokeWidth="3.2"
                strokeDasharray="11 8"
                strokeLinecap="round"
                opacity="0.72"
              />
              <circle cx={st.x1} cy={st.y1} r="6" fill={st.color} opacity="0.8" />
              <circle cx={st.x2} cy={st.y2} r="6" fill={st.color} opacity="0.8" />
            </svg>
          ))}

          {/* Z-PLANE 3 & 4: CONTEXT-AUTHENTIC TACTILE KEEPSAKES */}
          {plan.details.map((item) => (
            <TactileDetailElement
              key={item.id}
              item={item}
              ink={ink}
              surface={surface}
              lang={memoryLang}
            />
          ))}

          {/* HANDWRITTEN CURSIVE MARGIN ANNOTATIONS */}
          {plan.handwrittenMargins.map((hm, idx) => (
            <div
              key={idx}
              className="pointer-events-none absolute leading-tight"
              style={{
                left: pctX(hm.x),
                top: pctY(hm.y),
                maxWidth: pctX(hm.maxW),
                zIndex: hm.zIndex,
                transform: `rotate(${hm.rotation}deg)`,
                fontFamily: typo.noteFont,
                fontSize: `${(hm.fontSize / COLLAGE_W) * 100}cqw`,
                color: hm.color,
              }}
            >
              {hm.text}
            </div>
          ))}

          {/* PERSONAL DIARY NOTE CARD (WITH FOLDED CORNER / PAPER CLIP / TAPE) */}
          <article
            className="absolute px-[2.4cqw] py-[2.1cqw] shadow-md"
            style={{
              left: pctX(plan.storyNote.x),
              top: pctY(plan.storyNote.y),
              width: pctX(plan.storyNote.w),
              minHeight: pctY(plan.storyNote.minH),
              zIndex: plan.storyNote.zIndex,
              transform: `rotate(${plan.storyNote.rotation}deg)`,
              backgroundColor:
                plan.storyNote.style === 'vellum-sheet' ? `${surface}cc` : surface,
              backdropFilter: plan.storyNote.style === 'vellum-sheet' ? 'blur(4px)' : undefined,
              border: `1px solid ${ink}1c`,
              clipPath:
                plan.storyNote.style === 'folded-note'
                  ? 'polygon(0 0, calc(100% - 2.6cqw) 0, 100% 2.6cqw, 100% 100%, 0 100%)'
                  : undefined,
            }}
          >
            {plan.storyNote.style === 'folded-note' && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 h-[2.6cqw] w-[2.6cqw]"
                style={{
                  background: `linear-gradient(135deg, ${bg} 49%, ${ink}18 50%, ${surface} 53%)`,
                }}
              />
            )}
            {plan.storyNote.hasPaperClip && <PaperClipSvg color={mutedInk} />}
            {plan.storyNote.hasTape && <WashiTapeStrip corner="tl" color={accent} />}

            {plan.aiCaptionLabel && (
              <p
                className="mb-[0.6cqw] text-[0.9cqw] uppercase tracking-[0.2em] opacity-70"
                style={{ color: mutedInk, fontFamily: typo.bodyFont }}
              >
                {plan.aiCaptionLabel}
              </p>
            )}

            <p
              className="text-[1.72cqw] leading-[1.52]"
              style={{ fontFamily: typo.bodyFont, color: ink }}
            >
              {plan.storyText}
            </p>

            {plan.sensoryNotes.length > 0 && (
              <div className="mt-[1.1cqw] space-y-[0.35cqw]">
                {plan.sensoryNotes.slice(0, 2).map((note, idx) => (
                  <p
                    key={idx}
                    className="text-[2.15cqw] leading-[1.25]"
                    style={{ fontFamily: typo.noteFont, color: accent }}
                  >
                    {note}
                  </p>
                ))}
              </div>
            )}

            {plan.musicLabel && (
              <p
                className="mt-[1.1cqw] border-t pt-[0.8cqw] text-[1.12cqw]"
                style={{ borderColor: `${ink}18`, color: mutedInk, fontFamily: typo.bodyFont }}
              >
                {memoryLang === 'ru' ? 'Музыка' : 'Soundtrack'} ·{' '}
                <span className="font-medium" style={{ color: ink }}>
                  {plan.musicLabel}
                </span>
              </p>
            )}
          </article>

          {/* Subtle Analog Vignette */}
          <div
            className="pointer-events-none absolute inset-0 z-40"
            style={{
              boxShadow: `inset 0 0 85px rgba(0,0,0,${film.vignetteOpacity * 0.5})`,
            }}
          />
        </div>
      </div>

      {/* Photo Inspection Lightbox */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close photograph viewer"
            className="absolute right-5 top-5 flex h-11 w-11 cursor-pointer items-center justify-center border border-white/30 bg-black/50 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full detail view"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
