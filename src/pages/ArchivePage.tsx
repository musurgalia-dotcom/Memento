import { Plus, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_MEMORIES, localizeDemoMemory } from '../lib/demoMemories';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord } from '../lib/types';

interface ArchivePageProps {
  memories: MemoryRecord[];
  isDemoMode?: boolean;
  onOpenMemory: (memory: MemoryRecord) => void;
  onCreateNew: () => void;
  onCreateFromYear?: () => void;
}

export function ArchivePage({
  memories,
  isDemoMode = false,
  onOpenMemory,
  onCreateNew,
  onCreateFromYear,
}: ArchivePageProps) {
  const { t, lang, months, formatDate } = useI18n();
  const [tab, setTab] = useState<'personal' | 'demo'>('personal');
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'automatic' | 'manual'>('all');

  const displayMemories = useMemo(
    () => memories.map((m) => (m.isPresetDemo ? localizeDemoMemory(m, lang) : m)),
    [memories, lang]
  );

  const showcasePresets = useMemo(
    () => DEMO_MEMORIES.map((d) => localizeDemoMemory(d, lang)),
    [lang]
  );

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    displayMemories.forEach((m) => set.add(m.memoryDate.slice(0, 4)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [displayMemories]);

  const filteredPersonal = useMemo(() => {
    const q = query.trim().toLowerCase();
    return displayMemories.filter((m) => {
      if (yearFilter && !m.memoryDate.startsWith(yearFilter)) return false;
      if (monthFilter && m.memoryDate.slice(5, 7) !== monthFilter) return false;
      if (originFilter !== 'all') {
        const effectiveOrigin = m.origin === 'automatic' ? 'automatic' : 'manual';
        if (effectiveOrigin !== originFilter) return false;
      }
      if (!q) return true;
      const hay = [
        m.title,
        m.storyText,
        m.music?.trackTitle || '',
        m.music?.artist || '',
        ...m.answers.map((a) => a.answer),
        ...(m.design?.designSpec.atmosphereKeywords || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [displayMemories, query, yearFilter, monthFilter, originFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {isDemoMode ? t('arch.localSub') : t('arch.privateSub')}
          </p>
          <h1 className="font-display mt-1 text-4xl font-medium text-stone-900 sm:text-5xl">
            {t('arch.title')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onCreateFromYear && (
            <button
              type="button"
              onClick={onCreateFromYear}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-stone-300 bg-white px-3.5 text-xs font-medium text-stone-900 hover:border-stone-900"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('arch.importYearBtn')}</span>
            </button>
          )}

          <div className="flex items-center gap-1 border border-stone-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab('personal')}
              className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'personal' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isDemoMode
                ? t('arch.demoWorkspace', { count: displayMemories.length })
                : t('arch.personalArchive', { count: displayMemories.length })}
            </button>
            <button
              type="button"
              onClick={() => setTab('demo')}
              className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'demo' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t('arch.showcasePresets', { count: showcasePresets.length })}
            </button>
          </div>
        </div>
      </div>

      {tab === 'personal' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('arch.searchPlaceholder')}
                className="min-h-[44px] w-full border border-stone-300 bg-white pl-10 pr-9 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('create.cancel')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-stone-400 hover:text-stone-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <select
              aria-label={t('arch.allYears')}
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="min-h-[44px] border border-stone-300 bg-white px-3 text-xs font-medium tabular-nums text-stone-800 sm:col-span-2"
            >
              <option value="">{t('arch.allYears')}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              aria-label={t('arch.allMonths')}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="min-h-[44px] border border-stone-300 bg-white px-3 text-xs font-medium text-stone-800 sm:col-span-3"
            >
              <option value="">{t('arch.allMonths')}</option>
              {months.map((label, idx) => {
                const val = String(idx + 1).padStart(2, '0');
                return (
                  <option key={val} value={val}>
                    {label}
                  </option>
                );
              })}
            </select>

            <select
              aria-label={t('arch.filterAll')}
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as 'all' | 'automatic' | 'manual')}
              className="min-h-[44px] border border-stone-300 bg-white px-3 text-xs font-medium text-stone-800 sm:col-span-2"
            >
              <option value="all">{t('arch.filterAll')}</option>
              <option value="automatic">{t('arch.filterAuto')}</option>
              <option value="manual">{t('arch.filterManual')}</option>
            </select>
          </div>

          {filteredPersonal.length === 0 ? (
            <div className="border border-stone-200 bg-white px-6 py-16 text-center space-y-4">
              <h2 className="font-display text-3xl font-medium text-stone-900">
                {displayMemories.length === 0 ? t('arch.emptyTitle') : t('arch.noMatchTitle')}
              </h2>
              <p className="mx-auto max-w-md text-sm text-stone-500">
                {displayMemories.length === 0 ? t('arch.emptySub') : t('arch.noMatchSub')}
              </p>
              {displayMemories.length === 0 && (
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={onCreateNew}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('arch.createFirst')}</span>
                  </button>
                  {onCreateFromYear && (
                    <button
                      type="button"
                      onClick={onCreateFromYear}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-300 px-5 text-xs font-medium text-stone-800 hover:border-stone-900"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{t('arch.importYearBtn')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPersonal.map((mem) => {
                const formatted = formatDate(mem.memoryDate, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const keywords = mem.design?.designSpec.atmosphereKeywords || [];
                return (
                  <button
                    key={mem.id}
                    type="button"
                    onClick={() => onOpenMemory(mem)}
                    className="polaroid-card group flex cursor-pointer flex-col p-3 pb-5 text-left"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                      {(mem.design?.collageUrl || mem.photos[0]?.url) && (
                        <img
                          src={mem.design?.collageUrl || mem.photos[0].url}
                          alt={mem.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      )}
                    </div>
                    <div className="mt-3.5 space-y-1.5 px-1">
                      <p className="text-xs text-stone-500 tabular-nums">
                        {formatted} ·{' '}
                        {mem.origin === 'automatic' ? t('origin.automatic') : t('origin.manual')}
                        {keywords.length > 0 ? ` · ${keywords[0]}` : ''}
                      </p>
                      <h2 className="font-display text-2xl font-medium text-stone-900 leading-snug">
                        {mem.title}
                      </h2>
                      <p className="line-clamp-2 text-xs leading-relaxed text-stone-600">
                        {mem.storyText || mem.design?.designSpec.moodSummary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="border border-stone-200 bg-white px-4 py-3 text-xs text-stone-600">
            {t('arch.demoNotice')}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcasePresets.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => onOpenMemory(demo)}
                className="polaroid-card group flex cursor-pointer flex-col p-3 pb-5 text-left"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  <img
                    src={demo.photos[0].url}
                    alt={demo.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-3.5 space-y-1.5 px-1">
                  <p className="text-[11px] uppercase tracking-wider text-stone-500">
                    {demo.demoLabel}
                  </p>
                  <h2 className="font-display text-2xl font-medium text-stone-900 leading-snug">
                    {demo.title}
                  </h2>
                  <p className="line-clamp-2 text-xs leading-relaxed text-stone-600">
                    {demo.storyText}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
