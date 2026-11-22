import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  CALENDAR_MOOD_COLORS,
  type CalendarColorMode,
  type CalendarMoodCategory,
} from '../lib/artLibrary';
import { localizeDemoMemory } from '../lib/demoMemories';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord, OnThisDayEntry, UserProfile } from '../lib/types';

interface CalendarPageProps {
  user: UserProfile;
  memories: MemoryRecord[];
  onThisDay: OnThisDayEntry[];
  onOpenDay: (isoDate: string) => void;
  onCreateForDate?: (isoDate: string) => void;
  onCreateFromYear?: () => void;
  onOpenOnThisDay: () => void;
  onUserUpdated: (user: UserProfile) => void;
}

function inferMoodCategory(mem: MemoryRecord): CalendarMoodCategory {
  const cat = mem.design?.designSpec.calendarMoodCategory;
  if (cat && CALENDAR_MOOD_COLORS[cat]) return cat;
  const text = [
    mem.design?.designSpec.moodSummary || '',
    ...(mem.design?.designSpec.atmosphereKeywords || []),
  ]
    .join(' ')
    .toLowerCase();
  if (/(night|midnight|rain|city|solitude|ноч|дожд)/.test(text)) return 'night';
  if (/(nostalg|autumn|coffee|sepia|ностальг|осен|кофе)/.test(text)) return 'nostalgic';
  if (/(happy|sun|sea|summer|joy|bright|freedom|счаст|солнц|мор|лет)/.test(text)) return 'happy';
  if (/(calm|peace|snow|quiet|поко|тиш|снег)/.test(text)) return 'calm';
  return 'neutral';
}

function getMarkerStyle(
  dayMems: MemoryRecord[],
  colorMode: CalendarColorMode
): { bg: string; fg: string } {
  if (colorMode === 'monochrome') {
    return { bg: '#1E1B18', fg: '#FAF8F3' };
  }
  const primary = dayMems[0];
  if (colorMode === 'palette') {
    const accent = primary.design?.designSpec.palette.primaryAccent || '#2E4A62';
    const r = parseInt(accent.slice(1, 3), 16) || 80;
    const g = parseInt(accent.slice(3, 5), 16) || 80;
    const b = parseInt(accent.slice(5, 7), 16) || 80;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return {
      bg: accent,
      fg: lum < 0.55 ? '#FFFFFF' : '#1E1B18',
    };
  }
  const moodCat = inferMoodCategory(primary);
  const token = CALENDAR_MOOD_COLORS[moodCat];
  return { bg: token.fill, fg: token.text };
}

export function CalendarPage({
  user,
  memories,
  onThisDay,
  onOpenDay,
  onCreateFromYear,
  onOpenOnThisDay,
  onUserUpdated,
}: CalendarPageProps) {
  const { t, lang, months, weekdaysShort, weekdays, formatDate } = useI18n();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [viewMode, setViewMode] = useState<'year' | 'month'>('year');
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [savingColorMode, setSavingColorMode] = useState(false);

  const colorMode: CalendarColorMode = user.preferences?.calendarColorMode || 'atmosphere';

  const localizedMemories = useMemo(
    () => memories.map((m) => (m.isPresetDemo ? localizeDemoMemory(m, lang) : m)),
    [memories, lang]
  );

  const memoriesByDate = useMemo(() => {
    const map = new Map<string, MemoryRecord[]>();
    for (const mem of localizedMemories) {
      const key = mem.memoryDate.slice(0, 10);
      const list = map.get(key) || [];
      list.push(mem);
      map.set(key, list);
    }
    return map;
  }, [localizedMemories]);

  const yearMemoryCount = useMemo(() => {
    const prefix = `${viewYear}-`;
    return localizedMemories.filter((m) => m.memoryDate.startsWith(prefix)).length;
  }, [localizedMemories, viewYear]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([today.getFullYear()]);
    for (let y = today.getFullYear() - 5; y <= today.getFullYear() + 1; y++) years.add(y);
    for (const m of localizedMemories) years.add(Number(m.memoryDate.slice(0, 4)));
    return Array.from(years).sort((a, b) => b - a);
  }, [localizedMemories]);

  const formatMemoryUnit = (count: number) => {
    if (lang !== 'ru') return count === 1 ? t('cal.memoryOne') : t('cal.memoryMany');
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'воспоминание';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'воспоминания';
    return 'воспоминаний';
  };

  const handleColorModeChange = async (mode: CalendarColorMode) => {
    if (user.isDemoAccount) {
      onUserUpdated({
        ...user,
        preferences: {
          ...user.preferences,
          calendarColorMode: mode,
        },
      });
      return;
    }

    setSavingColorMode(true);
    try {
      const res = await api.updateProfile({ preferences: { calendarColorMode: mode } });
      onUserUpdated(res.user);
    } finally {
      setSavingColorMode(false);
    }
  };

  const handleDateSelect = (isoDate: string) => {
    onOpenDay(isoDate);
  };

  const monthCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; isoDate: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, isoDate: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ day: d, isoDate: `${viewYear}-${mm}-${dd}` });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-8">
      {/* Editorial Header + View Controls */}
      <div className="flex flex-col justify-between gap-5 border-b border-stone-200 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {t('cal.atlas')} · {yearMemoryCount} {formatMemoryUnit(yearMemoryCount)} {t('cal.inYear', { year: viewYear })}
          </p>
          <h1 className="font-display mt-1 text-4xl font-medium text-stone-900 sm:text-5xl">
            {viewMode === 'year' ? (
              <span className="tabular-nums">{viewYear}</span>
            ) : (
              <>
                {months[viewMonth]} <span className="tabular-nums text-stone-500">{viewYear}</span>
              </>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onCreateFromYear && (
            <button
              type="button"
              onClick={onCreateFromYear}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-stone-900 bg-stone-900 px-3.5 text-xs font-medium text-white hover:bg-stone-800"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('cal.autoYearCta')}</span>
            </button>
          )}

          {/* Year | Month View Switcher */}
          <div className="flex items-center border border-stone-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('year')}
              className={`min-h-[36px] cursor-pointer px-3.5 text-xs font-medium whitespace-nowrap transition-colors ${
                viewMode === 'year' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t('cal.yearView')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`min-h-[36px] cursor-pointer px-3.5 text-xs font-medium whitespace-nowrap transition-colors ${
                viewMode === 'month' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t('cal.monthView')}
            </button>
          </div>

          {/* Year Navigation */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (viewMode === 'year' ? setViewYear((y) => y - 1) : shiftMonth(-1))}
              aria-label={viewMode === 'year' ? t('cal.prevYear') : t('cal.prevMonth')}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              aria-label={String(viewYear)}
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="min-h-[40px] border border-stone-300 bg-white px-3 text-xs font-medium tabular-nums text-stone-800"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => (viewMode === 'year' ? setViewYear((y) => y + 1) : shiftMonth(1))}
              aria-label={viewMode === 'year' ? t('cal.nextYear') : t('cal.nextMonth')}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar: Calendar Color System + On This Day Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span className="font-medium text-stone-700">{t('cal.dateMarkers')}</span>
          <div className="flex items-center border border-stone-200 bg-white p-0.5">
            {(
              [
                { id: 'atmosphere', label: t('cal.modeAtmosphere') },
                { id: 'palette', label: t('cal.modePalette') },
                { id: 'monochrome', label: t('cal.modeMonochrome') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={savingColorMode}
                onClick={() => handleColorModeChange(opt.id)}
                className={`min-h-[32px] cursor-pointer px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  colorMode === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {colorMode === 'atmosphere' && (
            <span className="hidden items-center gap-3 pl-2 text-[11px] text-stone-500 sm:inline-flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALENDAR_MOOD_COLORS.calm.fill }} />
                {t('cal.legendCalm')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALENDAR_MOOD_COLORS.happy.fill }} />
                {t('cal.legendWarm')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALENDAR_MOOD_COLORS.nostalgic.fill }} />
                {t('cal.legendNostalgic')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALENDAR_MOOD_COLORS.night.fill }} />
                {t('cal.legendNight')}
              </span>
            </span>
          )}
        </div>

        {onThisDay.length > 0 && (
          <button
            type="button"
            onClick={onOpenOnThisDay}
            className="flex cursor-pointer items-center gap-3 border border-stone-300 bg-white px-3.5 py-2 text-left transition-colors hover:border-stone-900"
          >
            {onThisDay[0].memory.photos[0] && (
              <img
                src={onThisDay[0].memory.photos[0].url}
                alt={onThisDay[0].memory.title}
                referrerPolicy="no-referrer"
                className="h-9 w-9 shrink-0 object-cover"
              />
            )}
            <div className="text-xs">
              <span className="font-medium text-stone-900">{t('cal.onThisDay')}</span>
              <span className="text-stone-500">
                {' '}· {onThisDay.length} {formatMemoryUnit(onThisDay.length)}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* VIEW 1: FULL 12-MONTH YEAR CALENDAR */}
      {viewMode === 'year' ? (
        <section
          aria-label={String(viewYear)}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {months.map((monthName, monthIdx) => {
            const firstDay = new Date(viewYear, monthIdx, 1).getDay();
            const daysInMonth = new Date(viewYear, monthIdx + 1, 0).getDate();
            const cells: Array<{ day: number | null; iso: string | null }> = [];
            for (let i = 0; i < firstDay; i++) cells.push({ day: null, iso: null });
            for (let d = 1; d <= daysInMonth; d++) {
              const mm = String(monthIdx + 1).padStart(2, '0');
              const dd = String(d).padStart(2, '0');
              cells.push({ day: d, iso: `${viewYear}-${mm}-${dd}` });
            }

            const monthCount = cells.reduce(
              (acc, c) => (c.iso && memoriesByDate.has(c.iso) ? acc + (memoriesByDate.get(c.iso)?.length || 0) : acc),
              0
            );

            return (
              <div
                key={monthName}
                className="border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300"
              >
                <div className="mb-3 flex items-baseline justify-between border-b border-stone-100 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMonth(monthIdx);
                      setViewMode('month');
                    }}
                    className="font-display cursor-pointer text-xl font-medium text-stone-900 hover:underline underline-offset-4"
                  >
                    {monthName}
                  </button>
                  {monthCount > 0 && (
                    <span className="text-[11px] tabular-nums text-stone-500">{monthCount}</span>
                  )}
                </div>

                <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-medium text-stone-400">
                  {weekdaysShort.map((w, i) => (
                    <span key={`${monthName}-w-${i}`}>{w}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((cell, idx) => {
                    if (!cell.day || !cell.iso) {
                      return <div key={`empty-${monthIdx}-${idx}`} className="h-8" />;
                    }

                    const dayMems = memoriesByDate.get(cell.iso) || [];
                    const hasMemories = dayMems.length > 0;
                    const isToday = cell.iso === todayIso;
                    const marker = hasMemories ? getMarkerStyle(dayMems, colorMode) : null;

                    return (
                      <div key={cell.iso} className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleDateSelect(cell.iso!)}
                          title={
                            hasMemories
                              ? `${dayMems.length} · ${dayMems.map((m) => m.title).join(', ')}`
                              : cell.iso
                          }
                          className={`relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[11px] tabular-nums transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                            hasMemories
                              ? 'font-semibold shadow-xs'
                              : isToday
                              ? 'border border-stone-500 text-stone-900 font-medium'
                              : 'border border-stone-200/80 text-stone-500 hover:border-stone-400 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                          style={
                            marker
                              ? {
                                  backgroundColor: marker.bg,
                                  color: marker.fg,
                                  boxShadow:
                                    dayMems.length > 1
                                      ? `0 0 0 1.5px #FFFFFF, 0 0 0 3px ${marker.bg}`
                                      : undefined,
                                }
                              : undefined
                          }
                        >
                          {cell.day}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        /* VIEW 2: EXPANDED MONTH VIEW */
        <section className="border border-stone-200 bg-white p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <select
              aria-label={months[viewMonth]}
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="min-h-[40px] border border-stone-200 bg-[#faf8f3] px-3 text-xs font-medium text-stone-800"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              className="min-h-[40px] cursor-pointer border border-stone-200 px-3 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              {t('cal.jumpToday')}
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-200 pb-2 text-center text-[11px] font-medium uppercase tracking-wider text-stone-500">
            {weekdays.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {monthCells.map((cell, idx) => {
              if (!cell.day || !cell.isoDate) {
                return <div key={`m-empty-${idx}`} className="aspect-square bg-stone-50/60" />;
              }

              const dayMems = memoriesByDate.get(cell.isoDate) || [];
              const hasMems = dayMems.length > 0;
              const thumb = dayMems[0]?.photos[0]?.url;
              const marker = hasMems ? getMarkerStyle(dayMems, colorMode) : null;
              const isToday = cell.isoDate === todayIso;

              return (
                <button
                  key={cell.isoDate}
                  type="button"
                  onClick={() => handleDateSelect(cell.isoDate!)}
                  className={`group relative flex aspect-square cursor-pointer flex-col justify-between overflow-hidden border p-2 text-left transition-colors ${
                    hasMems
                      ? 'border-stone-300 hover:border-stone-900'
                      : 'border-stone-100 hover:border-stone-300'
                  }`}
                >
                  {thumb && (
                    <>
                      <img
                        src={thumb}
                        alt={dayMems[0].title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />
                    </>
                  )}

                  <span
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums font-medium ${
                      marker ? '' : isToday ? 'border border-stone-900 text-stone-900' : 'text-stone-600'
                    }`}
                    style={marker ? { backgroundColor: marker.bg, color: marker.fg } : undefined}
                  >
                    {cell.day}
                  </span>

                  {hasMems && (
                    <span className="relative z-10 hidden truncate text-[11px] font-medium text-white sm:block">
                      {dayMems.length > 1
                        ? `${dayMems.length} ${formatMemoryUnit(dayMems.length)}`
                        : dayMems[0].title}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
