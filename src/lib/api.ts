import type { DesignSpecification, ImageVisualAnalysis } from './artLibrary';
import type { MemoryMusicRecord, MemoryRecord, OnThisDayEntry, UserPreferences, UserProfile } from './types';

// Held strictly in JS memory (never persisted to localStorage/sessionStorage) as a fallback when iframe cookies are blocked.
let inMemorySessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setInMemorySessionToken(token: string | null) {
  inMemorySessionToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function safeExternalHref(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function cleanErrorMessage(raw: unknown, status: number): string {
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      return status === 401
        ? 'Your session has expired. Please sign in again or continue in Demo Mode.'
        : 'Unable to complete this request right now. Please try again.';
    }
    return trimmed;
  }
  if (status === 401) return 'Please sign in to your account or switch to Demo Mode.';
  if (status === 404) return 'The requested memory could not be found.';
  return 'Something went wrong while communicating with the server. Please try again.';
}

async function parseResponse<T>(res: Response, notifyOn401 = true): Promise<T> {
  const text = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401 && notifyOn401) {
      inMemorySessionToken = null;
      unauthorizedHandler?.();
    }
    throw new Error(cleanErrorMessage(data.error, res.status));
  }
  return data as T;
}

async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
  options: { notifyOn401?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'memento-client');
  if (inMemorySessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error('Could not reach the MEMENTO server. You can continue using Local Demo Mode.');
  }
  return parseResponse<T>(res, options.notifyOn401 ?? true);
}

export const api = {
  health: () => apiFetch<{ ok: boolean; aiConfigured: boolean }>('/api/health', {}, { notifyOn401: false }),

  me: () => apiFetch<{ user: UserProfile | null }>('/api/auth/me', {}, { notifyOn401: false }),

  register: async (payload: { name: string; email: string; password: string; privacyAgree: boolean }) => {
    const res = await apiFetch<{ user: UserProfile; sessionToken?: string }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      { notifyOn401: false }
    );
    if (res.sessionToken) inMemorySessionToken = res.sessionToken;
    return res;
  },

  login: async (payload: { email: string; password: string }) => {
    const res = await apiFetch<{ user: UserProfile; sessionToken?: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      { notifyOn401: false }
    );
    if (res.sessionToken) inMemorySessionToken = res.sessionToken;
    return res;
  },

  logout: async () => {
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, { notifyOn401: false });
    } finally {
      inMemorySessionToken = null;
    }
  },

  forgotPassword: (email: string) =>
    apiFetch<{ ok: boolean; deliveryMode?: string; recoveryToken?: string; message: string }>(
      '/api/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) },
      { notifyOn401: false }
    ),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    apiFetch<{ ok: boolean; message: string }>(
      '/api/auth/reset-password',
      { method: 'POST', body: JSON.stringify(payload) },
      { notifyOn401: false }
    ),

  getProfile: () => apiFetch<{ user: UserProfile; memoryCount: number }>('/api/profile'),

  updateProfile: (payload: { name?: string; bio?: string; preferences?: Partial<UserPreferences> }) =>
    apiFetch<{ user: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportArchiveBlob: async (): Promise<{ blob: Blob; filename: string }> => {
    const headers = new Headers({ 'X-Requested-With': 'memento-client' });
    if (inMemorySessionToken) headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
    const res = await fetch('/api/profile/export', { headers, credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) {
        inMemorySessionToken = null;
        unauthorizedHandler?.();
      }
      throw new Error('Could not export archive right now. Please make sure you are signed in.');
    }
    const blob = await res.blob();
    return { blob, filename: `memento-archive-${new Date().toISOString().slice(0, 10)}.json` };
  },

  deleteAccount: () => apiFetch<{ ok: boolean }>('/api/profile', { method: 'DELETE' }),

  disconnectGallery: () =>
    apiFetch<{ ok: boolean; removedCount: number; preferences: UserPreferences }>(
      '/api/gallery/disconnect',
      { method: 'DELETE' }
    ),

  searchMusic: (payload: {
    mode: 'specific' | 'description' | 'custom';
    query: string;
    customTitle?: string;
    customArtist?: string;
  }) =>
    apiFetch<{
      mode: string;
      interpretedQuery: string;
      message?: string;
      tracks: Array<{
        trackTitle: string;
        artist: string;
        album: string | null;
        artworkUrl: string | null;
        previewUrl: string | null;
        externalUrl: string | null;
        source: 'itunes' | 'custom-link';
        genre?: string | null;
        musicProfile: { tempoFeel: string; energy: number; mood: string };
      }>;
    }>('/api/music/search', { method: 'POST', body: JSON.stringify(payload) }, { notifyOn401: false }),

  previewMemoryDesign: (formData: FormData) =>
    apiFetch<{
      imageAnalyses: ImageVisualAnalysis[];
      designSpec: DesignSpecification;
      aiProviderUsed: string;
      notice?: string;
    }>('/api/memories/preview', { method: 'POST', body: formData }, { notifyOn401: false }),

  regenerateDesignSpec: (payload: {
    imageAnalyses: ImageVisualAnalysis[];
    memoryDate: string;
    memoryLanguage?: 'en' | 'ru';
    storyText: string;
    answers: Array<{ questionId: string; question: string; answer: string; tags?: string[] }>;
    music: MemoryMusicRecord | null;
    userPreferences?: UserPreferences;
    variationSeed?: number;
  }) =>
    apiFetch<{ designSpec: DesignSpecification; aiProviderUsed: string; notice?: string }>(
      '/api/memories/regenerate-spec',
      { method: 'POST', body: JSON.stringify(payload) },
      { notifyOn401: false }
    ),

  analyzeYearBatch: (payload: {
    language: 'en' | 'ru';
    items: Array<{ clientId: string; base64DataUrl: string }>;
  }) =>
    apiFetch<{
      results: Array<{
        clientId: string;
        ok: boolean;
        analysis?: ImageVisualAnalysis;
        error?: string;
      }>;
    }>('/api/auto-year/analyze-batch', { method: 'POST', body: JSON.stringify(payload) }, { notifyOn401: false }),

  clusterYearPhotos: (payload: {
    language: 'en' | 'ru';
    photos: Array<{
      clientId: string;
      originalName: string;
      captureDate: string | null;
      captureTime?: string | null;
      captureMinutes?: number | null;
      dateSource: 'exif' | 'file-modified' | 'manual' | 'unknown';
      analysis: ImageVisualAnalysis;
    }>;
  }) =>
    apiFetch<{
      clusters: Array<{
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
      }>;
    }>('/api/auto-year/cluster', { method: 'POST', body: JSON.stringify(payload) }, { notifyOn401: false }),

  generateClusterDesign: (payload: {
    imageAnalyses: ImageVisualAnalysis[];
    memoryDate: string;
    memoryLanguage: 'en' | 'ru';
    storyText: string;
    answers: Array<{ questionId: string; question: string; answer: string; tags?: string[] }>;
    music: MemoryMusicRecord | null;
    userPreferences?: UserPreferences;
    variationSeed?: number;
  }) =>
    apiFetch<{ designSpec: DesignSpecification; aiProviderUsed: string; notice?: string }>(
      '/api/auto-year/generate-cluster',
      { method: 'POST', body: JSON.stringify(payload) },
      { notifyOn401: false }
    ),

  listMemories: (params?: { q?: string; year?: string; month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.year) qs.set('year', params.year);
    if (params?.month) qs.set('month', params.month);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ memories: MemoryRecord[] }>(`/api/memories${suffix}`);
  },

  getMemory: (id: string) => apiFetch<{ memory: MemoryRecord }>(`/api/memories/${id}`),

  createMemory: (formData: FormData) =>
    apiFetch<{ memory: MemoryRecord; notice?: string }>('/api/memories', {
      method: 'POST',
      body: formData,
    }),

  updateMemory: (
    id: string,
    payload: {
      title?: string;
      memoryDate?: string;
      memoryLanguage?: 'en' | 'ru';
      storyText?: string;
      answers?: Array<{ questionId: string; question: string; answer: string; tags?: string[] }>;
      music?: MemoryMusicRecord | null;
      regenerateDesign?: boolean;
      variationSeed?: number;
    }
  ) =>
    apiFetch<{ memory: MemoryRecord; notice?: string }>(`/api/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  addMemoryPhotos: (memoryId: string, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('photos', f));
    return apiFetch<{ memory: MemoryRecord }>(`/api/memories/${memoryId}/photos`, {
      method: 'POST',
      body: fd,
    });
  },

  deleteMemoryPhoto: (memoryId: string, photoId: string) =>
    apiFetch<{ memory: MemoryRecord }>(`/api/memories/${memoryId}/photos/${photoId}`, {
      method: 'DELETE',
    }),

  deleteMemory: (id: string) => apiFetch<{ ok: boolean }>(`/api/memories/${id}`, { method: 'DELETE' }),

  saveCollage: (memoryId: string, blob: Blob) => {
    const fd = new FormData();
    fd.append('collage', blob, 'collage.png');
    return apiFetch<{ collageUrl: string }>(`/api/memories/${memoryId}/collage`, {
      method: 'POST',
      body: fd,
    });
  },

  saveVideo: (memoryId: string, blob: Blob, durationSec: number) => {
    const fd = new FormData();
    fd.append('video', blob, 'memory.webm');
    fd.append('durationSec', String(durationSec));
    return apiFetch<{ video: MemoryRecord['video'] }>(`/api/memories/${memoryId}/video`, {
      method: 'POST',
      body: fd,
    });
  },

  onThisDay: (dateStr?: string) => {
    const suffix = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
    return apiFetch<{ targetDate: string; monthDay: string; memories: OnThisDayEntry[] }>(`/api/on-this-day${suffix}`);
  },
};
