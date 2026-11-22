import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  clearSessionCookie,
  createPersistedSession,
  createResetToken,
  getSessionUser,
  hashPassword,
  hashResetToken,
  requireAuth,
  revokeSession,
  setSessionCookie,
  verifyCsrfOrigin,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  analyzePhotograph,
  clusterYearPhotos,
  generateMemoryDesignSpec,
  sanitizeDesignSpec,
} from './server/aiEngine.ts';
import { db, getUserPreferences, safeJsonArray, type DbUserRow } from './server/db.ts';
import { searchMusicCatalog } from './server/musicEngine.ts';
import {
  deleteMemoryDirectory,
  deleteUserDirectory,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  readPrivateFile,
  resolveSafeStoragePath,
  saveGeneratedArtifact,
  saveOriginalPhoto,
  validateUploadedImage,
} from './server/storage.ts';

const PORT = 3000;
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '16mb' }));

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 8 },
});

const uploadMediaBlob = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
});

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().email('Valid email is required').max(160),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  privacyAgree: z.boolean().refine((v) => v === true, 'Please acknowledge private archive handling.'),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function hydrateMemoryRow(memoryId: string, userId: string) {
  const mem = db
    .prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?')
    .get(memoryId, userId) as
    | {
        id: string;
        user_id: string;
        memory_date: string;
        title: string;
        story_text: string;
        language?: string;
        origin?: string;
        event_time_label?: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!mem) return null;

  const photos = db
    .prepare('SELECT * FROM memory_photos WHERE memory_id = ? AND user_id = ? ORDER BY sort_order ASC')
    .all(memoryId, userId) as Array<{
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    sort_order: number;
    image_analysis_json: string | null;
    created_at: string;
  }>;

  const answers = db
    .prepare('SELECT question_id, question, answer, tags_json FROM memory_answers WHERE memory_id = ?')
    .all(memoryId) as Array<{
    question_id: string;
    question: string;
    answer: string;
    tags_json: string;
  }>;

  const music = db
    .prepare('SELECT * FROM memory_music WHERE memory_id = ?')
    .get(memoryId) as
    | {
        mode: string;
        query_or_mood: string | null;
        track_title: string | null;
        artist: string | null;
        album: string | null;
        artwork_url: string | null;
        preview_url: string | null;
        external_url: string | null;
        source: string | null;
        music_profile_json: string | null;
      }
    | undefined;

  const design = db
    .prepare('SELECT * FROM generated_designs WHERE memory_id = ?')
    .get(memoryId) as
    | {
        collage_file_key: string | null;
        design_spec_json: string;
        ai_provider_used: string;
        updated_at: string;
      }
    | undefined;

  const video = db
    .prepare('SELECT * FROM generated_videos WHERE memory_id = ?')
    .get(memoryId) as
    | {
        video_file_key: string | null;
        status: string;
        duration_sec: number | null;
        mime_type: string | null;
        updated_at: string;
      }
    | undefined;

  return {
    id: mem.id,
    userId: mem.user_id,
    memoryDate: mem.memory_date,
    title: mem.title,
    storyText: mem.story_text,
    language: mem.language === 'ru' ? 'ru' : 'en',
    origin: mem.origin === 'automatic' ? 'automatic' : 'manual',
    eventTimeLabel: mem.event_time_label || '',
    createdAt: mem.created_at,
    updatedAt: mem.updated_at,
    photos: photos.map((p) => ({
      id: p.id,
      url: `/api/files/${mem.id}/${p.id}`,
      originalName: p.original_name,
      mimeType: p.mime_type,
      sizeBytes: p.size_bytes,
      sortOrder: p.sort_order,
      imageAnalysis: p.image_analysis_json ? JSON.parse(p.image_analysis_json) : null,
      createdAt: p.created_at,
    })),
    answers: answers.map((a) => ({
      questionId: a.question_id,
      question: a.question,
      answer: a.answer,
      tags: safeJsonArray(a.tags_json),
    })),
    music: music
      ? {
          mode: music.mode,
          queryOrMood: music.query_or_mood,
          trackTitle: music.track_title,
          artist: music.artist,
          album: music.album,
          artworkUrl: music.artwork_url,
          previewUrl: music.preview_url,
          externalUrl: music.external_url,
          source: music.source,
          musicProfile: music.music_profile_json ? JSON.parse(music.music_profile_json) : null,
        }
      : null,
    design: design
      ? {
          collageUrl: design.collage_file_key ? `/api/files/${mem.id}/collage?t=${encodeURIComponent(design.updated_at)}` : null,
          designSpec: JSON.parse(design.design_spec_json),
          aiProviderUsed: design.ai_provider_used,
          updatedAt: design.updated_at,
        }
      : null,
    video: video
      ? {
          videoUrl: video.video_file_key ? `/api/files/${mem.id}/video?t=${encodeURIComponent(video.updated_at)}` : null,
          status: video.status,
          durationSec: video.duration_sec,
          mimeType: video.mime_type,
          updatedAt: video.updated_at,
        }
      : { videoUrl: null, status: 'not_generated', durationSec: null, mimeType: null },
  };
}

// ---------- Health ----------
app.get('/api/health', (_req, res) => {
  const key = process.env.GEMINI_API_KEY?.trim();
  res.json({
    ok: true,
    aiConfigured: Boolean(key && key !== 'MY_GEMINI_API_KEY'),
  });
});

// ---------- Auth Routes ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration fields.' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.data.password);

    db.prepare(
      'INSERT INTO users (id, email, name, password_hash, bio, privacy_agree, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    ).run(userId, email, parsed.data.name, passwordHash, '', now, now);

    db.prepare(
      `INSERT INTO user_preferences (
        user_id, favorite_colors_json, preferred_textures_json, preferred_layouts_json,
        preferred_typography, preferred_film_effect, preferred_animation, allow_adaptive_learning, updated_at
      ) VALUES (?, '[]', '[]', '[]', 'editorial-serif', 'warm-kodak', 'gentle-drift', 1, ?)`
    ).run(userId, now);

    const token = createPersistedSession(userId);
    setSessionCookie(req, res, token);

    res.status(201).json({
      sessionToken: token,
      user: {
        id: userId,
        email,
        name: parsed.data.name,
        bio: '',
        createdAt: now,
        preferences: getUserPreferences(userId),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide a valid email and password.' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUserRow | undefined;
    if (!userRow || !(await verifyPassword(parsed.data.password, userRow.password_hash))) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const token = createPersistedSession(userRow.id);
    setSessionCookie(req, res, token);

    res.json({
      sessionToken: token,
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        bio: userRow.bio || '',
        createdAt: userRow.created_at,
        preferences: getUserPreferences(userRow.id),
      },
    });
  } catch {
    res.status(500).json({ error: 'Sign-in failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  revokeSession(req);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await getSessionUser(req);
  res.json({ user });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Please enter your account email.' });
    return;
  }

  const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!userRow) {
    // Do not leak email existence while remaining helpful
    res.json({
      ok: true,
      message: 'If an account matches that email, a password recovery token has been prepared.',
    });
    return;
  }

  const { raw, hash } = createResetToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(crypto.randomUUID(), userRow.id, hash, expiresAt, now);

  // Since no external SMTP server is configured in this local runtime, return a clear local recovery notice + token
  res.json({
    ok: true,
    deliveryMode: 'local-preview',
    recoveryToken: raw,
    message:
      'No external email SMTP service is configured in this environment. Use the recovery token shown below within 30 minutes to reset your password.',
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!rawToken || newPassword.length < 8) {
      res.status(400).json({ error: 'Valid recovery token and a new password (8+ chars) are required.' });
      return;
    }

    const tokenHash = hashResetToken(rawToken);
    const tokenRow = db
      .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = 0')
      .get(tokenHash) as
      | { id: string; user_id: string; expires_at: string }
      | undefined;

    if (!tokenRow || new Date(tokenRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Recovery token is invalid or has expired.' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, tokenRow.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);

    res.json({ ok: true, message: 'Your password has been updated. You can now sign in.' });
  } catch {
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// ---------- Profile & Settings ----------
app.get('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const stats = db
    .prepare('SELECT COUNT(*) as count FROM memories WHERE user_id = ?')
    .get(user.id) as { count: number };
  res.json({ user, memoryCount: stats.count });
});

app.put('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : user.name;
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim().slice(0, 400) : user.bio;
  const prefs = req.body?.preferences;
  const now = new Date().toISOString();

  if (name) {
    db.prepare('UPDATE users SET name = ?, bio = ?, updated_at = ? WHERE id = ?').run(name, bio, now, user.id);
  }

  if (prefs && typeof prefs === 'object') {
    const current = getUserPreferences(user.id);
    const nextColors = Array.isArray(prefs.favoriteColors) ? prefs.favoriteColors.slice(0, 10) : current.favoriteColors;
    const nextTextures = Array.isArray(prefs.preferredTextures)
      ? prefs.preferredTextures.slice(0, 6)
      : current.preferredTextures;
    const nextLayouts = Array.isArray(prefs.preferredLayouts)
      ? prefs.preferredLayouts.slice(0, 6)
      : current.preferredLayouts;
    const nextTypo = typeof prefs.preferredTypography === 'string' ? prefs.preferredTypography : current.preferredTypography;
    const nextFilm = typeof prefs.preferredFilmEffect === 'string' ? prefs.preferredFilmEffect : current.preferredFilmEffect;
    const nextAnim = typeof prefs.preferredAnimation === 'string' ? prefs.preferredAnimation : current.preferredAnimation;
    const nextAdaptive =
      typeof prefs.allowAdaptiveLearning === 'boolean' ? (prefs.allowAdaptiveLearning ? 1 : 0) : current.allowAdaptiveLearning ? 1 : 0;
    const nextCalendarMode =
      prefs.calendarColorMode === 'atmosphere' ||
      prefs.calendarColorMode === 'palette' ||
      prefs.calendarColorMode === 'monochrome'
        ? prefs.calendarColorMode
        : current.calendarColorMode;
    const nextUiLanguage =
      prefs.uiLanguage === 'ru' || prefs.uiLanguage === 'en' ? prefs.uiLanguage : current.uiLanguage;
    const nextOnboarding =
      typeof prefs.onboardingCompleted === 'boolean'
        ? prefs.onboardingCompleted
          ? 1
          : 0
        : current.onboardingCompleted
        ? 1
        : 0;
    const nextGalleryConnected =
      typeof prefs.galleryConnected === 'boolean'
        ? prefs.galleryConnected
          ? 1
          : 0
        : current.galleryConnected
        ? 1
        : 0;
    const nextFingerprints = Array.isArray(prefs.importedFingerprints)
      ? Array.from(new Set(prefs.importedFingerprints.map((x: unknown) => String(x)).filter(Boolean))).slice(-2000)
      : current.importedFingerprints;

    db.prepare(
      `UPDATE user_preferences SET
        favorite_colors_json = ?,
        preferred_textures_json = ?,
        preferred_layouts_json = ?,
        preferred_typography = ?,
        preferred_film_effect = ?,
        preferred_animation = ?,
        allow_adaptive_learning = ?,
        calendar_color_mode = ?,
        ui_language = ?,
        onboarding_completed = ?,
        gallery_connected = ?,
        imported_fingerprints_json = ?,
        updated_at = ?
      WHERE user_id = ?`
    ).run(
      JSON.stringify(nextColors),
      JSON.stringify(nextTextures),
      JSON.stringify(nextLayouts),
      nextTypo,
      nextFilm,
      nextAnim,
      nextAdaptive,
      nextCalendarMode,
      nextUiLanguage,
      nextOnboarding,
      nextGalleryConnected,
      JSON.stringify(nextFingerprints),
      now,
      user.id
    );
  }

  res.json({
    user: {
      ...user,
      name: name || user.name,
      bio,
      preferences: getUserPreferences(user.id),
    },
  });
});

app.post('/api/profile/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
  if (!(await verifyPassword(currentPassword, row.password_hash))) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    nextHash,
    new Date().toISOString(),
    user.id
  );
  res.json({ ok: true });
});

app.get('/api/profile/export', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const rows = db
    .prepare('SELECT id FROM memories WHERE user_id = ? ORDER BY memory_date DESC')
    .all(user.id) as Array<{ id: string }>;
  const memories = rows.map((r) => hydrateMemoryRow(r.id, user.id)).filter(Boolean);
  res.setHeader('Content-Disposition', `attachment; filename="memento-archive-${user.id.slice(0, 8)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), user: { name: user.name, email: user.email, bio: user.bio }, memories });
});

app.delete('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  const user = req.user!;
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  await deleteUserDirectory(user.id);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.delete('/api/gallery/disconnect', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  const user = req.user!;
  const autoRows = db
    .prepare(`SELECT id FROM memories WHERE user_id = ? AND origin = 'automatic'`)
    .all(user.id) as Array<{ id: string }>;

  db.prepare(`DELETE FROM memories WHERE user_id = ? AND origin = 'automatic'`).run(user.id);
  await Promise.all(autoRows.map((r) => deleteMemoryDirectory(user.id, r.id).catch(() => {})));

  db.prepare(
    `UPDATE user_preferences SET gallery_connected = 0, imported_fingerprints_json = '[]', updated_at = ? WHERE user_id = ?`
  ).run(new Date().toISOString(), user.id);

  res.json({
    ok: true,
    removedCount: autoRows.length,
    preferences: getUserPreferences(user.id),
  });
});

// ---------- Music Search (Available in both Signed-In Mode and Demo Mode) ----------
app.post('/api/music/search', async (req, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  try {
    const result = await searchMusicCatalog({
      mode: req.body?.mode || 'specific',
      query: String(req.body?.query || ''),
      customTitle: req.body?.customTitle,
      customArtist: req.body?.customArtist,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Music search failed.' });
  }
});

// ---------- AI Design Preview & Regeneration (Signed-In & Demo Mode) ----------
app.post('/api/memories/preview', uploadImages.array('photos', 8), async (req, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (files.length === 0) {
    res.status(400).json({ error: 'Please select at least one photograph.' });
    return;
  }
  try {
    for (const file of files) {
      validateUploadedImage({ mimetype: file.mimetype, size: file.size });
    }
    const sessionUser = await getSessionUser(req);
    const memoryDateRaw = String(req.body.memoryDate || new Date().toISOString().slice(0, 10));
    const memoryDate = /^\d{4}-\d{2}-\d{2}/.test(memoryDateRaw)
      ? memoryDateRaw.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const storyText = String(req.body.storyText || '').trim().slice(0, 4000);
    const memoryLanguage = req.body.memoryLanguage === 'ru' ? 'ru' : 'en';
    const answers = JSON.parse(String(req.body.answersJson || '[]'));
    const musicInput = req.body.musicJson ? JSON.parse(String(req.body.musicJson)) : null;
    const demoPrefs = req.body.userPreferencesJson ? JSON.parse(String(req.body.userPreferencesJson)) : null;

    const analyses = [];
    for (const file of files) {
      analyses.push(await analyzePhotograph(file.buffer, memoryLanguage));
    }

    const prefs = sessionUser ? getUserPreferences(sessionUser.id) : demoPrefs;
    const { designSpec, aiProviderUsed, notice } = await generateMemoryDesignSpec({
      imageAnalyses: analyses,
      questionnaire: {
        memoryDate,
        memoryLanguage,
        storyText,
        answers,
        music: musicInput,
        userPreferences: prefs,
      },
    });

    res.json({
      imageAnalyses: analyses,
      designSpec,
      aiProviderUsed,
      notice: notice || analyses.find((a) => a.notice)?.notice,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to generate memory preview.' });
  }
});

app.post('/api/memories/regenerate-spec', async (req, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  try {
    const sessionUser = await getSessionUser(req);
    const analyses = Array.isArray(req.body?.imageAnalyses) ? req.body.imageAnalyses : [];
    const memoryDate = String(req.body?.memoryDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const memoryLanguage = req.body?.memoryLanguage === 'ru' ? 'ru' : 'en';
    const storyText = String(req.body?.storyText || '').trim().slice(0, 4000);
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const music = req.body?.music || null;
    const prefs = sessionUser ? getUserPreferences(sessionUser.id) : req.body?.userPreferences || null;

    const synth = await generateMemoryDesignSpec({
      imageAnalyses: analyses,
      variationSeed: typeof req.body?.variationSeed === 'number' ? req.body.variationSeed : 1,
      questionnaire: {
        memoryDate,
        memoryLanguage,
        storyText,
        answers,
        music,
        userPreferences: prefs,
      },
    });
    res.json(synth);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not regenerate design.' });
  }
});

// ---------- Automatic Year Mode: Batch Analysis, Clustering & Per-Cluster Generation ----------
app.post('/api/auto-year/analyze-batch', async (req, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  try {
    const language = req.body?.language === 'ru' ? 'ru' : 'en';
    const rawItems = Array.isArray(req.body?.items) ? req.body.items.slice(0, 10) : [];
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'No batch items provided.' });
      return;
    }

    const results = await Promise.all(
      rawItems.map(async (item: { clientId?: string; base64DataUrl?: string }) => {
        const clientId = String(item?.clientId || '');
        try {
          const dataUrl = String(item?.base64DataUrl || '');
          const commaIdx = dataUrl.indexOf(',');
          const base64Part = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
          const buffer = Buffer.from(base64Part, 'base64');
          if (!buffer.byteLength) {
            return { clientId, ok: false, error: 'Empty thumbnail payload.' };
          }
          const analysis = await analyzePhotograph(buffer, language);
          return { clientId, ok: true, analysis };
        } catch (err) {
          return {
            clientId,
            ok: false,
            error: err instanceof Error ? err.message : 'Analysis failed.',
          };
        }
      })
    );

    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Batch analysis failed.' });
  }
});

app.post('/api/auto-year/cluster', async (req, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  try {
    const language = req.body?.language === 'ru' ? 'ru' : 'en';
    const photos = Array.isArray(req.body?.photos) ? req.body.photos : [];
    if (photos.length === 0) {
      res.status(400).json({ error: 'Please supply analyzed photos to cluster.' });
      return;
    }
    const clusters = await clusterYearPhotos({ photos, language });
    res.json({ clusters });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to cluster photos.' });
  }
});

app.post('/api/auto-year/generate-cluster', async (req, res) => {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  try {
    const sessionUser = await getSessionUser(req);
    const analyses = Array.isArray(req.body?.imageAnalyses) ? req.body.imageAnalyses : [];
    const memoryDate = String(req.body?.memoryDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const memoryLanguage = req.body?.memoryLanguage === 'ru' ? 'ru' : 'en';
    const storyText = String(req.body?.storyText || '').trim().slice(0, 4000);
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const music = req.body?.music || null;
    const prefs = sessionUser ? getUserPreferences(sessionUser.id) : req.body?.userPreferences || null;
    const variationSeed = typeof req.body?.variationSeed === 'number' ? req.body.variationSeed : 0;

    const synth = await generateMemoryDesignSpec({
      imageAnalyses: analyses,
      variationSeed,
      questionnaire: {
        memoryDate,
        memoryLanguage,
        storyText,
        answers,
        music,
        userPreferences: prefs,
      },
    });
    res.json(synth);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not generate cluster design.' });
  }
});

// ---------- Memories CRUD & AI Generation ----------
app.get('/api/memories', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const q = String(req.query.q || '').trim().toLowerCase();
  const year = String(req.query.year || '').trim();
  const month = String(req.query.month || '').trim();

  const rows = db
    .prepare('SELECT id FROM memories WHERE user_id = ? ORDER BY memory_date DESC, created_at DESC')
    .all(user.id) as Array<{ id: string }>;

  let memories = rows.map((r) => hydrateMemoryRow(r.id, user.id)).filter((m): m is NonNullable<typeof m> => Boolean(m));

  if (year) {
    memories = memories.filter((m) => m.memoryDate.startsWith(year));
  }
  if (month) {
    memories = memories.filter((m) => m.memoryDate.slice(5, 7) === month.padStart(2, '0'));
  }
  if (q) {
    memories = memories.filter((m) => {
      const hay = [
        m.title,
        m.storyText,
        m.music?.trackTitle || '',
        m.music?.artist || '',
        ...m.answers.map((a) => a.answer),
        ...(m.design?.designSpec?.atmosphereKeywords || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  res.json({ memories });
});

app.post(
  '/api/memories',
  requireAuth,
  uploadImages.array('photos', 8),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Please select at least one photograph.' });
      return;
    }

    const memoryId = crypto.randomUUID();

    try {
      for (const file of files) {
        validateUploadedImage({ mimetype: file.mimetype, size: file.size });
      }

      const memoryDateRaw = String(req.body.memoryDate || new Date().toISOString().slice(0, 10));
      const memoryDate = /^\d{4}-\d{2}-\d{2}/.test(memoryDateRaw)
        ? memoryDateRaw.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const memoryLanguage = req.body.memoryLanguage === 'ru' ? 'ru' : 'en';
      const origin = req.body.origin === 'automatic' ? 'automatic' : 'manual';
      const eventTimeLabel =
        typeof req.body.eventTimeLabel === 'string' ? req.body.eventTimeLabel.trim().slice(0, 60) : '';
      const customTitleInput = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 90) : '';
      const storyText = String(req.body.storyText || '').trim().slice(0, 4000);
      const answers = JSON.parse(String(req.body.answersJson || '[]')) as Array<{
        questionId: string;
        question: string;
        answer: string;
        tags?: string[];
      }>;
      const musicInput = req.body.musicJson ? JSON.parse(String(req.body.musicJson)) : null;

      const now = new Date().toISOString();

      const precomputedAnalyses = req.body.precomputedAnalysesJson
        ? (JSON.parse(String(req.body.precomputedAnalysesJson)) as Array<Awaited<ReturnType<typeof analyzePhotograph>>>)
        : null;
      const precomputedDesign = req.body.precomputedDesignJson
        ? JSON.parse(String(req.body.precomputedDesignJson))
        : null;
      const precomputedProvider =
        typeof req.body.aiProviderUsed === 'string' && req.body.aiProviderUsed.trim()
          ? req.body.aiProviderUsed.trim().slice(0, 60)
          : 'local-heuristic';

      // 1. Store original photos privately & run objective visual analysis (or reuse preview analyses)
      const analyses: Array<Awaited<ReturnType<typeof analyzePhotograph>>> = [];
      const savedPhotoRecords: Array<{
        id: string;
        fileKey: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        sortOrder: number;
        analysis: Awaited<ReturnType<typeof analyzePhotograph>>;
      }> = [];

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const fileKey = await saveOriginalPhoto({
          userId: user.id,
          memoryId,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        const analysis = precomputedAnalyses?.[idx] || (await analyzePhotograph(file.buffer, memoryLanguage));
        analyses.push(analysis);
        savedPhotoRecords.push({
          id: crypto.randomUUID(),
          fileKey,
          originalName: file.originalname || `photo-${idx + 1}.jpg`,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          sortOrder: idx,
          analysis,
        });
      }

      // 2. Synthesize personalized DesignSpecification (or sanitize approved preview spec)
      const prefs = getUserPreferences(user.id);
      let designSpec;
      let aiProviderUsed: string;
      let notice: string | undefined;

      if (precomputedDesign && typeof precomputedDesign === 'object') {
        designSpec = sanitizeDesignSpec(
          precomputedDesign,
          analyses[0]?.dominantColors || ['#C2B29F', '#6B7785'],
          memoryLanguage
        );
        aiProviderUsed = precomputedProvider;
      } else {
        const synth = await generateMemoryDesignSpec({
          imageAnalyses: analyses,
          questionnaire: {
            memoryDate,
            memoryLanguage,
            storyText,
            answers,
            music: musicInput,
            userPreferences: prefs,
          },
        });
        designSpec = synth.designSpec;
        aiProviderUsed = synth.aiProviderUsed;
        notice = synth.notice;
      }

      const title =
        customTitleInput || designSpec.generatedTitle || (memoryLanguage === 'ru' ? 'Сохранённое мгновение' : 'Preserved Moment');
      if (customTitleInput) {
        designSpec.generatedTitle = customTitleInput;
      }

      // 3. Persist atomically in SQLite
      db.prepare(
        'INSERT INTO memories (id, user_id, memory_date, title, story_text, language, origin, event_time_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(memoryId, user.id, memoryDate, title, storyText, memoryLanguage, origin, eventTimeLabel, now, now);

      const insertPhoto = db.prepare(
        'INSERT INTO memory_photos (id, memory_id, user_id, file_key, original_name, mime_type, size_bytes, sort_order, image_analysis_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const p of savedPhotoRecords) {
        insertPhoto.run(
          p.id,
          memoryId,
          user.id,
          p.fileKey,
          p.originalName,
          p.mimeType,
          p.sizeBytes,
          p.sortOrder,
          JSON.stringify(p.analysis),
          now
        );
      }

      const insertAnswer = db.prepare(
        'INSERT INTO memory_answers (id, memory_id, question_id, question, answer, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const ans of answers) {
        if (ans.answer && ans.answer.trim()) {
          insertAnswer.run(
            crypto.randomUUID(),
            memoryId,
            ans.questionId,
            ans.question,
            ans.answer.trim(),
            JSON.stringify(ans.tags || []),
            now
          );
        }
      }

      if (musicInput && musicInput.mode && musicInput.mode !== 'none') {
        db.prepare(
          `INSERT INTO memory_music (
            id, memory_id, mode, query_or_mood, track_title, artist, album,
            artwork_url, preview_url, external_url, source, music_profile_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          memoryId,
          musicInput.mode,
          musicInput.queryOrMood || null,
          musicInput.trackTitle || null,
          musicInput.artist || null,
          musicInput.album || null,
          musicInput.artworkUrl || null,
          musicInput.previewUrl || null,
          musicInput.externalUrl || null,
          musicInput.source || null,
          musicInput.musicProfile ? JSON.stringify(musicInput.musicProfile) : null
        );
      }

      db.prepare(
        'INSERT INTO generated_designs (id, memory_id, collage_file_key, design_spec_json, ai_provider_used, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), memoryId, JSON.stringify(designSpec), aiProviderUsed, now, now);

      db.prepare(
        'INSERT INTO generated_videos (id, memory_id, video_file_key, status, duration_sec, mime_type, updated_at) VALUES (?, ?, NULL, ?, NULL, NULL, ?)'
      ).run(crypto.randomUUID(), memoryId, 'not_generated', now);

      // 4. Gently learn preferences if enabled without overwriting explicit choices
      if (prefs.allowAdaptiveLearning) {
        const nextColors = Array.from(new Set([designSpec.palette.chosenByUser, ...prefs.favoriteColors])).slice(0, 6);
        const nextTextures = Array.from(new Set([designSpec.paperTexture, ...prefs.preferredTextures])).slice(0, 4);
        const nextLayouts = Array.from(new Set([designSpec.layoutId, ...prefs.preferredLayouts])).slice(0, 4);
        db.prepare(
          'UPDATE user_preferences SET favorite_colors_json = ?, preferred_textures_json = ?, preferred_layouts_json = ?, updated_at = ? WHERE user_id = ?'
        ).run(JSON.stringify(nextColors), JSON.stringify(nextTextures), JSON.stringify(nextLayouts), now, user.id);
      }

      const memory = hydrateMemoryRow(memoryId, user.id);
      res.status(201).json({ memory, notice: notice || analyses.find((a) => a.notice)?.notice });
    } catch (err) {
      await deleteMemoryDirectory(user.id, memoryId).catch(() => {});
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create memory.' });
    }
  }
);

app.get('/api/memories/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const memory = hydrateMemoryRow(String(req.params.id), user.id);
  if (!memory) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }
  res.json({ memory });
});

app.put('/api/memories/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const memoryId = String(req.params.id);
  const existing = hydrateMemoryRow(memoryId, user.id);
  if (!existing) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const memoryDate =
      typeof req.body?.memoryDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(req.body.memoryDate)
        ? req.body.memoryDate.slice(0, 10)
        : existing.memoryDate;
    const storyText =
      typeof req.body?.storyText === 'string' ? req.body.storyText.trim().slice(0, 4000) : existing.storyText;
    const customTitle = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 90) : existing.title;
    const memoryLanguage =
      req.body?.memoryLanguage === 'ru' || req.body?.memoryLanguage === 'en'
        ? req.body.memoryLanguage
        : existing.language || 'en';
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : existing.answers;
    const musicInput = req.body?.music !== undefined ? req.body.music : existing.music;
    const regenerateDesign = Boolean(req.body?.regenerateDesign);

    db.prepare(
      'UPDATE memories SET memory_date = ?, title = ?, story_text = ?, language = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(memoryDate, customTitle || existing.title, storyText, memoryLanguage, now, memoryId, user.id);

    if (Array.isArray(req.body?.answers)) {
      db.prepare('DELETE FROM memory_answers WHERE memory_id = ?').run(memoryId);
      const insertAns = db.prepare(
        'INSERT INTO memory_answers (id, memory_id, question_id, question, answer, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const ans of answers) {
        if (ans.answer && String(ans.answer).trim()) {
          insertAns.run(
            crypto.randomUUID(),
            memoryId,
            String(ans.questionId),
            String(ans.question),
            String(ans.answer).trim(),
            JSON.stringify(ans.tags || []),
            now
          );
        }
      }
    }

    if (req.body?.music !== undefined) {
      db.prepare('DELETE FROM memory_music WHERE memory_id = ?').run(memoryId);
      if (musicInput && musicInput.mode && musicInput.mode !== 'none') {
        db.prepare(
          `INSERT INTO memory_music (
            id, memory_id, mode, query_or_mood, track_title, artist, album,
            artwork_url, preview_url, external_url, source, music_profile_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          memoryId,
          musicInput.mode,
          musicInput.queryOrMood || null,
          musicInput.trackTitle || null,
          musicInput.artist || null,
          musicInput.album || null,
          musicInput.artworkUrl || null,
          musicInput.previewUrl || null,
          musicInput.externalUrl || null,
          musicInput.source || null,
          musicInput.musicProfile ? JSON.stringify(musicInput.musicProfile) : null
        );
      }
    }

    let notice: string | undefined;
    if (regenerateDesign) {
      const analyses = existing.photos
        .map((p) => p.imageAnalysis)
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      const prefs = getUserPreferences(user.id);
      const synth = await generateMemoryDesignSpec({
        imageAnalyses: analyses,
        variationSeed: typeof req.body?.variationSeed === 'number' ? req.body.variationSeed : Math.floor(Date.now() / 1000) % 7 + 1,
        questionnaire: {
          memoryDate,
          memoryLanguage,
          storyText,
          answers,
          music: musicInput,
          userPreferences: prefs,
        },
      });
      notice = synth.notice;
      if (!req.body?.title) {
        db.prepare('UPDATE memories SET title = ? WHERE id = ? AND user_id = ?').run(
          synth.designSpec.generatedTitle,
          memoryId,
          user.id
        );
      } else if (customTitle) {
        synth.designSpec.generatedTitle = customTitle;
      }
      db.prepare(
        'UPDATE generated_designs SET design_spec_json = ?, ai_provider_used = ?, updated_at = ? WHERE memory_id = ?'
      ).run(JSON.stringify(synth.designSpec), synth.aiProviderUsed, now, memoryId);
    } else if (customTitle && existing.design?.designSpec) {
      const updatedSpec = { ...existing.design.designSpec, generatedTitle: customTitle };
      db.prepare('UPDATE generated_designs SET design_spec_json = ?, updated_at = ? WHERE memory_id = ?').run(
        JSON.stringify(updatedSpec),
        now,
        memoryId
      );
    }

    const updated = hydrateMemoryRow(memoryId, user.id);
    res.json({ memory: updated, notice });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update memory.' });
  }
});

// Add photographs to an existing saved memory (up to 8 total)
app.post(
  '/api/memories/:id/photos',
  requireAuth,
  uploadImages.array('photos', 8),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const memoryId = String(req.params.id);
    const existing = hydrateMemoryRow(memoryId, user.id);
    if (!existing) {
      res.status(404).json({ error: 'Memory not found.' });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Please select at least one photograph.' });
      return;
    }
    if (existing.photos.length + files.length > 8) {
      res.status(400).json({ error: 'A memory can hold up to 8 photographs.' });
      return;
    }

    try {
      for (const file of files) {
        validateUploadedImage({ mimetype: file.mimetype, size: file.size });
      }
      const now = new Date().toISOString();
      const memoryLang = existing.language === 'ru' ? 'ru' : 'en';
      let nextSort = existing.photos.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;

      const insertPhoto = db.prepare(
        'INSERT INTO memory_photos (id, memory_id, user_id, file_key, original_name, mime_type, size_bytes, sort_order, image_analysis_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const file of files) {
        const fileKey = await saveOriginalPhoto({
          userId: user.id,
          memoryId,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        const analysis = await analyzePhotograph(file.buffer, memoryLang);
        insertPhoto.run(
          crypto.randomUUID(),
          memoryId,
          user.id,
          fileKey,
          file.originalname || `photo-${nextSort + 1}.jpg`,
          file.mimetype,
          file.size,
          nextSort++,
          JSON.stringify(analysis),
          now
        );
      }

      db.prepare('UPDATE memories SET updated_at = ? WHERE id = ? AND user_id = ?').run(now, memoryId, user.id);
      const updated = hydrateMemoryRow(memoryId, user.id);
      res.json({ memory: updated });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not add photographs.' });
    }
  }
);

// Remove a single photograph from an existing memory (keeps at least 1 photograph)
app.delete('/api/memories/:id/photos/:photoId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const memoryId = String(req.params.id);
  const photoId = String(req.params.photoId);

  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM memory_photos WHERE memory_id = ? AND user_id = ?')
    .get(memoryId, user.id) as { cnt: number };

  if (countRow.cnt <= 1) {
    res.status(400).json({ error: 'A memory must keep at least one photograph.' });
    return;
  }

  const photoRow = db
    .prepare('SELECT file_key FROM memory_photos WHERE id = ? AND memory_id = ? AND user_id = ?')
    .get(photoId, memoryId, user.id) as { file_key: string } | undefined;

  if (!photoRow) {
    res.status(404).json({ error: 'Photograph not found.' });
    return;
  }

  db.prepare('DELETE FROM memory_photos WHERE id = ? AND memory_id = ? AND user_id = ?').run(photoId, memoryId, user.id);
  try {
    const abs = resolveSafeStoragePath(photoRow.file_key);
    await fs.rm(abs, { force: true });
  } catch {
    // Ignore file cleanup failures
  }
  db.prepare('UPDATE memories SET updated_at = ? WHERE id = ? AND user_id = ?').run(
    new Date().toISOString(),
    memoryId,
    user.id
  );
  const updated = hydrateMemoryRow(memoryId, user.id);
  res.json({ memory: updated });
});

app.delete('/api/memories/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const memoryId = String(req.params.id);
  const existing = db.prepare('SELECT id FROM memories WHERE id = ? AND user_id = ?').get(memoryId, user.id);
  if (!existing) {
    res.status(404).json({ error: 'Memory not found.' });
    return;
  }
  db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(memoryId, user.id);
  await deleteMemoryDirectory(user.id, memoryId);
  res.json({ ok: true });
});

// Save rendered static PNG collage privately
app.post(
  '/api/memories/:id/collage',
  requireAuth,
  uploadMediaBlob.single('collage'),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const memoryId = String(req.params.id);
    const existing = db.prepare('SELECT id FROM memories WHERE id = ? AND user_id = ?').get(memoryId, user.id);
    if (!existing) {
      res.status(404).json({ error: 'Memory not found.' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Missing collage PNG payload.' });
      return;
    }
    try {
      const fileKey = await saveGeneratedArtifact({
        userId: user.id,
        memoryId,
        kind: 'collage',
        buffer: file.buffer,
        mimeType: 'image/png',
      });
      const now = new Date().toISOString();
      db.prepare('UPDATE generated_designs SET collage_file_key = ?, updated_at = ? WHERE memory_id = ?').run(
        fileKey,
        now,
        memoryId
      );
      res.json({ collageUrl: `/api/files/${memoryId}/collage?t=${encodeURIComponent(now)}` });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save collage.' });
    }
  }
);

// Save rendered animated video privately
app.post(
  '/api/memories/:id/video',
  requireAuth,
  uploadMediaBlob.single('video'),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const memoryId = String(req.params.id);
    const existing = db.prepare('SELECT id FROM memories WHERE id = ? AND user_id = ?').get(memoryId, user.id);
    if (!existing) {
      res.status(404).json({ error: 'Memory not found.' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Missing video payload.' });
      return;
    }
    try {
      const durationSec = Math.max(15, Math.min(30, Number(req.body?.durationSec || 18)));
      const fileKey = await saveGeneratedArtifact({
        userId: user.id,
        memoryId,
        kind: 'video',
        buffer: file.buffer,
        mimeType: file.mimetype || 'video/webm',
      });
      const now = new Date().toISOString();
      db.prepare(
        'UPDATE generated_videos SET video_file_key = ?, status = ?, duration_sec = ?, mime_type = ?, updated_at = ? WHERE memory_id = ?'
      ).run(fileKey, 'ready', durationSec, file.mimetype || 'video/webm', now, memoryId);

      res.json({
        video: {
          videoUrl: `/api/files/${memoryId}/video?t=${encodeURIComponent(now)}`,
          status: 'ready',
          durationSec,
          mimeType: file.mimetype || 'video/webm',
          updatedAt: now,
        },
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save video.' });
    }
  }
);

// ---------- On This Day ----------
app.get('/api/on-this-day', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const targetDateStr = String(req.query.date || new Date().toISOString().slice(0, 10));
  const match = targetDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const targetYear = match ? Number(match[1]) : new Date().getFullYear();
  const monthDay = match ? `${match[2]}-${match[3]}` : new Date().toISOString().slice(5, 10);

  const rows = db
    .prepare('SELECT id, memory_date FROM memories WHERE user_id = ? ORDER BY memory_date DESC')
    .all(user.id) as Array<{ id: string; memory_date: string }>;

  const matching = rows.filter((r) => {
    const rYear = Number(r.memory_date.slice(0, 4));
    const rMonthDay = r.memory_date.slice(5, 10);
    return rMonthDay === monthDay && rYear < targetYear;
  });

  const memories = matching
    .map((r) => {
      const mem = hydrateMemoryRow(r.id, user.id);
      if (!mem) return null;
      const yearsAgo = targetYear - Number(mem.memoryDate.slice(0, 4));
      return { yearsAgo, memory: mem };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  res.json({ targetDate: `${targetYear}-${monthDay}`, monthDay, memories });
});

// ---------- Owner-Only Private File Serving ----------
app.get('/api/files/:memoryId/:fileId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const memoryId = String(req.params.memoryId);
  const fileId = String(req.params.fileId);

  const mem = db
    .prepare('SELECT id FROM memories WHERE id = ? AND user_id = ?')
    .get(memoryId, user.id) as { id: string } | undefined;

  if (!mem) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  try {
    if (fileId === 'collage') {
      const design = db
        .prepare('SELECT collage_file_key FROM generated_designs WHERE memory_id = ?')
        .get(memoryId) as { collage_file_key: string | null } | undefined;
      if (!design?.collage_file_key) {
        res.status(404).json({ error: 'Collage not found.' });
        return;
      }
      const bytes = await readPrivateFile(design.collage_file_key);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(bytes);
      return;
    }

    if (fileId === 'video') {
      const video = db
        .prepare('SELECT video_file_key, mime_type FROM generated_videos WHERE memory_id = ?')
        .get(memoryId) as { video_file_key: string | null; mime_type: string | null } | undefined;
      if (!video?.video_file_key) {
        res.status(404).json({ error: 'Video not found.' });
        return;
      }
      const bytes = await readPrivateFile(video.video_file_key);
      res.setHeader('Content-Type', video.mime_type || 'video/webm');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(bytes);
      return;
    }

    const photo = db
      .prepare('SELECT file_key, mime_type FROM memory_photos WHERE id = ? AND memory_id = ? AND user_id = ?')
      .get(fileId, memoryId, user.id) as { file_key: string; mime_type: string } | undefined;

    if (!photo) {
      res.status(404).json({ error: 'Photograph not found.' });
      return;
    }

    const bytes = await readPrivateFile(photo.file_key);
    const isDownload = req.query.download === '1';
    const isHeic = /heic|heif/i.test(photo.mime_type);

    if (isHeic && !isDownload) {
      try {
        const jpeg = await sharp(bytes).rotate().jpeg({ quality: 90 }).toBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.send(jpeg);
        return;
      } catch {
        // Fallback to raw bytes if sharp cannot decode HEIC in this runtime
      }
    }

    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(bytes);
  } catch {
    res.status(404).json({ error: 'File unavailable.' });
  }
});

// ---------- Vite Dev / Production Static Serving ----------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', async (_req, res) => {
      const html = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MEMENTO server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
