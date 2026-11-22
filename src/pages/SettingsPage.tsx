import { Download, FolderOpen, Languages, LogIn, LogOut, RotateCcw, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { clearCachedPhotoAnalyses } from '../lib/exifAndThumb';
import { useI18n } from '../lib/i18n';
import type { AppLanguage, MemoryRecord, UserProfile } from '../lib/types';

interface SettingsPageProps {
  user: UserProfile;
  memories?: MemoryRecord[];
  onUserUpdated: (user: UserProfile) => void;
  onLanguageChange?: (next: AppLanguage) => void;
  onOpenAutoImport?: () => void;
  onAutomaticMemoriesDisconnected?: () => void;
  onResetDemo?: () => void;
  onLogout: () => void;
}

export function SettingsPage({
  user,
  memories = [],
  onUserUpdated,
  onLanguageChange,
  onOpenAutoImport,
  onAutomaticMemoriesDisconnected,
  onResetDemo,
  onLogout,
}: SettingsPageProps) {
  const { t, lang, setLang } = useI18n();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [savingAccount, setSavingAccount] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmResetDemo, setConfirmResetDemo] = useState(false);
  const [confirmDisconnectGallery, setConfirmDisconnectGallery] = useState(false);
  const [disconnectingGallery, setDisconnectingGallery] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const automaticMemoriesCount = memories.filter((m) => m.origin === 'automatic').length;
  const indexedPhotosCount = user.preferences?.importedFingerprints?.length || 0;

  useEffect(() => {
    setName(user.name);
    setBio(user.bio || '');
  }, [user.name, user.bio]);

  const handleSelectLanguage = (next: AppLanguage) => {
    setLang(next);
    if (onLanguageChange) {
      onLanguageChange(next);
    }
  };

  const handleSaveAccount = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAccount(true);
    setNotice(null);
    setError(null);
    try {
      if (user.isDemoAccount) {
        onUserUpdated({ ...user, name: name.trim() || user.name, bio });
        setNotice(
          lang === 'ru'
            ? 'Профиль демо-режима обновлён локально в браузере.'
            : 'Demo profile details updated locally in this browser.'
        );
        return;
      }
      const res = await api.updateProfile({ name, bio });
      onUserUpdated(res.user);
      setNotice(lang === 'ru' ? 'Данные аккаунта обновлены.' : 'Account details updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account details.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setNotice(null);
    setError(null);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setNotice(lang === 'ru' ? 'Пароль успешно изменён.' : 'Password changed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleExportArchive = async () => {
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      let blob: Blob;
      let filename: string;
      if (user.isDemoAccount) {
        const payload = {
          mode: 'local-demo-workspace',
          exportedAt: new Date().toISOString(),
          note: 'Exported from MEMENTO Local Demo Mode. These entries were stored in your browser only.',
          profile: user,
          memories: memories.map((m) => ({
            id: m.id,
            memoryDate: m.memoryDate,
            title: m.title,
            language: m.language || 'en',
            storyText: m.storyText,
            answers: m.answers,
            music: m.music,
            isPresetDemo: Boolean(m.isPresetDemo),
          })),
        };
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        filename = `memento-demo-export-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        const res = await api.exportArchiveBlob();
        blob = res.blob;
        filename = res.filename;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice(lang === 'ru' ? 'Экспорт архива скачан.' : 'Archive export downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export archive right now.');
    } finally {
      setExporting(false);
    }
  };

  const handleDisconnectGallery = async () => {
    setDisconnectingGallery(true);
    setError(null);
    setNotice(null);
    try {
      clearCachedPhotoAnalyses();
      if (user.isDemoAccount) {
        onUserUpdated({
          ...user,
          preferences: {
            ...user.preferences,
            galleryConnected: false,
            importedFingerprints: [],
          },
        });
      } else {
        const res = await api.disconnectGallery();
        onUserUpdated({
          ...user,
          preferences: res.preferences,
        });
      }
      onAutomaticMemoriesDisconnected?.();
      setConfirmDisconnectGallery(false);
      setNotice(t('settings.disconnectedOk'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect gallery.');
    } finally {
      setDisconnectingGallery(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setError(null);
    try {
      await api.deleteAccount();
      onLogout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account.');
      setDeletingAccount(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {user.isDemoAccount ? t('settings.demoScope') : t('settings.privateScope')}
          </p>
          <h1 className="font-display mt-1 text-4xl font-medium text-stone-900 sm:text-5xl">
            {t('settings.title')}
          </h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-300 bg-white px-4 text-xs font-medium text-stone-800 hover:bg-stone-100"
        >
          {user.isDemoAccount ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
          <span>{user.isDemoAccount ? t('settings.exitDemo') : t('settings.signOut')}</span>
        </button>
      </div>

      {notice && (
        <div className="border border-stone-300 bg-white px-4 py-3 text-xs text-stone-800">{notice}</div>
      )}
      {error && (
        <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Interface Language Selector */}
      <section className="flex flex-wrap items-center justify-between gap-4 border border-stone-200 bg-white p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-stone-700" />
            <h2 className="font-display text-2xl font-medium text-stone-900">
              {t('settings.languageTitle')}
            </h2>
          </div>
          <p className="text-xs text-stone-500">{t('settings.languageSub')}</p>
        </div>

        <div className="flex border border-stone-300 bg-[#faf8f3] p-0.5">
          <button
            type="button"
            onClick={() => handleSelectLanguage('en')}
            className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium ${
              lang === 'en' ? 'bg-stone-900 text-white' : 'text-stone-700'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => handleSelectLanguage('ru')}
            className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium ${
              lang === 'ru' ? 'bg-stone-900 text-white' : 'text-stone-700'
            }`}
          >
            Русский
          </button>
        </div>
      </section>

      {/* Connected Photo Library & Automatic Memories */}
      <section className="space-y-4 border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-stone-700" />
              <h2 className="font-display text-2xl font-medium text-stone-900">
                {t('settings.galleryTitle')}
              </h2>
            </div>
            <p className="text-xs font-medium text-stone-700">
              {user.preferences?.galleryConnected || indexedPhotosCount > 0 || automaticMemoriesCount > 0
                ? t('settings.galleryConnected', { count: indexedPhotosCount })
                : t('settings.galleryEmpty')}
            </p>
            <p className="max-w-2xl text-xs leading-relaxed text-stone-500">
              {t('settings.galleryDesc')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-stone-100 pt-4">
          {onOpenAutoImport && (
            <button
              type="button"
              onClick={onOpenAutoImport}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 bg-stone-900 px-4 text-xs font-medium text-white hover:bg-stone-800 whitespace-nowrap"
            >
              <FolderOpen className="h-4 w-4" />
              <span>{t('settings.importMore')}</span>
            </button>
          )}

          {(user.preferences?.galleryConnected || indexedPhotosCount > 0 || automaticMemoriesCount > 0) &&
            (!confirmDisconnectGallery ? (
              <button
                type="button"
                onClick={() => setConfirmDisconnectGallery(true)}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-red-200 px-4 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('settings.disconnectGallery')}</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border border-red-200 bg-red-50 px-3 py-2">
                <span className="text-xs text-red-900">
                  {t('settings.confirmDisconnect', { count: automaticMemoriesCount })}
                </span>
                <button
                  type="button"
                  disabled={disconnectingGallery}
                  onClick={handleDisconnectGallery}
                  className="min-h-[34px] cursor-pointer bg-red-700 px-3 text-xs font-medium text-white"
                >
                  {disconnectingGallery ? t('detail.deleting') : t('detail.confirmDelete')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDisconnectGallery(false)}
                  className="min-h-[34px] cursor-pointer border border-stone-300 bg-white px-3 text-xs text-stone-700"
                >
                  {t('create.cancel')}
                </button>
              </div>
            ))}
        </div>
      </section>

      {/* Account Profile Details */}
      <form onSubmit={handleSaveAccount} className="space-y-4 border border-stone-200 bg-white p-6">
        <h2 className="font-display text-2xl font-medium text-stone-900">
          {user.isDemoAccount ? t('settings.demoDetails') : t('settings.accountDetails')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-name" className="mb-1 block text-xs font-medium text-stone-700">
              {t('settings.displayName')}
            </label>
            <input
              id="settings-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[42px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">
              {user.isDemoAccount ? t('settings.storageScope') : t('settings.email')}
            </label>
            <input
              type="text"
              disabled
              value={user.email}
              className="min-h-[42px] w-full border border-stone-200 bg-stone-100 px-3 text-sm text-stone-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor="settings-bio" className="mb-1 block text-xs font-medium text-stone-700">
            {t('settings.bioLabel')}
          </label>
          <textarea
            id="settings-bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('settings.bioPlaceholder')}
            className="w-full border border-stone-300 bg-[#faf8f3] p-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={savingAccount}
          className="min-h-[42px] cursor-pointer bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800"
        >
          {savingAccount
            ? t('profile.saving')
            : user.isDemoAccount
            ? t('settings.saveDemoLocal')
            : t('settings.saveAccount')}
        </button>
      </form>

      {/* Security: Password Change */}
      {!user.isDemoAccount && (
        <form onSubmit={handleChangePassword} className="space-y-4 border border-stone-200 bg-white p-6">
          <h2 className="font-display text-2xl font-medium text-stone-900">{t('settings.changePassword')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="curr-pass" className="mb-1 block text-xs font-medium text-stone-700">
                {t('settings.currPass')}
              </label>
              <input
                id="curr-pass"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="min-h-[42px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="next-pass" className="mb-1 block text-xs font-medium text-stone-700">
                {t('settings.nextPass')}
              </label>
              <input
                id="next-pass"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="min-h-[42px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="min-h-[42px] cursor-pointer border border-stone-900 px-5 text-xs font-medium text-stone-900 hover:bg-stone-100"
          >
            {savingPassword ? t('settings.updating') : t('settings.updatePass')}
          </button>
        </form>
      )}

      {/* Privacy & Data Controls */}
      <section className="space-y-4 border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-stone-700" />
          <h2 className="font-display text-2xl font-medium text-stone-900">
            {user.isDemoAccount ? t('settings.privacyDemoTitle') : t('settings.privacyRealTitle')}
          </h2>
        </div>

        {user.isDemoAccount ? (
          <ul className="space-y-2 text-xs leading-relaxed text-stone-600">
            {lang === 'ru' ? (
              <>
                <li>• Вы используете MEMENTO в локальном демо-режиме: записи и настройки хранятся только в этом браузере.</li>
                <li>• Демо-данные не отправляются на личный облачный аккаунт и не видны на других устройствах.</li>
                <li>• Создайте личный аккаунт в любой момент, чтобы хранить оригиналы фотографий и архив постоянно.</li>
              </>
            ) : (
              <>
                <li>• You are exploring MEMENTO in Local Demo Mode. Memories and preferences you add here are stored only in this browser’s local storage.</li>
                <li>• Local Demo data is never uploaded to a private cloud account or shared across devices.</li>
                <li>• Create a private account anytime to preserve original high-resolution photographs and archives across sessions and devices.</li>
              </>
            )}
          </ul>
        ) : (
          <ul className="space-y-2 text-xs leading-relaxed text-stone-600">
            {lang === 'ru' ? (
              <>
                <li>• Каждая загруженная фотография хранится в изолированном каталоге, привязанном только к вашему аккаунту.</li>
                <li>• ИИ анализирует только выбранные вами снимки, сохраняя приоритет за вашими ответами и чувствами.</li>
                <li>• Ни одна фотография или страница памяти не публикуется и не доступна другим пользователям.</li>
              </>
            ) : (
              <>
                <li>• Every photograph you upload is stored inside an isolated private directory bound exclusively to your account ID.</li>
                <li>• AI analysis inspects only the photographs you explicitly choose, extracting lighting and scenery facts while treating your questionnaire answers as the primary source of personal meaning.</li>
                <li>• No photograph or memory is publicly shared or accessible by any other account.</li>
              </>
            )}
          </ul>
        )}

        <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportArchive}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-300 px-4 text-xs font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>
              {exporting
                ? t('settings.preparingJson')
                : user.isDemoAccount
                ? t('settings.exportDemo')
                : t('settings.exportReal')}
            </span>
          </button>

          {user.isDemoAccount ? (
            !confirmResetDemo ? (
              <button
                type="button"
                onClick={() => setConfirmResetDemo(true)}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{t('settings.resetDemo')}</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border border-stone-300 bg-stone-50 px-3 py-2">
                <span className="text-xs text-stone-800">
                  {lang === 'ru'
                    ? 'Сбросить локальные работы и вернуть демо-примеры?'
                    : 'Restore default showcase samples & clear local creations?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onResetDemo?.();
                    setConfirmResetDemo(false);
                    setNotice(
                      lang === 'ru'
                        ? 'Локальный демо-архив восстановлен.'
                        : 'Local Demo Workspace restored to its initial sample memories.'
                    );
                  }}
                  className="min-h-[34px] cursor-pointer bg-stone-900 px-3 text-xs font-medium text-white"
                >
                  {t('settings.resetDemo')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetDemo(false)}
                  className="min-h-[34px] cursor-pointer border border-stone-300 bg-white px-3 text-xs text-stone-700"
                >
                  {t('create.cancel')}
                </button>
              </div>
            )
          ) : !confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-red-200 px-4 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t('settings.deleteAccount')}</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border border-red-300 bg-red-50 px-3 py-2">
              <span className="text-xs text-red-900">{t('detail.deleteConfirmTitle')}</span>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleDeleteAccount}
                className="min-h-[34px] cursor-pointer bg-red-700 px-3 text-xs font-medium text-white"
              >
                {deletingAccount ? t('detail.deleting') : t('detail.confirmDelete')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[34px] cursor-pointer border border-stone-300 bg-white px-3 text-xs text-stone-700"
              >
                {t('create.cancel')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
