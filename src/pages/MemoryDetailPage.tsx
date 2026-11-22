import {
  ArrowLeft,
  Check,
  Download,
  Edit3,
  ExternalLink,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Loader2,
  Music,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MusicPicker } from '../components/MusicPicker';
import { ScrapbookCanvas } from '../components/ScrapbookCanvas';
import { api, safeExternalHref } from '../lib/api';
import {
  FILM_FILTERS,
  MEMORY_QUESTIONS,
  TYPOGRAPHY_PAIRS,
  localizeAnimationLabel,
  localizeCollageStyleLabel,
  localizeLayoutLabel,
  localizeTextureLabel,
} from '../lib/artLibrary';
import { renderStaticCollageToBlob } from '../lib/collageRenderer';
import { buildLocalClientFallbackSpec, fileToCompactDataUrl } from '../lib/demoWorkspace';
import { useI18n } from '../lib/i18n';
import type { AppLanguage, MemoryAnswerRecord, MemoryRecord, UserPreferences } from '../lib/types';
import { renderAnimatedMemoryVideo } from '../lib/videoRenderer';

interface MemoryDetailPageProps {
  memory: MemoryRecord;
  userPreferences?: UserPreferences;
  sameDayMemories?: MemoryRecord[];
  initialNotice?: string | null;
  onSelectMemory?: (memory: MemoryRecord) => void;
  onBack: () => void;
  onUpdated: (memory: MemoryRecord) => void;
  onDeleted: (id: string) => void;
}

function mergeAnswersForEdit(existing: MemoryAnswerRecord[], targetLang: AppLanguage): MemoryAnswerRecord[] {
  const byId = new Map(existing.map((a) => [a.questionId, a]));
  return MEMORY_QUESTIONS.filter((q) => !q.isMusicQuestion).map((q) => {
    const found = byId.get(q.id);
    return {
      questionId: q.id,
      question: targetLang === 'ru' ? q.questionRu : q.question,
      answer: found?.answer || '',
      tags: found?.tags || [],
    };
  });
}

export function MemoryDetailPage({
  memory,
  userPreferences,
  sameDayMemories = [],
  initialNotice,
  onSelectMemory,
  onBack,
  onUpdated,
  onDeleted,
}: MemoryDetailPageProps) {
  const { t, lang, formatDate } = useI18n();
  const displayLang: AppLanguage = memory.language || lang;

  const [activeTab, setActiveTab] = useState<
    'scrapbook' | 'interactive' | 'collage' | 'video' | 'originals' | 'explain'
  >('scrapbook');
  const [notice, setNotice] = useState<string | null>(initialNotice || null);
  const [error, setError] = useState<string | null>(null);

  const [collagePreviewUrl, setCollagePreviewUrl] = useState<string | null>(
    memory.design?.collageUrl || null
  );
  const [renderingCollage, setRenderingCollage] = useState(false);

  const [videoUrl, setVideoUrl] = useState<string | null>(memory.video?.videoUrl || null);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(memory.title);
  const [editDate, setEditDate] = useState(memory.memoryDate.slice(0, 10));
  const [editLanguage, setEditLanguage] = useState<AppLanguage>(memory.language || lang);
  const [editStory, setEditStory] = useState(memory.storyText);
  const [editAnswers, setEditAnswers] = useState<MemoryAnswerRecord[]>(() =>
    mergeAnswersForEdit(memory.answers, lang)
  );
  const [editMusic, setEditMusic] = useState(memory.music);
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingPhotos, setUpdatingPhotos] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [variationSeed, setVariationSeed] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const isReadOnlyPreset = Boolean(memory.isPresetDemo);
  const isLocalDemoItem = Boolean(memory.isDemo);

  useEffect(() => {
    setCollagePreviewUrl(memory.design?.collageUrl || null);
    setVideoUrl(memory.video?.videoUrl || null);
    setEditTitle(memory.title);
    setEditDate(memory.memoryDate.slice(0, 10));
    setEditLanguage(memory.language || lang);
    setEditStory(memory.storyText);
    setEditAnswers(mergeAnswersForEdit(memory.answers, lang));
    setEditMusic(memory.music);
    setEditing(false);
    setConfirmDelete(false);
    setNotice(initialNotice || null);
  }, [memory, initialNotice, lang]);

  const spec = memory.design?.designSpec;
  const typo = spec
    ? TYPOGRAPHY_PAIRS[spec.typography] || TYPOGRAPHY_PAIRS['editorial-serif']
    : TYPOGRAPHY_PAIRS['editorial-serif'];
  const film = spec
    ? FILM_FILTERS[spec.filmEffect] || FILM_FILTERS['warm-kodak']
    : FILM_FILTERS['warm-kodak'];

  const handwrittenNotes = memory.answers
    .filter((a) => ['smell', 'sounds', 'detail_remember'].includes(a.questionId))
    .map((a) => a.answer)
    .filter(Boolean);

  const safeDownloadSlug = memory.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || 'memory';

  const handleRenderCollage = async (downloadImmediately = false) => {
    if (!spec || memory.photos.length === 0) return;
    setRenderingCollage(true);
    setError(null);
    try {
      const { blob, previewDataUrl } = await renderStaticCollageToBlob({
        seedKey: memory.id,
        title: memory.title,
        photoUrls: memory.photos.map((p) => p.url),
        memoryDate: memory.memoryDate,
        language: displayLang,
        designSpec: spec,
        storySnippet: memory.storyText,
        isAiOnlyText: !memory.storyText?.trim(),
        handwrittenNotes,
        answers: memory.answers,
        musicLabel: memory.music?.trackTitle
          ? `${memory.music.trackTitle} — ${memory.music.artist || ''}`
          : memory.music?.queryOrMood || undefined,
      });

      if (isLocalDemoItem) {
        setCollagePreviewUrl(previewDataUrl);
        if (!isReadOnlyPreset) {
          onUpdated({
            ...memory,
            design: memory.design ? { ...memory.design, collageUrl: previewDataUrl } : memory.design,
          });
        }
      } else {
        const res = await api.saveCollage(memory.id, blob);
        setCollagePreviewUrl(res.collageUrl);
        onUpdated({
          ...memory,
          design: memory.design ? { ...memory.design, collageUrl: res.collageUrl } : memory.design,
        });
      }

      if (downloadImmediately) {
        const link = document.createElement('a');
        link.href = previewDataUrl;
        link.download = `memento-${safeDownloadSlug}.png`;
        link.click();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render collage.');
    } finally {
      setRenderingCollage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'collage' && !collagePreviewUrl && !renderingCollage) {
      handleRenderCollage();
    }
  }, [activeTab, memory.id, collagePreviewUrl]);

  const handleGenerateVideo = async () => {
    if (!spec || memory.photos.length === 0) return;
    const ctrl = new AbortController();
    videoAbortRef.current = ctrl;
    setRenderingVideo(true);
    setVideoProgress(0);
    setVideoNotice(null);
    setError(null);

    try {
      const result = await renderAnimatedMemoryVideo({
        photoUrls: memory.photos.map((p) => p.url),
        memoryDate: memory.memoryDate,
        language: displayLang,
        designSpec: spec,
        storySnippet: memory.storyText,
        handwrittenNotes,
        audioPreviewUrl: memory.music?.previewUrl || null,
        durationSec: 18,
        onProgress: setVideoProgress,
        abortSignal: ctrl.signal,
      });

      const localUrl = URL.createObjectURL(result.blob);
      setVideoUrl(localUrl);
      setVideoNotice(
        lang === 'ru'
          ? result.audioIncluded
            ? '18-секундное видео собрано с прикреплённым аудио-превью.'
            : '18-секундное видео готово. Внешние стриминговые треки нельзя встроить напрямую из-за ограничений браузера — воспроизводите саундтрек параллельно.'
          : result.audioIncluded
          ? '18-second animated video rendered with attached audio preview.'
          : '18-second animated video rendered. Note: external streaming music tracks cannot be audio-muxed due to browser CORS; play your soundtrack alongside.'
      );

      if (!isLocalDemoItem) {
        const saved = await api.saveVideo(memory.id, result.blob, result.durationSec);
        onUpdated({ ...memory, video: saved.video });
        setVideoUrl(saved.video.videoUrl);
      }
    } catch (err) {
      if ((err as Error).message !== 'Video rendering cancelled.') {
        setError(err instanceof Error ? err.message : 'Video generation failed.');
      }
    } finally {
      setRenderingVideo(false);
      videoAbortRef.current = null;
    }
  };

  const handleQuickRegenerate = async () => {
    if (isReadOnlyPreset) return;
    setRegenerating(true);
    setError(null);
    const nextSeed = variationSeed + 1;
    setVariationSeed(nextSeed);

    try {
      if (isLocalDemoItem) {
        const imageAnalyses = memory.photos
          .map((p) => p.imageAnalysis)
          .filter((a): a is NonNullable<typeof a> => Boolean(a));
        let nextSpec = memory.design?.designSpec;
        let providerUsed = memory.design?.aiProviderUsed || 'local-heuristic';
        let noticeText: string | undefined;

        try {
          const regen = await api.regenerateDesignSpec({
            imageAnalyses,
            memoryDate: memory.memoryDate,
            memoryLanguage: displayLang,
            storyText: memory.storyText,
            answers: memory.answers,
            music: memory.music,
            userPreferences,
            variationSeed: nextSeed,
          });
          nextSpec = regen.designSpec;
          providerUsed = regen.aiProviderUsed;
          noticeText = regen.notice;
        } catch {
          const fallback = buildLocalClientFallbackSpec({
            memoryDate: memory.memoryDate,
            storyText: memory.storyText,
            answers: memory.answers,
            music: memory.music,
            memoryLanguage: displayLang,
          });
          nextSpec = fallback.designSpec;
          providerUsed = fallback.aiProviderUsed;
        }

        if (nextSpec) {
          let updatedCollageUrl = memory.design?.collageUrl || null;
          try {
            const { previewDataUrl } = await renderStaticCollageToBlob({
              seedKey: memory.id,
              title: memory.title,
              photoUrls: memory.photos.map((p) => p.url),
              memoryDate: memory.memoryDate,
              language: displayLang,
              designSpec: nextSpec,
              storySnippet: memory.storyText,
              isAiOnlyText: !memory.storyText?.trim(),
              handwrittenNotes,
              answers: memory.answers,
              musicLabel: memory.music?.trackTitle || memory.music?.queryOrMood || undefined,
            });
            updatedCollageUrl = previewDataUrl;
            setCollagePreviewUrl(previewDataUrl);
          } catch {
            // Keep existing collage url if canvas fails
          }

          onUpdated({
            ...memory,
            updatedAt: new Date().toISOString(),
            design: {
              collageUrl: updatedCollageUrl,
              designSpec: nextSpec,
              aiProviderUsed: providerUsed,
              updatedAt: new Date().toISOString(),
            },
          });
          if (noticeText) setNotice(noticeText);
        }
        return;
      }

      const res = await api.updateMemory(memory.id, {
        title: memory.title,
        memoryDate: memory.memoryDate.slice(0, 10),
        memoryLanguage: displayLang,
        storyText: memory.storyText,
        answers: memory.answers,
        music: memory.music,
        regenerateDesign: true,
        variationSeed: nextSeed,
      });

      let updatedMemory = res.memory;
      if (updatedMemory.design?.designSpec) {
        try {
          const { blob } = await renderStaticCollageToBlob({
            seedKey: updatedMemory.id,
            title: updatedMemory.title,
            photoUrls: updatedMemory.photos.map((p) => p.url),
            memoryDate: updatedMemory.memoryDate,
            language: updatedMemory.language || displayLang,
            designSpec: updatedMemory.design.designSpec,
            storySnippet: updatedMemory.storyText,
            isAiOnlyText: !updatedMemory.storyText?.trim(),
            handwrittenNotes,
            answers: updatedMemory.answers,
            musicLabel: updatedMemory.music?.trackTitle || updatedMemory.music?.queryOrMood || undefined,
          });
          const saved = await api.saveCollage(updatedMemory.id, blob);
          setCollagePreviewUrl(saved.collageUrl);
          updatedMemory = {
            ...updatedMemory,
            design: { ...updatedMemory.design, collageUrl: saved.collageUrl },
          };
        } catch {
          // Recoverable
        }
      }

      onUpdated(updatedMemory);
      if (res.notice) setNotice(res.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate composition right now.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleAddPhotosInEditor = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || isReadOnlyPreset) return;
    const remaining = Math.max(0, 8 - memory.photos.length);
    const chosen = files.slice(0, remaining);
    if (chosen.length === 0) return;

    setUpdatingPhotos(true);
    setError(null);
    try {
      if (isLocalDemoItem) {
        const now = new Date().toISOString();
        const added = await Promise.all(
          chosen.map(async (f, i) => ({
            id: `demo-photo-${Date.now()}-${i}`,
            url: await fileToCompactDataUrl(f, 1024),
            originalName: f.name,
            mimeType: f.type || 'image/jpeg',
            sizeBytes: f.size,
            sortOrder: memory.photos.length + i,
            imageAnalysis: null,
            createdAt: now,
          }))
        );
        onUpdated({
          ...memory,
          photos: [...memory.photos, ...added],
          updatedAt: now,
        });
      } else {
        const res = await api.addMemoryPhotos(memory.id, chosen);
        onUpdated(res.memory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add photographs.');
    } finally {
      setUpdatingPhotos(false);
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
    }
  };

  const handleRemovePhotoInEditor = async (photoId: string) => {
    if (isReadOnlyPreset || memory.photos.length <= 1) return;
    setUpdatingPhotos(true);
    setError(null);
    try {
      if (isLocalDemoItem) {
        onUpdated({
          ...memory,
          photos: memory.photos.filter((p) => p.id !== photoId),
          updatedAt: new Date().toISOString(),
        });
      } else {
        const res = await api.deleteMemoryPhoto(memory.id, photoId);
        onUpdated(res.memory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photograph.');
    } finally {
      setUpdatingPhotos(false);
    }
  };

  const handleSaveEdits = async (regenerateDesign: boolean) => {
    if (isReadOnlyPreset) return;
    setSavingEdit(true);
    setError(null);
    const nextSeed = variationSeed + 1;
    if (regenerateDesign) setVariationSeed(nextSeed);

    const nonEmptyAnswers = editAnswers.filter((a) => a.answer.trim().length > 0);

    try {
      if (isLocalDemoItem) {
        const now = new Date().toISOString();
        let nextDesign = memory.design;

        if (regenerateDesign) {
          const imageAnalyses = memory.photos
            .map((p) => p.imageAnalysis)
            .filter((a): a is NonNullable<typeof a> => Boolean(a));
          let nextSpec = memory.design?.designSpec;
          let providerUsed = memory.design?.aiProviderUsed || 'local-heuristic';
          try {
            const regen = await api.regenerateDesignSpec({
              imageAnalyses,
              memoryDate: editDate,
              memoryLanguage: editLanguage,
              storyText: editStory,
              answers: nonEmptyAnswers,
              music: editMusic,
              userPreferences,
              variationSeed: nextSeed,
            });
            nextSpec = { ...regen.designSpec, generatedTitle: editTitle.trim() || regen.designSpec.generatedTitle };
            providerUsed = regen.aiProviderUsed;
            if (regen.notice) setNotice(regen.notice);
          } catch {
            const fallback = buildLocalClientFallbackSpec({
              memoryDate: editDate,
              storyText: editStory,
              answers: nonEmptyAnswers,
              music: editMusic,
              memoryLanguage: editLanguage,
            });
            nextSpec = { ...fallback.designSpec, generatedTitle: editTitle.trim() || fallback.designSpec.generatedTitle };
            providerUsed = fallback.aiProviderUsed;
          }

          if (nextSpec) {
            const updatedNotes = nonEmptyAnswers
              .filter((a) => ['smell', 'sounds', 'detail_remember'].includes(a.questionId))
              .map((a) => a.answer)
              .filter(Boolean);
            let nextCollageUrl = memory.design?.collageUrl || null;
            try {
              const { previewDataUrl } = await renderStaticCollageToBlob({
                seedKey: memory.id,
                title: editTitle || nextSpec.generatedTitle,
                photoUrls: memory.photos.map((p) => p.url),
                memoryDate: editDate,
                language: editLanguage,
                designSpec: nextSpec,
                storySnippet: editStory,
                isAiOnlyText: !editStory.trim(),
                handwrittenNotes: updatedNotes,
                answers: nonEmptyAnswers,
                musicLabel: editMusic?.trackTitle || editMusic?.queryOrMood || undefined,
              });
              nextCollageUrl = previewDataUrl;
              setCollagePreviewUrl(previewDataUrl);
            } catch {
              // Keep existing collage url
            }
            nextDesign = {
              collageUrl: nextCollageUrl,
              designSpec: nextSpec,
              aiProviderUsed: providerUsed,
              updatedAt: now,
            };
          }
        }

        const updated: MemoryRecord = {
          ...memory,
          title: editTitle,
          memoryDate: editDate,
          language: editLanguage,
          storyText: editStory,
          answers: nonEmptyAnswers,
          music: editMusic,
          updatedAt: now,
          design: nextDesign,
        };
        onUpdated(updated);
        setEditing(false);
        return;
      }

      const res = await api.updateMemory(memory.id, {
        title: editTitle,
        memoryDate: editDate,
        memoryLanguage: editLanguage,
        storyText: editStory,
        answers: nonEmptyAnswers,
        music: editMusic,
        regenerateDesign,
        variationSeed: regenerateDesign ? nextSeed : undefined,
      });

      let finalMemory = res.memory;
      if (regenerateDesign && finalMemory.design?.designSpec) {
        const updatedNotes = finalMemory.answers
          .filter((a) => ['smell', 'sounds', 'detail_remember'].includes(a.questionId))
          .map((a) => a.answer)
          .filter(Boolean);
        const { blob } = await renderStaticCollageToBlob({
          seedKey: finalMemory.id,
          title: finalMemory.title,
          photoUrls: finalMemory.photos.map((p) => p.url),
          memoryDate: finalMemory.memoryDate,
          language: finalMemory.language || editLanguage,
          designSpec: finalMemory.design.designSpec,
          storySnippet: finalMemory.storyText,
          isAiOnlyText: !finalMemory.storyText?.trim(),
          handwrittenNotes: updatedNotes,
          answers: finalMemory.answers,
          musicLabel: finalMemory.music?.trackTitle || finalMemory.music?.queryOrMood || undefined,
        });
        const saved = await api.saveCollage(finalMemory.id, blob);
        setCollagePreviewUrl(saved.collageUrl);
        finalMemory = {
          ...finalMemory,
          design: { ...finalMemory.design, collageUrl: saved.collageUrl },
        };
      }

      onUpdated(finalMemory);
      if (res.notice) setNotice(res.notice);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (isReadOnlyPreset) return;
    if (isLocalDemoItem) {
      onDeleted(memory.id);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteMemory(memory.id);
      onDeleted(memory.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory.');
      setDeleting(false);
    }
  };

  const formattedDate = formatDate(memory.memoryDate, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const bgColor = spec?.palette.background || '#FAF8F3';
  const surfaceColor = spec?.palette.surface || '#FFFFFF';
  const inkColor = spec?.palette.ink || '#1E1B18';
  const mutedInk = spec?.palette.mutedInk || '#605950';
  const accentColor = spec?.palette.primaryAccent || '#2E4A62';

  return (
    <div style={{ backgroundColor: bgColor, color: inkColor }} className="min-h-[calc(100vh-68px)] transition-colors duration-300">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        {/* Top Control Bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: `${inkColor}20` }}>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-xs font-medium opacity-80 hover:opacity-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('detail.back')}</span>
            </button>

            {sameDayMemories.length > 1 && onSelectMemory && (
              <div className="flex flex-wrap items-center gap-1.5 border-l pl-4" style={{ borderColor: `${inkColor}25` }}>
                <span className="text-[11px] uppercase tracking-wider" style={{ color: mutedInk }}>
                  {t('detail.sameDay', { count: sameDayMemories.length })}
                </span>
                {sameDayMemories.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMemory(m)}
                    className="min-h-[32px] cursor-pointer px-2.5 text-xs font-medium transition-opacity"
                    style={
                      m.id === memory.id
                        ? { backgroundColor: accentColor, color: '#FFFFFF' }
                        : { border: `1px solid ${inkColor}30`, color: inkColor }
                    }
                  >
                    {i + 1}. {m.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {collagePreviewUrl ? (
              <a
                href={collagePreviewUrl}
                download={`memento-${safeDownloadSlug}.png`}
                className="inline-flex min-h-[40px] items-center gap-1.5 border px-3.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: `${inkColor}35` }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t('detail.downloadPng')}</span>
              </a>
            ) : (
              <button
                type="button"
                disabled={renderingCollage}
                onClick={() => handleRenderCollage(true)}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border px-3.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: `${inkColor}35` }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{renderingCollage ? t('detail.preparingPng') : t('detail.exportPng')}</span>
              </button>
            )}

            {isReadOnlyPreset ? (
              <span className="border px-3 py-1.5 text-xs font-medium" style={{ borderColor: `${inkColor}35` }}>
                {t('detail.presetReadOnly')}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={regenerating}
                  onClick={handleQuickRegenerate}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border px-3.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: `${inkColor}35` }}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  <span>{regenerating ? t('detail.regenerating') : t('detail.regenerate')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border px-3.5 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ borderColor: `${inkColor}35` }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{editing ? t('detail.closeEditor') : t('detail.editAnswers')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-red-200 bg-white/90 px-3.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t('detail.delete')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {notice && (
          <div className="mb-5 flex items-start gap-2.5 border bg-white/90 px-4 py-3 text-xs text-stone-700" style={{ borderColor: `${inkColor}25` }}>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-600" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
            {error}
          </div>
        )}

        {confirmDelete && (
          <div className="mb-6 border border-red-300 bg-white p-5 text-stone-900 shadow-sm">
            <p className="font-display text-2xl font-medium">{t('detail.deleteConfirmTitle')}</p>
            <p className="mt-1 text-xs text-stone-600">
              {t('detail.deleteConfirmBody', { title: memory.title })}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="min-h-[40px] cursor-pointer bg-red-700 px-4 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleting ? t('detail.deleting') : t('detail.confirmDelete')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[40px] cursor-pointer border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                {t('create.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Full Memory Editor (Title, Date, Language, Photos, Narrative, All 10 Questions, Music) */}
        {editing && !isReadOnlyPreset && (
          <div className="mb-8 space-y-5 border border-stone-300 bg-white p-6 text-stone-900 shadow-sm">
            <h2 className="font-display text-2xl font-medium">{t('detail.editTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">{t('detail.fieldTitle')}</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="min-h-[42px] w-full border border-stone-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">{t('detail.fieldDate')}</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="min-h-[42px] w-full border border-stone-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">{t('detail.fieldLang')}</label>
                <select
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value === 'ru' ? 'ru' : 'en')}
                  className="min-h-[42px] w-full border border-stone-300 bg-white px-3 text-sm"
                >
                  <option value="en">{t('create.langEn')}</option>
                  <option value="ru">{t('create.langRu')}</option>
                </select>
              </div>
            </div>

            {/* Manage Photos */}
            <div className="space-y-2.5 border border-stone-200 bg-[#faf8f3] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-stone-700">
                  {t('detail.photosManage', { count: memory.photos.length })}
                </span>
                {memory.photos.length < 8 && (
                  <>
                    <input
                      ref={addPhotoInputRef}
                      type="file"
                      accept="image/*,.heic,.heif"
                      multiple
                      onChange={handleAddPhotosInEditor}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      disabled={updatingPhotos}
                      onClick={() => addPhotoInputRef.current?.click()}
                      className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-stone-300 bg-white px-3 text-xs font-medium text-stone-800 hover:border-stone-900 disabled:opacity-50"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>{t('detail.addPhotos')}</span>
                    </button>
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {memory.photos.map((photo) => (
                  <div key={photo.id} className="relative border border-stone-200 bg-white p-1">
                    <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                      <img src={photo.url} alt={photo.originalName} className="h-full w-full object-cover" />
                    </div>
                    {memory.photos.length > 1 && (
                      <button
                        type="button"
                        disabled={updatingPhotos}
                        onClick={() => handleRemovePhotoInEditor(photo.id)}
                        aria-label={photo.originalName}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center bg-black/70 text-white hover:bg-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">{t('detail.fieldNarrative')}</label>
              <textarea
                rows={4}
                value={editStory}
                onChange={(e) => setEditStory(e.target.value)}
                className="font-serif-prose w-full border border-stone-300 p-3 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {editAnswers.map((ans, idx) => (
                <div key={ans.questionId}>
                  <label className="mb-1 block text-[11px] font-medium text-stone-600">{ans.question}</label>
                  <input
                    type="text"
                    value={ans.answer}
                    onChange={(e) => {
                      const next = [...editAnswers];
                      next[idx] = { ...ans, answer: e.target.value };
                      setEditAnswers(next);
                    }}
                    className="min-h-[40px] w-full border border-stone-300 px-3 text-xs"
                  />
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-stone-700">{t('detail.fieldSoundtrack')}</p>
              <MusicPicker value={editMusic} onChange={setEditMusic} />
            </div>

            <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => handleSaveEdits(false)}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-900 px-4 text-xs font-medium text-stone-900 hover:bg-stone-100"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{t('detail.saveText')}</span>
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => handleSaveEdits(true)}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white hover:bg-stone-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${savingEdit ? 'animate-spin' : ''}`} />
                <span>{savingEdit ? t('detail.reimagining') : t('detail.saveReimagine')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Format Navigation Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: `${inkColor}20` }}>
          {(
            [
              { id: 'scrapbook', label: t('detail.tabScrapbook') },
              { id: 'interactive', label: t('detail.tabJournal') },
              { id: 'collage', label: t('detail.tabCollage') },
              { id: 'video', label: t('detail.tabVideo') },
              { id: 'originals', label: t('detail.tabOriginals', { count: memory.photos.length }) },
              { id: 'explain', label: t('detail.tabExplain') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="min-h-[40px] cursor-pointer whitespace-nowrap px-4 py-2 text-xs font-medium shrink-0 transition-colors"
              style={
                activeTab === tab.id
                  ? { backgroundColor: accentColor, color: '#FFFFFF' }
                  : { backgroundColor: surfaceColor, color: inkColor, border: `1px solid ${inkColor}22` }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 0. SCRAPBOOK CANVAS */}
        {activeTab === 'scrapbook' && (
          <div className="space-y-6">
            <ScrapbookCanvas memory={memory} />

            {memory.music && memory.music.mode !== 'none' && (
              <div
                className="flex flex-wrap items-center justify-between gap-4 border p-4"
                style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}18` }}
              >
                <div className="flex items-center gap-3">
                  <Music className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                  <div className="text-xs">
                    <span className="font-medium">{memory.music.trackTitle || memory.music.queryOrMood}</span>
                    {memory.music.artist && <span style={{ color: mutedInk }}> · {memory.music.artist}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {memory.music.previewUrl && (
                    <audio controls src={memory.music.previewUrl} className="h-8 max-w-[260px]" />
                  )}
                  {safeExternalHref(memory.music.externalUrl) && (
                    <a
                      href={safeExternalHref(memory.music.externalUrl)!}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-[34px] items-center gap-1.5 border px-3 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ color: accentColor, borderColor: `${accentColor}45` }}
                    >
                      <span>{t('detail.playOpenMusic')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1. INTERACTIVE JOURNAL & QUESTIONNAIRE */}
        {activeTab === 'interactive' && (
          <article className="space-y-10">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: mutedInk }}>
                <span>{formattedDate}</span>
                {memory.eventTimeLabel && <span>· {memory.eventTimeLabel}</span>}
                {!memory.isPresetDemo && (
                  <span>· {memory.origin === 'automatic' ? t('origin.automatic') : t('origin.manual')}</span>
                )}
                {spec?.atmosphereKeywords.map((kw) => (
                  <span key={kw}>· {kw}</span>
                ))}
              </div>
              <h1
                className="headline-balance text-4xl font-medium sm:text-5xl lg:text-6xl"
                style={{ fontFamily: typo.headingFont }}
              >
                {memory.title}
              </h1>
              {spec && (
                <p className="max-w-2xl text-base leading-relaxed" style={{ color: mutedInk }}>
                  {spec.moodSummary}
                </p>
              )}
            </header>

            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="space-y-6 lg:col-span-7">
                <div className="grid gap-6 sm:grid-cols-2">
                  {memory.photos.map((photo, idx) => (
                    <figure
                      key={photo.id}
                      className="p-3 pb-7 shadow-md"
                      style={{
                        backgroundColor: surfaceColor,
                        border: `1px solid ${inkColor}18`,
                      }}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden">
                        <img
                          src={photo.url}
                          alt={memory.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{ filter: film.cssFilter }}
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: film.warmthTint }} />
                      </div>
                      <figcaption className="mt-3 flex items-center justify-between text-xs" style={{ color: mutedInk }}>
                        <span>Fig. {idx + 1}</span>
                        <span>{lang === 'ru' ? film.labelRu : film.label}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>

                <div className="border-t pt-6" style={{ borderColor: `${inkColor}20` }}>
                  <p className="max-w-prose text-lg leading-relaxed" style={{ fontFamily: typo.bodyFont }}>
                    {memory.storyText || spec?.moodSummary}
                  </p>
                  {handwrittenNotes.length > 0 && (
                    <div className="mt-5 space-y-1.5">
                      {handwrittenNotes.map((note, idx) => (
                        <p key={idx} className="text-2xl leading-snug" style={{ fontFamily: typo.noteFont, color: accentColor }}>
                          “{note}”
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-6 lg:col-span-5">
                {spec && (
                  <div className="border p-5" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}18` }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                      {t('detail.palette')}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {[spec.palette.chosenByUser, ...spec.palette.extractedFromPhoto.slice(0, 3), spec.palette.secondaryAccent].map(
                        (hex, idx) => (
                          <div key={`${hex}-${idx}`} className="flex flex-col items-center gap-1">
                            <span
                              className="h-8 w-8 rounded-full border"
                              style={{ backgroundColor: hex, borderColor: `${inkColor}25` }}
                            />
                            <span className="font-mono text-[10px]" style={{ color: mutedInk }}>
                              {hex}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {memory.music && memory.music.mode !== 'none' && (
                  <div className="border p-5 space-y-3" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}18` }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                        {t('detail.soundtrack')}
                      </p>
                      <Music className="h-4 w-4" style={{ color: accentColor }} />
                    </div>
                    <div className="flex items-center gap-3">
                      {memory.music.artworkUrl && (
                        <img
                          src={memory.music.artworkUrl}
                          alt={memory.music.trackTitle || 'Track art'}
                          referrerPolicy="no-referrer"
                          className="h-12 w-12 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{memory.music.trackTitle || memory.music.queryOrMood}</p>
                        <p className="truncate text-xs" style={{ color: mutedInk }}>
                          {memory.music.artist || t('detail.fieldSoundtrack')}
                        </p>
                      </div>
                    </div>
                    {memory.music.previewUrl && <audio controls src={memory.music.previewUrl} className="h-9 w-full" />}
                    {safeExternalHref(memory.music.externalUrl) && (
                      <a
                        href={safeExternalHref(memory.music.externalUrl)!}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4"
                        style={{ color: accentColor }}
                      >
                        <span>{t('detail.playOpenMusic')}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {spec && (
                      <p className="text-xs leading-relaxed" style={{ color: mutedInk }}>
                        {spec.musicInfluenceNote}
                      </p>
                    )}
                  </div>
                )}

                <div className="border p-5 space-y-3" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}18` }}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {t('detail.associations')}
                  </p>
                  <dl className="divide-y" style={{ borderColor: `${inkColor}14` }}>
                    {memory.answers.map((ans) => (
                      <div key={ans.questionId} className="py-2.5">
                        <dt className="text-[11px]" style={{ color: mutedInk }}>
                          {ans.question}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium">{ans.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </aside>
            </div>
          </article>
        )}

        {/* 2. STATIC PNG COLLAGE */}
        {activeTab === 'collage' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-medium">{t('detail.staticTitle')}</h2>
                <p className="text-xs" style={{ color: mutedInk }}>
                  {t('detail.staticSub')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={renderingCollage}
                  onClick={() => handleRenderCollage(false)}
                  className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border px-4 text-xs font-medium"
                  style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}30` }}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${renderingCollage ? 'animate-spin' : ''}`} />
                  <span>{renderingCollage ? t('detail.rendering') : t('detail.rerender')}</span>
                </button>
                {collagePreviewUrl && (
                  <a
                    href={collagePreviewUrl}
                    download={`memento-${safeDownloadSlug}.png`}
                    className="inline-flex min-h-[42px] items-center gap-2 px-5 text-xs font-medium text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Download className="h-4 w-4" />
                    <span>{t('detail.downloadCollage')}</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-center border p-4 sm:p-8" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}20` }}>
              {renderingCollage ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <p className="text-xs" style={{ color: mutedInk }}>
                    {t('detail.rendering')}
                  </p>
                </div>
              ) : collagePreviewUrl ? (
                <img
                  src={collagePreviewUrl}
                  alt={memory.title}
                  className="max-h-[78vh] w-auto border shadow-lg"
                  style={{ borderColor: `${inkColor}20` }}
                />
              ) : (
                <p className="py-16 text-sm" style={{ color: mutedInk }}>
                  {t('detail.staticSub')}
                </p>
              )}
            </div>
          </section>
        )}

        {/* 3. ANIMATED MEMORY VIDEO */}
        {activeTab === 'video' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-medium">{t('detail.videoTitle')}</h2>
                <p className="text-xs" style={{ color: mutedInk }}>
                  {t('detail.videoSub', { speed: spec?.animationSpeedMultiplier || 1 })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {renderingVideo ? (
                  <button
                    type="button"
                    onClick={() => videoAbortRef.current?.abort()}
                    className="min-h-[42px] cursor-pointer border border-red-300 bg-white px-4 text-xs font-medium text-red-700"
                  >
                    {t('detail.cancelRender')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateVideo}
                    className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 px-5 text-xs font-medium text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Film className="h-4 w-4" />
                    <span>{videoUrl ? t('detail.regenerateVideo') : t('detail.generateVideo')}</span>
                  </button>
                )}
                {videoUrl && !renderingVideo && (
                  <a
                    href={videoUrl}
                    download={`memento-${safeDownloadSlug}.webm`}
                    className="inline-flex min-h-[42px] items-center gap-2 border px-4 text-xs font-medium"
                    style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}30` }}
                  >
                    <Download className="h-4 w-4" />
                    <span>{t('detail.downloadVideo')}</span>
                  </a>
                )}
              </div>
            </div>

            {videoNotice && (
              <div className="border bg-white/90 px-4 py-3 text-xs text-stone-700" style={{ borderColor: `${inkColor}20` }}>
                {videoNotice}
              </div>
            )}

            <div className="border p-6 text-center" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}20` }}>
              {renderingVideo ? (
                <div className="mx-auto max-w-md space-y-4 py-16">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                  <p className="font-display text-2xl font-medium">{videoProgress}%</p>
                  <div className="h-1.5 w-full overflow-hidden bg-stone-200">
                    <div
                      className="h-full transition-all duration-200"
                      style={{ width: `${videoProgress}%`, backgroundColor: accentColor }}
                    />
                  </div>
                </div>
              ) : videoUrl ? (
                <video
                  controls
                  playsInline
                  src={videoUrl}
                  className="mx-auto max-h-[75vh] w-auto border shadow-md"
                  style={{ borderColor: `${inkColor}20` }}
                />
              ) : (
                <div className="space-y-3 py-16">
                  <Film className="mx-auto h-8 w-8 opacity-50" />
                  <p className="font-display text-2xl">{t('detail.videoReadyTitle')}</p>
                  <p className="mx-auto max-w-md text-xs" style={{ color: mutedInk }}>
                    {t('detail.videoReadySub')}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 4. ORIGINAL PHOTOGRAPHS */}
        {activeTab === 'originals' && (
          <section className="space-y-6">
            <div>
              <h2 className="font-display text-3xl font-medium">{t('detail.originalsTitle')}</h2>
              <p className="text-xs" style={{ color: mutedInk }}>
                {t('detail.originalsSub')}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {memory.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="border p-4 space-y-4"
                  style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}20` }}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                    <img
                      src={photo.url}
                      alt={photo.originalName}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: mutedInk }}>
                    <span className="truncate">{photo.originalName}</span>
                    <a
                      href={
                        !isLocalDemoItem && !photo.url.startsWith('data:')
                          ? `${photo.url}?download=1`
                          : photo.url
                      }
                      download={photo.originalName}
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                      style={{ color: accentColor }}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>{t('detail.downloadOriginal')}</span>
                    </a>
                  </div>
                  {photo.imageAnalysis && (
                    <div className="space-y-2 border-t pt-3 text-xs" style={{ borderColor: `${inkColor}15` }}>
                      <p className="font-medium">
                        {photo.imageAnalysis.provider} · {photo.imageAnalysis.lighting}
                      </p>
                      <p style={{ color: mutedInk }}>{photo.imageAnalysis.scenery}</p>
                      <div className="flex items-center gap-2 pt-1">
                        {photo.imageAnalysis.dominantColors.map((hex) => (
                          <span
                            key={hex}
                            title={hex}
                            className="h-4 w-4 rounded-full border"
                            style={{ backgroundColor: hex, borderColor: `${inkColor}25` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. DESIGN EXPLAINABILITY & MULTILAYER PLAN */}
        {activeTab === 'explain' && spec && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="border p-6 space-y-4" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}20` }}>
              <h2 className="font-display text-3xl font-medium">{t('detail.explainTitle')}</h2>
              <p className="text-xs" style={{ color: mutedInk }}>
                {t('create.engine', { provider: memory.design?.aiProviderUsed || 'local-heuristic' })}
              </p>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {t('detail.palette')}
                  </dt>
                  <dd className="mt-1">{spec.explainability.paletteReason}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {localizeLayoutLabel(spec.layoutId, lang)}
                  </dt>
                  <dd className="mt-1">{spec.explainability.layoutReason}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {localizeTextureLabel(spec.paperTexture, lang)} ·{' '}
                    {lang === 'ru'
                      ? FILM_FILTERS[spec.filmEffect]?.labelRu
                      : FILM_FILTERS[spec.filmEffect]?.label}
                  </dt>
                  <dd className="mt-1">{spec.explainability.textureAndFilmReason}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {lang === 'ru'
                      ? TYPOGRAPHY_PAIRS[spec.typography]?.labelRu
                      : TYPOGRAPHY_PAIRS[spec.typography]?.label}
                  </dt>
                  <dd className="mt-1">{spec.explainability.typographyAndMotifReason}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {localizeAnimationLabel(spec.animationStyle, lang)} ({spec.animationSpeedMultiplier}x)
                  </dt>
                  <dd className="mt-1">{spec.explainability.animationReason}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: mutedInk }}>
                    {t('profile.eyebrow')}
                  </dt>
                  <dd className="mt-1">{spec.explainability.profileBalanceNote}</dd>
                </div>
              </dl>
            </div>

            <div className="border p-6 space-y-4" style={{ backgroundColor: surfaceColor, borderColor: `${inkColor}20` }}>
              <h3 className="font-display text-2xl font-medium">{t('detail.archTitle')}</h3>
              {spec.scrapbookPlan?.collageStyle && (
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: mutedInk }}>
                  {localizeCollageStyleLabel(spec.scrapbookPlan.collageStyle, lang)}
                </p>
              )}
              <ul className="space-y-2.5 text-sm">
                <li>
                  <span style={{ color: mutedInk }}>1 · </span>
                  {spec.scrapbookPlan?.backgroundMaterial || localizeTextureLabel(spec.paperTexture, lang)}
                </li>
                {spec.scrapbookPlan?.focalStrategy && (
                  <li>
                    <span style={{ color: mutedInk }}>2 · </span>
                    {spec.scrapbookPlan.focalStrategy}
                  </li>
                )}
                {spec.scrapbookPlan?.layeringStrategy && (
                  <li>
                    <span style={{ color: mutedInk }}>3 · </span>
                    {spec.scrapbookPlan.layeringStrategy}
                  </li>
                )}
                <li>
                  <span style={{ color: mutedInk }}>4 · </span>
                  {(spec.scrapbookPlan?.selectedDetails && spec.scrapbookPlan.selectedDetails.length > 0
                    ? spec.scrapbookPlan.selectedDetails
                    : spec.decorativeMotifs
                  ).join(', ')}
                </li>
                <li>
                  <span style={{ color: mutedInk }}>5 · </span>
                  {lang === 'ru'
                    ? TYPOGRAPHY_PAIRS[spec.typography]?.labelRu
                    : TYPOGRAPHY_PAIRS[spec.typography]?.label}
                </li>
                <li>
                  <span style={{ color: mutedInk }}>6 · </span>
                  {spec.scrapbookPlan?.negativeSpaceNote ||
                    spec.scrapbookPlan?.lightingMood ||
                    (lang === 'ru'
                      ? FILM_FILTERS[spec.filmEffect]?.labelRu
                      : FILM_FILTERS[spec.filmEffect]?.label)}
                </li>
              </ul>
              {spec.scrapbookPlan?.visualBalanceNote && (
                <p className="border-t pt-3 text-xs leading-relaxed" style={{ borderColor: `${inkColor}15`, color: mutedInk }}>
                  {spec.scrapbookPlan.visualBalanceNote}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
