import { Check, ExternalLink, Link2, Music, Pause, Play, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, safeExternalHref } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { MemoryMusicRecord } from '../lib/types';

interface MusicPickerProps {
  value: MemoryMusicRecord | null;
  onChange: (music: MemoryMusicRecord | null) => void;
}

const MOOD_CHIPS_EN = [
  'dreamy and nostalgic',
  'warm summer evening',
  'soft piano and rain',
  'cinematic, emotional, peaceful',
  'energetic and carefree',
  'gentle acoustic morning',
];

const MOOD_CHIPS_RU = [
  'мечтательно и ностальгично',
  'тёплый летний вечер',
  'тихое пианино и дождь',
  'кинематографично и спокойно',
  'энергично и беззаботно',
  'лёгкая утренняя акустика',
];

function inferLocalMoodProfile(desc: string): { tempoFeel: string; energy: number; mood: string } {
  const lower = desc.toLowerCase();
  if (/(energetic|carefree|upbeat|dance|bright|энерг|беззабот|танц|жив)/.test(lower)) {
    return { tempoFeel: 'brisk', energy: 1.2, mood: desc };
  }
  if (/(calm|peace|piano|rain|still|soft|спокой|тих|пианино|дожд|нежн)/.test(lower)) {
    return { tempoFeel: 'still', energy: 0.72, mood: desc };
  }
  if (/(dreamy|nostalgic|cinematic|emotional|summer|ностальг|мечтат|кино|эмоц|летн)/.test(lower)) {
    return { tempoFeel: 'floating', energy: 0.85, mood: desc };
  }
  return { tempoFeel: 'balanced', energy: 0.95, mood: desc };
}

export function MusicPicker({ value, onChange }: MusicPickerProps) {
  const { lang, t } = useI18n();
  const [mode, setMode] = useState<'specific' | 'description' | 'custom'>(
    value?.mode === 'description' || value?.mode === 'custom' ? value.mode : 'specific'
  );
  const [query, setQuery] = useState(value?.queryOrMood || '');
  const [customUrl, setCustomUrl] = useState(value?.externalUrl || '');
  const [customTitle, setCustomTitle] = useState(value?.trackTitle || '');
  const [customArtist, setCustomArtist] = useState(value?.artist || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [interpretedQuery, setInterpretedQuery] = useState<string | null>(null);
  const [results, setResults] = useState<
    Array<{
      trackTitle: string;
      artist: string;
      album: string | null;
      artworkUrl: string | null;
      previewUrl: string | null;
      externalUrl: string | null;
      source: 'itunes' | 'custom-link';
      musicProfile: { tempoFeel: string; energy: number; mood: string };
    }>
  >([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePreview = (previewUrl: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingUrl(null);
    }
    if (playingUrl === previewUrl) {
      audioRef.current.pause();
      setPlayingUrl(null);
    } else {
      audioRef.current.src = previewUrl;
      audioRef.current.play().catch(() => {});
      setPlayingUrl(previewUrl);
    }
  };

  const applyMoodDirectly = (moodText?: string) => {
    const clean = (moodText ?? query).trim();
    if (!clean) {
      setError(
        lang === 'ru'
          ? 'Напишите или выберите описание музыкального настроения.'
          : 'Please write or choose a musical mood description first.'
      );
      return;
    }
    setError(null);
    setQuery(clean);
    onChange({
      mode: 'description',
      queryOrMood: clean,
      trackTitle: clean,
      artist: lang === 'ru' ? 'Музыкальное настроение' : 'Musical Mood Direction',
      source: 'mood-description',
      musicProfile: inferLocalMoodProfile(clean),
    });
    setInfoMessage(
      lang === 'ru'
        ? 'Настроение музыки прикреплено — оно повлияет на ритм и атмосферу воспоминания.'
        : 'Musical mood attached directly to guide your memory design.'
    );
  };

  const runSearch = async (overrideQuery?: string) => {
    const rawInput = mode === 'custom' ? (overrideQuery ?? customUrl) : (overrideQuery ?? query);
    const q = rawInput.trim();
    if (!q) {
      setError(
        mode === 'custom'
          ? lang === 'ru'
            ? 'Вставьте ссылку на Spotify, YouTube, YouTube Music или другой сервис.'
            : 'Please paste a Spotify, YouTube, YouTube Music, or other music link.'
          : lang === 'ru'
          ? 'Введите название песни, имя исполнителя или настроение.'
          : 'Please enter a song title, artist, or mood description.'
      );
      return;
    }
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await api.searchMusic({
        mode,
        query: q,
        customTitle: mode === 'custom' ? customTitle : undefined,
        customArtist: mode === 'custom' ? customArtist : undefined,
      });
      setInterpretedQuery(res.interpretedQuery);
      setResults(res.tracks);
      if (res.message) setInfoMessage(res.message);

      if (mode === 'custom' && res.tracks[0]) {
        const tr = res.tracks[0];
        setCustomTitle(tr.trackTitle);
        setCustomArtist(tr.artist);
        onChange({
          mode: 'custom',
          queryOrMood: q,
          trackTitle: tr.trackTitle,
          artist: tr.artist,
          album: tr.album,
          artworkUrl: tr.artworkUrl,
          externalUrl: tr.externalUrl,
          source: 'custom-link',
          musicProfile: tr.musicProfile,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : lang === 'ru' ? 'Поиск музыки не удался.' : 'Music search failed.');
    } finally {
      setLoading(false);
    }
  };

  const selectedExternalHref = safeExternalHref(value?.externalUrl);
  const moodChips = lang === 'ru' ? MOOD_CHIPS_RU : MOOD_CHIPS_EN;

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setMode('specific');
            setError(null);
            setInfoMessage(null);
          }}
          className={`min-h-[40px] cursor-pointer px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            mode === 'specific'
              ? 'bg-stone-900 text-stone-50'
              : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
          }`}
        >
          {t('music.tabSpecific')}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('custom');
            setError(null);
            setInfoMessage(null);
          }}
          className={`min-h-[40px] cursor-pointer px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            mode === 'custom'
              ? 'bg-stone-900 text-stone-50'
              : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
          }`}
        >
          {t('music.tabCustom')}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('description');
            setError(null);
            setInfoMessage(null);
          }}
          className={`min-h-[40px] cursor-pointer px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            mode === 'description'
              ? 'bg-stone-900 text-stone-50'
              : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
          }`}
        >
          {t('music.tabMood')}
        </button>
      </div>

      {/* Selected Soundtrack Summary */}
      {value && value.mode !== 'none' && (
        <div className="flex flex-wrap items-center justify-between gap-4 border border-stone-300 bg-white p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {value.artworkUrl ? (
              <img
                src={value.artworkUrl}
                alt={value.trackTitle || 'Album artwork'}
                referrerPolicy="no-referrer"
                className="h-12 w-12 shrink-0 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-stone-100 text-stone-600">
                <Music className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">
                {value.trackTitle || value.queryOrMood}
              </p>
              <p className="truncate text-xs text-stone-500">
                {value.artist || ''}
                {value.album ? ` · ${value.album}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {value.previewUrl && (
              <button
                type="button"
                onClick={() => togglePreview(value.previewUrl!)}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 border border-stone-300 px-3 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                {playingUrl === value.previewUrl ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{playingUrl === value.previewUrl ? t('music.pause') : t('music.preview')}</span>
              </button>
            )}
            {selectedExternalHref && (
              <a
                href={selectedExternalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 border border-stone-900 px-3 text-xs font-medium text-stone-900 hover:bg-stone-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t('music.open')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                audioRef.current?.pause();
                setPlayingUrl(null);
                onChange(null);
              }}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-stone-300 text-stone-600 hover:bg-stone-100"
              aria-label="Remove selected song"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mood chips when in description mode */}
      {mode === 'description' && (
        <div className="flex flex-wrap gap-2">
          {moodChips.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => applyMoodDirectly(mood)}
              className="min-h-[36px] cursor-pointer border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:border-stone-900 hover:text-stone-900"
            >
              {mood}
            </button>
          ))}
        </div>
      )}

      {/* Input Controls */}
      {mode === 'custom' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder={t('music.linkPlaceholder')}
              className="min-h-[44px] flex-1 border border-stone-300 bg-white px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => runSearch()}
              disabled={loading}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 bg-stone-900 px-5 text-xs font-medium text-stone-50 hover:bg-stone-800 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              <span>{loading ? t('music.checking') : t('music.attachLink')}</span>
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={t('music.customTitle')}
              className="min-h-[42px] w-full border border-stone-300 bg-white px-3.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-none"
            />
            <input
              type="text"
              value={customArtist}
              onChange={(e) => setCustomArtist(e.target.value)}
              placeholder={t('music.customArtist')}
              className="min-h-[42px] w-full border border-stone-300 bg-white px-3.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-stone-500">{t('music.linkSupport')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (mode === 'description') applyMoodDirectly();
                  else runSearch();
                }
              }}
              placeholder={mode === 'specific' ? t('music.searchPlaceholder') : t('music.moodPlaceholder')}
              className="min-h-[44px] flex-1 border border-stone-300 bg-white px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
            />
            {mode === 'description' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyMoodDirectly()}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-4 text-xs font-medium text-stone-50 hover:bg-stone-800 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t('music.useMood')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => runSearch()}
                  disabled={loading}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-900 bg-white px-4 text-xs font-medium text-stone-900 hover:bg-stone-100 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{loading ? t('music.searching') : t('music.suggestSongs')}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => runSearch()}
                disabled={loading}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 bg-stone-900 px-5 text-xs font-medium text-stone-50 hover:bg-stone-800 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                <span>{loading ? t('music.searching') : t('music.search')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
          {error}
        </p>
      )}

      {infoMessage && (
        <p className="border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-xs text-stone-700">{infoMessage}</p>
      )}

      {interpretedQuery && mode === 'description' && results.length > 0 && (
        <p className="text-xs text-stone-500">
          “{interpretedQuery}” · iTunes
        </p>
      )}

      {/* Search Results */}
      {results.length > 0 && mode !== 'custom' && (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {results.map((track, idx) => {
            const isSelected = value?.trackTitle === track.trackTitle && value?.artist === track.artist;
            const trackHref = safeExternalHref(track.externalUrl);
            return (
              <div
                key={`${track.trackTitle}-${track.artist}-${idx}`}
                className={`flex items-center justify-between gap-3 border p-2.5 transition-colors ${
                  isSelected ? 'border-stone-900 bg-stone-100/70' : 'border-stone-200 bg-white hover:border-stone-400'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt={track.trackTitle}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-stone-100">
                      <Music className="h-4 w-4 text-stone-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{track.trackTitle}</p>
                    <p className="truncate text-xs text-stone-500">
                      {track.artist} {track.album ? `· ${track.album}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {track.previewUrl && (
                    <button
                      type="button"
                      onClick={() => togglePreview(track.previewUrl!)}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center border border-stone-300 text-stone-700 hover:bg-stone-100"
                    >
                      {playingUrl === track.previewUrl ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  {trackHref && (
                    <a
                      href={trackHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center border border-stone-300 text-stone-600 hover:bg-stone-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      audioRef.current?.pause();
                      setPlayingUrl(null);
                      onChange({
                        mode,
                        queryOrMood: query,
                        trackTitle: track.trackTitle,
                        artist: track.artist,
                        album: track.album,
                        artworkUrl: track.artworkUrl,
                        previewUrl: track.previewUrl,
                        externalUrl: track.externalUrl,
                        source: track.source,
                        musicProfile: track.musicProfile,
                      });
                    }}
                    className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1 px-3 text-xs font-medium whitespace-nowrap ${
                      isSelected
                        ? 'bg-stone-900 text-stone-50'
                        : 'border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-stone-50'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                    <span>{isSelected ? t('music.selected') : t('music.choose')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
