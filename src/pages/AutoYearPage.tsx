import {
  ArrowRight,
  Calendar,
  FolderOpen,
  Images,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useRef, type ChangeEvent } from 'react';
import { useAutoImport } from '../lib/autoImportManager';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord, UserProfile } from '../lib/types';

interface AutoYearPageProps {
  user: UserProfile;
  memories: MemoryRecord[];
  onSwitchToManual: () => void;
  onOpenMemory: (memory: MemoryRecord) => void;
  onOpenDay: (isoDate: string) => void;
  onBrowseInBackground: () => void;
  onCancel: () => void;
}

export function AutoYearPage({
  user,
  memories,
  onSwitchToManual,
  onOpenMemory,
  onOpenDay,
  onBrowseInBackground,
  onCancel,
}: AutoYearPageProps) {
  const { t, formatDate } = useI18n();
  const {
    queue,
    state,
    yearFilter,
    setYearFilter,
    memoryLanguage,
    setMemoryLanguage,
    enqueueFiles,
    updateQueuedDate,
    removeQueuedPhoto,
    clearQueue,
    startBackgroundDiscovery,
    pause,
    resume,
    cancel,
    retryFailed,
    clearInterruptedNotice,
  } = useAutoImport();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const isRunning =
    state.stage === 'preparing' ||
    state.stage === 'analyzing' ||
    state.stage === 'clustering' ||
    state.stage === 'creating';
  const isPaused = state.stage === 'paused';

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const q of queue) {
      if (q.detectedYear) set.add(q.detectedYear);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [queue]);

  const activeQueue = useMemo(() => {
    if (yearFilter === 'all') return queue;
    return queue.filter((q) => !q.detectedYear || q.detectedYear === yearFilter);
  }, [queue, yearFilter]);

  const undatedCount = useMemo(
    () =>
      activeQueue.filter((q) => q.dateSource === 'unknown' || q.dateSource === 'file-modified').length,
    [activeQueue]
  );

  const recentAutoMemories = useMemo(() => {
    return memories
      .filter((m) => m.origin === 'automatic' && !m.isPresetDemo)
      .sort((a, b) => (b.createdAt || b.memoryDate).localeCompare(a.createdAt || a.memoryDate))
      .slice(0, 12);
  }, [memories]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await enqueueFiles(fileList, { autoStart: false });
  };

  const progressPct =
    state.stage === 'creating' && state.createdTotal > 0
      ? Math.round((state.createdDone / state.createdTotal) * 100)
      : state.stage === 'clustering'
      ? 100
      : state.analyzedTotal > 0
      ? Math.round((state.analyzedDone / state.analyzedTotal) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      {/* Header + Mode Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {t('auto.eyebrow')}
            {user.isDemoAccount ? ` · ${t('demo.bannerLead').replace(':', '')}` : ''}
          </p>
          <h1 className="font-display mt-1 text-3xl font-medium text-stone-900 sm:text-4xl">
            {t('auto.title')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-stone-600">{t('auto.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex border border-stone-300 bg-white p-0.5">
            <button
              type="button"
              onClick={onSwitchToManual}
              className="min-h-[36px] cursor-pointer px-3 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              {t('create.modeManual')}
            </button>
            <button
              type="button"
              className="min-h-[36px] cursor-pointer bg-stone-900 px-3 text-xs font-medium text-white"
            >
              {t('create.modeAutoYear')}
            </button>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] cursor-pointer border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
          >
            {t('create.cancel')}
          </button>
        </div>
      </div>

      {/* Notices */}
      {state.interruptedPreviousRun && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span>{t('bg.interruptedNotice')}</span>
          <button
            type="button"
            onClick={clearInterruptedNotice}
            className="cursor-pointer font-medium underline underline-offset-4"
          >
            {t('cal.dismiss')}
          </button>
        </div>
      )}

      {state.duplicatesSkipped > 0 && (
        <div className="border border-stone-200 bg-stone-100 px-4 py-3 text-xs text-stone-700">
          {t('bg.duplicatesSkipped', { count: state.duplicatesSkipped })}
        </div>
      )}

      {state.errorMessage && (
        <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {state.errorMessage}
        </div>
      )}

      {/* Hidden Multi-File & Folder Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
        className="sr-only"
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        {...({ webkitdirectory: '' } as Record<string, string>)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
        className="sr-only"
      />

      {/* ACTIVE BACKGROUND PIPELINE STATUS CARD */}
      {(isRunning || isPaused || state.stage === 'completed' || state.stage === 'error') && (
        <section className="space-y-4 border border-stone-300 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-stone-800" />}
                <h2 className="font-display text-2xl font-medium text-stone-900">
                  {state.stage === 'preparing' && t('auth.pleaseWait')}
                  {state.stage === 'analyzing' &&
                    t('bg.organizing', { done: state.analyzedDone, total: state.analyzedTotal })}
                  {state.stage === 'clustering' && t('bg.clustering')}
                  {state.stage === 'creating' &&
                    t('bg.creating', { done: state.createdDone, total: state.createdTotal })}
                  {state.stage === 'paused' &&
                    t('bg.paused', { done: state.analyzedDone, total: state.analyzedTotal })}
                  {state.stage === 'completed' && t('bg.completed', { count: state.createdDone })}
                  {state.stage === 'error' && (state.errorMessage || t('bg.paused', { done: state.analyzedDone, total: state.analyzedTotal }))}
                </h2>
              </div>

              {state.discoveredGroups > 0 && (
                <p className="text-xs text-stone-600">
                  {t('bg.foundGroups', { count: state.discoveredGroups })}
                </p>
              )}
              {isPaused && <p className="text-xs font-medium text-amber-800">{t('auto.pausedLabel')}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isRunning && (
                <button
                  type="button"
                  onClick={onBrowseInBackground}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 bg-stone-900 px-4 text-xs font-medium text-white hover:bg-stone-800"
                >
                  <span>{t('auto.continueBrowsing')}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {(isRunning || isPaused) && (
                <>
                  <button
                    type="button"
                    onClick={isPaused ? resume : pause}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-stone-300 bg-white px-3.5 text-xs font-medium text-stone-800 hover:bg-stone-100"
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    <span>{isPaused ? t('auto.resume') : t('auto.pause')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    className="min-h-[38px] cursor-pointer border border-stone-300 px-3.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                  >
                    {t('auto.cancel')}
                  </button>
                </>
              )}

              {(state.failedCount > 0 || state.stage === 'error') && queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => retryFailed()}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-amber-300 bg-amber-50 px-3.5 text-xs font-medium text-amber-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('auto.retryFailed', { count: Math.max(1, state.failedCount) })}</span>
                </button>
              )}
            </div>
          </div>

          {(isRunning || isPaused) && (
            <div className="h-2 w-full overflow-hidden bg-stone-200">
              <div
                className="h-full bg-stone-900 transition-all duration-300"
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
            </div>
          )}
        </section>
      )}

      {/* PHOTO & FOLDER QUEUE PANEL */}
      <section className="space-y-6 border border-stone-200 bg-white p-6 sm:p-8">
        <div className="space-y-2 border border-stone-200 bg-[#faf8f3] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-700">
            {t('auto.permissionTitle')}
          </p>
          <p className="text-xs leading-relaxed text-stone-600">{t('auto.permissionBody')}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={state.stage === 'preparing'}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              <Images className="h-4 w-4" />
              <span>{t('auto.pickPhotos')}</span>
            </button>
            <button
              type="button"
              disabled={state.stage === 'preparing'}
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-400 bg-white px-5 text-xs font-medium text-stone-900 hover:bg-stone-100 disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              <span>{t('auto.pickFolder')}</span>
            </button>
            {state.stage === 'preparing' && (
              <span className="inline-flex items-center gap-2 text-xs text-stone-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('auth.pleaseWait')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Language & Year Filter Bar */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-stone-700">{t('auto.languageLabel')}</p>
            <div className="inline-flex border border-stone-300 bg-[#faf8f3] p-0.5">
              <button
                type="button"
                onClick={() => setMemoryLanguage('en')}
                className={`min-h-[36px] cursor-pointer px-4 text-xs font-medium ${
                  memoryLanguage === 'en' ? 'bg-stone-900 text-white' : 'text-stone-700'
                }`}
              >
                {t('create.langEn')}
              </button>
              <button
                type="button"
                onClick={() => setMemoryLanguage('ru')}
                className={`min-h-[36px] cursor-pointer px-4 text-xs font-medium ${
                  memoryLanguage === 'ru' ? 'bg-stone-900 text-white' : 'text-stone-700'
                }`}
              >
                {t('create.langRu')}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="auto-year-filter" className="mb-1.5 block text-xs font-medium text-stone-700">
              {t('auto.yearFilter')}
            </label>
            <select
              id="auto-year-filter"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="min-h-[40px] w-full border border-stone-300 bg-[#faf8f3] px-3 text-xs font-medium text-stone-900"
            >
              <option value="all">{t('auto.allDates')}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
              <span>
                <strong className="font-medium text-stone-900">
                  {t('auto.queuedCount', { count: activeQueue.length })}
                </strong>
                {undatedCount > 0 && ` · ${t('auto.undatedCount', { count: undatedCount })}`}
              </span>
              {!isRunning && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="cursor-pointer text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
                >
                  {t('auto.clearAll')}
                </button>
              )}
            </div>

            <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto border border-stone-200 bg-[#faf8f3] p-3 sm:grid-cols-4 md:grid-cols-5">
              {activeQueue.map((item) => (
                <div key={item.clientId} className="polaroid-card flex flex-col justify-between p-2">
                  <div>
                    <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
                      <img
                        src={item.thumbnailDataUrl || item.previewUrl}
                        alt={item.file.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {!isRunning && (
                        <button
                          type="button"
                          onClick={() => removeQueuedPhoto(item.clientId)}
                          aria-label={item.file.name}
                          className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center bg-black/70 text-white hover:bg-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[10px] text-stone-500">
                      {item.captureTime ? `${item.captureTime.slice(0, 5)} · ` : ''}
                      {item.file.name}
                    </p>
                  </div>

                  <div className="mt-1.5">
                    <input
                      type="date"
                      disabled={isRunning}
                      value={item.captureDate || ''}
                      onChange={(e) => updateQueuedDate(item.clientId, e.target.value)}
                      title={t('auto.assignDate')}
                      className="w-full border border-stone-200 bg-white px-1.5 py-1 text-[10px] text-stone-800 disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>

            {!isRunning && !isPaused && (
              <div className="flex justify-end border-t border-stone-200 pt-4">
                <button
                  type="button"
                  disabled={activeQueue.length === 0 || state.stage === 'preparing'}
                  onClick={() => startBackgroundDiscovery()}
                  className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 bg-stone-900 px-6 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{t('auto.startAnalyze')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* LIVE INCREMENTALLY SAVED AUTOMATIC MEMORIES */}
      {recentAutoMemories.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-stone-200 pb-3">
            <h2 className="font-display text-2xl font-medium text-stone-900">
              {t('auto.liveSavedTitle')} ({recentAutoMemories.length})
            </h2>
            <p className="text-xs text-stone-600">{t('auto.liveSavedSub')}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentAutoMemories.map((mem) => {
              const cover = mem.design?.collageUrl || mem.photos[0]?.url;
              return (
                <article
                  key={mem.id}
                  className="flex flex-col justify-between border border-stone-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => onOpenMemory(mem)}
                    className="block w-full cursor-pointer text-left"
                  >
                    {cover && (
                      <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                        <img
                          src={cover}
                          alt={mem.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wider text-stone-500">
                        {formatDate(mem.memoryDate)}
                        {mem.eventTimeLabel ? ` · ${mem.eventTimeLabel}` : ''}
                      </p>
                      <h3 className="font-display text-xl font-medium text-stone-900 leading-snug">
                        {mem.title}
                      </h3>
                      <p className="line-clamp-2 text-xs text-stone-600">
                        {mem.storyText || mem.design?.designSpec.moodSummary}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => onOpenDay(mem.memoryDate.slice(0, 10))}
                      className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-stone-700 hover:text-stone-900"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{t('auto.viewInDay')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenMemory(mem)}
                      className="cursor-pointer font-medium text-stone-900 underline underline-offset-4"
                    >
                      {t('auto.openSaved')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
