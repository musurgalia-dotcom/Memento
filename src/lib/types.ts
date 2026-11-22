import type { CalendarColorMode, DesignSpecification, ImageVisualAnalysis } from './artLibrary';

export type AppLanguage = 'en' | 'ru';
export type MemoryOrigin = 'automatic' | 'manual';

export interface UserPreferences {
  favoriteColors: string[];
  preferredTextures: string[];
  preferredLayouts: string[];
  preferredTypography: string;
  preferredFilmEffect: string;
  preferredAnimation: string;
  allowAdaptiveLearning: boolean;
  calendarColorMode: CalendarColorMode;
  uiLanguage?: AppLanguage;
  onboardingCompleted?: boolean;
  galleryConnected?: boolean;
  importedFingerprints?: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  bio: string;
  createdAt: string;
  isDemoAccount?: boolean;
  preferences: UserPreferences;
}

export interface MemoryPhotoRecord {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  imageAnalysis: ImageVisualAnalysis | null;
  createdAt: string;
}

export interface MemoryAnswerRecord {
  questionId: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface MemoryMusicRecord {
  mode: 'specific' | 'description' | 'custom' | 'none';
  queryOrMood?: string | null;
  trackTitle?: string | null;
  artist?: string | null;
  album?: string | null;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  externalUrl?: string | null;
  source?: string | null;
  musicProfile?: {
    tempoFeel: string;
    energy: number;
    mood: string;
  } | null;
}

export interface MemoryRecord {
  id: string;
  userId: string;
  memoryDate: string;
  title: string;
  storyText: string;
  language?: AppLanguage;
  origin?: MemoryOrigin;
  eventTimeLabel?: string;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
  isPresetDemo?: boolean;
  demoLabel?: string;
  photos: MemoryPhotoRecord[];
  answers: MemoryAnswerRecord[];
  music: MemoryMusicRecord | null;
  design: {
    collageUrl: string | null;
    designSpec: DesignSpecification;
    aiProviderUsed: string;
    updatedAt: string;
  } | null;
  video: {
    videoUrl: string | null;
    status: string;
    durationSec: number | null;
    mimeType: string | null;
    updatedAt?: string;
  };
}

export interface OnThisDayEntry {
  yearsAgo: number;
  memory: MemoryRecord;
}

export interface AutoYearAnalyzedItem {
  clientId: string;
  fingerprint: string;
  originalName: string;
  captureDate: string | null;
  captureTime?: string | null;
  captureMinutes?: number | null;
  dateSource: 'exif' | 'file-modified' | 'manual' | 'unknown';
  analysis: ImageVisualAnalysis;
}

export interface AutoYearClusterDraft {
  clusterId: string;
  title: string;
  memoryDate: string;
  dateUncertain: boolean;
  eventTimeLabel?: string;
  themeLabel: string;
  groupingReason: string;
  photoIds: string[];
  storyText: string;
  language: AppLanguage;
  music: MemoryMusicRecord | null;
  designSpec?: DesignSpecification;
  aiProviderUsed?: string;
  notice?: string;
  collagePreviewUrl?: string | null;
  savedMemoryId?: string | null;
}

export type AppRoute =
  | 'home'
  | 'calendar'
  | 'day'
  | 'create'
  | 'auto-year'
  | 'archive'
  | 'on-this-day'
  | 'profile'
  | 'settings'
  | 'memory';
