import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  ANIMATION_LABELS,
  FILM_FILTERS,
  LAYOUT_LABELS,
  TEXTURE_LABELS,
  TYPOGRAPHY_PAIRS,
  localizeAnimationLabel,
  localizeLayoutLabel,
  localizeTextureLabel,
  type AnimationStyleId,
  type LayoutId,
  type PaperTextureId,
} from '../lib/artLibrary';
import { DEFAULT_USER_PREFERENCES } from '../lib/demoWorkspace';
import { useI18n } from '../lib/i18n';
import type { UserPreferences, UserProfile } from '../lib/types';

interface ProfilePageProps {
  user: UserProfile;
  memoryCount: number;
  onUserUpdated: (user: UserProfile) => void;
}

export function ProfilePage({ user, memoryCount, onUserUpdated }: ProfilePageProps) {
  const { t, lang } = useI18n();
  const [prefs, setPrefs] = useState<UserPreferences>(user.preferences);
  const [newColor, setNewColor] = useState('#5D8AA8');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(user.preferences);
  }, [user.preferences]);

  const formatMemoryUnit = (count: number) => {
    if (lang !== 'ru') return count === 1 ? t('cal.memoryOne') : t('cal.memoryMany');
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'воспоминание';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'воспоминания';
    return 'воспоминаний';
  };

  const toggleItem = (key: 'preferredTextures' | 'preferredLayouts', value: string) => {
    setPrefs((prev) => {
      const list = prev[key];
      const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  const addColor = () => {
    const hex = newColor.toUpperCase();
    if (!prefs.favoriteColors.includes(hex)) {
      setPrefs((prev) => ({ ...prev, favoriteColors: [hex, ...prev.favoriteColors].slice(0, 8) }));
    }
  };

  const removeColor = (hex: string) => {
    setPrefs((prev) => ({
      ...prev,
      favoriteColors: prev.favoriteColors.filter((c) => c !== hex),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedNotice(null);
    setError(null);
    try {
      if (user.isDemoAccount) {
        onUserUpdated({ ...user, preferences: prefs });
        setSavedNotice(
          lang === 'ru'
            ? 'Эстетические настройки демо-режима обновлены локально в браузере.'
            : 'Demo Mode aesthetic preferences updated locally in this browser.'
        );
        return;
      }

      const res = await api.updateProfile({ preferences: prefs });
      onUserUpdated(res.user);
      setSavedNotice(
        lang === 'ru' ? 'Личные эстетические предпочтения сохранены.' : 'Personal aesthetic preferences saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preferences right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const defaults = { ...DEFAULT_USER_PREFERENCES, uiLanguage: lang };
    setPrefs(defaults);
    setSaving(true);
    setSavedNotice(null);
    setError(null);
    try {
      if (user.isDemoAccount) {
        onUserUpdated({ ...user, preferences: defaults });
        setSavedNotice(
          lang === 'ru' ? 'Предпочтения демо-режима сброшены.' : 'Reset Demo Mode aesthetic preferences to defaults.'
        );
        return;
      }
      const res = await api.updateProfile({ preferences: defaults });
      onUserUpdated(res.user);
      setSavedNotice(
        lang === 'ru' ? 'Предпочтения сброшены по умолчанию.' : 'Reset your aesthetic preferences to clean defaults.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset preferences right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {t('profile.eyebrow')}
            {user.isDemoAccount ? ` · ${t('demo.bannerLead').replace(':', '')}` : ''}
          </p>
          <h1 className="font-display mt-1 text-4xl font-medium text-stone-900 sm:text-5xl">
            {user.name}
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            {user.email} · {t('profile.preserved', { count: memoryCount, unit: formatMemoryUnit(memoryCount) })}
          </p>
        </div>
      </div>

      {savedNotice && (
        <div className="border border-stone-300 bg-white px-4 py-3 text-xs text-stone-800">
          {savedNotice}
        </div>
      )}
      {error && (
        <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="space-y-7 border border-stone-200 bg-white p-6 sm:p-8">
        <div className="space-y-1.5 border-b border-stone-200 pb-4">
          <h2 className="font-display text-2xl font-medium text-stone-900">
            {t('profile.sectionTitle')}
          </h2>
          <p className="text-xs leading-relaxed text-stone-500">{t('profile.sectionSub')}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 border border-stone-200 bg-[#faf8f3] p-4 text-xs">
          <input
            type="checkbox"
            checked={prefs.allowAdaptiveLearning}
            onChange={(e) => setPrefs((p) => ({ ...p, allowAdaptiveLearning: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-stone-900"
          />
          <span>
            <strong className="block text-sm font-medium text-stone-900">
              {t('profile.adaptiveTitle')}
            </strong>
            <span className="text-stone-600">{t('profile.adaptiveSub')}</span>
          </span>
        </label>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-600">
            {t('profile.favoriteColors')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {prefs.favoriteColors.map((hex) => (
              <div
                key={hex}
                className="flex items-center gap-2 border border-stone-200 bg-[#faf8f3] px-2.5 py-1.5"
              >
                <span className="h-4 w-4 rounded-full border border-stone-300" style={{ backgroundColor: hex }} />
                <span className="font-mono text-xs text-stone-700">{hex}</span>
                <button
                  type="button"
                  onClick={() => removeColor(hex)}
                  aria-label={hex}
                  className="cursor-pointer text-stone-400 hover:text-stone-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t('profile.favoriteColors')}
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-12 cursor-pointer border border-stone-300 bg-white p-0.5"
              />
              <button
                type="button"
                onClick={addColor}
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 border border-stone-300 px-3 text-xs text-stone-700 hover:bg-stone-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('profile.add')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-600">
            {t('profile.preferredTextures')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEXTURE_LABELS) as PaperTextureId[]).map((id) => {
              const active = prefs.preferredTextures.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleItem('preferredTextures', id)}
                  className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border px-3.5 text-xs ${
                    active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  <span>{localizeTextureLabel(id, lang)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-600">
            {t('profile.preferredLayouts')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LAYOUT_LABELS) as LayoutId[]).map((id) => {
              const active = prefs.preferredLayouts.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleItem('preferredLayouts', id)}
                  className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border px-3.5 text-xs ${
                    active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  <span>{localizeLayoutLabel(id, lang)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-700">{t('profile.typography')}</label>
            <select
              value={prefs.preferredTypography}
              onChange={(e) => setPrefs((p) => ({ ...p, preferredTypography: e.target.value }))}
              className="min-h-[42px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-xs text-stone-900"
            >
              {Object.entries(TYPOGRAPHY_PAIRS).map(([id, pair]) => (
                <option key={id} value={id}>
                  {lang === 'ru' ? pair.labelRu : pair.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-700">{t('profile.filmGrading')}</label>
            <select
              value={prefs.preferredFilmEffect}
              onChange={(e) => setPrefs((p) => ({ ...p, preferredFilmEffect: e.target.value }))}
              className="min-h-[42px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-xs text-stone-900"
            >
              {Object.entries(FILM_FILTERS).map(([id, f]) => (
                <option key={id} value={id}>
                  {lang === 'ru' ? f.labelRu : f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-700">{t('profile.animation')}</label>
            <select
              value={prefs.preferredAnimation}
              onChange={(e) => setPrefs((p) => ({ ...p, preferredAnimation: e.target.value }))}
              className="min-h-[42px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-xs text-stone-900"
            >
              {(Object.keys(ANIMATION_LABELS) as AnimationStyleId[]).map((id) => (
                <option key={id} value={id}>
                  {localizeAnimationLabel(id, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2.5 border-t border-stone-200 pt-5">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-600">
            {t('profile.calendarMarkers')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'atmosphere', label: t('profile.markerAtmos') },
                { id: 'palette', label: t('profile.markerPalette') },
                { id: 'monochrome', label: t('profile.markerMono') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, calendarColorMode: opt.id }))}
                className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border px-3.5 text-xs ${
                  prefs.calendarColorMode === opt.id
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 bg-white text-stone-700'
                }`}
              >
                {prefs.calendarColorMode === opt.id && <Check className="h-3.5 w-3.5" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="min-h-[44px] cursor-pointer bg-stone-900 px-6 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? t('profile.saving') : t('profile.saveBtn')}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleResetDefaults}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t('profile.resetBtn')}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
