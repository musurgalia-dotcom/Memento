import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR || './private-storage');
fs.mkdirSync(STORAGE_ROOT, { recursive: true });

const DB_PATH = path.join(STORAGE_ROOT, 'memento.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    privacy_agree INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    favorite_colors_json TEXT NOT NULL DEFAULT '[]',
    preferred_textures_json TEXT NOT NULL DEFAULT '[]',
    preferred_layouts_json TEXT NOT NULL DEFAULT '[]',
    preferred_typography TEXT NOT NULL DEFAULT 'editorial-serif',
    preferred_film_effect TEXT NOT NULL DEFAULT 'warm-kodak',
    preferred_animation TEXT NOT NULL DEFAULT 'gentle-drift',
    allow_adaptive_learning INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_date TEXT NOT NULL,
    title TEXT NOT NULL,
    story_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date);

  CREATE TABLE IF NOT EXISTS memory_photos (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    file_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    image_analysis_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_photos_memory ON memory_photos(memory_id);

  CREATE TABLE IF NOT EXISTS memory_answers (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    UNIQUE(memory_id, question_id),
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memory_music (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL,
    query_or_mood TEXT,
    track_title TEXT,
    artist TEXT,
    album TEXT,
    artwork_url TEXT,
    preview_url TEXT,
    external_url TEXT,
    source TEXT,
    music_profile_json TEXT,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS generated_designs (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL UNIQUE,
    collage_file_key TEXT,
    design_spec_json TEXT NOT NULL,
    ai_provider_used TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS generated_videos (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL UNIQUE,
    video_file_key TEXT,
    status TEXT NOT NULL DEFAULT 'not_generated',
    duration_sec INTEGER,
    mime_type TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

// Safe additive migrations for existing SQLite databases
try {
  db.exec(`ALTER TABLE user_preferences ADD COLUMN calendar_color_mode TEXT NOT NULL DEFAULT 'atmosphere'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE user_preferences ADD COLUMN ui_language TEXT NOT NULL DEFAULT 'en'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE user_preferences ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE user_preferences ADD COLUMN gallery_connected INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE user_preferences ADD COLUMN imported_fingerprints_json TEXT NOT NULL DEFAULT '[]'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE memories ADD COLUMN language TEXT NOT NULL DEFAULT 'en'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE memories ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE memories ADD COLUMN event_time_label TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists
}

export interface DbUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  bio: string | null;
  privacy_agree: number;
  created_at: string;
  updated_at: string;
}

export interface DbPreferencesRow {
  user_id: string;
  favorite_colors_json: string;
  preferred_textures_json: string;
  preferred_layouts_json: string;
  preferred_typography: string;
  preferred_film_effect: string;
  preferred_animation: string;
  allow_adaptive_learning: number;
  calendar_color_mode?: string;
  ui_language?: string;
  onboarding_completed?: number;
  gallery_connected?: number;
  imported_fingerprints_json?: string;
  updated_at: string;
}

export function getUserPreferences(userId: string) {
  const row = db
    .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
    .get(userId) as DbPreferencesRow | undefined;

  if (!row) {
    return {
      favoriteColors: [] as string[],
      preferredTextures: [] as string[],
      preferredLayouts: [] as string[],
      preferredTypography: 'editorial-serif',
      preferredFilmEffect: 'warm-kodak',
      preferredAnimation: 'gentle-drift',
      allowAdaptiveLearning: true,
      calendarColorMode: 'atmosphere' as const,
      uiLanguage: 'en' as const,
      onboardingCompleted: false,
      galleryConnected: false,
      importedFingerprints: [] as string[],
    };
  }

  const colorMode =
    row.calendar_color_mode === 'palette' || row.calendar_color_mode === 'monochrome'
      ? row.calendar_color_mode
      : 'atmosphere';
  const uiLanguage = row.ui_language === 'ru' ? 'ru' : 'en';

  return {
    favoriteColors: safeJsonArray(row.favorite_colors_json),
    preferredTextures: safeJsonArray(row.preferred_textures_json),
    preferredLayouts: safeJsonArray(row.preferred_layouts_json),
    preferredTypography: row.preferred_typography,
    preferredFilmEffect: row.preferred_film_effect,
    preferredAnimation: row.preferred_animation,
    allowAdaptiveLearning: Boolean(row.allow_adaptive_learning),
    calendarColorMode: colorMode as 'atmosphere' | 'palette' | 'monochrome',
    uiLanguage: uiLanguage as 'en' | 'ru',
    onboardingCompleted: Boolean(row.onboarding_completed),
    galleryConnected: Boolean(row.gallery_connected),
    importedFingerprints: safeJsonArray(row.imported_fingerprints_json),
  };
}

export function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
