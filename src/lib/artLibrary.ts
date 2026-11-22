export type LayoutId =
  | 'editorial-spread'
  | 'polaroid-cluster'
  | 'filmstrip-diary'
  | 'minimal-gallery'
  | 'scrapbook-layers'
  | 'botanical-folio'
  | 'night-cinematic-zine'
  | 'watercolor-journal';

export type PaperTextureId =
  | 'warm-cotton'
  | 'linen-archival'
  | 'rain-washed'
  | 'aged-vellum'
  | 'charcoal-matte'
  | 'sand-textured'
  | 'frost-paper';

export type FilmEffectId =
  | 'warm-kodak'
  | 'faded-polaroid'
  | 'cool-cinestill'
  | 'soft-matte'
  | 'clean-archival';

export type FrameStyleId =
  | 'classic-polaroid'
  | 'deckled-paper'
  | 'torn-paper'
  | 'thin-gallery-rule'
  | 'contact-sheet'
  | 'taped-snapshot'
  | 'arch-cutout'
  | 'oval-cutout';

export type TypographyPairId =
  | 'editorial-serif'
  | 'poetic-italic'
  | 'modern-archival'
  | 'intimate-journal';

export type TypographyPlacementId =
  | 'top-editorial'
  | 'vertical-spine'
  | 'split-column'
  | 'floating-card'
  | 'bottom-atelier';

export type ArtisticTechniqueId =
  | 'watercolor-wash'
  | 'torn-collage'
  | 'halftone-newsprint'
  | 'linen-fibers'
  | 'ink-sketches'
  | 'stamped-postmark'
  | 'film-sprockets'
  | 'light-leak';

export type DecorativeMotifId =
  | 'autumn-leaves'
  | 'pressed-botanical'
  | 'seashells'
  | 'wave-contour'
  | 'snowflakes'
  | 'raindrop-streaks'
  | 'vintage-ticket'
  | 'clouds'
  | 'star-constellation'
  | 'sunburst-stamp'
  | 'sunlight-wash'
  | 'postmark-seal'
  | 'masking-tape'
  | 'film-strip'
  | 'minimal-hairline';

export type AnimationStyleId =
  | 'gentle-drift'
  | 'sunlit-breeze'
  | 'rainy-stillness'
  | 'kinetic-pulse'
  | 'nostalgic-reel';

export type CalendarColorMode = 'atmosphere' | 'palette' | 'monochrome';
export type CalendarMoodCategory = 'calm' | 'happy' | 'nostalgic' | 'night' | 'neutral';

export type CollageStyleId =
  | 'handmade-scrapbook'
  | 'mixed-media-journal'
  | 'editorial-art'
  | 'vintage-archive'
  | 'dreamy-collage'
  | 'playful-cutout'
  | 'cinematic-journal'
  | 'nature-herbarium'
  | 'contemporary-art';

export type SmallDetailId =
  | 'torn-colored-paper'
  | 'washi-tape'
  | 'paper-clip'
  | 'photo-corners'
  | 'folded-note'
  | 'envelope-scrap'
  | 'stitched-thread'
  | 'translucent-vellum'
  | 'fabric-swatch'
  | 'ticket-stub'
  | 'receipt-fragment'
  | 'date-stamp'
  | 'postmark-seal'
  | 'film-strip-mini'
  | 'city-map-fragment'
  | 'handwritten-edge-word'
  | 'pressed-flower'
  | 'pressed-leaf'
  | 'tiny-branch'
  | 'seashell-sketch'
  | 'wave-ripples'
  | 'sun-doodle'
  | 'rain-streaks'
  | 'umbrella-doodle'
  | 'camera-doodle'
  | 'candle-doodle'
  | 'confetti-scraps'
  | 'tiny-stars'
  | 'coffee-ring-mark'
  | 'pencil-marks'
  | 'ink-sketch-object';

export interface ScrapbookPlan {
  collageStyle?: CollageStyleId;
  focalStrategy?: string;
  layeringStrategy?: string;
  backgroundMaterial: string;
  mainPhotoPlacement: 'left-anchor' | 'center-folio' | 'upper-editorial' | 'offset-right';
  secondaryPhotoArrangement: 'overlapping-cluster' | 'tucked-corners' | 'filmstrip-rail' | 'minimal-stack';
  lightingMood: string;
  decorationDensity: 'minimal' | 'balanced' | 'layered';
  visualBalanceNote: string;
  negativeSpaceNote?: string;
  ticketStubText?: string;
  typographyPlacement?: TypographyPlacementId;
  artisticTechniques?: ArtisticTechniqueId[];
  decorativeAccentLine?: string;
  selectedDetails?: SmallDetailId[];
  handwrittenEdgeWord?: string;
  sketchSubject?: string;
  locationOrLabelText?: string;
}

export interface ImageVisualAnalysis {
  dominantColors: string[];
  secondaryColors: string[];
  lighting: string;
  composition: string;
  visibleObjects: string[];
  scenery: string;
  visualTextures: string[];
  photographicCharacteristics: string;
  brightnessScore: number;
  saturationScore: number;
  sceneCategory?: string;
  activity?: string;
  timeOfDay?: string;
  peopleCount?: number;
  provider: 'gemini-4-hydrogen' | 'local-pixel-quantizer';
  notice?: string;
}

export interface DesignSpecification {
  generatedTitle: string;
  moodSummary: string;
  atmosphereKeywords: string[];
  calendarMoodCategory?: CalendarMoodCategory;
  calendarMarkerColor?: string;
  palette: {
    background: string;
    surface: string;
    primaryAccent: string;
    secondaryAccent: string;
    ink: string;
    mutedInk: string;
    extractedFromPhoto: string[];
    chosenByUser: string;
  };
  layoutId: LayoutId;
  paperTexture: PaperTextureId;
  filmEffect: FilmEffectId;
  frameStyle: FrameStyleId;
  typography: TypographyPairId;
  decorativeMotifs: DecorativeMotifId[];
  animationStyle: AnimationStyleId;
  animationSpeedMultiplier: number;
  musicInfluenceNote: string;
  scrapbookPlan?: ScrapbookPlan;
  explainability: {
    paletteReason: string;
    layoutReason: string;
    textureAndFilmReason: string;
    typographyAndMotifReason: string;
    animationReason: string;
    profileBalanceNote: string;
  };
}

export interface MemoryQuestionDef {
  id: string;
  stepLabel: string;
  stepLabelRu: string;
  question: string;
  questionRu: string;
  promptHint: string;
  promptHintRu: string;
  multiSelect?: boolean;
  isColorQuestion?: boolean;
  isMusicQuestion?: boolean;
  suggestions: string[];
  suggestionsRu: string[];
  adaptiveSuggestions?: Record<string, string[]>;
  adaptiveSuggestionsRu?: Record<string, string[]>;
}

export const MEMORY_QUESTIONS: MemoryQuestionDef[] = [
  {
    id: 'reminds_of',
    stepLabel: '01 · Association',
    stepLabelRu: '01 · Ассоциация',
    question: 'What does this photograph remind you of?',
    questionRu: 'Что вам напоминает эта фотография?',
    promptHint: 'A season, a chapter of your life, a familiar place, or a recurring feeling.',
    promptHintRu: 'Время года, глава жизни, знакомое место или повторяющееся чувство.',
    multiSelect: true,
    suggestions: [
      'Warm summer evenings',
      'Childhood summers',
      'Old friendships',
      'A quiet escape',
      'First travels',
      'Sunday mornings',
      'Late city walks',
    ],
    suggestionsRu: [
      'Тёплые летние вечера',
      'Лето из детства',
      'Старая дружба',
      'Тихое уединение',
      'Первые путешествия',
      'Воскресные утра',
      'Поздние прогулки по городу',
    ],
  },
  {
    id: 'associated_color',
    stepLabel: '02 · Color Memory',
    stepLabelRu: '02 · Цвет памяти',
    question: 'Which color do you associate with this photograph?',
    questionRu: 'Какой цвет у вас ассоциируется с этим снимком?',
    promptHint: 'Not necessarily the brightest pixel—choose the color that feels true to your memory.',
    promptHintRu: 'Не обязательно самый яркий пиксель — выберите оттенок, который откликается внутри.',
    isColorQuestion: true,
    suggestions: [
      'Sea Blue (#5D8AA8)',
      'Warm Sand (#D9C7AD)',
      'Burnt Amber (#B96B4B)',
      'Forest Sage (#5C7361)',
      'Slate Midnight (#3A4B73)',
      'Honey Gold (#D8A24A)',
      'Soft Rose (#C97B84)',
      'Warm Charcoal (#33363B)',
    ],
    suggestionsRu: [
      'Морская синева (#5D8AA8)',
      'Тёплый песок (#D9C7AD)',
      'Жжёный янтарь (#B96B4B)',
      'Лесной шалфей (#5C7361)',
      'Полуночный сланец (#3A4B73)',
      'Медовое золото (#D8A24A)',
      'Нежная роза (#C97B84)',
      'Тёплый графит (#33363B)',
    ],
  },
  {
    id: 'mood_emotions',
    stepLabel: '03 · Emotion',
    stepLabelRu: '03 · Эмоция',
    question: 'What mood or emotions does this moment bring back?',
    questionRu: 'Какое настроение или чувства возвращает этот момент?',
    promptHint: 'Select one or several feelings, or write your own.',
    promptHintRu: 'Выберите одно или несколько чувств, либо напишите своими словами.',
    multiSelect: true,
    suggestions: [
      'Nostalgia',
      'Happiness',
      'Freedom',
      'Peace',
      'Excitement',
      'Gentle melancholy',
      'Gratitude',
      'Tenderness',
    ],
    suggestionsRu: [
      'Ностальгия',
      'Счастье',
      'Свобода',
      'Покой',
      'Предвкушение',
      'Тихая светлая грусть',
      'Благодарность',
      'Нежность',
    ],
  },
  {
    id: 'smell',
    stepLabel: '04 · Scent',
    stepLabelRu: '04 · Запах',
    question: 'What smell do you remember?',
    questionRu: 'Какой запах вам запомнился?',
    promptHint: 'Scent is often the strongest anchor of memory.',
    promptHintRu: 'Аромат часто хранит память сильнее изображения.',
    multiSelect: true,
    suggestions: [
      'Sea air',
      'Rain',
      'Fresh grass',
      'Flowers',
      'Coffee',
      'Warm pine & cedar',
      'Fresh baked bread',
      'Wet asphalt',
    ],
    suggestionsRu: [
      'Морской воздух',
      'Дождь',
      'Свежая трава',
      'Цветы',
      'Кофе',
      'Тёплая хвоя и кедр',
      'Свежая выпечка',
      'Мокрый асфальт',
    ],
    adaptiveSuggestions: {
      Freedom: ['Sea air', 'Warm pine & cedar', 'Fresh grass'],
      Nostalgia: ['Coffee', 'Old books & paper', 'Autumn leaves'],
      Peace: ['Rain', 'Flowers', 'Warm tea'],
    },
    adaptiveSuggestionsRu: {
      Свобода: ['Морской воздух', 'Тёплая хвоя и кедр', 'Свежая трава'],
      Ностальгия: ['Кофе', 'Старые книги и бумага', 'Осенние листья'],
      Покой: ['Дождь', 'Цветы', 'Тёплый чай'],
    },
  },
  {
    id: 'weather',
    stepLabel: '05 · Atmosphere',
    stepLabelRu: '05 · Погода и свет',
    question: 'What was the weather like?',
    questionRu: 'Какой была погода в тот момент?',
    promptHint: 'Light, temperature, wind, or sky.',
    promptHintRu: 'Свет, температура воздуха, ветер или состояние неба.',
    suggestions: [
      'Warm summer evenings',
      'Bright golden sun',
      'Steady evening rain',
      'Crisp autumn breeze',
      'Quiet snowfall & frost',
      'Soft overcast light',
      'Cool night air',
    ],
    suggestionsRu: [
      'Тёплый летний вечер',
      'Яркое золотое солнце',
      'Тихий вечерний дождь',
      'Свежий осенний ветер',
      'Спокойный снегопад и мороз',
      'Мягкий рассеянный свет',
      'Прохладный ночной воздух',
    ],
  },
  {
    id: 'sounds',
    stepLabel: '06 · Soundscape',
    stepLabelRu: '06 · Звуки',
    question: 'What sounds do you remember?',
    questionRu: 'Какие звуки остались в памяти?',
    promptHint: 'Voices, water, traffic, silence, or wind.',
    promptHintRu: 'Голоса, вода, шум улицы, тишина или шелест ветра.',
    multiSelect: true,
    suggestions: [
      'Gentle waves',
      'Rain on glass',
      'Shared laughter',
      'Distant city hum',
      'Leaves in the wind',
      'Quiet stillness',
      'Clinking cups',
    ],
    suggestionsRu: [
      'Мягкий шум волн',
      'Дождь по стеклу',
      'Общий смех',
      'Далёкий гул города',
      'Листья на ветру',
      'Глубокая тишина',
      'Звон чашек',
    ],
    adaptiveSuggestions: {
      'Sea air': ['Gentle waves', 'Distant gulls', 'Wind in coastal grass'],
      Rain: ['Rain on glass', 'Distant thunder', 'Footsteps on wet stone'],
      Coffee: ['Clinking cups', 'Quiet conversation', 'Soft acoustic background'],
    },
    adaptiveSuggestionsRu: {
      'Морской воздух': ['Мягкий шум волн', 'Крики чаек вдалеке', 'Ветер в прибрежной траве'],
      Дождь: ['Дождь по стеклу', 'Далёкий гром', 'Шаги по мокрому камню'],
      Кофе: ['Звон чашек', 'Тихий разговор', 'Мягкая акустика на фоне'],
    },
  },
  {
    id: 'music_step',
    stepLabel: '07 · Soundtrack',
    stepLabelRu: '07 · Музыка',
    question: 'What music or song do you associate with this moment?',
    questionRu: 'Какая песня или музыка связана с этим моментом?',
    promptHint: 'Search for a specific song, describe a musical mood, or attach your own link.',
    promptHintRu: 'Найдите конкретный трек, опишите настроение музыки или прикрепите свою ссылку.',
    isMusicQuestion: true,
    suggestions: ['Dreamy', 'Nostalgic', 'Calm', 'Energetic', 'Romantic', 'Melancholic', 'Cheerful'],
    suggestionsRu: ['Мечтательная', 'Ностальгическая', 'Спокойная', 'Энергичная', 'Романтичная', 'Меланхоличная', 'Солнечная'],
  },
  {
    id: 'who_with',
    stepLabel: '08 · Company',
    stepLabelRu: '08 · Рядом',
    question: 'Who were you with?',
    questionRu: 'С кем вы были рядом?',
    promptHint: 'Friends, family, a partner, or solitude.',
    promptHintRu: 'Друзья, семья, любимый человек или наедине с собой.',
    suggestions: ['Close friends', 'Family', 'Someone I love', 'Just myself', 'A small crowd'],
    suggestionsRu: ['Близкие друзья', 'Семья', 'Любимый человек', 'Наедине с собой', 'Небольшая компания'],
  },
  {
    id: 'detail_remember',
    stepLabel: '09 · Small Detail',
    stepLabelRu: '09 · Маленькая деталь',
    question: 'What detail do you want to remember most?',
    questionRu: 'Какую деталь вы хотите запомнить сильнее всего?',
    promptHint: 'A fleeting gesture, a reflection, a phrase someone said, or the warmth of the light.',
    promptHintRu: 'Мимолётный жест, отражение, чья-то фраза или тепло уходящего света.',
    suggestions: [
      'The way the light fell',
      'How unhurried time felt',
      'A joke right before the shutter',
      'The chill in the air',
    ],
    suggestionsRu: [
      'Как падал свет на лица и стены',
      'Ощущение, что время никуда не спешит',
      'Шутка за секунду до нажатия затвора',
      'Прохлада в воздухе к закату',
    ],
  },
  {
    id: 'why_special',
    stepLabel: '10 · Meaning',
    stepLabelRu: '10 · Смысл',
    question: 'Why was this moment special to you?',
    questionRu: 'Почему этот момент стал для вас особенным?',
    promptHint: 'What made this ordinary day worth keeping forever?',
    promptHintRu: 'Что сделало этот день достойным того, чтобы сохранить его навсегда?',
    suggestions: [
      'Nothing was rushed',
      'Everything felt alive',
      'It marked a quiet turning point',
      'We were completely present',
    ],
    suggestionsRu: [
      'Никто никуда не спешил',
      'Всё вокруг казалось по-настоящему живым',
      'Это стало тихой точкой перемен',
      'Мы были целиком в этом мгновении',
    ],
  },
];

export const TYPOGRAPHY_PAIRS: Record<
  TypographyPairId,
  { headingFont: string; bodyFont: string; noteFont: string; label: string; labelRu: string }
> = {
  'editorial-serif': {
    headingFont: '"Cormorant Garamond", Georgia, serif',
    bodyFont: '"Manrope", system-ui, sans-serif',
    noteFont: '"Caveat", "Bad Script", cursive',
    label: 'Editorial Magazine Serif',
    labelRu: 'Журнальная антиква',
  },
  'poetic-italic': {
    headingFont: '"Playfair Display", Georgia, serif',
    bodyFont: '"Manrope", system-ui, sans-serif',
    noteFont: '"Caveat", "Bad Script", cursive',
    label: 'Poetic Diary Italic',
    labelRu: 'Поэтический дневник',
  },
  'modern-archival': {
    headingFont: '"Cormorant Garamond", Georgia, serif',
    bodyFont: '"Lora", Georgia, serif',
    noteFont: '"Caveat", "Bad Script", cursive',
    label: 'Archival Monograph',
    labelRu: 'Архивная монография',
  },
  'intimate-journal': {
    headingFont: '"Lora", Georgia, serif',
    bodyFont: '"Manrope", system-ui, sans-serif',
    noteFont: '"Caveat", "Bad Script", cursive',
    label: 'Intimate Written Journal',
    labelRu: 'Камерный рукописный журнал',
  },
};

export const FILM_FILTERS: Record<
  FilmEffectId,
  { label: string; labelRu: string; cssFilter: string; vignetteOpacity: number; grainOpacity: number; warmthTint: string }
> = {
  'warm-kodak': {
    label: 'Warm Kodak 400',
    labelRu: 'Тёплая плёнка Kodak 400',
    cssFilter: 'contrast(1.04) saturate(1.1) sepia(0.08)',
    vignetteOpacity: 0.14,
    grainOpacity: 0.08,
    warmthTint: 'rgba(232, 175, 108, 0.09)',
  },
  'faded-polaroid': {
    label: 'Faded Polaroid',
    labelRu: 'Выцветший полароид',
    cssFilter: 'contrast(0.94) saturate(0.88) brightness(1.04) sepia(0.14)',
    vignetteOpacity: 0.18,
    grainOpacity: 0.1,
    warmthTint: 'rgba(220, 200, 170, 0.1)',
  },
  'cool-cinestill': {
    label: 'Cool CineStill 800T',
    labelRu: 'Холодный CineStill 800T',
    cssFilter: 'contrast(1.08) saturate(0.92) hue-rotate(-6deg)',
    vignetteOpacity: 0.24,
    grainOpacity: 0.11,
    warmthTint: 'rgba(72, 118, 158, 0.12)',
  },
  'soft-matte': {
    label: 'Soft Archival Matte',
    labelRu: 'Мягкая матовая печать',
    cssFilter: 'contrast(0.92) brightness(1.03) saturate(0.9)',
    vignetteOpacity: 0.1,
    grainOpacity: 0.05,
    warmthTint: 'rgba(245, 240, 232, 0.06)',
  },
  'clean-archival': {
    label: 'Clean Natural Print',
    labelRu: 'Чистая естественная печать',
    cssFilter: 'contrast(1.02) saturate(1.0)',
    vignetteOpacity: 0.06,
    grainOpacity: 0.03,
    warmthTint: 'rgba(0, 0, 0, 0)',
  },
};

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  'editorial-spread': 'Editorial Spread',
  'polaroid-cluster': 'Polaroid Cluster',
  'filmstrip-diary': 'Filmstrip Diary',
  'minimal-gallery': 'Minimal Gallery',
  'scrapbook-layers': 'Scrapbook Layers',
  'botanical-folio': 'Botanical Herbarium Folio',
  'night-cinematic-zine': 'Nocturnal Editorial Zine',
  'watercolor-journal': 'Watercolor Atelier Page',
};

export const LAYOUT_LABELS_RU: Record<LayoutId, string> = {
  'editorial-spread': 'Журнальный разворот',
  'polaroid-cluster': 'Каскад полароидов',
  'filmstrip-diary': 'Плёночный дневник',
  'minimal-gallery': 'Минималистичная галерея',
  'scrapbook-layers': 'Многослойный скрапбук',
  'botanical-folio': 'Гербарий и бумага',
  'night-cinematic-zine': 'Ночной кинематографический зин',
  'watercolor-journal': 'Акварельная страница',
};

export const TEXTURE_LABELS: Record<PaperTextureId, string> = {
  'warm-cotton': 'Warm Cotton Paper',
  'linen-archival': 'Linen Archival Stock',
  'rain-washed': 'Rain-Washed Vellum',
  'aged-vellum': 'Aged Album Vellum',
  'charcoal-matte': 'Charcoal Matte Board',
  'sand-textured': 'Sunlit Sand Paper',
  'frost-paper': 'Winter Frost Cotton',
};

export const TEXTURE_LABELS_RU: Record<PaperTextureId, string> = {
  'warm-cotton': 'Тёплый хлопок',
  'linen-archival': 'Архивный лён',
  'rain-washed': 'Бумага после дождя',
  'aged-vellum': 'Состаренный веллум',
  'charcoal-matte': 'Матовый угольный картон',
  'sand-textured': 'Фактурный песчаник',
  'frost-paper': 'Зимняя морозная бумага',
};

export const ANIMATION_LABELS: Record<AnimationStyleId, string> = {
  'gentle-drift': 'Gentle Drift',
  'sunlit-breeze': 'Sunlit Breeze',
  'rainy-stillness': 'Rainy Stillness',
  'kinetic-pulse': 'Kinetic Pulse',
  'nostalgic-reel': 'Nostalgic Reel',
};

export const ANIMATION_LABELS_RU: Record<AnimationStyleId, string> = {
  'gentle-drift': 'Мягкое течение',
  'sunlit-breeze': 'Солнечный бриз',
  'rainy-stillness': 'Тишина дождя',
  'kinetic-pulse': 'Живой пульс',
  'nostalgic-reel': 'Ностальгическая плёнка',
};

export const CALENDAR_MOOD_COLORS: Record<
  CalendarMoodCategory,
  { fill: string; text: string; label: string; labelRu: string }
> = {
  calm: { fill: '#DCE6EA', text: '#243B46', label: 'Calm & Peaceful', labelRu: 'Спокойные' },
  happy: { fill: '#F0DEC0', text: '#4C3619', label: 'Warm & Joyful', labelRu: 'Тёплые и радостные' },
  nostalgic: { fill: '#E8DBD0', text: '#473327', label: 'Nostalgic & Sepia', labelRu: 'Ностальгические' },
  night: { fill: '#2D3542', text: '#F4F5F7', label: 'Evening & Nocturnal', labelRu: 'Вечерние и ночные' },
  neutral: { fill: '#E4E0D8', text: '#26231F', label: 'Quiet Neutral', labelRu: 'Сдержанные' },
};

export const COLLAGE_STYLE_LABELS: Record<CollageStyleId, string> = {
  'handmade-scrapbook': 'Handmade Scrapbook',
  'mixed-media-journal': 'Mixed-Media Art Journal',
  'editorial-art': 'Editorial Art Composition',
  'vintage-archive': 'Vintage Memory Archive',
  'dreamy-collage': 'Dreamy Layered Collage',
  'playful-cutout': 'Playful Cutout Collage',
  'cinematic-journal': 'Cinematic Photo Journal',
  'nature-herbarium': 'Botanical Herbarium Composition',
  'contemporary-art': 'Contemporary Art Scrapbook',
};

export const COLLAGE_STYLE_LABELS_RU: Record<CollageStyleId, string> = {
  'handmade-scrapbook': 'Ручной скрапбук',
  'mixed-media-journal': 'Арт-журнал в смешанной технике',
  'editorial-art': 'Журнальная арт-композиция',
  'vintage-archive': 'Винтажный архив памяти',
  'dreamy-collage': 'Воздушный полупрозрачный коллаж',
  'playful-cutout': 'Фигурные вырезки и коллаж',
  'cinematic-journal': 'Кинематографический фотодневник',
  'nature-herbarium': 'Природная композиция с гербарием',
  'contemporary-art': 'Современный арт-скрапбук',
};

export function localizeLayoutLabel(id: LayoutId, lang: 'en' | 'ru'): string {
  return lang === 'ru' ? LAYOUT_LABELS_RU[id] || id : LAYOUT_LABELS[id] || id;
}

export function localizeCollageStyleLabel(id: CollageStyleId, lang: 'en' | 'ru'): string {
  return lang === 'ru' ? COLLAGE_STYLE_LABELS_RU[id] || id : COLLAGE_STYLE_LABELS[id] || id;
}

export function localizeTextureLabel(id: PaperTextureId, lang: 'en' | 'ru'): string {
  return lang === 'ru' ? TEXTURE_LABELS_RU[id] || id : TEXTURE_LABELS[id] || id;
}

export function localizeAnimationLabel(id: AnimationStyleId, lang: 'en' | 'ru'): string {
  return lang === 'ru' ? ANIMATION_LABELS_RU[id] || id : ANIMATION_LABELS[id] || id;
}
