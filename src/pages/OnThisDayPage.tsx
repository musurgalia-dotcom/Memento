import { CalendarHeart, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { localizeDemoMemory } from '../lib/demoMemories';
import { computeDemoOnThisDay } from '../lib/demoWorkspace';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord, OnThisDayEntry } from '../lib/types';

interface OnThisDayPageProps {
  memories: MemoryRecord[];
  isDemoMode?: boolean;
  onOpenMemory: (memory: MemoryRecord) => void;
  onCreateMemory: () => void;
}

function getLocalTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function OnThisDayPage({ memories, isDemoMode = false, onOpenMemory, onCreateMemory }: OnThisDayPageProps) {
  const { t, lang, formatDate } = useI18n();
  const [targetDate, setTargetDate] = useState(getLocalTodayIso());
  const [entries, setEntries] = useState<OnThisDayEntry[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      setError(null);
      setEntries(
        computeDemoOnThisDay(memories, targetDate).map((e) => ({
          ...e,
          memory: e.memory.isPresetDemo ? localizeDemoMemory(e.memory, lang) : e.memory,
        }))
      );
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    api
      .onThisDay(targetDate)
      .then((res) => {
        if (active) setEntries(res.memories);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to check anniversaries right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetDate, isDemoMode, memories, lang]);

  const readableDate = formatDate(targetDate, {
    month: 'long',
    day: 'numeric',
  });

  const formatYearsAgo = (years: number) => {
    if (years === 1) return t('otd.oneYear');
    if (years === 2) return t('otd.twoYears');
    if (years === 3) return t('otd.threeYears');
    if (years === 5) return t('otd.fiveYears');
    if (lang === 'ru') {
      const mod10 = years % 10;
      const mod100 = years % 100;
      if (mod10 === 1 && mod100 !== 11) return `${years} год назад`;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${years} года назад`;
      return `${years} лет назад`;
    }
    return t('otd.yearsAgo', { years });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {t('otd.eyebrow')}
            {isDemoMode ? ` · ${t('demo.bannerLead').replace(':', '')}` : ''}
          </p>
          <h1 className="font-display mt-1 text-4xl font-medium text-stone-900 sm:text-5xl">
            {t('otd.title', { date: readableDate })}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="on-this-day-date" className="text-xs text-stone-500">
            {t('otd.inspectDate')}
          </label>
          <input
            id="on-this-day-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="min-h-[40px] border border-stone-300 bg-white px-3 text-xs text-stone-800"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          {t('otd.loading', { date: readableDate })}
        </div>
      ) : entries.length === 0 ? (
        <div className="border border-stone-200 bg-white px-6 py-16 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-stone-200 bg-[#faf8f3] text-stone-500">
            <CalendarHeart className="h-5 w-5" />
          </div>
          <h2 className="font-display text-3xl font-medium text-stone-900">
            {t('otd.emptyTitle', { date: readableDate })}
          </h2>
          <p className="mx-auto max-w-md text-sm text-stone-500">{t('otd.emptySub')}</p>
          <button
            type="button"
            onClick={onCreateMemory}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            <span>{t('otd.createToday')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {entries.map(({ yearsAgo, memory }) => (
            <article
              key={memory.id}
              className="grid gap-6 border border-stone-200 bg-white p-6 md:grid-cols-12 md:items-center"
            >
              <div className="grid grid-cols-2 gap-3 md:col-span-6">
                {memory.photos[0] && (
                  <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                    <img
                      src={memory.photos[0].url}
                      alt={memory.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {memory.design?.collageUrl ? (
                  <div className="aspect-[4/3] overflow-hidden border border-stone-200 bg-stone-50">
                    <img
                      src={memory.design.collageUrl}
                      alt={memory.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex aspect-[4/3] flex-col justify-between p-4"
                    style={{
                      backgroundColor: memory.design?.designSpec.palette.background || '#FAF8F3',
                      color: memory.design?.designSpec.palette.ink || '#1E1B18',
                    }}
                  >
                    <span className="text-[11px] uppercase tracking-wider opacity-70">{t('otd.moodLabel')}</span>
                    <p className="font-handwriting text-xl leading-snug">
                      {memory.design?.designSpec.atmosphereKeywords.join(' · ')}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 md:col-span-6">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {formatYearsAgo(yearsAgo)} · {formatDate(memory.memoryDate)}
                </p>
                <h2 className="font-display text-3xl font-medium text-stone-900">{memory.title}</h2>
                <p className="font-serif-prose text-sm leading-relaxed text-stone-700">
                  {memory.storyText || memory.design?.designSpec.moodSummary}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenMemory(memory)}
                  className="inline-flex min-h-[42px] cursor-pointer items-center bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800"
                >
                  {t('otd.reopen')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
