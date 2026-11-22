import type {
  CollageStyleId,
  DesignSpecification,
  LayoutId,
  SmallDetailId,
} from './artLibrary';
import type { AppLanguage, MemoryAnswerRecord } from './types';

export const COLLAGE_W = 1600;
export const COLLAGE_H = 2000;

export type CutoutShapeId =
  | 'torn'
  | 'scissors-poly'
  | 'arch'
  | 'oval'
  | 'polaroid'
  | 'deckled'
  | 'raw-cut'
  | 'film-frame';

export interface PaperScrapSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  opacity: number;
  zIndex: number;
  kind: 'torn-paper' | 'vellum' | 'envelope-flap' | 'fabric-swatch' | 'solid-block';
  polygonNorm: Array<[number, number]>;
}

export interface PhotoSlotSpec {
  photoIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  cutoutShape: CutoutShapeId;
  polygonNorm: Array<[number, number]>;
  hasPhotoCorners?: boolean;
  tapeCorners?: Array<'tl' | 'tr' | 'bl' | 'br' | 'top-center'>;
  polaroidCaption?: string;
}

export interface DetailItemSpec {
  id: string;
  kind: SmallDetailId;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  primaryColor: string;
  secondaryColor: string;
  labelText?: string;
  anchorPhotoIndex?: number;
}

export interface TitleBlockSpec {
  x: number;
  y: number;
  maxW: number;
  align: 'left' | 'right' | 'center';
  rotation: number;
  boxed: boolean;
  verticalSpineLabel?: string;
}

export interface StoryNoteSpec {
  x: number;
  y: number;
  w: number;
  minH: number;
  rotation: number;
  zIndex: number;
  style: 'folded-note' | 'torn-card' | 'vellum-sheet' | 'editorial-column';
  hasPaperClip?: boolean;
  hasTape?: boolean;
}

export interface HandwrittenMarginSpec {
  text: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  maxW: number;
  color: string;
  zIndex: number;
}

export interface ArtisticCompositionPlan {
  width: number;
  height: number;
  collageStyle: CollageStyleId;
  seed: number;
  titleBlock: TitleBlockSpec;
  paperScraps: PaperScrapSpec[];
  photoSlots: PhotoSlotSpec[];
  details: DetailItemSpec[];
  storyNote: StoryNoteSpec;
  handwrittenMargins: HandwrittenMarginSpec[];
  filmstripSlot?: {
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
    zIndex: number;
    photoIndices: number[];
  };
  stitchedThreads: Array<{
    x1: number;
    y1: number;
    cx: number;
    cy: number;
    x2: number;
    y2: number;
    color: string;
    zIndex: number;
  }>;
  aiCaptionLabel: string | null;
  storyText: string;
  sensoryNotes: string[];
  formattedDate: string;
  locationOrWho: string;
  musicLabel?: string;
}

export interface CompositionBuildInput {
  seedKey: string;
  photoCount: number;
  memoryDate: string;
  language: AppLanguage;
  title: string;
  storyText: string;
  isAiOnlyText?: boolean;
  designSpec: DesignSpecification;
  answers?: MemoryAnswerRecord[];
  sensoryNotes?: string[];
  whereOrWho?: string;
  musicLabel?: string;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateTornPolygonNorm(seed: number, jaggedness = 0.018): Array<[number, number]> {
  const rng = createRng(seed + 17);
  const pts: Array<[number, number]> = [];
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push([0.015 + t * 0.97, 0.012 + (rng() - 0.5) * jaggedness]);
  }
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    pts.push([0.985 + (rng() - 0.5) * jaggedness, 0.015 + t * 0.97]);
  }
  for (let i = 1; i <= segs; i++) {
    const t = 1 - i / segs;
    pts.push([0.015 + t * 0.97, 0.988 + (rng() - 0.5) * jaggedness]);
  }
  for (let i = 1; i < segs; i++) {
    const t = 1 - i / segs;
    pts.push([0.015 + (rng() - 0.5) * jaggedness, 0.015 + t * 0.97]);
  }
  return pts;
}

export function generateScissorsPolygonNorm(seed: number): Array<[number, number]> {
  const rng = createRng(seed + 91);
  return [
    [0.03 + rng() * 0.05, 0.01 + rng() * 0.03],
    [0.42 + (rng() - 0.5) * 0.08, 0.005 + rng() * 0.025],
    [0.95 - rng() * 0.05, 0.02 + rng() * 0.05],
    [0.99 - rng() * 0.02, 0.48 + (rng() - 0.5) * 0.1],
    [0.96 - rng() * 0.05, 0.96 - rng() * 0.04],
    [0.52 + (rng() - 0.5) * 0.1, 0.99 - rng() * 0.02],
    [0.04 + rng() * 0.04, 0.95 - rng() * 0.05],
    [0.008 + rng() * 0.025, 0.45 + (rng() - 0.5) * 0.1],
  ];
}

export function mapLegacyLayoutToCollageStyle(
  spec: DesignSpecification,
  combinedText: string
): CollageStyleId {
  if (spec.scrapbookPlan?.collageStyle) return spec.scrapbookPlan.collageStyle;
  if (/(herbarium|flower|garden|petal|meadow|botanical|лес|цвет|луг|сад)/.test(combinedText)) {
    return 'nature-herbarium';
  }
  const map: Record<LayoutId, CollageStyleId> = {
    'editorial-spread': 'editorial-art',
    'polaroid-cluster': 'playful-cutout',
    'filmstrip-diary': 'vintage-archive',
    'minimal-gallery': 'contemporary-art',
    'scrapbook-layers': 'handmade-scrapbook',
    'botanical-folio': 'nature-herbarium',
    'night-cinematic-zine': 'cinematic-journal',
    'watercolor-journal': 'dreamy-collage',
  };
  return map[spec.layoutId] || 'mixed-media-journal';
}

export function inferContextDetails(
  spec: DesignSpecification,
  combinedText: string,
  style: CollageStyleId,
  lang: AppLanguage
): {
  details: SmallDetailId[];
  edgeWord: string;
  sketchSubject: string;
  ticketLabel: string;
} {
  if (spec.scrapbookPlan?.selectedDetails && spec.scrapbookPlan.selectedDetails.length >= 4) {
    return {
      details: spec.scrapbookPlan.selectedDetails.slice(0, 9),
      edgeWord:
        spec.scrapbookPlan.handwrittenEdgeWord ||
        (lang === 'ru' ? 'в памяти' : 'kept closely'),
      sketchSubject: spec.scrapbookPlan.sketchSubject || 'memory detail',
      ticketLabel:
        spec.scrapbookPlan.ticketStubText ||
        spec.scrapbookPlan.locationOrLabelText ||
        (lang === 'ru' ? 'АРХИВ' : 'ARCHIVE'),
    };
  }

  const lower = combinedText.toLowerCase();
  const pool: SmallDetailId[] = ['torn-colored-paper', 'handwritten-edge-word', 'folded-note'];

  const isBeach = /(sea|ocean|beach|coast|salt|wave|sand|boardwalk|shell|sun|summer|мор|пляж|волн|берег|песок|солн|ракуш)/.test(lower);
  const isAutumn = /(autumn|fall|maple|leaf|leaves|october|cozy|coat|sweater|осен|лист|клён|клен|октябр)/.test(lower);
  const isCafe = /(coffee|cafe|café|mug|tea|cup|bakery|croissant|кофе|кофейн|кружк|чашк|чай|выпеч)/.test(lower);
  const isRainOrNight = /(rain|wet|tram|city|street|lamp|umbrella|night|midnight|noir|дожд|трамва|ноч|город|фонар|зонт|полноч)/.test(lower);
  const isBotanical = /(flower|garden|petal|meadow|forest|pine|grass|herb|цвет|сад|луг|лес|трав|хво)/.test(lower);
  const isCelebration = /(birthday|party|candle|cake|confetti|celebrat|friends|laugh|день рожд|праздн|свеч|торт|вечерин|смех|друз)/.test(lower);
  const isTravel = /(train|ticket|map|trip|flight|station|passport|поезд|билет|карт|путеш|вокзал|дорог)/.test(lower);

  if (isBeach) {
    pool.push('seashell-sketch', 'wave-ripples', 'sun-doodle', 'translucent-vellum', 'washi-tape', 'pencil-marks');
  }
  if (isAutumn) {
    pool.push('pressed-leaf', 'tiny-branch', 'stitched-thread', 'washi-tape', 'paper-clip', 'fabric-swatch');
  }
  if (isCafe) {
    pool.push('coffee-ring-mark', 'receipt-fragment', 'paper-clip', 'pencil-marks');
  }
  if (isRainOrNight) {
    pool.push('rain-streaks', 'umbrella-doodle', 'ticket-stub', 'city-map-fragment', 'film-strip-mini', 'tiny-stars');
  }
  if (isBotanical) {
    pool.push('pressed-flower', 'pressed-leaf', 'tiny-branch', 'translucent-vellum', 'stitched-thread');
  }
  if (isCelebration) {
    pool.push('candle-doodle', 'confetti-scraps', 'tiny-stars', 'camera-doodle', 'washi-tape', 'photo-corners');
  }
  if (isTravel) {
    pool.push('ticket-stub', 'city-map-fragment', 'postmark-seal', 'envelope-scrap', 'date-stamp');
  }

  // Fill to at least 6 authentic style-coherent details
  const styleExtras: Record<CollageStyleId, SmallDetailId[]> = {
    'handmade-scrapbook': ['washi-tape', 'paper-clip', 'stitched-thread', 'photo-corners', 'pencil-marks'],
    'mixed-media-journal': ['translucent-vellum', 'pencil-marks', 'ink-sketch-object', 'fabric-swatch', 'washi-tape'],
    'editorial-art': ['translucent-vellum', 'date-stamp', 'pencil-marks', 'minimal-hairline' as unknown as SmallDetailId],
    'vintage-archive': ['photo-corners', 'envelope-scrap', 'postmark-seal', 'date-stamp', 'receipt-fragment'],
    'dreamy-collage': ['translucent-vellum', 'tiny-stars', 'sun-doodle', 'pressed-flower'],
    'playful-cutout': ['confetti-scraps', 'washi-tape', 'camera-doodle', 'tiny-stars', 'pencil-marks'],
    'cinematic-journal': ['film-strip-mini', 'ticket-stub', 'date-stamp', 'city-map-fragment', 'tiny-stars'],
    'nature-herbarium': ['pressed-flower', 'pressed-leaf', 'tiny-branch', 'translucent-vellum', 'date-stamp'],
    'contemporary-art': ['stitched-thread', 'pencil-marks', 'ink-sketch-object', 'fabric-swatch'],
  };

  for (const extra of styleExtras[style]) {
    if (
      extra &&
      (extra as string) !== 'minimal-hairline' &&
      !pool.includes(extra) &&
      pool.length < 7
    ) {
      pool.push(extra);
    }
  }

  const deduped = Array.from(new Set(pool)).slice(0, 8);

  let edgeWord = lang === 'ru' ? 'тёплый след' : 'unhurried light';
  if (isBeach) edgeWord = lang === 'ru' ? 'солёный ветер' : 'salt & breeze';
  else if (isAutumn || isCafe) edgeWord = lang === 'ru' ? 'октябрь и кофе' : 'warm mugs & dusk';
  else if (isRainOrNight) edgeWord = lang === 'ru' ? 'тишина улиц' : 'rain-lit avenue';
  else if (isCelebration) edgeWord = lang === 'ru' ? 'наш смех' : 'caught mid-laugh';
  else if (isBotanical) edgeWord = lang === 'ru' ? 'тихий сад' : 'pressed in bloom';

  const ticketLabel =
    spec.scrapbookPlan?.ticketStubText ||
    (isRainOrNight
      ? lang === 'ru'
        ? 'МАРШРУТ 12 · НОЧЬ'
        : 'LINE 12 · EVENING PASS'
      : isCafe
      ? lang === 'ru'
        ? 'КОФЕЙНЯ · СТОЛИК У ОКНА'
        : 'CAFE TABLE · 2 CUPS'
      : lang === 'ru'
      ? 'АРХИВ ПАМЯТИ'
      : 'MEMORY ARCHIVE');

  return {
    details: deduped,
    edgeWord,
    sketchSubject: isBeach ? 'shell' : isRainOrNight ? 'umbrella' : isCelebration ? 'candle' : 'camera',
    ticketLabel,
  };
}

export function buildArtisticComposition(input: CompositionBuildInput): ArtisticCompositionPlan {
  const { designSpec, language, memoryDate, title, storyText } = input;
  const lang: AppLanguage = language === 'ru' ? 'ru' : 'en';
  const count = Math.max(1, Math.min(8, input.photoCount));
  const seed = hashString(`${input.seedKey}|${title}|${memoryDate}|${count}`);
  const rng = createRng(seed);

  const answers = input.answers || [];
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  const combinedText = [
    title,
    storyText,
    designSpec.moodSummary,
    ...(designSpec.atmosphereKeywords || []),
    ...(designSpec.decorativeMotifs || []),
    ...answers.map((a) => a.answer),
    input.musicLabel || '',
  ].join(' ');

  const collageStyle = mapLegacyLayoutToCollageStyle(designSpec, combinedText);
  const { details, edgeWord, ticketLabel } = inferContextDetails(
    designSpec,
    combinedText,
    collageStyle,
    lang
  );

  const sensoryNotes = (
    input.sensoryNotes && input.sensoryNotes.length > 0
      ? input.sensoryNotes
      : answers
          .filter((a) => ['smell', 'sounds', 'detail_remember', 'weather'].includes(a.questionId))
          .map((a) => a.answer)
          .filter(Boolean)
  ).slice(0, 3);

  const locationOrWho =
    input.whereOrWho ||
    designSpec.scrapbookPlan?.locationOrLabelText ||
    answerMap.get('who_with') ||
    answerMap.get('reminds_of')?.split(',')[0]?.trim() ||
    '';

  const formattedDate = new Date(`${memoryDate.slice(0, 10)}T12:00:00`).toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const userHex = designSpec.palette.chosenByUser || designSpec.palette.primaryAccent;
  const extracted0 = designSpec.palette.extractedFromPhoto[0] || designSpec.palette.primaryAccent;
  const extracted1 = designSpec.palette.extractedFromPhoto[1] || designSpec.palette.secondaryAccent;
  const secondaryHex = designSpec.palette.secondaryAccent || extracted1;
  const accentHex = designSpec.palette.primaryAccent;
  const surfaceHex = designSpec.palette.surface;
  const inkHex = designSpec.palette.ink;

  const scraps: PaperScrapSpec[] = [];
  const photoSlots: PhotoSlotSpec[] = [];
  const detailItems: DetailItemSpec[] = [];
  const stitchedThreads: ArtisticCompositionPlan['stitchedThreads'] = [];
  const handwrittenMargins: HandwrittenMarginSpec[] = [];
  let filmstripSlot: ArtisticCompositionPlan['filmstripSlot'];

  // Defaults overridden per style choreography
  let titleBlock: TitleBlockSpec = {
    x: 110,
    y: 120,
    maxW: 940,
    align: 'left',
    rotation: 0,
    boxed: false,
  };

  let storyNote: StoryNoteSpec = {
    x: 110,
    y: 1410,
    w: 840,
    minH: 360,
    rotation: -0.8,
    zIndex: 8,
    style: 'torn-card',
    hasPaperClip: details.includes('paper-clip'),
    hasTape: details.includes('washi-tape'),
  };

  // =========================================================================
  // 9 GENUINELY DIFFERENT ARCHITECTURAL COLLAGE CHOREOGRAPHIES (1600×2000)
  // =========================================================================
  if (collageStyle === 'handmade-scrapbook') {
    titleBlock = { x: 105, y: 110, maxW: 860, align: 'left', rotation: -0.4, boxed: false };

    scraps.push(
      {
        id: 'scrap-kraft-back',
        x: 92,
        y: 350,
        w: 820,
        h: 920,
        rotation: -3.2,
        color: userHex,
        opacity: 0.32,
        zIndex: 1,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 11, 0.022),
      },
      {
        id: 'scrap-vellum-mid',
        x: 740,
        y: 250,
        w: 690,
        h: 510,
        rotation: 2.1,
        color: extracted1,
        opacity: 0.24,
        zIndex: 2,
        kind: 'vellum',
        polygonNorm: generateTornPolygonNorm(seed + 23, 0.012),
      },
      {
        id: 'scrap-swatch-bottom',
        x: 980,
        y: 1280,
        w: 440,
        h: 340,
        rotation: 4.5,
        color: secondaryHex,
        opacity: 0.28,
        zIndex: 2,
        kind: 'fabric-swatch',
        polygonNorm: generateTornPolygonNorm(seed + 37, 0.016),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 135,
      y: 385,
      w: count === 1 ? 880 : 750,
      h: count === 1 ? 820 : 770,
      rotation: -1.8,
      zIndex: 4,
      cutoutShape: 'torn',
      polygonNorm: generateTornPolygonNorm(seed + 41, 0.014),
      tapeCorners: ['tl', 'br'],
      polaroidCaption: sensoryNotes[0],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 845,
        y: 440,
        w: 585,
        h: 490,
        rotation: 3.4,
        zIndex: 5,
        cutoutShape: 'polaroid',
        polygonNorm: generateTornPolygonNorm(seed + 53, 0.008),
        hasPhotoCorners: true,
        polaroidCaption: sensoryNotes[1] || edgeWord,
      });
    }
    if (count >= 3) {
      photoSlots.push({
        photoIndex: 2,
        x: 960,
        y: 960,
        w: 485,
        h: 375,
        rotation: -2.9,
        zIndex: 6,
        cutoutShape: 'deckled',
        polygonNorm: generateTornPolygonNorm(seed + 67, 0.011),
        tapeCorners: ['top-center'],
      });
    }
    for (let i = 3; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 140 + ((i - 3) % 3) * 265,
        y: 1120 + Math.floor((i - 3) / 3) * 210,
        w: 240,
        h: 195,
        rotation: i % 2 === 0 ? 3.2 : -3.6,
        zIndex: 6 + i,
        cutoutShape: 'polaroid',
        polygonNorm: generateTornPolygonNorm(seed + i * 19, 0.009),
        tapeCorners: ['top-center'],
      });
    }

    storyNote = {
      x: 120,
      y: count > 3 ? 1470 : 1365,
      w: 830,
      minH: 370,
      rotation: 0.7,
      zIndex: 8,
      style: 'folded-note',
      hasPaperClip: true,
      hasTape: false,
    };

    stitchedThreads.push({
      x1: 860,
      y1: 1130,
      cx: 960,
      cy: 1280,
      x2: 910,
      y2: 1410,
      color: accentHex,
      zIndex: 7,
    });
  } else if (collageStyle === 'editorial-art') {
    titleBlock = {
      x: 105,
      y: 118,
      maxW: 780,
      align: 'left',
      rotation: 0,
      boxed: false,
      verticalSpineLabel: `FOLIO ${memoryDate.slice(0, 7)}`,
    };

    scraps.push(
      {
        id: 'ed-back-arch',
        x: 680,
        y: 165,
        w: 800,
        h: 1080,
        rotation: 0,
        color: extracted0,
        opacity: 0.2,
        zIndex: 1,
        kind: 'solid-block',
        polygonNorm: generateTornPolygonNorm(seed + 13, 0.004),
      },
      {
        id: 'ed-torn-accent',
        x: 560,
        y: 1160,
        w: 620,
        h: 220,
        rotation: -1.4,
        color: userHex,
        opacity: 0.36,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 29, 0.022),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: count === 1 ? 560 : 620,
      y: 230,
      w: count === 1 ? 870 : 810,
      h: 980,
      rotation: 0,
      zIndex: 4,
      cutoutShape: 'arch',
      polygonNorm: generateTornPolygonNorm(seed + 43, 0.004),
      tapeCorners: [],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 135,
        y: 660,
        w: 540,
        h: 440,
        rotation: -1.6,
        zIndex: 5,
        cutoutShape: 'raw-cut',
        polygonNorm: generateTornPolygonNorm(seed + 59, 0.004),
        tapeCorners: ['tl'],
      });
    }
    if (count >= 3) {
      photoSlots.push({
        photoIndex: 2,
        x: 1040,
        y: 1210,
        w: 410,
        h: 350,
        rotation: 2.2,
        zIndex: 6,
        cutoutShape: 'deckled',
        polygonNorm: generateTornPolygonNorm(seed + 71, 0.01),
      });
    }
    for (let i = 3; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 145 + (i - 3) * 215,
        y: 1140,
        w: 195,
        h: 175,
        rotation: (i % 2 === 0 ? 1.5 : -1.5),
        zIndex: 6 + i,
        cutoutShape: 'raw-cut',
        polygonNorm: generateTornPolygonNorm(seed + i * 21, 0.005),
      });
    }

    storyNote = {
      x: 115,
      y: 1355,
      w: 840,
      minH: 410,
      rotation: 0,
      zIndex: 8,
      style: 'editorial-column',
      hasPaperClip: false,
      hasTape: false,
    };
  } else if (collageStyle === 'mixed-media-journal') {
    titleBlock = { x: 115, y: 115, maxW: 920, align: 'left', rotation: -0.6, boxed: true };

    scraps.push(
      {
        id: 'mm-vellum-top',
        x: 90,
        y: 340,
        w: 980,
        h: 460,
        rotation: 1.5,
        color: secondaryHex,
        opacity: 0.25,
        zIndex: 1,
        kind: 'vellum',
        polygonNorm: generateTornPolygonNorm(seed + 19, 0.012),
      },
      {
        id: 'mm-torn-right',
        x: 840,
        y: 520,
        w: 640,
        h: 790,
        rotation: -2.4,
        color: userHex,
        opacity: 0.3,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 31, 0.022),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 155,
      y: 415,
      w: 770,
      h: 720,
      rotation: -2.1,
      zIndex: 4,
      cutoutShape: 'scissors-poly',
      polygonNorm: generateScissorsPolygonNorm(seed + 47),
      tapeCorners: ['tr', 'bl'],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 880,
        y: 325,
        w: 540,
        h: 620,
        rotation: 2.8,
        zIndex: 5,
        cutoutShape: 'oval',
        polygonNorm: generateTornPolygonNorm(seed + 61, 0.005),
      });
    }
    if (count >= 3) {
      photoSlots.push({
        photoIndex: 2,
        x: 830,
        y: 940,
        w: 580,
        h: 410,
        rotation: -1.8,
        zIndex: 6,
        cutoutShape: 'torn',
        polygonNorm: generateTornPolygonNorm(seed + 79, 0.018),
        tapeCorners: ['top-center'],
      });
    }
    for (let i = 3; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 165 + (i - 3) * 230,
        y: 1120,
        w: 210,
        h: 195,
        rotation: i % 2 === 0 ? -3.1 : 3.2,
        zIndex: 6 + i,
        cutoutShape: 'deckled',
        polygonNorm: generateTornPolygonNorm(seed + i * 29, 0.012),
      });
    }

    storyNote = {
      x: 120,
      y: 1380,
      w: 760,
      minH: 400,
      rotation: -0.9,
      zIndex: 8,
      style: 'torn-card',
      hasPaperClip: true,
      hasTape: true,
    };

    stitchedThreads.push({
      x1: 210,
      y1: 1140,
      cx: 175,
      cy: 1290,
      x2: 245,
      y2: 1405,
      color: secondaryHex,
      zIndex: 7,
    });
  } else if (collageStyle === 'vintage-archive') {
    titleBlock = {
      x: 120,
      y: 120,
      maxW: 960,
      align: 'left',
      rotation: 0,
      boxed: false,
      verticalSpineLabel: `ARCHIVE · ${memoryDate}`,
    };

    scraps.push(
      {
        id: 'va-envelope',
        x: 800,
        y: 295,
        w: 660,
        h: 530,
        rotation: 2.8,
        color: extracted1,
        opacity: 0.34,
        zIndex: 1,
        kind: 'envelope-flap',
        polygonNorm: generateTornPolygonNorm(seed + 17, 0.008),
      },
      {
        id: 'va-backing-ledger',
        x: 110,
        y: 350,
        w: 840,
        h: 880,
        rotation: -1.2,
        color: userHex,
        opacity: 0.22,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 33, 0.014),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 155,
      y: 390,
      w: count === 1 ? 890 : 760,
      h: 770,
      rotation: -1.1,
      zIndex: 4,
      cutoutShape: 'polaroid',
      polygonNorm: generateTornPolygonNorm(seed + 45, 0.005),
      hasPhotoCorners: true,
      polaroidCaption: sensoryNotes[0] || locationOrWho,
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 895,
        y: 495,
        w: 540,
        h: 470,
        rotation: 3.1,
        zIndex: 5,
        cutoutShape: 'polaroid',
        polygonNorm: generateTornPolygonNorm(seed + 57, 0.005),
        hasPhotoCorners: true,
      });
    }

    if (count >= 3) {
      filmstripSlot = {
        x: 820,
        y: 1015,
        w: 630,
        h: 290,
        rotation: -1.5,
        zIndex: 6,
        photoIndices: Array.from({ length: Math.min(3, count - 2) }, (_, idx) => idx + 2),
      };
    }

    storyNote = {
      x: 120,
      y: 1365,
      w: 840,
      minH: 410,
      rotation: 0.4,
      zIndex: 8,
      style: 'folded-note',
      hasPaperClip: true,
    };
  } else if (collageStyle === 'dreamy-collage') {
    titleBlock = { x: 115, y: 118, maxW: 940, align: 'left', rotation: 0, boxed: false };

    scraps.push(
      {
        id: 'dr-vellum-wash',
        x: 110,
        y: 350,
        w: 960,
        h: 720,
        rotation: -1.6,
        color: userHex,
        opacity: 0.25,
        zIndex: 1,
        kind: 'vellum',
        polygonNorm: generateTornPolygonNorm(seed + 14, 0.012),
      },
      {
        id: 'dr-vellum-lower',
        x: 780,
        y: 520,
        w: 690,
        h: 640,
        rotation: 2.8,
        color: secondaryHex,
        opacity: 0.22,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 28, 0.015),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: count === 1 ? 165 : 175,
      y: 355,
      w: count === 1 ? 820 : 750,
      h: count === 1 ? 900 : 880,
      rotation: -1.4,
      zIndex: 4,
      cutoutShape: 'arch',
      polygonNorm: generateTornPolygonNorm(seed + 42, 0.006),
      tapeCorners: ['top-center'],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 865,
        y: 465,
        w: 550,
        h: 630,
        rotation: 2.8,
        zIndex: 5,
        cutoutShape: 'oval',
        polygonNorm: generateTornPolygonNorm(seed + 58, 0.005),
      });
    }
    for (let i = 2; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 780 + ((i - 2) % 3) * 220,
        y: 1090 + Math.floor((i - 2) / 3) * 165,
        w: 225,
        h: 225,
        rotation: i % 2 === 0 ? -2.4 : 2.5,
        zIndex: 6 + i,
        cutoutShape: 'oval',
        polygonNorm: generateTornPolygonNorm(seed + i * 23, 0.006),
      });
    }

    storyNote = {
      x: 130,
      y: 1385,
      w: 830,
      minH: 390,
      rotation: -0.5,
      zIndex: 8,
      style: 'vellum-sheet',
      hasTape: true,
    };
  } else if (collageStyle === 'playful-cutout') {
    titleBlock = { x: 110, y: 110, maxW: 960, align: 'left', rotation: -1.1, boxed: false };

    scraps.push(
      {
        id: 'pc-bold-cut',
        x: 95,
        y: 345,
        w: 790,
        h: 820,
        rotation: -4.2,
        color: userHex,
        opacity: 0.42,
        zIndex: 1,
        kind: 'torn-paper',
        polygonNorm: generateScissorsPolygonNorm(seed + 15),
      },
      {
        id: 'pc-second-cut',
        x: 820,
        y: 440,
        w: 660,
        h: 720,
        rotation: 4.5,
        color: secondaryHex,
        opacity: 0.36,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateScissorsPolygonNorm(seed + 27),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 165,
      y: 375,
      w: count === 1 ? 880 : 720,
      h: 740,
      rotation: -3.6,
      zIndex: 4,
      cutoutShape: 'scissors-poly',
      polygonNorm: generateScissorsPolygonNorm(seed + 39),
      tapeCorners: ['tl', 'tr'],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 845,
        y: 325,
        w: 580,
        h: 530,
        rotation: 4.4,
        zIndex: 5,
        cutoutShape: 'torn',
        polygonNorm: generateTornPolygonNorm(seed + 51, 0.02),
        tapeCorners: ['br'],
      });
    }
    if (count >= 3) {
      photoSlots.push({
        photoIndex: 2,
        x: 785,
        y: 860,
        w: 615,
        h: 440,
        rotation: -2.9,
        zIndex: 6,
        cutoutShape: 'scissors-poly',
        polygonNorm: generateScissorsPolygonNorm(seed + 69),
        tapeCorners: ['top-center'],
      });
    }
    for (let i = 3; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 135 + (i - 3) * 235,
        y: 1125,
        w: 220,
        h: 210,
        rotation: i % 2 === 0 ? 5.2 : -4.8,
        zIndex: 7 + i,
        cutoutShape: i % 2 === 0 ? 'oval' : 'scissors-poly',
        polygonNorm: generateScissorsPolygonNorm(seed + i * 31),
        tapeCorners: ['top-center'],
      });
    }

    storyNote = {
      x: 120,
      y: 1385,
      w: 840,
      minH: 390,
      rotation: 1.1,
      zIndex: 8,
      style: 'torn-card',
      hasTape: true,
      hasPaperClip: true,
    };
  } else if (collageStyle === 'cinematic-journal') {
    titleBlock = {
      x: 135,
      y: 118,
      maxW: 980,
      align: 'left',
      rotation: 0,
      boxed: false,
      verticalSpineLabel: `REEL 35MM · ${memoryDate}`,
    };

    scraps.push(
      {
        id: 'cj-strip-band',
        x: 100,
        y: 335,
        w: 1390,
        h: 260,
        rotation: -0.7,
        color: userHex,
        opacity: 0.28,
        zIndex: 1,
        kind: 'vellum',
        polygonNorm: generateTornPolygonNorm(seed + 19, 0.006),
      },
      {
        id: 'cj-lower-accent',
        x: 990,
        y: 1290,
        w: 485,
        h: 410,
        rotation: 2.1,
        color: secondaryHex,
        opacity: 0.22,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 41, 0.015),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 145,
      y: 365,
      w: 1290,
      h: count === 1 ? 780 : 660,
      rotation: -0.4,
      zIndex: 4,
      cutoutShape: 'film-frame',
      polygonNorm: generateTornPolygonNorm(seed + 37, 0.003),
      tapeCorners: [],
    });

    if (count >= 2) {
      filmstripSlot = {
        x: 155,
        y: 1065,
        w: 1280,
        h: 265,
        rotation: 0.5,
        zIndex: 6,
        photoIndices: Array.from({ length: Math.min(4, count - 1) }, (_, idx) => idx + 1),
      };
    }

    storyNote = {
      x: 135,
      y: count >= 2 ? 1390 : 1310,
      w: 830,
      minH: 390,
      rotation: 0,
      zIndex: 8,
      style: 'editorial-column',
      hasPaperClip: false,
      hasTape: false,
    };
  } else if (collageStyle === 'nature-herbarium') {
    titleBlock = {
      x: 120,
      y: 118,
      maxW: 960,
      align: 'left',
      rotation: 0,
      boxed: false,
      verticalSpineLabel: `HERBARIUM · ${memoryDate.slice(0, 7)}`,
    };

    scraps.push(
      {
        id: 'nh-linen-sheet',
        x: 130,
        y: 335,
        w: 790,
        h: 930,
        rotation: -0.9,
        color: extracted1,
        opacity: 0.26,
        zIndex: 1,
        kind: 'vellum',
        polygonNorm: generateTornPolygonNorm(seed + 18, 0.012),
      },
      {
        id: 'nh-herb-backing',
        x: 780,
        y: 420,
        w: 670,
        h: 790,
        rotation: 1.8,
        color: userHex,
        opacity: 0.24,
        zIndex: 2,
        kind: 'torn-paper',
        polygonNorm: generateTornPolygonNorm(seed + 34, 0.015),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 165,
      y: 385,
      w: count === 1 ? 820 : 730,
      h: 820,
      rotation: -0.7,
      zIndex: 4,
      cutoutShape: 'arch',
      polygonNorm: generateTornPolygonNorm(seed + 44, 0.006),
      tapeCorners: ['top-center'],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 925,
        y: 465,
        w: 515,
        h: 530,
        rotation: 2.1,
        zIndex: 5,
        cutoutShape: 'deckled',
        polygonNorm: generateTornPolygonNorm(seed + 58, 0.01),
        tapeCorners: ['tl', 'br'],
      });
    }
    for (let i = 2; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 840 + ((i - 2) % 2) * 290,
        y: 1030 + Math.floor((i - 2) / 2) * 190,
        w: 270,
        h: 240,
        rotation: i % 2 === 0 ? -1.8 : 2.3,
        zIndex: 6 + i,
        cutoutShape: 'oval',
        polygonNorm: generateTornPolygonNorm(seed + i * 25, 0.008),
      });
    }

    storyNote = {
      x: 125,
      y: 1375,
      w: 840,
      minH: 400,
      rotation: 0,
      zIndex: 8,
      style: 'folded-note',
      hasTape: true,
      hasPaperClip: false,
    };

    stitchedThreads.push({
      x1: 870,
      y1: 520,
      cx: 915,
      cy: 680,
      x2: 880,
      y2: 850,
      color: accentHex,
      zIndex: 7,
    });
  } else {
    // 'contemporary-art'
    titleBlock = { x: 115, y: 112, maxW: 960, align: 'left', rotation: 0, boxed: false };

    scraps.push(
      {
        id: 'ca-color-monolith',
        x: 420,
        y: 310,
        w: 1040,
        h: 720,
        rotation: 1.2,
        color: userHex,
        opacity: 0.38,
        zIndex: 1,
        kind: 'solid-block',
        polygonNorm: generateTornPolygonNorm(seed + 22, 0.006),
      },
      {
        id: 'ca-fabric',
        x: 110,
        y: 920,
        w: 580,
        h: 410,
        rotation: -2.2,
        color: secondaryHex,
        opacity: 0.3,
        zIndex: 2,
        kind: 'fabric-swatch',
        polygonNorm: generateTornPolygonNorm(seed + 39, 0.012),
      }
    );

    photoSlots.push({
      photoIndex: 0,
      x: 145,
      y: 375,
      w: count === 1 ? 940 : 810,
      h: 770,
      rotation: 0,
      zIndex: 4,
      cutoutShape: 'raw-cut',
      polygonNorm: generateTornPolygonNorm(seed + 49, 0.004),
      tapeCorners: ['tr'],
    });

    if (count >= 2) {
      photoSlots.push({
        photoIndex: 1,
        x: 890,
        y: 590,
        w: 560,
        h: 620,
        rotation: 1.8,
        zIndex: 5,
        cutoutShape: 'oval',
        polygonNorm: generateTornPolygonNorm(seed + 63, 0.005),
      });
    }
    for (let i = 2; i < count; i++) {
      photoSlots.push({
        photoIndex: i,
        x: 180 + (i - 2) * 260,
        y: 1110,
        w: 240,
        h: 220,
        rotation: i % 2 === 0 ? -2.5 : 2.1,
        zIndex: 6 + i,
        cutoutShape: 'scissors-poly',
        polygonNorm: generateScissorsPolygonNorm(seed + i * 33),
      });
    }

    storyNote = {
      x: 120,
      y: 1380,
      w: 840,
      minH: 395,
      rotation: 0,
      zIndex: 8,
      style: 'editorial-column',
      hasPaperClip: true,
    };

    stitchedThreads.push({
      x1: 880,
      y1: 350,
      cx: 1120,
      cy: 470,
      x2: 1410,
      y2: 430,
      color: inkHex,
      zIndex: 7,
    });
  }

  // =========================================================================
  // PLACE CONTEXT-AUTHENTIC SMALL DETAILS (NON-OVERLAPPING & CANVAS-CLAMPED)
  // =========================================================================
  const mainPhoto = photoSlots[0];
  const isWideHero = (mainPhoto?.w || 0) > 980;
  const edgeAnchorX = isWideHero
    ? Math.max(85, (mainPhoto?.x || 145) - 30)
    : Math.min(1190, (mainPhoto?.x || 150) + (mainPhoto?.w || 740) - 65);
  const edgeAnchorY = isWideHero
    ? Math.min(1080, (mainPhoto?.y || 365) + (mainPhoto?.h || 780) - 95)
    : (mainPhoto?.y || 380) + 60;

  const slotAnchors = [
    // 0: Upper-right open margin
    { x: 1165, y: 115, w: 260, h: 205, zIndex: 7 },
    // 1: Tucked behind photo edge (zIndex 3)
    { x: edgeAnchorX, y: edgeAnchorY, w: 230, h: 250, zIndex: 3 },
    // 2: Right-hand sidebar top slot (clears storyNote x<=985 cleanly!)
    { x: 1035, y: 1245, w: 390, h: 195, zIndex: 6 },
    // 3: Right-hand sidebar middle slot
    { x: 1045, y: 1475, w: 390, h: 195, zIndex: 7 },
    // 4: Right-hand sidebar bottom slot
    { x: 1055, y: 1700, w: 375, h: 185, zIndex: 7 },
    // 5: Mid-right space beside narrow 1-photo hero, or clean lower-center margin for wide hero
    isWideHero
      ? { x: 520, y: 1795, w: 320, h: 125, zIndex: 7 }
      : { x: 1060, y: 745, w: 350, h: 210, zIndex: 5 },
    // 6: Upper-mid breathing pocket
    { x: 930, y: 145, w: 200, h: 165, zIndex: 6 },
    // 7: Lower-left margin
    { x: 120, y: 1805, w: 290, h: 120, zIndex: 7 },
  ];

  // Filter out pure photo/scrap helpers already represented natively so details list shows visible artifacts
  let slotCursor = 0;
  for (const kind of details) {
    if (
      kind === 'torn-colored-paper' ||
      kind === 'folded-note' ||
      kind === 'translucent-vellum' ||
      kind === 'fabric-swatch' ||
      kind === 'washi-tape' ||
      kind === 'photo-corners' ||
      kind === 'paper-clip' ||
      kind === 'stitched-thread'
    ) {
      if (kind === 'translucent-vellum' && scraps.every((s) => s.kind !== 'vellum')) {
        scraps.push({
          id: 'extra-vellum',
          x: 920,
          y: 1320,
          w: 480,
          h: 320,
          rotation: -2.1,
          color: surfaceHex,
          opacity: 0.42,
          zIndex: 3,
          kind: 'vellum',
          polygonNorm: generateTornPolygonNorm(seed + 83, 0.008),
        });
      }
      if (kind === 'stitched-thread' && stitchedThreads.length === 0) {
        stitchedThreads.push({
          x1: 860,
          y1: 1210,
          cx: 950,
          cy: 1310,
          x2: 910,
          y2: 1420,
          color: accentHex,
          zIndex: 7,
        });
      }
      continue;
    }

    if (kind === 'handwritten-edge-word') {
      const mp = photoSlots[0];
      const bezelOffset =
        mp?.cutoutShape === 'polaroid' ? 104 : mp?.cutoutShape === 'film-frame' ? 76 : 52;
      handwrittenMargins.push({
        text: edgeWord,
        x: mp ? Math.max(120, mp.x + 28) : 155,
        y: mp ? mp.y + mp.h + bezelOffset : 1220,
        rotation: -2.1 + (rng() - 0.5) * 1.2,
        fontSize: 40,
        maxW: 520,
        color: accentHex,
        zIndex: 9,
      });
      continue;
    }

    const isBotanicalTucked =
      kind === 'pressed-flower' ||
      kind === 'pressed-leaf' ||
      kind === 'tiny-branch' ||
      kind === 'envelope-scrap';

    // Never place tickets/maps behind left-edge handwritten margin text; use slot 1 only for botanicals/envelopes
    if (!isBotanicalTucked && slotCursor % slotAnchors.length === 1) {
      slotCursor++;
    }
    const anchor = slotAnchors[slotCursor % slotAnchors.length];
    slotCursor++;

    const clampedX = Math.max(76, Math.min(COLLAGE_W - anchor.w - 76, anchor.x));
    const clampedY = Math.max(76, Math.min(COLLAGE_H - anchor.h - 76, anchor.y));

    detailItems.push({
      id: `detail-${kind}-${slotCursor}`,
      kind,
      x: clampedX,
      y: clampedY,
      w: anchor.w,
      h: anchor.h,
      rotation: (rng() - 0.5) * 10,
      zIndex: isBotanicalTucked ? 3 : anchor.zIndex,
      primaryColor: accentHex,
      secondaryColor: secondaryHex,
      labelText:
        kind === 'ticket-stub' || kind === 'receipt-fragment'
          ? ticketLabel
          : kind === 'date-stamp' || kind === 'postmark-seal'
          ? memoryDate.slice(0, 10)
          : edgeWord,
    });
  }

  // Always add an upper-right context keepsake if slotCursor === 0
  if (detailItems.length === 0) {
    detailItems.push({
      id: 'detail-fallback-stamp',
      kind: 'postmark-seal',
      x: 1210,
      y: 130,
      w: 220,
      h: 220,
      rotation: 6,
      zIndex: 7,
      primaryColor: accentHex,
      secondaryColor: secondaryHex,
      labelText: memoryDate.slice(0, 10),
    });
  }

  if (handwrittenMargins.length === 0 && sensoryNotes[0]) {
    const mp = photoSlots[0];
    const bezelOffset =
      mp?.cutoutShape === 'polaroid' ? 104 : mp?.cutoutShape === 'film-frame' ? 76 : 52;
    handwrittenMargins.push({
      text: sensoryNotes[0].split(',')[0].trim(),
      x: mp ? Math.max(120, mp.x + 24) : 155,
      y: mp ? mp.y + mp.h + bezelOffset : 1220,
      rotation: -1.8,
      fontSize: 38,
      maxW: 520,
      color: accentHex,
      zIndex: 9,
    });
  }

  const resolvedStory = (storyText || '').trim() || designSpec.moodSummary || '';
  const aiCaptionLabel =
    !storyText.trim() || input.isAiOnlyText
      ? lang === 'ru'
        ? 'Атмосферная заметка AI'
        : 'AI atmosphere note'
      : null;

  return {
    width: COLLAGE_W,
    height: COLLAGE_H,
    collageStyle,
    seed,
    titleBlock,
    paperScraps: scraps,
    photoSlots,
    details: detailItems,
    storyNote,
    handwrittenMargins,
    filmstripSlot,
    stitchedThreads,
    aiCaptionLabel,
    storyText: resolvedStory,
    sensoryNotes,
    formattedDate,
    locationOrWho,
    musicLabel: input.musicLabel,
  };
}
