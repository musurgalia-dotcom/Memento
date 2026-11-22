import { FolderSearch, Loader2, Pause, Play, X } from 'lucide-react';
import { useAutoImport } from '../lib/autoImportManager';
import { useI18n } from '../lib/i18n';

interface AutoImportBannerProps {
  onOpenOrganizer: () => void;
}

export function AutoImportBanner({ onOpenOrganizer }: AutoImportBannerProps) {
  const { state, pause, resume, cancel, dismissBanner } = useAutoImport();
  const { t } = useI18n();

  const shouldShow =
    !state.bannerDismissed &&
    (state.stage !== 'idle' || state.interruptedPreviousRun);

  if (!shouldShow) return null;

  const isRunning =
    state.stage === 'preparing' ||
    state.stage === 'analyzing' ||
    state.stage === 'clustering' ||
    state.stage === 'creating';
  const isPaused = state.stage === 'paused';

  const progressPct =
    state.stage === 'creating' && state.createdTotal > 0
      ? Math.round((state.createdDone / state.createdTotal) * 100)
      : state.stage === 'clustering'
      ? 100
      : state.analyzedTotal > 0
      ? Math.round((state.analyzedDone / state.analyzedTotal) * 100)
      : 0;

  return (
    <div className="border-b border-stone-200 bg-white px-4 py-2.5 text-xs text-stone-800 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isRunning ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-stone-900" aria-hidden="true" />
          ) : (
            <FolderSearch className="h-4 w-4 shrink-0 text-stone-700" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="font-medium text-stone-900">
                {state.interruptedPreviousRun && state.stage === 'idle' && t('bg.interruptedNotice')}
                {state.stage === 'preparing' && t('auth.pleaseWait')}
                {state.stage === 'analyzing' &&
                  t('bg.organizing', { done: state.analyzedDone, total: state.analyzedTotal })}
                {state.stage === 'clustering' && t('bg.clustering')}
                {state.stage === 'creating' && (
                  <>
                    {t('bg.foundGroups', { count: state.discoveredGroups })} ·{' '}
                    {t('bg.creating', { done: state.createdDone, total: state.createdTotal })}
                  </>
                )}
                {state.stage === 'paused' &&
                  t('bg.paused', {
                    done:
                      state.resumeFromStage === 'creating' ? state.createdDone : state.analyzedDone,
                    total:
                      state.resumeFromStage === 'creating' ? state.createdTotal : state.analyzedTotal,
                  })}
                {state.stage === 'completed' && t('bg.completed', { count: state.createdDone })}
                {state.stage === 'error' && (state.errorMessage || 'Automatic organizer stopped.')}
              </span>

              {state.duplicatesSkipped > 0 && (
                <span className="text-[11px] text-stone-500">
                  {t('bg.duplicatesSkipped', { count: state.duplicatesSkipped })}
                </span>
              )}
            </div>

            {(isRunning || isPaused) && (
              <div className="h-1 max-w-sm overflow-hidden bg-stone-200">
                <div
                  className="h-full bg-stone-900 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <button
              type="button"
              onClick={pause}
              className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 border border-stone-300 px-2.5 text-[11px] font-medium text-stone-800 whitespace-nowrap hover:bg-stone-100"
            >
              <Pause className="h-3 w-3" />
              <span>{t('auto.pause')}</span>
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={resume}
              className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 border border-stone-900 bg-stone-900 px-2.5 text-[11px] font-medium text-white whitespace-nowrap"
            >
              <Play className="h-3 w-3" />
              <span>{t('auto.resume')}</span>
            </button>
          )}
          {(isRunning || isPaused) && (
            <button
              type="button"
              onClick={cancel}
              className="min-h-[32px] cursor-pointer border border-stone-300 px-2.5 text-[11px] font-medium text-stone-600 whitespace-nowrap hover:bg-stone-100"
            >
              {t('auto.cancel')}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenOrganizer}
            className="min-h-[32px] cursor-pointer border border-stone-300 px-3 text-[11px] font-medium text-stone-900 whitespace-nowrap hover:border-stone-900"
          >
            {t('bg.openOrganizer')}
          </button>

          {!isRunning && !isPaused && (
            <button
              type="button"
              onClick={dismissBanner}
              aria-label={t('cal.dismiss')}
              className="flex h-8 w-8 cursor-pointer items-center justify-center text-stone-500 hover:text-stone-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
