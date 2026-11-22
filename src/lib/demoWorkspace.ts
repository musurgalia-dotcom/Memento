import type {
  CollageStyleId,
  DesignSpecification,
  ImageVisualAnalysis,
  SmallDetailId,
} from './artLibrary';
import { DEMO_MEMORIES } from './demoMemories';
import type {
  AppLanguage,
  MemoryAnswerRecord,
  MemoryMusicRecord,
  MemoryRecord,
  OnThisDayEntry,
  UserPreferences,
  UserProfile,
} from './types';

const DEMO_STORAGE_KEY = 'memento_demo_workspace_v1';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  favoriteColors: [],
  preferredTextures: [],
  preferredLayouts: [],
  preferredTypography: 'editorial-serif',
  preferredFilmEffect: 'warm-kodak',
  preferredAnimation: 'gentle-drift',
  allowAdaptiveLearning: true,
  calendarColorMode: 'atmosphere',
  uiLanguage: 'en',
  onboardingCompleted: false,
  galleryConnected: false,
  importedFingerprints: [],
};

export interface DemoWorkspaceState {
  user: UserProfile;
  memories: MemoryRecord[];
}

function createInitialDemoWorkspace(): DemoWorkspaceState {
  const seededPresets = DEMO_MEMORIES.map((m) => ({
    ...m,
    isDemo: true,
    isPresetDemo: true,
  }));
  return {
    user: {
      id: 'local-demo-visitor',
      email: 'Local Browser Demo · Not a Cloud Account',
      name: 'Demo Explorer',
      bio: 'Testing MEMENTO locally in browser storage.',
      createdAt: new Date().toISOString(),
      isDemoAccount: true,
      preferences: { ...DEFAULT_USER_PREFERENCES },
    },
    memories: seededPresets,
  };
}

export function loadDemoWorkspace(): DemoWorkspaceState {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialDemoWorkspace();
      saveDemoWorkspace(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as DemoWorkspaceState;
    if (!parsed?.user || !Array.isArray(parsed?.memories)) {
      return createInitialDemoWorkspace();
    }
    return {
      user: {
        ...parsed.user,
        isDemoAccount: true,
        preferences: { ...DEFAULT_USER_PREFERENCES, ...(parsed.user.preferences || {}) },
      },
      memories: parsed.memories,
    };
  } catch {
    return createInitialDemoWorkspace();
  }
}

export function saveDemoWorkspace(state: DemoWorkspaceState): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    try {
      const trimmed = {
        ...state,
        memories: state.memories.map((m, idx) =>
          idx > 2 && m.design?.collageUrl?.startsWith('data:')
            ? { ...m, design: { ...m.design, collageUrl: null } }
            : m
        ),
      };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore if browser storage is disabled
    }
  }
}

export function resetDemoWorkspace(): DemoWorkspaceState {
  const fresh = createInitialDemoWorkspace();
  saveDemoWorkspace(fresh);
  return fresh;
}

export function computeDemoOnThisDay(memories: MemoryRecord[], dateStr?: string): OnThisDayEntry[] {
  const targetDateStr = dateStr || new Date().toISOString().slice(0, 10);
  const match = targetDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const targetYear = match ? Number(match[1]) : new Date().getFullYear();
  const monthDay = match ? `${match[2]}-${match[3]}` : new Date().toISOString().slice(5, 10);

  return memories
    .filter((m) => {
      const y = Number(m.memoryDate.slice(0, 4));
      return m.memoryDate.slice(5, 10) === monthDay && y < targetYear;
    })
    .map((m) => ({
      yearsAgo: targetYear - Number(m.memoryDate.slice(0, 4)),
      memory: m,
    }));
}

export async function fileToCompactDataUrl(file: File, maxDim = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

const CLIENT_DANGLING_WORDS = new Set([
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
  'в',
  'на',
  'у',
  'и',
  'с',
  'по',
  'из',
  'к',
  'о',
  'от',
  'без',
  'для',
]);

export function sanitizeCompleteTitleClient(raw: string | undefined, language: AppLanguage): string {
  const fallback = language === 'ru' ? 'Сохранённое мгновение' : 'Preserved Moment';
  if (!raw) return fallback;
  let cleaned = raw.replace(/\s+/g, ' ').replace(/[.…,;:\-—]+$/, '').trim();
  if (!cleaned) return fallback;
  if (cleaned.length > 56) {
    const clause = cleaned.split(/[.;!?—]+/)[0]?.trim();
    cleaned = clause && clause.length >= 6 && clause.length <= 60 ? clause : cleaned.slice(0, 56);
  }
  const words = cleaned.split(/\s+/);
  while (words.length > 1 && CLIENT_DANGLING_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  const out = words.join(' ').trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : fallback;
}

export function buildLocalClientFallbackSpec(params: {
  memoryDate: string;
  storyText: string;
  answers: MemoryAnswerRecord[];
  music: MemoryMusicRecord | null;
  memoryLanguage?: AppLanguage;
}): { imageAnalyses: ImageVisualAnalysis[]; designSpec: DesignSpecification; aiProviderUsed: string } {
  const lang: AppLanguage = params.memoryLanguage === 'ru' ? 'ru' : 'en';
  const answerMap = new Map(params.answers.map((a) => [a.questionId, a.answer]));
  const mood = answerMap.get('mood_emotions') || (lang === 'ru' ? 'личное воспоминание' : 'personal reflection');
  const colorRaw = answerMap.get('associated_color') || '#5D8AA8';
  const hexMatch = colorRaw.match(/#[0-9a-fA-F]{6}/);
  const chosenHex = hexMatch ? hexMatch[0].toUpperCase() : '#5D8AA8';
  const rawTitle =
    answerMap.get('detail_remember') || answerMap.get('reminds_of')?.split(',')[0]?.trim() || mood;
  const titleSeed = sanitizeCompleteTitleClient(rawTitle, lang);

  const combinedLower = [
    mood,
    params.storyText,
    answerMap.get('smell') || '',
    answerMap.get('weather') || '',
    answerMap.get('sounds') || '',
    answerMap.get('reminds_of') || '',
    answerMap.get('detail_remember') || '',
    params.music?.queryOrMood || '',
  ]
    .join(' ')
    .toLowerCase();

  let collageStyle: CollageStyleId = 'handmade-scrapbook';
  const details: SmallDetailId[] = ['torn-colored-paper', 'folded-note', 'handwritten-edge-word'];
  if (/(sea|ocean|beach|sand|waves|мор|пляж|волн|песок)/.test(combinedLower)) {
    collageStyle = 'dreamy-collage';
    details.push('seashell-sketch', 'wave-ripples', 'sun-doodle', 'translucent-vellum', 'washi-tape');
  } else if (/(flower|garden|forest|meadow|herbarium|цвет|сад|луг|лес)/.test(combinedLower)) {
    collageStyle = 'nature-herbarium';
    details.push('pressed-flower', 'pressed-leaf', 'tiny-branch', 'translucent-vellum', 'date-stamp');
  } else if (/(autumn|coffee|cafe|maple|tea|осен|кофе|кофейн|лист)/.test(combinedLower)) {
    collageStyle = 'handmade-scrapbook';
    details.push('pressed-leaf', 'coffee-ring-mark', 'receipt-fragment', 'paper-clip', 'stitched-thread');
  } else if (/(birthday|party|candle|friends|праздн|свеч|вечерин|друз)/.test(combinedLower)) {
    collageStyle = 'playful-cutout';
    details.push('candle-doodle', 'confetti-scraps', 'camera-doodle', 'tiny-stars', 'washi-tape');
  } else if (/(rain|night|city|tram|street|дожд|ноч|город|трамва)/.test(combinedLower)) {
    collageStyle = 'cinematic-journal';
    details.push('rain-streaks', 'umbrella-doodle', 'ticket-stub', 'film-strip-mini', 'city-map-fragment');
  } else {
    collageStyle = 'mixed-media-journal';
    details.push('washi-tape', 'paper-clip', 'postmark-seal', 'pencil-marks', 'translucent-vellum');
  }

  return {
    aiProviderUsed: 'browser-fallback',
    imageAnalyses: [
      {
        dominantColors: [chosenHex, '#C8B9A6', '#4A5568'],
        secondaryColors: ['#E6DDD0'],
        lighting: lang === 'ru' ? 'Естественный свет кадра' : 'Preserved photographic exposure',
        composition: lang === 'ru' ? 'Многослойная композиция скрапбука' : 'Layered scrapbook focal framing',
        visibleObjects: [lang === 'ru' ? 'Загруженная фотография' : 'Uploaded photograph'],
        scenery: lang === 'ru' ? 'Личный снимок' : 'Personal photograph',
        visualTextures: [lang === 'ru' ? 'Живая фактура фотографии' : 'Natural photographic detail'],
        photographicCharacteristics:
          lang === 'ru' ? 'Обработано локально в браузере' : 'Processed locally in browser demo mode',
        brightnessScore: 0.55,
        saturationScore: 0.45,
        provider: 'local-pixel-quantizer',
      },
    ],
    designSpec: {
      generatedTitle: titleSeed,
      moodSummary:
        lang === 'ru' ? `Собрано вокруг настроения: ${mood}.` : `Shaped locally around ${mood}.`,
      atmosphereKeywords: [mood.split(',')[0].trim() || (lang === 'ru' ? 'личное' : 'personal'), 'memento'],
      calendarMoodCategory: 'nostalgic',
      palette: {
        background: '#F6F2EA',
        surface: '#FCF9F3',
        primaryAccent: chosenHex,
        secondaryAccent: '#B96B4B',
        ink: '#1E1B18',
        mutedInk: '#645D53',
        extractedFromPhoto: [chosenHex, '#C8B9A6', '#4A5568'],
        chosenByUser: chosenHex,
      },
      layoutId: 'scrapbook-layers',
      paperTexture: 'warm-cotton',
      filmEffect: 'warm-kodak',
      frameStyle: 'torn-paper',
      typography: 'editorial-serif',
      decorativeMotifs: ['masking-tape', 'postmark-seal'],
      animationStyle: 'gentle-drift',
      animationSpeedMultiplier: 1.0,
      musicInfluenceNote:
        lang === 'ru'
          ? params.music?.trackTitle
            ? `Звучит трек «${params.music.trackTitle}».`
            : params.music?.queryOrMood
            ? `Музыкальная атмосфера: «${params.music.queryOrMood}».`
            : 'Спокойный неторопливый ритм.'
          : params.music?.trackTitle
          ? `Accompanied by ${params.music.trackTitle}.`
          : params.music?.queryOrMood
          ? `Mood guided by "${params.music.queryOrMood}".`
          : 'Gentle unhurried pace.',
      scrapbookPlan: {
        collageStyle,
        focalStrategy:
          lang === 'ru'
            ? 'Асимметричная вклейка главного кадра с живым наклоном и многослойной подложкой.'
            : 'Asymmetrical hero cutout layered over torn colored paper scraps and vellum.',
        layeringStrategy:
          lang === 'ru'
            ? 'Цветные обрывки бумаги и калька на заднем плане, вырезанные кадры в центре и записка со скрепкой.'
            : 'Torn paper backing, cut-out photographic layer, tucked details, and pinned diary note.',
        backgroundMaterial: lang === 'ru' ? 'тёплая хлопковая бумага' : 'warm cotton paper',
        mainPhotoPlacement: 'left-anchor',
        secondaryPhotoArrangement: 'overlapping-cluster',
        lightingMood: lang === 'ru' ? 'Мягкий дневной свет' : 'Soft warm daylight',
        decorationDensity: 'balanced',
        negativeSpaceNote:
          lang === 'ru'
            ? 'Воздушное правое поле уравновешивает плотность коллажа.'
            : 'Open right-hand margin lets overlapping cutouts and sketches breathe.',
        typographyPlacement: 'split-column',
        artisticTechniques: ['watercolor-wash', 'torn-collage'],
        visualBalanceNote:
          lang === 'ru'
            ? 'Композиция собрана локально по вашим ответам.'
            : 'Composed in Local Demo Mode using your personal answers.',
        selectedDetails: details.slice(0, 7),
        handwrittenEdgeWord: lang === 'ru' ? 'в моей памяти' : 'kept in focus',
      },
      explainability:
        lang === 'ru'
          ? {
              paletteReason: `Основана на выбранном вами оттенке (${chosenHex}).`,
              layoutReason: 'Многослойный скрапбук выделяет фотографию и личные заметки.',
              textureAndFilmReason: 'Тёплая хлопковая бумага с мягким плёночным цветом.',
              typographyAndMotifReason: 'Журнальная типографика, скотч и архивная печать.',
              animationReason: 'Плавное течение композиции.',
              profileBalanceNote: 'Создано в локальном демо-режиме.',
            }
          : {
              paletteReason: `Anchored on your selected color (${chosenHex}).`,
              layoutReason: 'Layered scrapbook layout highlights your photograph and personal notes.',
              textureAndFilmReason: 'Warm cotton paper with Kodak-inspired warmth.',
              typographyAndMotifReason: 'Editorial serif typography paired with archival tape and seal.',
              animationReason: 'Gentle drift motion.',
              profileBalanceNote: 'Local Demo Mode composition.',
            },
    },
  };
}

