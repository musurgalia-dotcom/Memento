import { GoogleGenAI, Type } from '@google/genai';
import sharp from 'sharp';
import type {
  AnimationStyleId,
  ArtisticTechniqueId,
  CalendarMoodCategory,
  CollageStyleId,
  DecorativeMotifId,
  DesignSpecification,
  FilmEffectId,
  FrameStyleId,
  ImageVisualAnalysis,
  LayoutId,
  PaperTextureId,
  ScrapbookPlan,
  SmallDetailId,
  TypographyPairId,
  TypographyPlacementId,
} from '../src/lib/artLibrary.ts';
import type { AppLanguage } from '../src/lib/types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [180, 160, 140];
  return [
    parseInt(clean.slice(0, 2), 16) || 180,
    parseInt(clean.slice(2, 4), 16) || 160,
    parseInt(clean.slice(4, 6), 16) || 140,
  ];
}

function mixHex(hexA: string, hexB: string, weightB: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return rgbToHex(r1 * (1 - w) + r2 * w, g1 * (1 - w) + g2 * w, b1 * (1 - w) + b2 * w);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Dangling trailing function words that indicate a truncated title in EN or RU
const DANGLING_WORDS = new Set([
  'the',
  'a',
  'an',
  'in',
  'on',
  'at',
  'of',
  'with',
  'to',
  'for',
  'and',
  'or',
  'by',
  'from',
  'into',
  'near',
  'under',
  'over',
  'as',
  'в',
  'во',
  'на',
  'у',
  'и',
  'с',
  'со',
  'по',
  'из',
  'к',
  'ко',
  'о',
  'об',
  'от',
  'под',
  'над',
  'без',
  'для',
  'при',
  'через',
  'про',
  'за',
]);

export function ensureCompletePhrase(raw: string | undefined | null, language: AppLanguage): string {
  const fallback = language === 'ru' ? 'Сохранённое мгновение' : 'Preserved Moment';
  if (!raw) return fallback;
  let cleaned = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["'«»„“”]+|["'«»„“”]+$/g, '')
    .replace(/[.…,;:\-—]+$/, '')
    .trim();

  if (!cleaned) return fallback;

  // If longer than 56 chars, split cleanly at natural clause boundary rather than chopping mid-phrase
  if (cleaned.length > 56) {
    const clauses = cleaned.split(/[.;!?—]+/).map((c) => c.trim()).filter(Boolean);
    if (clauses[0] && clauses[0].length <= 60 && clauses[0].length >= 6) {
      cleaned = clauses[0];
    } else {
      const commaParts = cleaned.split(',').map((c) => c.trim()).filter(Boolean);
      if (commaParts[0] && commaParts[0].length <= 60 && commaParts[0].length >= 6) {
        cleaned = commaParts[0];
      } else {
        // Trim cleanly back to whole words without dangling prepositions
        const words = cleaned.split(/\s+/);
        let acc = '';
        for (const w of words) {
          const next = acc ? `${acc} ${w}` : w;
          if (next.length > 56) break;
          acc = next;
        }
        cleaned = acc || words.slice(0, 5).join(' ');
      }
    }
  }

  // Never leave a dangling article/preposition at the end (e.g. "The chill in the")
  const tokens = cleaned.split(/\s+/);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1].toLowerCase().replace(/[^a-zа-яё0-9-]/gi, '');
    if (DANGLING_WORDS.has(last)) {
      tokens.pop();
    } else {
      break;
    }
  }
  const result = tokens.join(' ').trim();
  if (!result || result.length < 2) return fallback;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export async function extractImagePixelStats(buffer: Buffer): Promise<{
  dominantColors: string[];
  secondaryColors: string[];
  brightnessScore: number;
  saturationScore: number;
  normalizedJpegBase64: string;
}> {
  const resized = await sharp(buffer)
    .rotate()
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const { data } = await sharp(resized)
    .resize(48, 48, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<string, { rSum: number; gSum: number; bSum: number; count: number }>();
  let totalLum = 0;
  let totalSat = 0;
  const pixelCount = Math.max(1, data.length / 3);

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    totalLum += (max + min) / 2;
    totalSat += max === 0 ? 0 : (max - min) / max;

    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const existing = buckets.get(key) || { rSum: 0, gSum: 0, bSum: 0, count: 0 };
    existing.rSum += r;
    existing.gSum += g;
    existing.bSum += b;
    existing.count += 1;
    buckets.set(key, existing);
  }

  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .map((b) => rgbToHex(b.rSum / b.count, b.gSum / b.count, b.bSum / b.count));

  const unique: string[] = [];
  for (const hex of sorted) {
    const [r1, g1, b1] = hexToRgb(hex);
    const tooClose = unique.some((u) => {
      const [r2, g2, b2] = hexToRgb(u);
      return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 42;
    });
    if (!tooClose) unique.push(hex);
    if (unique.length >= 6) break;
  }

  return {
    dominantColors: unique.slice(0, 3).length ? unique.slice(0, 3) : ['#C2B29F', '#7A6F64'],
    secondaryColors: unique.slice(3, 6),
    brightnessScore: Number((totalLum / pixelCount).toFixed(2)),
    saturationScore: Number((totalSat / pixelCount).toFixed(2)),
    normalizedJpegBase64: resized.toString('base64'),
  };
}

export async function analyzePhotograph(
  buffer: Buffer,
  language: AppLanguage = 'en'
): Promise<ImageVisualAnalysis> {
  const pixelStats = await extractImagePixelStats(buffer);
  const ai = getGeminiClient();

  if (ai) {
    try {
      const langNote =
        language === 'ru'
          ? 'Write descriptive strings (lighting, composition, visibleObjects, scenery, visualTextures, photographicCharacteristics, activity) in Russian. Keep sceneCategory and timeOfDay as concise keywords.'
          : 'Write descriptive strings in English.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: pixelStats.normalizedJpegBase64,
              },
            },
            {
              text:
                'Analyze this photograph strictly for objective visual information. ' +
                'Do NOT guess personal emotions—meaning comes separately from the user. ' +
                'Identify lighting, composition, visibleObjects, scenery, visualTextures, photographicCharacteristics, ' +
                'sceneCategory (one of: coast, city, nature, cafe-dining, home-interior, travel-transit, celebration, winter, night-street, portrait), ' +
                'activity (e.g. walking, coffee with friends, sunset watching, museum visit), ' +
                'timeOfDay (morning | afternoon | golden-hour | dusk | night | indoor), and peopleCount (number). ' +
                langNote,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lighting: { type: Type.STRING },
              composition: { type: Type.STRING },
              visibleObjects: { type: Type.ARRAY, items: { type: Type.STRING } },
              scenery: { type: Type.STRING },
              visualTextures: { type: Type.ARRAY, items: { type: Type.STRING } },
              photographicCharacteristics: { type: Type.STRING },
              sceneCategory: { type: Type.STRING },
              activity: { type: Type.STRING },
              timeOfDay: { type: Type.STRING },
              peopleCount: { type: Type.NUMBER },
            },
            required: [
              'lighting',
              'composition',
              'visibleObjects',
              'scenery',
              'visualTextures',
              'photographicCharacteristics',
              'sceneCategory',
              'activity',
              'timeOfDay',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return {
        dominantColors: pixelStats.dominantColors,
        secondaryColors: pixelStats.secondaryColors,
        brightnessScore: pixelStats.brightnessScore,
        saturationScore: pixelStats.saturationScore,
        lighting: parsed.lighting || (language === 'ru' ? 'Естественное освещение' : 'Natural ambient lighting'),
        composition: parsed.composition || (language === 'ru' ? 'Сбалансированный кадр' : 'Balanced framing'),
        visibleObjects: Array.isArray(parsed.visibleObjects) ? parsed.visibleObjects.slice(0, 6) : [],
        scenery: parsed.scenery || (language === 'ru' ? 'Запечатлённое окружение' : 'Photographed setting'),
        visualTextures: Array.isArray(parsed.visualTextures) ? parsed.visualTextures.slice(0, 4) : [],
        photographicCharacteristics: parsed.photographicCharacteristics || 'Digital photograph',
        sceneCategory: parsed.sceneCategory || 'moment',
        activity: parsed.activity || '',
        timeOfDay: parsed.timeOfDay || 'afternoon',
        peopleCount: typeof parsed.peopleCount === 'number' ? parsed.peopleCount : 0,
        provider: 'gemini-4-hydrogen',
      };
    } catch {
      return buildLocalVisualFallback(
        pixelStats,
        language === 'ru'
          ? 'Локально определены цветовая палитра, яркость и свет кадра.'
          : 'Analyzed photograph light, color palette, and exposure locally.',
        language
      );
    }
  }

  return buildLocalVisualFallback(
    pixelStats,
    language === 'ru'
      ? 'GEMINI_API_KEY не настроен; реальная палитра и свет определены локально.'
      : 'GEMINI_API_KEY is not configured; extracted real pixel palette & exposure statistics locally.',
    language
  );
}

function buildLocalVisualFallback(
  pixelStats: Awaited<ReturnType<typeof extractImagePixelStats>>,
  notice: string,
  language: AppLanguage = 'en'
): ImageVisualAnalysis {
  const [r, g, b] = hexToRgb(pixelStats.dominantColors[0] || '#999999');
  const isWarmHue = r > b + 22;
  const isCoolBlue = b > r + 18;
  const isGreenish = g > r + 10 && g > b + 6;

  let sceneCategory = 'moment';
  if (pixelStats.brightnessScore < 0.3) sceneCategory = 'night-street';
  else if (isCoolBlue && pixelStats.brightnessScore > 0.55) sceneCategory = 'coast';
  else if (isGreenish) sceneCategory = 'nature';
  else if (isWarmHue) sceneCategory = 'cafe-dining';

  const timeOfDay =
    pixelStats.brightnessScore < 0.28
      ? 'night'
      : pixelStats.brightnessScore > 0.68
      ? 'afternoon'
      : isWarmHue
      ? 'golden-hour'
      : 'dusk';

  const lighting =
    language === 'ru'
      ? pixelStats.brightnessScore > 0.65
        ? 'Яркий дневной или солнечный свет'
        : pixelStats.brightnessScore < 0.35
        ? 'Вечернее или ночное приглушённое освещение'
        : 'Мягкий рассеянный свет полутонов'
      : pixelStats.brightnessScore > 0.65
      ? 'Bright daylight / high-key exposure'
      : pixelStats.brightnessScore < 0.35
      ? 'Low-light / shadowed evening exposure'
      : 'Balanced mid-tone ambient light';

  const saturationNote =
    language === 'ru'
      ? pixelStats.saturationScore > 0.45
        ? 'Насыщенные живые оттенки'
        : 'Сдержанная мягкая тональность'
      : pixelStats.saturationScore > 0.45
      ? 'Rich chromatic saturation'
      : 'Restrained, muted tonal range';

  return {
    dominantColors: pixelStats.dominantColors,
    secondaryColors: pixelStats.secondaryColors,
    brightnessScore: pixelStats.brightnessScore,
    saturationScore: pixelStats.saturationScore,
    lighting,
    composition: language === 'ru' ? 'Оригинальное кадрирование сохранено' : 'Original photographic framing preserved',
    visibleObjects: [
      language === 'ru' ? 'Снимок проанализирован по пикселям' : 'Visual subject analyzed via pixel sampling',
    ],
    scenery:
      language === 'ru'
        ? `Локальный анализ света (${timeOfDay})`
        : `Analyzed locally via sharp pixel quantization (${timeOfDay})`,
    visualTextures: [saturationNote],
    photographicCharacteristics: `${lighting}; ${saturationNote}`,
    sceneCategory,
    timeOfDay,
    provider: 'local-pixel-quantizer',
    notice,
  };
}

export interface QuestionnairePayload {
  memoryDate: string;
  storyText: string;
  memoryLanguage?: AppLanguage;
  answers: Array<{ questionId: string; question: string; answer: string; tags?: string[] }>;
  music?: {
    mode: string;
    queryOrMood?: string | null;
    trackTitle?: string | null;
    artist?: string | null;
    musicProfile?: { tempoFeel?: string; energy?: number; mood?: string } | null;
  } | null;
  userPreferences?: {
    favoriteColors?: string[];
    preferredTextures?: string[];
    preferredLayouts?: string[];
    preferredTypography?: string;
    preferredFilmEffect?: string;
    preferredAnimation?: string;
    allowAdaptiveLearning?: boolean;
  } | null;
}

const COLOR_NAME_MAP: Record<string, string> = {
  amber: '#D4944A',
  янтар: '#D4944A',
  gold: '#D9A84E',
  золот: '#D9A84E',
  honey: '#D8A24A',
  медов: '#D8A24A',
  sun: '#E2B45A',
  солн: '#E2B45A',
  sand: '#D9C7AD',
  песок: '#D9C7AD',
  песч: '#D9C7AD',
  cream: '#EFE7DA',
  крем: '#EFE7DA',
  beige: '#D9CCB9',
  беж: '#D9CCB9',
  terracotta: '#B96B4B',
  терракот: '#B96B4B',
  coral: '#D97B66',
  корал: '#D97B66',
  rose: '#C97B84',
  роз: '#C97B84',
  pink: '#D9929E',
  crimson: '#9E3E47',
  rust: '#A44D36',
  autumn: '#B86239',
  осен: '#B86239',
  orange: '#C96D3B',
  оранж: '#C96D3B',
  emerald: '#3D7A60',
  изумруд: '#3D7A60',
  sage: '#5C7361',
  шалфей: '#5C7361',
  olive: '#767D56',
  оливк: '#767D56',
  forest: '#3A5844',
  лес: '#3A5844',
  зел: '#4C7258',
  sea: '#5D8AA8',
  мор: '#5D8AA8',
  ocean: '#457696',
  океан: '#457696',
  blue: '#4F779B',
  син: '#4F779B',
  голуб: '#7DA4C0',
  frost: '#93B2C8',
  мороз: '#93B2C8',
  ice: '#A9C4D6',
  лёд: '#A9C4D6',
  лед: '#A9C4D6',
  indigo: '#3A4B73',
  индиго: '#3A4B73',
  navy: '#2B3A55',
  slate: '#687684',
  сланец: '#687684',
  lavender: '#8F84A8',
  лаванд: '#8F84A8',
  violet: '#705D8E',
  фиолет: '#705D8E',
  charcoal: '#33363B',
  графит: '#33363B',
  угол: '#282B30',
  silver: '#A7B0B8',
  серебр: '#A7B0B8',
};

function resolveUserColorHex(colorAnswer: string, fallbackHex: string): string {
  const hexMatch = colorAnswer.match(/#[0-9a-fA-F]{6}/);
  if (hexMatch) return hexMatch[0].toUpperCase();
  const lower = colorAnswer.toLowerCase();
  for (const [name, hex] of Object.entries(COLOR_NAME_MAP)) {
    if (lower.includes(name)) return hex;
  }
  return fallbackHex;
}

const VALID_LAYOUTS = new Set<LayoutId>([
  'editorial-spread',
  'polaroid-cluster',
  'filmstrip-diary',
  'minimal-gallery',
  'scrapbook-layers',
  'botanical-folio',
  'night-cinematic-zine',
  'watercolor-journal',
]);
const VALID_TEXTURES = new Set<PaperTextureId>([
  'warm-cotton',
  'linen-archival',
  'rain-washed',
  'aged-vellum',
  'charcoal-matte',
  'sand-textured',
  'frost-paper',
]);
const VALID_FILMS = new Set<FilmEffectId>([
  'warm-kodak',
  'faded-polaroid',
  'cool-cinestill',
  'soft-matte',
  'clean-archival',
]);
const VALID_FRAMES = new Set<FrameStyleId>([
  'classic-polaroid',
  'deckled-paper',
  'torn-paper',
  'thin-gallery-rule',
  'contact-sheet',
  'taped-snapshot',
  'arch-cutout',
  'oval-cutout',
]);
const VALID_TYPO = new Set<TypographyPairId>([
  'editorial-serif',
  'poetic-italic',
  'modern-archival',
  'intimate-journal',
]);
const VALID_TYPO_PLACEMENT = new Set<TypographyPlacementId>([
  'top-editorial',
  'vertical-spine',
  'split-column',
  'floating-card',
  'bottom-atelier',
]);
const VALID_TECHNIQUES = new Set<ArtisticTechniqueId>([
  'watercolor-wash',
  'torn-collage',
  'halftone-newsprint',
  'linen-fibers',
  'ink-sketches',
  'stamped-postmark',
  'film-sprockets',
  'light-leak',
]);
const VALID_ANIM = new Set<AnimationStyleId>([
  'gentle-drift',
  'sunlit-breeze',
  'rainy-stillness',
  'kinetic-pulse',
  'nostalgic-reel',
]);
const VALID_MOTIFS = new Set<DecorativeMotifId>([
  'autumn-leaves',
  'pressed-botanical',
  'seashells',
  'wave-contour',
  'snowflakes',
  'raindrop-streaks',
  'vintage-ticket',
  'clouds',
  'star-constellation',
  'sunburst-stamp',
  'sunlight-wash',
  'postmark-seal',
  'masking-tape',
  'film-strip',
  'minimal-hairline',
]);
const VALID_COLLAGE_STYLES = new Set<CollageStyleId>([
  'handmade-scrapbook',
  'mixed-media-journal',
  'editorial-art',
  'vintage-archive',
  'dreamy-collage',
  'playful-cutout',
  'cinematic-journal',
  'nature-herbarium',
  'contemporary-art',
]);
const VALID_SMALL_DETAILS = new Set<SmallDetailId>([
  'torn-colored-paper',
  'washi-tape',
  'paper-clip',
  'photo-corners',
  'folded-note',
  'envelope-scrap',
  'stitched-thread',
  'translucent-vellum',
  'fabric-swatch',
  'ticket-stub',
  'receipt-fragment',
  'date-stamp',
  'postmark-seal',
  'film-strip-mini',
  'city-map-fragment',
  'handwritten-edge-word',
  'pressed-flower',
  'pressed-leaf',
  'tiny-branch',
  'seashell-sketch',
  'wave-ripples',
  'sun-doodle',
  'rain-streaks',
  'umbrella-doodle',
  'camera-doodle',
  'candle-doodle',
  'confetti-scraps',
  'tiny-stars',
  'coffee-ring-mark',
  'pencil-marks',
  'ink-sketch-object',
]);

export async function generateMemoryDesignSpec(params: {
  imageAnalyses: ImageVisualAnalysis[];
  questionnaire: QuestionnairePayload;
  variationSeed?: number;
}): Promise<{ designSpec: DesignSpecification; aiProviderUsed: string; notice?: string }> {
  const { imageAnalyses, questionnaire, variationSeed = 0 } = params;
  const primaryImage = imageAnalyses[0];
  const lang: AppLanguage = questionnaire.memoryLanguage === 'ru' ? 'ru' : 'en';
  const ai = getGeminiClient();

  if (ai) {
    try {
      const languageDirective =
        lang === 'ru'
          ? 'CRITICAL OUTPUT LANGUAGE: Write ALL natural-language text fields (generatedTitle, moodSummary, atmosphereKeywords, musicInfluenceNote, scrapbookPlan.backgroundMaterial/focalStrategy/layeringStrategy/lightingMood/visualBalanceNote/negativeSpaceNote/ticketStubText/handwrittenEdgeWord/sketchSubject/locationOrLabelText, and ALL explainability fields) strictly in natural, literary RUSSIAN (Русский язык). Keep only strict enum identifiers (collageStyle, layoutId, paperTexture, filmEffect, frameStyle, typography, decorativeMotifs, selectedDetails, animationStyle, mainPhotoPlacement, secondaryPhotoArrangement, typographyPlacement, artisticTechniques, decorationDensity, calendarMoodCategory) in English schema format. Never mix English words into Russian captions or cut phrases off mid-word.'
          : 'CRITICAL OUTPUT LANGUAGE: Write ALL natural-language text fields strictly in natural, literary English. Never cut phrases off mid-word or leave dangling articles/prepositions.';

      const promptText = `You are MEMENTO's Avant-Garde Collage Artist, Mixed-Media Art Journal Designer & Editorial Art Director.
${languageDirective}

CRITICAL ARTISTIC PHILOSOPHY:
Every memory composition must feel like an authentic, bespoke, handmade art journal page or mixed-media editorial spread — NEVER a generic card with rectangles + 5 color circles + a centered bottom quote!
1. Two people uploading the SAME photo receive genuinely DIFFERENT compositions because their colors, smells, sounds, people, and music shape a different visual world.
2. FIRST create an explicit Creative Design Plan in scrapbookPlan BEFORE choosing details:
   - collageStyle: pick one of the 9 genuinely distinct styles (handmade-scrapbook, mixed-media-journal, editorial-art, vintage-archive, dreamy-collage, playful-cutout, cinematic-journal, nature-herbarium, contemporary-art).
   - focalStrategy: explain which photo dominates, how overlapping/tucking works, and how contrasting cutouts & angles create depth.
   - layeringStrategy: describe how torn colored paper scraps, translucent vellum, folded notes, and photos stack across foreground/midground/background planes (note: your chosen colors are woven into real paper scraps & washes, NEVER into color swatch circles!).
   - negativeSpaceNote: specify which margin stays airy so the composition breathes.
   - selectedDetails: select 5 to 8 context-authentic tactile details STRICTLY matching the actual photo & answers (e.g., beach -> seashell-sketch, wave-ripples, sun-doodle; birthday/friends -> candle-doodle, confetti-scraps, camera-doodle; cafe/autumn -> coffee-ring-mark, pressed-leaf, receipt-fragment, stitched-thread; rainy street -> rain-streaks, umbrella-doodle, ticket-stub, city-map-fragment, film-strip-mini). NEVER invent unrelated clichés!
   - handwrittenEdgeWord: a short 1-3 word handwritten margin annotation in ${lang === 'ru' ? 'Russian' : 'English'} (NOT a cliché quote or fake user conversation).
3. NEVER invent fake diary quotes or imaginary dialogue. Keep generatedTitle as a complete poetic 2–6 word phrase (never ending on a dangling article or preposition).
4. Variation seed is ${variationSeed}: if > 0, pick a fresh alternative collageStyle, layoutId, frameStyle, and selectedDetails combination.

Data:
- Objective Photo Analysis: ${JSON.stringify(imageAnalyses)}
- Memory Date: ${questionnaire.memoryDate}
- Questionnaire Answers: ${JSON.stringify(questionnaire.answers)}
- Personal Narrative: ${questionnaire.storyText}
- Music Selection & Profile: ${JSON.stringify(questionnaire.music || null)}
- Long-Term Aesthetic Preferences: ${JSON.stringify(questionnaire.userPreferences || null)}

Valid enum values:
- calendarMoodCategory: calm | happy | nostalgic | night | neutral
- scrapbookPlan.collageStyle: handmade-scrapbook | mixed-media-journal | editorial-art | vintage-archive | dreamy-collage | playful-cutout | cinematic-journal | nature-herbarium | contemporary-art
- layoutId: editorial-spread | polaroid-cluster | filmstrip-diary | minimal-gallery | scrapbook-layers | botanical-folio | night-cinematic-zine | watercolor-journal
- paperTexture: warm-cotton | linen-archival | rain-washed | aged-vellum | charcoal-matte | sand-textured | frost-paper
- filmEffect: warm-kodak | faded-polaroid | cool-cinestill | soft-matte | clean-archival
- frameStyle: classic-polaroid | deckled-paper | torn-paper | thin-gallery-rule | contact-sheet | taped-snapshot | arch-cutout | oval-cutout
- typography: editorial-serif | poetic-italic | modern-archival | intimate-journal
- decorativeMotifs (2-3 items): autumn-leaves | pressed-botanical | seashells | wave-contour | snowflakes | raindrop-streaks | vintage-ticket | clouds | star-constellation | sunburst-stamp | sunlight-wash | postmark-seal | masking-tape | film-strip | minimal-hairline
- scrapbookPlan.selectedDetails (5-8 items from): torn-colored-paper | washi-tape | paper-clip | photo-corners | folded-note | envelope-scrap | stitched-thread | translucent-vellum | fabric-swatch | ticket-stub | receipt-fragment | date-stamp | postmark-seal | film-strip-mini | city-map-fragment | handwritten-edge-word | pressed-flower | pressed-leaf | tiny-branch | seashell-sketch | wave-ripples | sun-doodle | rain-streaks | umbrella-doodle | camera-doodle | candle-doodle | confetti-scraps | tiny-stars | coffee-ring-mark | pencil-marks | ink-sketch-object
- animationStyle: gentle-drift | sunlit-breeze | rainy-stillness | kinetic-pulse | nostalgic-reel
- scrapbookPlan.mainPhotoPlacement: left-anchor | center-folio | upper-editorial | offset-right
- scrapbookPlan.secondaryPhotoArrangement: overlapping-cluster | tucked-corners | filmstrip-rail | minimal-stack
- scrapbookPlan.typographyPlacement: top-editorial | vertical-spine | split-column | floating-card | bottom-atelier
- scrapbookPlan.artisticTechniques: watercolor-wash | torn-collage | halftone-newsprint | linen-fibers | ink-sketches | stamped-postmark | film-sprockets | light-leak
- scrapbookPlan.decorationDensity: minimal | balanced | layered`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              generatedTitle: { type: Type.STRING },
              moodSummary: { type: Type.STRING },
              atmosphereKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              calendarMoodCategory: { type: Type.STRING },
              palette: {
                type: Type.OBJECT,
                properties: {
                  background: { type: Type.STRING },
                  surface: { type: Type.STRING },
                  primaryAccent: { type: Type.STRING },
                  secondaryAccent: { type: Type.STRING },
                  ink: { type: Type.STRING },
                  mutedInk: { type: Type.STRING },
                  extractedFromPhoto: { type: Type.ARRAY, items: { type: Type.STRING } },
                  chosenByUser: { type: Type.STRING },
                },
                required: [
                  'background',
                  'surface',
                  'primaryAccent',
                  'secondaryAccent',
                  'ink',
                  'mutedInk',
                  'extractedFromPhoto',
                  'chosenByUser',
                ],
              },
              layoutId: { type: Type.STRING },
              paperTexture: { type: Type.STRING },
              filmEffect: { type: Type.STRING },
              frameStyle: { type: Type.STRING },
              typography: { type: Type.STRING },
              decorativeMotifs: { type: Type.ARRAY, items: { type: Type.STRING } },
              animationStyle: { type: Type.STRING },
              animationSpeedMultiplier: { type: Type.NUMBER },
              musicInfluenceNote: { type: Type.STRING },
              scrapbookPlan: {
                type: Type.OBJECT,
                properties: {
                  collageStyle: { type: Type.STRING },
                  focalStrategy: { type: Type.STRING },
                  layeringStrategy: { type: Type.STRING },
                  backgroundMaterial: { type: Type.STRING },
                  mainPhotoPlacement: { type: Type.STRING },
                  secondaryPhotoArrangement: { type: Type.STRING },
                  lightingMood: { type: Type.STRING },
                  decorationDensity: { type: Type.STRING },
                  visualBalanceNote: { type: Type.STRING },
                  negativeSpaceNote: { type: Type.STRING },
                  ticketStubText: { type: Type.STRING },
                  typographyPlacement: { type: Type.STRING },
                  artisticTechniques: { type: Type.ARRAY, items: { type: Type.STRING } },
                  decorativeAccentLine: { type: Type.STRING },
                  selectedDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
                  handwrittenEdgeWord: { type: Type.STRING },
                  sketchSubject: { type: Type.STRING },
                  locationOrLabelText: { type: Type.STRING },
                },
                required: [
                  'collageStyle',
                  'focalStrategy',
                  'layeringStrategy',
                  'backgroundMaterial',
                  'mainPhotoPlacement',
                  'secondaryPhotoArrangement',
                  'lightingMood',
                  'decorationDensity',
                  'visualBalanceNote',
                  'negativeSpaceNote',
                  'typographyPlacement',
                  'artisticTechniques',
                  'selectedDetails',
                  'handwrittenEdgeWord',
                ],
              },
              explainability: {
                type: Type.OBJECT,
                properties: {
                  paletteReason: { type: Type.STRING },
                  layoutReason: { type: Type.STRING },
                  textureAndFilmReason: { type: Type.STRING },
                  typographyAndMotifReason: { type: Type.STRING },
                  animationReason: { type: Type.STRING },
                  profileBalanceNote: { type: Type.STRING },
                },
                required: [
                  'paletteReason',
                  'layoutReason',
                  'textureAndFilmReason',
                  'typographyAndMotifReason',
                  'animationReason',
                  'profileBalanceNote',
                ],
              },
            },
            required: [
              'generatedTitle',
              'moodSummary',
              'atmosphereKeywords',
              'calendarMoodCategory',
              'palette',
              'layoutId',
              'paperTexture',
              'filmEffect',
              'frameStyle',
              'typography',
              'decorativeMotifs',
              'animationStyle',
              'animationSpeedMultiplier',
              'musicInfluenceNote',
              'scrapbookPlan',
              'explainability',
            ],
          },
        },
      });

      const raw = JSON.parse((response.text ?? '{}').trim()) as DesignSpecification;
      const sanitized = sanitizeDesignSpec(
        raw,
        primaryImage?.dominantColors || ['#C2B29F', '#6B7785'],
        lang
      );
      return { designSpec: sanitized, aiProviderUsed: 'gemini-4-hydrogen' };
    } catch {
      return {
        ...buildHeuristicDesignSpec(params),
        notice:
          lang === 'ru'
            ? 'Создано локальным арт-движком на основе реальной палитры кадра и ваших личных ответов.'
            : 'Generated locally from real photographic pixel colors and your personal questionnaire answers.',
      };
    }
  }

  return {
    ...buildHeuristicDesignSpec(params),
    notice:
      lang === 'ru'
        ? 'Создано локальным арт-движком на основе реальной палитры кадра и ваших личных ответов.'
        : 'Generated locally from real photographic pixel colors and your personal questionnaire answers.',
  };
}

export function sanitizeDesignSpec(
  spec: DesignSpecification,
  fallbackExtracted: string[],
  language: AppLanguage = 'en'
): DesignSpecification {
  const safeHex = (v: unknown, fb: string) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : fb;

  const background = safeHex(spec.palette?.background, '#F6F2EA');
  const isDarkBg = relativeLuminance(background) < 0.35;

  const validCalCats = new Set<CalendarMoodCategory>(['calm', 'happy', 'nostalgic', 'night', 'neutral']);
  const calCat = validCalCats.has(spec.calendarMoodCategory as CalendarMoodCategory)
    ? (spec.calendarMoodCategory as CalendarMoodCategory)
    : isDarkBg
    ? 'night'
    : 'nostalgic';

  const validMainPlacement = new Set<ScrapbookPlan['mainPhotoPlacement']>([
    'left-anchor',
    'center-folio',
    'upper-editorial',
    'offset-right',
  ]);
  const validSecArr = new Set<ScrapbookPlan['secondaryPhotoArrangement']>([
    'overlapping-cluster',
    'tucked-corners',
    'filmstrip-rail',
    'minimal-stack',
  ]);
  const validDensity = new Set<ScrapbookPlan['decorationDensity']>(['minimal', 'balanced', 'layered']);

  const safeTechniques = Array.isArray(spec.scrapbookPlan?.artisticTechniques)
    ? spec.scrapbookPlan!.artisticTechniques.filter((t): t is ArtisticTechniqueId => VALID_TECHNIQUES.has(t)).slice(0, 4)
    : ['watercolor-wash', 'torn-collage'] as ArtisticTechniqueId[];

  const safeTypoPlacement = VALID_TYPO_PLACEMENT.has(
    spec.scrapbookPlan?.typographyPlacement as TypographyPlacementId
  )
    ? (spec.scrapbookPlan!.typographyPlacement as TypographyPlacementId)
    : 'top-editorial';

  return {
    generatedTitle: ensureCompletePhrase(spec.generatedTitle, language),
    moodSummary:
      spec.moodSummary ||
      (language === 'ru'
        ? 'Композиция собрана вокруг ваших чувств и личных ассоциаций.'
        : 'Shaped by your personal reflections and sensory memories.'),
    atmosphereKeywords: Array.isArray(spec.atmosphereKeywords)
      ? spec.atmosphereKeywords.slice(0, 5)
      : [language === 'ru' ? 'личное' : 'personal'],
    calendarMoodCategory: calCat,
    palette: {
      background,
      surface: safeHex(spec.palette?.surface, isDarkBg ? '#232830' : '#FCF9F3'),
      primaryAccent: safeHex(spec.palette?.primaryAccent, fallbackExtracted[0] || '#5D8AA8'),
      secondaryAccent: safeHex(spec.palette?.secondaryAccent, fallbackExtracted[1] || '#B96B4B'),
      ink: safeHex(spec.palette?.ink, isDarkBg ? '#F3EFE8' : '#1E1B18'),
      mutedInk: safeHex(spec.palette?.mutedInk, isDarkBg ? '#AEB5C0' : '#645D53'),
      extractedFromPhoto:
        Array.isArray(spec.palette?.extractedFromPhoto) && spec.palette.extractedFromPhoto.length > 0
          ? spec.palette.extractedFromPhoto.slice(0, 3)
          : fallbackExtracted.slice(0, 3),
      chosenByUser: safeHex(spec.palette?.chosenByUser, spec.palette?.primaryAccent || '#5D8AA8'),
    },
    layoutId: VALID_LAYOUTS.has(spec.layoutId) ? spec.layoutId : 'scrapbook-layers',
    paperTexture: VALID_TEXTURES.has(spec.paperTexture) ? spec.paperTexture : 'warm-cotton',
    filmEffect: VALID_FILMS.has(spec.filmEffect) ? spec.filmEffect : 'warm-kodak',
    frameStyle: VALID_FRAMES.has(spec.frameStyle) ? spec.frameStyle : 'torn-paper',
    typography: VALID_TYPO.has(spec.typography) ? spec.typography : 'editorial-serif',
    decorativeMotifs: Array.isArray(spec.decorativeMotifs)
      ? spec.decorativeMotifs.filter((m): m is DecorativeMotifId => VALID_MOTIFS.has(m)).slice(0, 3)
      : ['minimal-hairline'],
    animationStyle: VALID_ANIM.has(spec.animationStyle) ? spec.animationStyle : 'gentle-drift',
    animationSpeedMultiplier:
      typeof spec.animationSpeedMultiplier === 'number'
        ? Math.max(0.65, Math.min(1.35, spec.animationSpeedMultiplier))
        : 1.0,
    musicInfluenceNote:
      spec.musicInfluenceNote ||
      (language === 'ru' ? 'Ритм созвучен настроению вашего дня.' : 'Paced naturally to your memory.'),
    scrapbookPlan: {
      collageStyle: VALID_COLLAGE_STYLES.has(spec.scrapbookPlan?.collageStyle as CollageStyleId)
        ? (spec.scrapbookPlan!.collageStyle as CollageStyleId)
        : undefined,
      focalStrategy: spec.scrapbookPlan?.focalStrategy,
      layeringStrategy: spec.scrapbookPlan?.layeringStrategy,
      backgroundMaterial:
        spec.scrapbookPlan?.backgroundMaterial ||
        (language === 'ru' ? 'Фактурная хлопковая бумага' : 'Archival textured cotton paper'),
      mainPhotoPlacement: validMainPlacement.has(spec.scrapbookPlan?.mainPhotoPlacement as ScrapbookPlan['mainPhotoPlacement'])
        ? spec.scrapbookPlan!.mainPhotoPlacement
        : 'left-anchor',
      secondaryPhotoArrangement: validSecArr.has(
        spec.scrapbookPlan?.secondaryPhotoArrangement as ScrapbookPlan['secondaryPhotoArrangement']
      )
        ? spec.scrapbookPlan!.secondaryPhotoArrangement
        : 'overlapping-cluster',
      lightingMood:
        spec.scrapbookPlan?.lightingMood ||
        (language === 'ru' ? 'Мягкий рассеянный свет' : 'Soft diffused daylight'),
      decorationDensity: validDensity.has(spec.scrapbookPlan?.decorationDensity as ScrapbookPlan['decorationDensity'])
        ? spec.scrapbookPlan!.decorationDensity
        : 'balanced',
      visualBalanceNote:
        spec.scrapbookPlan?.visualBalanceNote ||
        (language === 'ru'
          ? 'Основной снимок уравновешен рукописными заметками и воздухом полей.'
          : 'Hero focal frame balanced with tactile margin notes and breathing room.'),
      negativeSpaceNote: spec.scrapbookPlan?.negativeSpaceNote,
      ticketStubText: spec.scrapbookPlan?.ticketStubText,
      typographyPlacement: safeTypoPlacement,
      artisticTechniques: safeTechniques.length ? safeTechniques : ['watercolor-wash', 'torn-collage'],
      decorativeAccentLine: spec.scrapbookPlan?.decorativeAccentLine,
      selectedDetails: Array.isArray(spec.scrapbookPlan?.selectedDetails)
        ? spec.scrapbookPlan!.selectedDetails
            .filter((d): d is SmallDetailId => VALID_SMALL_DETAILS.has(d))
            .slice(0, 9)
        : undefined,
      handwrittenEdgeWord: spec.scrapbookPlan?.handwrittenEdgeWord,
      sketchSubject: spec.scrapbookPlan?.sketchSubject,
      locationOrLabelText: spec.scrapbookPlan?.locationOrLabelText,
    },
    explainability: {
      paletteReason:
        spec.explainability?.paletteReason ||
        (language === 'ru'
          ? 'Объединяет выбранный вами цвет с оттенками самого снимка.'
          : 'Blends your chosen color with extracted photograph tones.'),
      layoutReason:
        spec.explainability?.layoutReason ||
        (language === 'ru'
          ? 'Композиция подобрана под фотографии и характер истории.'
          : 'Selected to fit your photographs and narrative.'),
      textureAndFilmReason:
        spec.explainability?.textureAndFilmReason ||
        (language === 'ru'
          ? 'Фактура и плёночный цвет передают атмосферу и погоду.'
          : 'Chosen to match the weather and sensory atmosphere.'),
      typographyAndMotifReason:
        spec.explainability?.typographyAndMotifReason ||
        (language === 'ru'
          ? 'Шрифты и детали взяты из ваших личных ассоциаций.'
          : 'Derived from your personal associations.'),
      animationReason:
        spec.explainability?.animationReason ||
        (language === 'ru'
          ? 'Скорость и пластика соответствуют настроению и музыке.'
          : 'Motion pace matches the emotional and musical tone.'),
      profileBalanceNote:
        spec.explainability?.profileBalanceNote ||
        (language === 'ru'
          ? 'Учтён баланс ваших долгосрочных предпочтений и характера этого дня.'
          : 'Balanced your long-term tastes with this moment.'),
    },
  };
}

function buildHeuristicDesignSpec(params: {
  imageAnalyses: ImageVisualAnalysis[];
  questionnaire: QuestionnairePayload;
  variationSeed?: number;
}): { designSpec: DesignSpecification; aiProviderUsed: string } {
  const { imageAnalyses, questionnaire, variationSeed = 0 } = params;
  const primaryImage = imageAnalyses[0];
  const lang: AppLanguage = questionnaire.memoryLanguage === 'ru' ? 'ru' : 'en';
  const answerMap = new Map(questionnaire.answers.map((a) => [a.questionId, a]));

  const colorAnswer = answerMap.get('associated_color')?.answer || '';
  const moodAnswer = answerMap.get('mood_emotions')?.answer || '';
  const weatherAnswer = answerMap.get('weather')?.answer || '';
  const smellAnswer = answerMap.get('smell')?.answer || '';
  const soundAnswer = answerMap.get('sounds')?.answer || '';
  const remindsOf = answerMap.get('reminds_of')?.answer || '';
  const specialWhy = answerMap.get('why_special')?.answer || '';
  const detailMost = answerMap.get('detail_remember')?.answer || '';
  const peopleWith = answerMap.get('who_with')?.answer || '';

  const combinedText = [
    moodAnswer,
    weatherAnswer,
    smellAnswer,
    soundAnswer,
    remindsOf,
    specialWhy,
    detailMost,
    questionnaire.storyText,
    questionnaire.music?.queryOrMood || '',
    questionnaire.music?.trackTitle || '',
    primaryImage?.scenery || '',
    ...(primaryImage?.visibleObjects || []),
  ]
    .join(' ')
    .toLowerCase();

  const extracted = primaryImage?.dominantColors || ['#C2B29F', '#6B7785'];
  const userColorHex = resolveUserColorHex(colorAnswer, extracted[0]);

  const isWinterSnow = /(snow|frost|winter|icy|freezing|blizzard|cold air|снег|мороз|зим|лёд|лед|иней|холод)/.test(
    combinedText
  );
  const isAutumnFoliage = /(autumn|fall|leaves|leaf|foliage|maple|chestnut|october|осен|листв|листь|клён|клен|сентябр|октябр)/.test(
    combinedText
  );
  const isWarmCozy = /(coffee|espresso|cafe|café|nostalg|amber|sweater|fireplace|tea|bakery|cinnamon|кофе|кофейн|чай|выпечк|ностальг|янтар|тепл|уют)/.test(
    combinedText
  );
  const isBotanical = /(flower|garden|petal|meadow|bloom|blossom|bouquet|botanical|grass|pine|цвет|сад|лепест|луг|букет|трав|хво|лес)/.test(
    combinedText
  );
  const isRainOrNight = /(rain|storm|night|neon|city|evening|melanchol|quiet|wet|drizzle|midnight|mist|solitude|tram|subway|cinema|дожд|ноч|неон|город|вечер|меланхол|мокры|полноч|туман|трамва|асфальт|груст)/.test(
    combinedText
  );
  const isCityNight = /(city|neon|tram|street|concert|ticket|train|midnight|night walk|subway|cinema|город|неон|трамва|улиц|концерт|поезд|полноч|метро|кино|фонар)/.test(
    combinedText
  );
  const isEnergetic = /(exciting|energetic|concert|dance|party|upbeat|birthday|electric|fast|alive|happy|cheerful|энерг|танц|вечерин|праздн|счаст|радост|жив|предвкуш)/.test(
    combinedText
  );
  const isSeasideOrSummer = /(sea|seaside|ocean|beach|coast|salt|summer|sun|sunshine|breeze|waves|sand|freedom|shell|мор|пляж|берег|соль|солн|лет|волн|песок|свобод|бриз|ракуш)/.test(
    combinedText
  );
  const isMinimalCalm = /(calm|peace|quiet|still|gentle|serene|soft|покой|тиш|спокой|нежно|умиротвор)/.test(
    combinedText
  );

  const isDarkCanvas =
    (/(night|midnight|dark|noir|neon|slate|city|evening drizzle|ноч|полноч|тёмн|темн|неон|фонар)/.test(combinedText) &&
      !isSeasideOrSummer &&
      !isWinterSnow) ||
    relativeLuminance(userColorHex) < 0.19;

  let calendarMoodCategory: CalendarMoodCategory = 'neutral';
  if (isDarkCanvas || isCityNight) calendarMoodCategory = 'night';
  else if (isWinterSnow) calendarMoodCategory = 'calm';
  else if (isAutumnFoliage || isWarmCozy) calendarMoodCategory = 'nostalgic';
  else if (isEnergetic || isSeasideOrSummer) calendarMoodCategory = 'happy';
  else if (isMinimalCalm || isRainOrNight) calendarMoodCategory = 'calm';

  const background = isDarkCanvas
    ? mixHex('#171B21', userColorHex, 0.14)
    : isWinterSnow
    ? mixHex('#EFF4F8', userColorHex, 0.08)
    : mixHex('#F6F2EA', userColorHex, 0.11);
  const surface = isDarkCanvas ? mixHex('#222730', userColorHex, 0.16) : mixHex('#FCF9F3', userColorHex, 0.06);
  const ink = isDarkCanvas ? '#F2EFE9' : '#1F1C18';
  const mutedInk = isDarkCanvas ? '#A9B0BC' : '#655E53';

  let layoutId: LayoutId = 'scrapbook-layers';
  let layoutReason = '';
  let mainPhotoPlacement: ScrapbookPlan['mainPhotoPlacement'] = 'left-anchor';
  let secondaryPhotoArrangement: ScrapbookPlan['secondaryPhotoArrangement'] = 'overlapping-cluster';
  let decorationDensity: ScrapbookPlan['decorationDensity'] = 'balanced';
  let typographyPlacement: TypographyPlacementId = 'top-editorial';
  let artisticTechniques: ArtisticTechniqueId[] = ['torn-collage', 'stamped-postmark'];

  if (isCityNight) {
    layoutId = 'night-cinematic-zine';
    mainPhotoPlacement = 'offset-right';
    secondaryPhotoArrangement = 'filmstrip-rail';
    typographyPlacement = 'vertical-spine';
    artisticTechniques = ['film-sprockets', 'light-leak', 'halftone-newsprint'];
    layoutReason =
      lang === 'ru'
        ? 'Ночной кинематографический зин с боковой типографикой и световыми засветами передаёт ритм вечернего города.'
        : 'Nocturnal zine spread with vertical spine typography and light leaks echoes evening city rhythm.';
  } else if (isBotanical && !isAutumnFoliage) {
    layoutId = 'botanical-folio';
    mainPhotoPlacement = 'center-folio';
    secondaryPhotoArrangement = 'tucked-corners';
    typographyPlacement = 'split-column';
    artisticTechniques = ['watercolor-wash', 'ink-sketches', 'linen-fibers'];
    layoutReason =
      lang === 'ru'
        ? 'Страница гербария с акварельной дымкой и тонкими линиями туши бережно обрамляет природные детали.'
        : 'Herbarium folio pairs watercolor washes and delicate ink linework with organic textures.';
  } else if (isSeasideOrSummer) {
    layoutId = 'watercolor-journal';
    mainPhotoPlacement = 'left-anchor';
    secondaryPhotoArrangement = 'overlapping-cluster';
    typographyPlacement = 'floating-card';
    artisticTechniques = ['watercolor-wash', 'torn-collage', 'light-leak'];
    layoutReason =
      lang === 'ru'
        ? 'Акварельный журнал с живым каскадом кадров передаёт воздух лета, солнце и движение.'
        : `Watercolor journal echoes open movement and sunlit spontaneity (${weatherAnswer || 'coastal warmth'}).`;
  } else if (isWinterSnow || (isRainOrNight && !isCityNight)) {
    layoutId = 'minimal-gallery';
    mainPhotoPlacement = 'center-folio';
    secondaryPhotoArrangement = 'minimal-stack';
    decorationDensity = 'minimal';
    typographyPlacement = 'bottom-atelier';
    artisticTechniques = ['linen-fibers', 'ink-sketches'];
    layoutReason =
      lang === 'ru'
        ? 'Минималистичная галерея оставляет максимум тишины и воздуха вокруг кадра.'
        : `Minimal gallery composition preserves quiet breathing room for your peaceful mood (${moodAnswer || 'quiet stillness'}).`;
  } else if (isAutumnFoliage || isWarmCozy) {
    layoutId = 'scrapbook-layers';
    mainPhotoPlacement = 'left-anchor';
    secondaryPhotoArrangement = 'tucked-corners';
    decorationDensity = 'layered';
    typographyPlacement = 'split-column';
    artisticTechniques = ['torn-collage', 'halftone-newsprint', 'stamped-postmark'];
    layoutReason =
      lang === 'ru'
        ? 'Многослойный скрапбук с вырезками бумаги и тёплыми полями напоминает живую страницу личного дневника.'
        : `Layered scrapbook layout brings tactile warmth to shared memories (${peopleWith || 'close company'}).`;
  } else if (isEnergetic) {
    layoutId = 'polaroid-cluster';
    mainPhotoPlacement = 'left-anchor';
    secondaryPhotoArrangement = 'overlapping-cluster';
    typographyPlacement = 'top-editorial';
    artisticTechniques = ['torn-collage', 'light-leak', 'film-sprockets'];
    layoutReason =
      lang === 'ru'
        ? 'Динамичный каскад полароидов со смелыми углами отражает энергию и живые эмоции.'
        : 'Dynamic Polaroid cascade mirrors vivid energy and candid celebration.';
  } else {
    layoutReason =
      lang === 'ru'
        ? 'Многослойная журнальная вёрстка уравновешивает ключевой кадр, рукописные заметки и свободное пространство.'
        : 'Layered scrapbook composition balancing main focal image, tactile notes, and whitespace.';
  }

  let paperTexture: PaperTextureId = 'warm-cotton';
  let filmEffect: FilmEffectId = 'warm-kodak';
  let frameStyle: FrameStyleId = 'torn-paper';
  let lightingMood = lang === 'ru' ? 'Мягкий дневной свет' : 'Soft diffused daylight';

  if (isWinterSnow) {
    paperTexture = 'frost-paper';
    filmEffect = 'soft-matte';
    frameStyle = 'deckled-paper';
    lightingMood = lang === 'ru' ? 'Прозрачный зимний полусвет' : 'Crisp pale winter diffusion';
  } else if (isRainOrNight) {
    paperTexture = isDarkCanvas ? 'charcoal-matte' : 'rain-washed';
    filmEffect = 'cool-cinestill';
    frameStyle = isCityNight ? 'contact-sheet' : 'thin-gallery-rule';
    lightingMood = lang === 'ru' ? 'Ночные отблески и глубокие тени' : 'Nocturnal wet-stone reflections';
  } else if (isBotanical) {
    paperTexture = 'linen-archival';
    filmEffect = 'faded-polaroid';
    frameStyle = 'arch-cutout';
    lightingMood = lang === 'ru' ? 'Тёплый садовый полутон' : 'Gentle dappled botanical shade';
  } else if (isAutumnFoliage || isWarmCozy) {
    paperTexture = 'aged-vellum';
    filmEffect = 'faded-polaroid';
    frameStyle = 'torn-paper';
    lightingMood = lang === 'ru' ? 'Тёплый янтарный свет позднего дня' : 'Warm late-afternoon amber glow';
  } else if (isSeasideOrSummer) {
    paperTexture = 'sand-textured';
    filmEffect = 'warm-kodak';
    frameStyle = 'classic-polaroid';
    lightingMood = lang === 'ru' ? 'Золотой прибрежный закат' : 'Golden coastal sunbeams';
  }

  let typography: TypographyPairId = 'editorial-serif';
  if (isAutumnFoliage || isWarmCozy) typography = 'intimate-journal';
  else if (isRainOrNight || isWinterSnow) typography = 'modern-archival';
  else if (isSeasideOrSummer || isBotanical) typography = 'poetic-italic';

  const motifs: DecorativeMotifId[] = [];
  if (isAutumnFoliage) motifs.push('autumn-leaves', 'masking-tape');
  else if (isWarmCozy) motifs.push('masking-tape', 'postmark-seal');
  if (isBotanical) motifs.push('pressed-botanical');
  if (isSeasideOrSummer) motifs.push('seashells', 'wave-contour', 'sunlight-wash');
  if (isWinterSnow) motifs.push('snowflakes', 'clouds');
  if (isRainOrNight && !isWinterSnow) motifs.push('raindrop-streaks');
  if (isCityNight) motifs.push('vintage-ticket', 'film-strip', 'star-constellation');
  if (motifs.length === 0) motifs.push('postmark-seal', 'minimal-hairline');

  let animationStyle: AnimationStyleId = 'gentle-drift';
  let animationSpeedMultiplier = 1.0;
  if (isRainOrNight || isWinterSnow) {
    animationStyle = 'rainy-stillness';
    animationSpeedMultiplier = 0.72;
  } else if (isEnergetic) {
    animationStyle = 'kinetic-pulse';
    animationSpeedMultiplier = 1.24;
  } else if (isSeasideOrSummer) {
    animationStyle = 'sunlit-breeze';
    animationSpeedMultiplier = 1.12;
  } else if (isAutumnFoliage || isWarmCozy) {
    animationStyle = 'nostalgic-reel';
    animationSpeedMultiplier = 0.9;
  }

  // Full-phrase title generation — NEVER chop mid-phrase with slice(0, 4)!
  const rawTitleCandidate =
    detailMost ||
    remindsOf.split(',')[0]?.trim() ||
    moodAnswer.split(',')[0]?.trim() ||
    (questionnaire.storyText ? questionnaire.storyText.split(/[.!?]/)[0]?.trim() : '') ||
    (lang === 'ru' ? 'Сохранённое мгновение' : 'Preserved Moment');
  const generatedTitle = ensureCompletePhrase(rawTitleCandidate, lang);

  // Respect variationSeed cleanly across ALL 8 layouts, 8 frames, and 5 typography placements
  const allLayouts: LayoutId[] = [
    layoutId,
    'editorial-spread',
    'botanical-folio',
    'watercolor-journal',
    'scrapbook-layers',
    'polaroid-cluster',
    'night-cinematic-zine',
    'minimal-gallery',
    'filmstrip-diary',
  ];
  const layoutAlternates: LayoutId[] = allLayouts.filter((val, idx) => idx === 0 || val !== layoutId);
  const frameAlternates: FrameStyleId[] = [
    frameStyle,
    'torn-paper',
    'arch-cutout',
    'classic-polaroid',
    'oval-cutout',
    'taped-snapshot',
    'deckled-paper',
    'contact-sheet',
  ];
  const placementAlternates: ScrapbookPlan['mainPhotoPlacement'][] = [
    mainPhotoPlacement,
    'left-anchor',
    'center-folio',
    'offset-right',
    'upper-editorial',
  ];
  const typoPlacementAlternates: TypographyPlacementId[] = [
    typographyPlacement,
    'vertical-spine',
    'split-column',
    'floating-card',
    'bottom-atelier',
    'top-editorial',
  ];

  const effectiveLayout = variationSeed > 0 ? layoutAlternates[variationSeed % layoutAlternates.length] : layoutId;
  const effectiveFrame = variationSeed > 0 ? frameAlternates[variationSeed % frameAlternates.length] : frameStyle;
  const effectivePlacement =
    variationSeed > 0 ? placementAlternates[variationSeed % placementAlternates.length] : mainPhotoPlacement;
  const effectiveTypoPlacement =
    variationSeed > 0
      ? typoPlacementAlternates[variationSeed % typoPlacementAlternates.length]
      : typographyPlacement;
  const effectiveAccent =
    variationSeed % 2 === 1 && extracted[1] ? mixHex(userColorHex, extracted[1], 0.35) : userColorHex;

  // Choose one of 9 genuinely distinct CollageStyleIds + rich context-authentic SmallDetails
  let collageStyle: CollageStyleId = 'handmade-scrapbook';
  if (isCityNight) collageStyle = 'cinematic-journal';
  else if (isBotanical && !isAutumnFoliage) collageStyle = 'nature-herbarium';
  else if (isSeasideOrSummer) collageStyle = 'dreamy-collage';
  else if (isAutumnFoliage || isWarmCozy) collageStyle = 'handmade-scrapbook';
  else if (isEnergetic) collageStyle = 'playful-cutout';
  else if (isRainOrNight) collageStyle = 'vintage-archive';
  else if (isMinimalCalm) collageStyle = 'editorial-art';
  else collageStyle = 'mixed-media-journal';

  const allCollageStyles: CollageStyleId[] = [
    collageStyle,
    'mixed-media-journal',
    'editorial-art',
    'handmade-scrapbook',
    'playful-cutout',
    'vintage-archive',
    'dreamy-collage',
    'nature-herbarium',
    'cinematic-journal',
    'contemporary-art',
  ];
  const uniqueStyles = allCollageStyles.filter((s, idx) => allCollageStyles.indexOf(s) === idx);
  const effectiveCollageStyle =
    variationSeed > 0 ? uniqueStyles[variationSeed % uniqueStyles.length] : collageStyle;

  const selectedDetailsSet = new Set<SmallDetailId>([
    'torn-colored-paper',
    'folded-note',
    'handwritten-edge-word',
  ]);
  if (isSeasideOrSummer) {
    selectedDetailsSet.add('seashell-sketch');
    selectedDetailsSet.add('wave-ripples');
    selectedDetailsSet.add('sun-doodle');
    selectedDetailsSet.add('translucent-vellum');
    selectedDetailsSet.add('washi-tape');
  }
  if (isAutumnFoliage) {
    selectedDetailsSet.add('pressed-leaf');
    selectedDetailsSet.add('tiny-branch');
    selectedDetailsSet.add('stitched-thread');
    selectedDetailsSet.add('paper-clip');
  }
  if (isWarmCozy) {
    selectedDetailsSet.add('coffee-ring-mark');
    selectedDetailsSet.add('receipt-fragment');
    selectedDetailsSet.add('fabric-swatch');
  }
  if (isBotanical) {
    selectedDetailsSet.add('pressed-flower');
    selectedDetailsSet.add('pressed-leaf');
    selectedDetailsSet.add('tiny-branch');
    selectedDetailsSet.add('translucent-vellum');
  }
  if (isCityNight || isRainOrNight) {
    selectedDetailsSet.add('rain-streaks');
    selectedDetailsSet.add('ticket-stub');
    selectedDetailsSet.add('film-strip-mini');
    selectedDetailsSet.add('umbrella-doodle');
    selectedDetailsSet.add('city-map-fragment');
  }
  if (isEnergetic) {
    selectedDetailsSet.add('confetti-scraps');
    selectedDetailsSet.add('candle-doodle');
    selectedDetailsSet.add('camera-doodle');
    selectedDetailsSet.add('tiny-stars');
  }
  if (selectedDetailsSet.size < 6) {
    selectedDetailsSet.add('washi-tape');
    selectedDetailsSet.add('postmark-seal');
    selectedDetailsSet.add('pencil-marks');
    selectedDetailsSet.add('date-stamp');
  }
  const selectedDetails = Array.from(selectedDetailsSet).slice(0, 8);

  const handwrittenEdgeWord =
    detailMost.split(/[,.!?]/)[0]?.trim().split(/\s+/).slice(0, 3).join(' ') ||
    (isSeasideOrSummer
      ? lang === 'ru'
        ? 'солёный бриз'
        : 'salt & warm light'
      : isAutumnFoliage || isWarmCozy
      ? lang === 'ru'
        ? 'тепло вечера'
        : 'warm mugs & dusk'
      : isRainOrNight
      ? lang === 'ru'
        ? 'огни после дождя'
        : 'rain-lit street'
      : lang === 'ru'
      ? 'живой след'
      : 'kept closely');

  const focalStrategy =
    lang === 'ru'
      ? `Крупный вырезанный акцентный кадр задаёт ритм стиля «${effectiveCollageStyle}», остальные снимки наслаиваются с разным наклоном и масштабом.`
      : `Dominant asymmetrical hero cutout anchors the ${effectiveCollageStyle} spread while supporting frames peek out at contrasting angles.`;

  const layeringStrategy =
    lang === 'ru'
      ? `Многослойная глубина: снизу рваные цветные обрывки бумаги в палитре (${userColorHex}) и калька, в середине вклеенные снимки и гербарий, сверху сгибы заметок, скотч, нить и скрепка.`
      : `True z-depth layering: torn colored paper scraps (${userColorHex}) and translucent vellum sit behind cutouts, botanical/paper keepsakes tuck between frames, and tape/clips pin the diary note.`;

  const negativeSpaceNote =
    lang === 'ru'
      ? 'Правое верхнее поле и край вокруг рукописной заметки оставлены свободными для воздуха и лёгкого дыхания листа.'
      : 'Upper-right breathing pocket and clean borders around the diary note prevent visual crowding.';

  const moodSummary =
    lang === 'ru'
      ? `Собрано вокруг чувства: ${moodAnswer || 'тихое личное размышление'}${
          smellAnswer ? `, аромат — ${smellAnswer}` : ''
        }${weatherAnswer ? `, погода — ${weatherAnswer}` : ''}.`
      : `Shaped around ${moodAnswer || 'your personal reflections'}${
          smellAnswer ? `, the scent of ${smellAnswer}` : ''
        }${weatherAnswer ? `, and ${weatherAnswer}` : ''}.`;

  const musicInfluenceNote =
    lang === 'ru'
      ? questionnaire.music?.trackTitle
        ? `Темп настроен под трек «${questionnaire.music.trackTitle}»${
            questionnaire.music.artist ? ` (${questionnaire.music.artist})` : ''
          }.`
        : questionnaire.music?.queryOrMood
        ? `Ритм навеян музыкальной атмосферой: «${questionnaire.music.queryOrMood}».`
        : 'Естественный неторопливый ритм ваших ответов.'
      : questionnaire.music?.trackTitle
      ? `Paced to "${questionnaire.music.trackTitle}" by ${questionnaire.music.artist || 'selected artist'}.`
      : questionnaire.music?.queryOrMood
      ? `Rhythm guided by your "${questionnaire.music.queryOrMood}" musical atmosphere.`
      : 'Paced naturally to the quiet cadence of your written answers.';

  const explainability =
    lang === 'ru'
      ? {
          paletteReason: `Ваш оттенок (${colorAnswer || userColorHex}) и тона кадра (${extracted.slice(0, 2).join(', ')}) вплетены в обрывки цветной бумаги, акварель и детали.`,
          layoutReason,
          textureAndFilmReason: `Бумага «${paperTexture}» и плёночный цвет «${filmEffect}» передают атмосферу погоды (${weatherAnswer || 'естественный свет'}) и запахов (${smellAnswer || 'момент'}).`,
          typographyAndMotifReason: `Типографика (${typography}, ${effectiveTypoPlacement}) и ручные детали (${selectedDetails.slice(0, 4).join(', ')}) рождены из ваших ответов.`,
          animationReason: `Пластичный ритм «${animationStyle}» (${animationSpeedMultiplier}x) откликается на настроение (${moodAnswer || 'спокойное'}) и звуки.`,
          profileBalanceNote: questionnaire.userPreferences?.allowAdaptiveLearning
            ? 'Учтены ваши сохранённые предпочтения профиля, но главный приоритет — живая эмоция этого момента.'
            : 'Создано чисто по ответам этого воспоминания без влияния общих настроек профиля.',
        }
      : {
          paletteReason: `Your chosen color (${colorAnswer || userColorHex}) and extracted frame tones (${extracted.slice(0, 2).join(', ')}) are woven into torn paper scraps, washes, and accents.`,
          layoutReason,
          textureAndFilmReason: `Selected ${paperTexture} paper and ${filmEffect} grading to mirror ${weatherAnswer || 'the ambient light'} and scents like ${smellAnswer || 'the moment'}.`,
          typographyAndMotifReason: `Paired ${typography} typography (${effectiveTypoPlacement}) with handmade details (${selectedDetails.slice(0, 4).join(', ')}) from your personal memories.`,
          animationReason: `Motion profile "${animationStyle}" (${animationSpeedMultiplier}x pace) responds directly to ${moodAnswer || 'your mood'} and ${soundAnswer || 'ambient sounds'}.`,
          profileBalanceNote: questionnaire.userPreferences?.allowAdaptiveLearning
            ? 'Your saved profile preferences were respected as subtle defaults while allowing this specific memory’s mood to lead.'
            : 'Designed purely from this memory’s answers without long-term profile overrides.',
        };

  return {
    aiProviderUsed: 'local-heuristic',
    designSpec: {
      generatedTitle,
      moodSummary,
      atmosphereKeywords: [
        moodAnswer.split(',')[0]?.trim() || (lang === 'ru' ? 'личное' : 'personal'),
        weatherAnswer.split(',')[0]?.trim() || (lang === 'ru' ? 'вне времени' : 'timeless'),
        smellAnswer.split(',')[0]?.trim() || (lang === 'ru' ? 'тактильность' : 'tactile'),
      ].filter(Boolean),
      calendarMoodCategory,
      palette: {
        background,
        surface,
        primaryAccent: effectiveAccent,
        secondaryAccent: extracted[1] || extracted[0],
        ink,
        mutedInk,
        extractedFromPhoto: extracted.slice(0, 3),
        chosenByUser: userColorHex,
      },
      layoutId: effectiveLayout,
      paperTexture,
      filmEffect,
      frameStyle: effectiveFrame,
      typography,
      decorativeMotifs: Array.from(new Set(motifs)).slice(0, 3),
      animationStyle,
      animationSpeedMultiplier,
      musicInfluenceNote,
      scrapbookPlan: {
        collageStyle: effectiveCollageStyle,
        focalStrategy,
        layeringStrategy,
        backgroundMaterial: paperTexture.replace(/-/g, ' '),
        mainPhotoPlacement: effectivePlacement,
        secondaryPhotoArrangement,
        lightingMood,
        decorationDensity,
        visualBalanceNote:
          lang === 'ru'
            ? `Композиция «${effectiveCollageStyle}» с ручными слоями: ${selectedDetails.slice(0, 4).join(', ')}.`
            : `Composed as ${effectiveCollageStyle} weaving ${selectedDetails.slice(0, 4).join(', ')} across layered paper planes.`,
        negativeSpaceNote,
        ticketStubText: isCityNight
          ? `${questionnaire.memoryDate} · ${lang === 'ru' ? 'НОЧНОЙ БИЛЕТ' : 'LATE PASS'}`
          : undefined,
        typographyPlacement: effectiveTypoPlacement,
        artisticTechniques,
        selectedDetails,
        handwrittenEdgeWord,
        sketchSubject: isSeasideOrSummer ? 'seashell' : isRainOrNight ? 'umbrella' : isEnergetic ? 'candle' : 'camera',
        locationOrLabelText: peopleWith || remindsOf.split(',')[0]?.trim() || undefined,
      },
      explainability,
    },
  };
}

// =========================================================================
// AUTOMATIC YEAR MULTI-SIGNAL MEMORY CLUSTERING
// =========================================================================

export interface ClusterInputPhoto {
  clientId: string;
  originalName: string;
  captureDate: string | null; // YYYY-MM-DD or null
  captureTime?: string | null; // HH:MM:SS or HH:MM
  captureMinutes?: number | null; // 0..1439
  dateSource: 'exif' | 'file-modified' | 'manual' | 'unknown';
  analysis: ImageVisualAnalysis;
}

export interface ClusteredMemoryProposal {
  clusterId: string;
  title: string;
  memoryDate: string;
  dateUncertain: boolean;
  eventTimeLabel?: string;
  themeLabel: string;
  groupingReason: string;
  photoIds: string[];
  storyText: string;
  inferredAnswers: Array<{ questionId: string; question: string; answer: string; tags: string[] }>;
}

function dayDiff(dateA: string, dateB: string): number {
  const t1 = new Date(`${dateA.slice(0, 10)}T12:00:00Z`).getTime();
  const t2 = new Date(`${dateB.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 9999;
  return Math.abs(Math.round((t1 - t2) / 86_400_000));
}

function inferApproxMinutes(item: ClusterInputPhoto): number | null {
  if (typeof item.captureMinutes === 'number' && !Number.isNaN(item.captureMinutes)) {
    return item.captureMinutes;
  }
  if (item.captureTime && /^\d{2}:\d{2}/.test(item.captureTime)) {
    const [hh, mm] = item.captureTime.split(':').map(Number);
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) return hh * 60 + mm;
  }
  return null;
}

function inferTimeBucket(item: ClusterInputPhoto): 'morning' | 'afternoon' | 'evening' | 'night' {
  const mins = inferApproxMinutes(item);
  if (mins !== null) {
    if (mins < 11 * 60 + 30) return 'morning';
    if (mins < 17 * 60) return 'afternoon';
    if (mins < 21 * 60) return 'evening';
    return 'night';
  }
  const tod = item.analysis.timeOfDay;
  if (tod === 'morning' || tod === 'afternoon' || tod === 'evening' || tod === 'night') return tod;
  return (item.analysis.brightnessScore ?? 0.55) < 0.35 ? 'night' : 'afternoon';
}

function formatEventTimeLabel(grp: ClusterInputPhoto[], language: AppLanguage): string {
  const times = grp
    .map((g) => inferApproxMinutes(g))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);

  if (times.length > 0) {
    const startH = String(Math.floor(times[0] / 60)).padStart(2, '0');
    const startM = String(times[0] % 60).padStart(2, '0');
    const bucket = inferTimeBucket(grp[0]);
    const bucketLabel =
      language === 'ru'
        ? bucket === 'morning'
          ? 'Утро'
          : bucket === 'afternoon'
          ? 'День'
          : bucket === 'evening'
          ? 'Вечер'
          : 'Ночь'
        : bucket === 'morning'
        ? 'Morning'
        : bucket === 'afternoon'
        ? 'Afternoon'
        : bucket === 'evening'
        ? 'Evening'
        : 'Night';
    return `${bucketLabel} · ${startH}:${startM}`;
  }

  const bucket = inferTimeBucket(grp[0]);
  if (language === 'ru') {
    return bucket === 'morning' ? 'Утро' : bucket === 'afternoon' ? 'День' : bucket === 'evening' ? 'Вечер' : 'Ночь';
  }
  return bucket === 'morning' ? 'Morning' : bucket === 'afternoon' ? 'Afternoon' : bucket === 'evening' ? 'Evening' : 'Night';
}

function objectOverlapScore(a: ImageVisualAnalysis, b: ImageVisualAnalysis): number {
  const wordsA = new Set(
    [a.sceneCategory || '', a.scenery || '', a.activity || '', ...(a.visibleObjects || [])]
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const wordsB = new Set(
    [b.sceneCategory || '', b.scenery || '', b.activity || '', ...(b.visibleObjects || [])]
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.min(wordsA.size, wordsB.size);
}

const SCENE_TITLE_MAP: Record<string, { en: string; ru: string; moodEn: string; moodRu: string }> = {
  coast: {
    en: 'Salt Air & Open Horizon',
    ru: 'Морской бриз и открытый горизонт',
    moodEn: 'Sea air, sunlit warmth, openness',
    moodRu: 'Морской воздух, солнечное тепло, свобода',
  },
  city: {
    en: 'City Streets & Quiet Light',
    ru: 'Городские улицы и тихий свет',
    moodEn: 'Urban rhythm, curiosity, late light',
    moodRu: 'Ритм города, наблюдение, вечерний свет',
  },
  'night-street': {
    en: 'Lanterns After Dusk',
    ru: 'Огни города после заката',
    moodEn: 'Nocturnal calm, solitude, warm streetlamps',
    moodRu: 'Ночной покой, тёплые фонари, тишина',
  },
  nature: {
    en: 'Green Trails & Quiet Air',
    ru: 'Зелёные тропы и чистый воздух',
    moodEn: 'Fresh leaves, unhurried breath, stillness',
    moodRu: 'Свежая листва, неспешный шаг, тишина',
  },
  'cafe-dining': {
    en: 'Warm Cups & Shared Tables',
    ru: 'Тёплые чашки и долгие разговоры',
    moodEn: 'Coffee warmth, companionship, nostalgia',
    moodRu: 'Аромат кофе, близость, светлая ностальгия',
  },
  'home-interior': {
    en: 'Quiet Corners at Home',
    ru: 'Тихие домашние мгновения',
    moodEn: 'Comfort, intimacy, soft daylight',
    moodRu: 'Уют, камерность, мягкий дневной свет',
  },
  'travel-transit': {
    en: 'Miles Along the Road',
    ru: 'Дороги и новые горизонты',
    moodEn: 'Anticipation, movement, discovery',
    moodRu: 'Дорога, предвкушение, открытия',
  },
  celebration: {
    en: 'Gathered Voices & Warm Light',
    ru: 'Собранный свет и общий праздник',
    moodEn: 'Joy, gratitude, vibrant energy',
    moodRu: 'Радость, благодарность, живая энергия',
  },
  winter: {
    en: 'Crisp Air & Winter Silence',
    ru: 'Морозный воздух и зимняя тишина',
    moodEn: 'Quiet frost, pale light, calm reflection',
    moodRu: 'Тишина зимы, прозрачный свет, спокойствие',
  },
  portrait: {
    en: 'Faces Kept in Daylight',
    ru: 'Близкие лица в живом свете',
    moodEn: 'Tenderness, presence, warmth',
    moodRu: 'Нежность, близость, живое присутствие',
  },
  moment: {
    en: 'Chapter from the Year',
    ru: 'Сохранившаяся глава года',
    moodEn: 'Personal reflection, natural light',
    moodRu: 'Личное воспоминание, естественный свет',
  },
};

function areSameSubDayEvent(a: ClusterInputPhoto, b: ClusterInputPhoto): { compatible: boolean; score: number } {
  const minsA = inferApproxMinutes(a);
  const minsB = inferApproxMinutes(b);
  const catA = a.analysis.sceneCategory || 'moment';
  const catB = b.analysis.sceneCategory || 'moment';
  const bucketA = inferTimeBucket(a);
  const bucketB = inferTimeBucket(b);
  const overlap = objectOverlapScore(a.analysis, b.analysis);

  const sameSpecificCat = catA !== 'moment' && catB !== 'moment' && catA === catB;
  const bothGeneric = catA === 'moment' || catB === 'moment';

  if (minsA !== null && minsB !== null) {
    const gap = Math.abs(minsA - minsB);
    // Burst or immediate outing within 60 minutes
    if (gap <= 60) {
      // Even within 60 mins, clearly distinct contrasting activities shouldn't merge if completely unrelated
      if (!bothGeneric && !sameSpecificCat && overlap < 0.12 && gap > 25) {
        return { compatible: false, score: 0 };
      }
      return { compatible: true, score: 12 + (sameSpecificCat ? 4 : 0) + overlap * 4 - gap / 30 };
    }
    // Same event up to 110 minutes ONLY if category matches or strong context overlap
    if (gap <= 110 && (sameSpecificCat || overlap >= 0.25)) {
      return { compatible: true, score: 8 + overlap * 4 };
    }
    // 2+ hours apart on the same day -> separate sub-day event (e.g. Morning Coffee vs Lunch vs Evening Walk)
    return { compatible: false, score: 0 };
  }

  // When explicit timestamps are unavailable, rely on timeOfDay bucket + visual scene/activity context
  if (bucketA !== bucketB) {
    // e.g. morning indoor coffee vs evening city walk vs night street
    return { compatible: false, score: 0 };
  }

  if (sameSpecificCat || overlap >= 0.25) {
    return { compatible: true, score: 8 + (sameSpecificCat ? 3 : 0) + overlap * 4 };
  }

  // Contrasting scene categories (e.g. cafe-dining vs nature or celebration) even without clock timestamps stay distinct
  if (!bothGeneric && catA !== catB && overlap < 0.2) {
    return { compatible: false, score: 0 };
  }

  return { compatible: true, score: 5 + overlap * 2 };
}

export async function clusterYearPhotos(params: {
  photos: ClusterInputPhoto[];
  language: AppLanguage;
}): Promise<ClusteredMemoryProposal[]> {
  const { photos, language } = params;
  if (photos.length === 0) return [];

  // Sort dated items chronologically (by captureDate + captureMinutes + name), undated afterward
  const sorted = [...photos].sort((a, b) => {
    if (a.captureDate && b.captureDate) {
      const dc = a.captureDate.localeCompare(b.captureDate);
      if (dc !== 0) return dc;
      const ma = inferApproxMinutes(a);
      const mb = inferApproxMinutes(b);
      if (ma !== null && mb !== null && ma !== mb) return ma - mb;
      if (ma !== null) return -1;
      if (mb !== null) return 1;
      return a.originalName.localeCompare(b.originalName);
    }
    if (a.captureDate) return -1;
    if (b.captureDate) return 1;
    return a.originalName.localeCompare(b.originalName);
  });

  // Multi-signal grouping that splits distinct events on the SAME date into multiple memories
  // while keeping burst shots & matching same-moment events together (max 8 photos per memory chapter).
  const groups: ClusterInputPhoto[][] = [];

  for (const item of sorted) {
    let matchedGroup: ClusterInputPhoto[] | null = null;
    let bestScore = -1;

    for (const grp of groups) {
      if (grp.length >= 8) continue;
      const anchor = grp[grp.length - 1];

      const bothDated =
        Boolean(item.captureDate) &&
        Boolean(anchor.captureDate) &&
        item.dateSource !== 'unknown' &&
        anchor.dateSource !== 'unknown';

      let score = 0;
      if (bothDated) {
        const diff = dayDiff(item.captureDate!, anchor.captureDate!);
        if (diff === 0) {
          const sameDayCheck = areSameSubDayEvent(item, anchor);
          if (sameDayCheck.compatible) {
            score = sameDayCheck.score;
          }
        } else if (diff === 1 && !item.captureTime && !anchor.captureTime) {
          // Consecutive undated-time trip photos only merge if very strong shared scenery/activity
          const overlap = objectOverlapScore(item.analysis, anchor.analysis);
          const sameCat =
            item.analysis.sceneCategory &&
            item.analysis.sceneCategory !== 'moment' &&
            item.analysis.sceneCategory === anchor.analysis.sceneCategory;
          if (sameCat && overlap >= 0.3) {
            score = 5 + overlap * 4;
          }
        }
      } else if (!item.captureDate && !anchor.captureDate) {
        // Both undated: group strictly by real scene/object/timeOfDay context (NEVER purely by color!)
        const overlap = objectOverlapScore(item.analysis, anchor.analysis);
        const sameBucket = inferTimeBucket(item) === inferTimeBucket(anchor);
        const sameCat =
          item.analysis.sceneCategory &&
          anchor.analysis.sceneCategory &&
          item.analysis.sceneCategory === anchor.analysis.sceneCategory &&
          item.analysis.sceneCategory !== 'moment';
        if (sameBucket && (sameCat || overlap >= 0.4)) {
          score = 4 + overlap * 4;
        }
      }

      if (score > bestScore && score >= 4) {
        bestScore = score;
        matchedGroup = grp;
      }
    }

    if (matchedGroup) {
      matchedGroup.push(item);
    } else {
      groups.push([item]);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  // Build initial heuristic proposals
  const proposals: ClusteredMemoryProposal[] = groups.map((grp, idx) => {
    const dated = grp.find((p) => p.captureDate);
    const memoryDate = dated?.captureDate || todayIso;
    const dateUncertain = !dated || dated.dateSource === 'unknown' || dated.dateSource === 'file-modified';
    const eventTimeLabel = formatEventTimeLabel(grp, language);

    const catCounts = new Map<string, number>();
    grp.forEach((p) => {
      const cat = p.analysis.sceneCategory || 'moment';
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    });
    const topCategory =
      Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'moment';
    const meta = SCENE_TITLE_MAP[topCategory] || SCENE_TITLE_MAP.moment;
    const bucket = inferTimeBucket(grp[0]);
    const timeTitleFallback =
      language === 'ru'
        ? bucket === 'morning'
          ? 'Утренний свет и детали'
          : bucket === 'afternoon'
          ? 'Дневная глава'
          : bucket === 'evening'
          ? 'Вечерние краски'
          : 'Огни ночного часа'
        : bucket === 'morning'
        ? 'Morning Light & Details'
        : bucket === 'afternoon'
        ? 'Afternoon Chapter'
        : bucket === 'evening'
        ? 'Evening Atmosphere'
        : 'Late Night Lights';

    const activityHint = grp.map((p) => p.analysis.activity).find((a) => a && a.trim()) || '';
    const sceneryHint = grp[0].analysis.scenery || '';
    const dominantHex = grp[0].analysis.dominantColors[0] || '#5D8AA8';

    const rawTitle =
      activityHint && activityHint.length <= 42
        ? activityHint
        : SCENE_TITLE_MAP[topCategory]
        ? language === 'ru'
          ? meta.ru
          : meta.en
        : timeTitleFallback;
    const title = ensureCompletePhrase(rawTitle, language);

    const groupingReason =
      language === 'ru'
        ? dated
          ? `Событие за ${memoryDate} (${eventTimeLabel}) · ${grp.length} фото (${sceneryHint || topCategory}).`
          : `Объединено ${grp.length} фото со схожей сценой и объектами (${sceneryHint || topCategory}). Проверьте дату.`
        : dated
        ? `${eventTimeLabel} moment on ${memoryDate} · ${grp.length} photograph${grp.length > 1 ? 's' : ''} (${sceneryHint || topCategory}).`
        : `Grouped ${grp.length} undated photograph${grp.length > 1 ? 's' : ''} sharing scene & visual context.`;

    const moodStr = language === 'ru' ? meta.moodRu : meta.moodEn;

    return {
      clusterId: `cluster-${idx + 1}-${Date.now()}`,
      title,
      memoryDate,
      dateUncertain,
      eventTimeLabel,
      themeLabel: topCategory,
      groupingReason,
      photoIds: grp.map((p) => p.clientId),
      storyText:
        language === 'ru'
          ? `${sceneryHint ? sceneryHint + '. ' : ''}Запечатлено в серии из ${grp.length} снимков (${eventTimeLabel}).`
          : `${sceneryHint ? sceneryHint + '. ' : ''}Captured across ${grp.length} photograph${grp.length > 1 ? 's' : ''} (${eventTimeLabel}).`,
      inferredAnswers: [
        {
          questionId: 'associated_color',
          question:
            language === 'ru'
              ? 'Какой цвет у вас ассоциируется с этим снимком?'
              : 'Which color do you associate with this photograph?',
          answer: dominantHex,
          tags: [dominantHex],
        },
        {
          questionId: 'mood_emotions',
          question:
            language === 'ru'
              ? 'Какое настроение или чувства возвращает этот момент?'
              : 'What mood or emotions does this moment bring back?',
          answer: moodStr,
          tags: moodStr.split(',').map((s) => s.trim()),
        },
        {
          questionId: 'weather',
          question:
            language === 'ru' ? 'Какой была погода в тот момент?' : 'What was the weather like?',
          answer: grp[0].analysis.lighting,
          tags: [],
        },
        {
          questionId: 'detail_remember',
          question:
            language === 'ru'
              ? 'Какую деталь вы хотите запомнить сильнее всего?'
              : 'What detail do you want to remember most?',
          answer: title,
          tags: [],
        },
      ],
    };
  });

  // Optionally enrich cluster titles & factual visual notes using Gemini without inventing private feelings
  const ai = getGeminiClient();
  if (ai && proposals.length > 0 && proposals.length <= 24) {
    try {
      const compactSummaries = proposals.map((p) => {
        const items = photos.filter((ph) => p.photoIds.includes(ph.clientId));
        return {
          clusterId: p.clusterId,
          memoryDate: p.memoryDate,
          timeWindow: p.eventTimeLabel,
          theme: p.themeLabel,
          sceneries: items.slice(0, 3).map((x) => x.analysis.scenery),
          activities: items.slice(0, 3).map((x) => x.analysis.activity).filter(Boolean),
          objects: Array.from(new Set(items.flatMap((x) => x.analysis.visibleObjects))).slice(0, 6),
        };
      });

      const prompt =
        (language === 'ru'
          ? 'Ты деликатный редактор фотоархива MEMENTO. Придумай короткие, точные и полностью завершённые заголовки (2–5 слов на русском) и 1 краткую нейтральную визуальную подпись (что видно на кадрах и время дня, БЕЗ выдумывания вымышленных эмоций, диалогов или событий) для каждого блока.'
          : 'You are MEMENTO’s archival photo editor. Write a concise, evocative, grammatically complete 2–5 word title and 1 grounded factual visual caption (based strictly on visible scenery, activity, and time window—never invent fabricated feelings or dialogue) in English for each memory group.') +
        `\nClusters: ${JSON.stringify(compactSummaries)}`;

      const res = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clusterId: { type: Type.STRING },
                title: { type: Type.STRING },
                storyText: { type: Type.STRING },
              },
              required: ['clusterId', 'title', 'storyText'],
            },
          },
        },
      });
      const refined = JSON.parse((res.text ?? '[]').trim()) as Array<{
        clusterId: string;
        title: string;
        storyText: string;
      }>;
      const byId = new Map(refined.map((r) => [r.clusterId, r]));
      for (const prop of proposals) {
        const match = byId.get(prop.clusterId);
        if (match?.title) prop.title = ensureCompletePhrase(match.title, language);
        if (match?.storyText) prop.storyText = match.storyText.trim();
      }
    } catch {
      // Keep heuristic cluster titles cleanly
    }
  }

  return proposals;
}
