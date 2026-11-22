import { ArrowRight, CalendarDays, FolderOpen, Plus, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { localizeDemoMemory } from '../lib/demoMemories';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord, OnThisDayEntry, UserProfile } from '../lib/types';

interface HomePageProps {
  user: UserProfile;
  memories: MemoryRecord[];
  onThisDay: OnThisDayEntry[];
  onOpenMemory: (memory: MemoryRecord) => void;
  onOpenDay: (isoDate: string) => void;
  onOpenCalendar: () => void;
  onOpenArchive: () => void;
  onCreateManual: () => void;
  onAutoImport: () => void;
  onOpenOnboarding: () => void;
}

export function HomePage({
  user,
  memories,
  onThisDay,
  onOpenMemory,
  onOpenDay,
  onOpenCalendar,
  onOpenArchive,
  onCreateManual,
  onAutoImport,
  onOpenOnboarding,
}: HomePageProps) {
  const { t, lang, months, formatDate } = useI18n();
  const currentYear = new Date().getFullYear();

  const localizedMemories = useMemo(
    () => memories.map((m) => (m.isPresetDemo ? localizeDemoMemory(m, lang) : m)),
    [memories, lang]
  );

  const recentMemories = useMemo(() => {
    return [...localizedMemories]
      .sort((a, b) => (b.createdAt || b.memoryDate).localeCompare(a.createdAt || a.memoryDate))
      .slice(0, 6);
  }, [localizedMemories]);

  const collectionMemories = useMemo(() => {
    return [...localizedMemories]
      .sort((a, b) => b.memoryDate.localeCompare(a.memoryDate))
      .slice(0, 9);
  }, [localizedMemories]);

  const rememberedDaysThisYear = useMemo(() => {
    const prefix = `${currentYear}-`;
    const uniqueDates = new Set(
      localizedMemories.filter((m) => m.memoryDate.startsWith(prefix)).map((m) => m.memoryDate.slice(0, 10))
    );
    return uniqueDates.size;
  }, [currentYear, localizedMemories]);

  const monthPresence = useMemo(() => {
    const counts = new Array<number>(12).fill(0);
    const prefix = `${currentYear}-`;
    for (const m of localizedMemories) {
      if (m.memoryDate.startsWith(prefix)) {
        const idx = Number(m.memoryDate.slice(5, 7)) - 1;
        if (idx >= 0 && idx < 12) counts[idx] += 1;
      }
    }
    return counts;
  }, [currentYear, localizedMemories]);

  const formatYearsLabel = (years: number) => {
    if (years === 1) return t('otd.oneYear');
    if (years === 2) return t('otd.twoYears');
    if (years === 3) return t('otd.threeYears');
    if (years === 5) return t('otd.fiveYears');
    return t('otd.yearsAgo', { years });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-8">
      {/* HERO JOURNAL HEADER */}
      <section className="grid gap-8 border-b border-stone-200 pb-10 lg:grid-cols-12 lg:items-end">
        <div className="space-y-4 lg:col-span-7">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {t('home.eyebrow')}
            {user.preferences?.galleryConnected
              ? ` · ${t('settings.galleryConnected', {
                  count: user.preferences.importedFingerprints?.length || 0,
                })}`
              : ''}
          </p>
          <h1 className="font-display headline-balance text-4xl font-medium leading-[1.08] text-stone-900 sm:text-5xl">
            {t('home.greeting', { name: user.name })}
          </h1>
          <p className="font-serif-prose max-w-xl text-base leading-relaxed text-stone-700">
            {t('home.subtitle')}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-5 lg:items-end">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCreateManual}
              className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium tracking-wide text-stone-50 transition-colors hover:bg-stone-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{t('home.ctaCreateManual')}</span>
            </button>
            <button
              type="button"
              onClick={onAutoImport}
              className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 border border-stone-400 bg-white px-5 text-xs font-medium text-stone-900 transition-colors hover:border-stone-900 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('home.ctaAutoImport')}</span>
            </button>
          </div>
          <p className="text-xs text-stone-500 tabular-nums">
            {t('home.photosStat', { count: localizedMemories.length })} ·{' '}
            {t('home.daysStat', { count: rememberedDaysThisYear, year: currentYear })}
          </p>
        </div>
      </section>

      {/* SECTION 1: TODAY IN YOUR MEMORIES */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl font-medium text-stone-900">{t('home.todayTitle')}</h2>
            <p className="text-xs text-stone-500">{t('home.todaySub')}</p>
          </div>
          {onThisDay.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenDay(onThisDay[0].memory.memoryDate)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-900 underline underline-offset-4"
            >
              <span>{t('otd.reopen')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {onThisDay.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border border-stone-200 bg-white px-6 py-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-stone-900">{t('home.todayEmpty')}</p>
              <p className="text-xs text-stone-500">{t('home.todayEmptySub')}</p>
            </div>
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-stone-300 px-4 text-xs font-medium text-stone-800 whitespace-nowrap hover:border-stone-900"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t('home.ctaAutoImport')}</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {onThisDay.map((entry) => {
              const mem = entry.memory.isPresetDemo ? localizeDemoMemory(entry.memory, lang) : entry.memory;
              const cover = mem.design?.collageUrl || mem.photos[0]?.url;
              return (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => onOpenMemory(mem)}
                  className="group grid cursor-pointer gap-4 border border-stone-200 bg-white p-4 text-left transition-colors hover:border-stone-900 sm:grid-cols-12"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-stone-100 sm:col-span-5">
                    {cover && (
                      <img
                        src={cover}
                        alt={mem.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="flex flex-col justify-between space-y-2 sm:col-span-7">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wider text-stone-500 tabular-nums">
                        {formatYearsLabel(entry.yearsAgo)} · {formatDate(mem.memoryDate)}
                      </p>
                      <h3 className="font-display text-2xl font-medium text-stone-900 leading-snug">
                        {mem.title}
                      </h3>
                      <p className="line-clamp-2 text-xs leading-relaxed text-stone-600">
                        {mem.storyText || mem.design?.designSpec.moodSummary}
                      </p>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      {mem.origin === 'automatic' ? t('origin.automatic') : t('origin.manual')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: RECENTLY CREATED MEMORIES */}
      <section className="space-y-5 border-t border-stone-200 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl font-medium text-stone-900">{t('home.recentTitle')}</h2>
            <p className="text-xs text-stone-500">{t('home.recentSub')}</p>
          </div>
          {localizedMemories.length > 0 && (
            <button
              type="button"
              onClick={onOpenArchive}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900"
            >
              <span>{t('home.viewAllArchive')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {recentMemories.length === 0 ? (
          <div className="border border-stone-200 bg-white px-6 py-12 text-center space-y-4">
            <p className="text-sm text-stone-600">{t('home.recentEmpty')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onCreateManual}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                <span>{t('home.ctaCreateManual')}</span>
              </button>
              <button
                type="button"
                onClick={onAutoImport}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-300 px-5 text-xs font-medium text-stone-800"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t('home.ctaAutoImport')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentMemories.map((mem) => {
              const cover = mem.design?.collageUrl || mem.photos[0]?.url;
              return (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => onOpenMemory(mem)}
                  className="polaroid-card group flex cursor-pointer flex-col p-3 pb-5 text-left"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden bg-stone-100">
                    {cover && (
                      <img
                        src={cover}
                        alt={mem.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="mt-3.5 space-y-1 px-1">
                    <p className="text-[11px] text-stone-500 tabular-nums">
                      {formatDate(mem.memoryDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {mem.eventTimeLabel ? ` · ${mem.eventTimeLabel}` : ''} ·{' '}
                      {mem.origin === 'automatic' ? t('origin.automatic') : t('origin.manual')}
                    </p>
                    <h3 className="font-display text-2xl font-medium text-stone-900 leading-snug">
                      {mem.title}
                    </h3>
                    <p className="line-clamp-2 text-xs leading-relaxed text-stone-600">
                      {mem.storyText || mem.design?.designSpec.moodSummary}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: EXPLORE YOUR YEAR */}
      <section className="grid gap-6 border border-stone-200 bg-white p-6 sm:p-8 lg:grid-cols-12 lg:items-center">
        <div className="space-y-2 lg:col-span-5">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-500">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="tabular-nums">{currentYear}</span>
          </p>
          <h2 className="font-display text-3xl font-medium text-stone-900">{t('home.exploreYearTitle')}</h2>
          <p className="text-xs leading-relaxed text-stone-600">{t('home.exploreYearSub')}</p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenCalendar}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800 whitespace-nowrap"
            >
              <span>{t('home.openCalendar')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:col-span-7">
          {months.map((mName, idx) => {
            const count = monthPresence[idx];
            return (
              <button
                key={mName}
                type="button"
                onClick={onOpenCalendar}
                className={`cursor-pointer border p-3 text-left transition-colors ${
                  count > 0
                    ? 'border-stone-900 bg-[#faf8f3]'
                    : 'border-stone-200 bg-white text-stone-400 hover:border-stone-400'
                }`}
              >
                <p className="text-xs font-medium text-stone-900 truncate">{mName}</p>
                <p className="mt-1 text-[11px] tabular-nums text-stone-500">
                  {count > 0 ? `${count} · ${t(count === 1 ? 'cal.memoryOne' : 'cal.memoryMany')}` : '—'}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: MEMORY COLLECTION */}
      {collectionMemories.length > 0 && (
        <section className="space-y-5 border-t border-stone-200 pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-3xl font-medium text-stone-900">{t('home.collectionTitle')}</h2>
              <p className="text-xs text-stone-500">{t('home.collectionSub')}</p>
            </div>
            <button
              type="button"
              onClick={onOpenArchive}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900"
            >
              <span>{t('home.viewAllArchive')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {collectionMemories.map((mem) => (
              <button
                key={`col-${mem.id}`}
                type="button"
                onClick={() => onOpenDay(mem.memoryDate.slice(0, 10))}
                className="group relative aspect-[4/3] cursor-pointer overflow-hidden border border-stone-200 bg-stone-100 text-left"
              >
                {mem.photos[0] && (
                  <img
                    src={mem.photos[0].url}
                    alt={mem.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <p className="text-[11px] uppercase tracking-wider text-stone-200 tabular-nums">
                    {formatDate(mem.memoryDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="font-display text-xl font-medium leading-tight">{mem.title}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
