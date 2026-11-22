import { ArrowLeft, Calendar, Images, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScrapbookCanvas } from '../components/ScrapbookCanvas';
import { api } from '../lib/api';
import { localizeDemoMemory } from '../lib/demoMemories';
import { buildLocalClientFallbackSpec } from '../lib/demoWorkspace';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord, UserProfile } from '../lib/types';

interface DayMemoriesPageProps {
  isoDate: string;
  user: UserProfile;
  memories: MemoryRecord[];
  onBackToCalendar: () => void;
  onOpenMemory: (memory: MemoryRecord) => void;
  onCreateForDate: (isoDate: string) => void;
  onAutoImport: () => void;
  onMemoryUpdated: (memory: MemoryRecord) => void;
  onMemoryDeleted: (memoryId: string) => void;
}

export function DayMemoriesPage({
  isoDate,
  user,
  memories,
  onBackToCalendar,
  onOpenMemory,
  onCreateForDate,
  onAutoImport,
  onMemoryUpdated,
  onMemoryDeleted,
}: DayMemoriesPageProps) {
  const { t, lang, formatDate } = useI18n();
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const dayMemories = useMemo(() => {
    const cleanDate = isoDate.slice(0, 10);
    return memories
      .filter((m) => m.memoryDate.slice(0, 10) === cleanDate)
      .map((m) => (m.isPresetDemo ? localizeDemoMemory(m, lang) : m));
  }, [isoDate, lang, memories]);

  const formattedDate = formatDate(isoDate, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formatMemoryUnit = (count: number) => {
    if (lang !== 'ru') return count === 1 ? t('cal.memoryOne') : t('cal.memoryMany');
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'воспоминание';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'воспоминания';
    return 'воспоминаний';
  };

  const handleRegenerateDesign = async (mem: MemoryRecord) => {
    if (mem.isPresetDemo) return;
    setRegeneratingId(mem.id);
    setErrorBanner(null);
    try {
      const nextSeed = Math.floor(Math.random() * 50) + 1;
      if (mem.isDemo) {
        const local = buildLocalClientFallbackSpec({
          memoryDate: mem.memoryDate,
          storyText: mem.storyText,
          answers: mem.answers,
          music: mem.music,
          memoryLanguage: mem.language || lang,
        });
        const updated: MemoryRecord = {
          ...mem,
          design: {
            collageUrl: null,
            designSpec: { ...local.designSpec, generatedTitle: mem.title },
            aiProviderUsed: local.aiProviderUsed,
            updatedAt: new Date().toISOString(),
          },
        };
        onMemoryUpdated(updated);
      } else {
        const res = await api.updateMemory(mem.id, {
          regenerateDesign: true,
          variationSeed: nextSeed,
        });
        onMemoryUpdated(res.memory);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to regenerate design.');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDeleteMemory = async (mem: MemoryRecord) => {
    if (mem.isPresetDemo) return;
    setDeletingId(mem.id);
    setErrorBanner(null);
    try {
      if (!mem.isDemo && !user.isDemoAccount) {
        await api.deleteMemory(mem.id);
      }
      onMemoryDeleted(mem.id);
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete memory.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onBackToCalendar}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('day.backCalendar')}</span>
          </button>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {dayMemories.length > 0
              ? t('day.countLabel', {
                  count: dayMemories.length,
                  unit: formatMemoryUnit(dayMemories.length),
                })
              : formattedDate}
          </p>
          <h1 className="font-display headline-balance text-3xl font-medium text-stone-900 sm:text-5xl">
            {formattedDate} — {t('day.titleSuffix')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onCreateForDate(isoDate.slice(0, 10))}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 bg-stone-900 px-4 text-xs font-medium text-white hover:bg-stone-800 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('day.addAnotherManual')}</span>
          </button>
          <button
            type="button"
            onClick={onAutoImport}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-300 bg-white px-4 text-xs font-medium text-stone-800 hover:border-stone-900 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('day.importPhotos')}</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {errorBanner}
        </div>
      )}

      {dayMemories.length === 0 ? (
        <div className="border border-stone-200 bg-white px-6 py-16 text-center space-y-4">
          <Calendar className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="font-display text-3xl font-medium text-stone-900">{t('day.emptyTitle')}</h2>
          <p className="mx-auto max-w-md text-sm text-stone-600">{t('day.emptySub')}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onCreateForDate(isoDate.slice(0, 10))}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              <span>{t('day.addAnotherManual')}</span>
            </button>
            <button
              type="button"
              onClick={onAutoImport}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-300 bg-white px-5 text-xs font-medium text-stone-800"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('day.importPhotos')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {dayMemories.map((mem, idx) => {
            const spec = mem.design?.designSpec;
            const collageUrl = mem.design?.collageUrl;
            const originLabel = mem.origin === 'automatic' ? t('origin.automatic') : t('origin.manual');
            const isConfirmingDelete = confirmDeleteId === mem.id;

            return (
              <article
                key={mem.id}
                className="grid gap-6 border border-stone-200 bg-white p-5 sm:p-7 lg:grid-cols-12"
              >
                {/* Pre-rendered Artistic Collage or Live Scrapbook Visual */}
                <div className="space-y-3 lg:col-span-6">
                  {collageUrl ? (
                    <button
                      type="button"
                      onClick={() => onOpenMemory(mem)}
                      className="block w-full cursor-pointer overflow-hidden border border-stone-200 bg-stone-100"
                    >
                      <img
                        src={collageUrl}
                        alt={mem.title}
                        loading="lazy"
                        className="w-full object-cover transition-transform duration-300 hover:scale-[1.01]"
                      />
                    </button>
                  ) : spec ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenMemory(mem)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenMemory(mem);
                        }
                      }}
                      className="cursor-pointer border border-stone-200"
                    >
                      <ScrapbookCanvas memory={mem} />
                    </div>
                  ) : (
                    mem.photos[0] && (
                      <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                        <img
                          src={mem.photos[0].url}
                          alt={mem.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )
                  )}
                </div>

                {/* Memory Details, Photo Strip & Actions */}
                <div className="flex flex-col justify-between space-y-5 lg:col-span-6">
                  <div className="space-y-3">
                    <p className="text-xs text-stone-500">
                      <span className="tabular-nums font-medium text-stone-700">#{idx + 1}</span>
                      {mem.eventTimeLabel ? ` · ${mem.eventTimeLabel}` : ''} · {originLabel} ·{' '}
                      {t('create.photosCount', { count: mem.photos.length })}
                    </p>
                    <h2 className="font-display text-3xl font-medium text-stone-900 leading-tight">
                      {mem.title}
                    </h2>
                    <p className="font-serif-prose text-base leading-relaxed text-stone-700">
                      {mem.storyText || spec?.moodSummary}
                    </p>

                    {spec?.atmosphereKeywords && spec.atmosphereKeywords.length > 0 && (
                      <p className="text-xs text-stone-500">
                        {spec.atmosphereKeywords.join(' · ')}
                      </p>
                    )}

                    {/* Original Photos Strip */}
                    {mem.photos.length > 0 && (
                      <div className="pt-2">
                        <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-stone-500">
                          <Images className="h-3.5 w-3.5" />
                          <span>{t('day.viewOriginals', { count: mem.photos.length })}</span>
                        </p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                          {mem.photos.slice(0, 5).map((ph) => (
                            <button
                              key={ph.id}
                              type="button"
                              onClick={() => onOpenMemory(mem)}
                              className="aspect-square cursor-pointer overflow-hidden border border-stone-200 bg-stone-100"
                            >
                              <img
                                src={ph.url}
                                alt={ph.originalName}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover hover:opacity-90"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Row */}
                  <div className="space-y-3 border-t border-stone-200 pt-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenMemory(mem)}
                        className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 bg-stone-900 px-4 text-xs font-medium text-white hover:bg-stone-800 whitespace-nowrap"
                      >
                        <span>{t('day.openScrapbook')}</span>
                      </button>

                      {!mem.isPresetDemo && (
                        <>
                          <button
                            type="button"
                            disabled={regeneratingId === mem.id}
                            onClick={() => handleRegenerateDesign(mem)}
                            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-stone-300 px-3.5 text-xs font-medium text-stone-800 hover:border-stone-900 whitespace-nowrap disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${regeneratingId === mem.id ? 'animate-spin' : ''}`}
                            />
                            <span>
                              {regeneratingId === mem.id ? t('detail.regenerating') : t('day.regenerate')}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : mem.id)}
                            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-red-200 px-3.5 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t('detail.delete')}</span>
                          </button>
                        </>
                      )}
                    </div>

                    {isConfirmingDelete && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs">
                        <span className="text-red-900">{t('detail.deleteConfirmTitle')}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === mem.id}
                            onClick={() => handleDeleteMemory(mem)}
                            className="min-h-[32px] cursor-pointer bg-red-700 px-3 text-xs font-medium text-white"
                          >
                            {deletingId === mem.id ? t('detail.deleting') : t('detail.confirmDelete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[32px] cursor-pointer border border-stone-300 bg-white px-3 text-xs text-stone-700"
                          >
                            {t('create.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
