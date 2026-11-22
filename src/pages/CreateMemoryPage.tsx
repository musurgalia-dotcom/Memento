import {
  ArrowLeft,
  ArrowRight,
  Check,
  Edit3,
  ImagePlus,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MusicPicker } from '../components/MusicPicker';
import { ScrapbookCanvas } from '../components/ScrapbookCanvas';
import { api } from '../lib/api';
import {
  FILM_FILTERS,
  MEMORY_QUESTIONS,
  TYPOGRAPHY_PAIRS,
  localizeLayoutLabel,
  localizeTextureLabel,
  type DesignSpecification,
  type ImageVisualAnalysis,
} from '../lib/artLibrary';
import { renderStaticCollageToBlob } from '../lib/collageRenderer';
import { buildLocalClientFallbackSpec, fileToCompactDataUrl } from '../lib/demoWorkspace';
import { useI18n } from '../lib/i18n';
import type {
  AppLanguage,
  MemoryAnswerRecord,
  MemoryMusicRecord,
  MemoryRecord,
  UserProfile,
} from '../lib/types';

interface CreateMemoryPageProps {
  user: UserProfile;
  initialDate?: string;
  onMemoryCreated: (memory: MemoryRecord, notice?: string) => void;
  onSwitchToAutoYear?: () => void;
  onCancel: () => void;
}

interface SelectedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_PHOTOS = 8;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function getLocalTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CreateMemoryPage({
  user,
  initialDate,
  onMemoryCreated,
  onSwitchToAutoYear,
  onCancel,
}: CreateMemoryPageProps) {
  const { t, lang, formatDate } = useI18n();

  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [memoryDate, setMemoryDate] = useState(initialDate || getLocalTodayIso());
  const [memoryLanguage, setMemoryLanguage] = useState<AppLanguage>(lang);
  const [phase, setPhase] = useState<'upload' | 'questionnaire' | 'narrative' | 'generating' | 'review'>('upload');
  const [stepIdx, setStepIdx] = useState(0);

  const [answers, setAnswers] = useState<Record<string, { selected: string[]; custom: string }>>({});
  const [customColorHex, setCustomColorHex] = useState('#5D8AA8');
  const [music, setMusic] = useState<MemoryMusicRecord | null>(null);
  const [storyText, setStoryText] = useState('');

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  // Review & Regenerate state
  const [compiledAnswers, setCompiledAnswers] = useState<MemoryAnswerRecord[]>([]);
  const [previewAnalyses, setPreviewAnalyses] = useState<ImageVisualAnalysis[]>([]);
  const [previewSpec, setPreviewSpec] = useState<DesignSpecification | null>(null);
  const [previewProviderUsed, setPreviewProviderUsed] = useState<string>('local-heuristic');
  const [previewNotice, setPreviewNotice] = useState<string | undefined>(undefined);
  const [previewCollageBlob, setPreviewCollageBlob] = useState<Blob | null>(null);
  const [previewCollageUrl, setPreviewCollageUrl] = useState<string | null>(null);
  const [demoPhotoDataUrls, setDemoPhotoDataUrls] = useState<string[]>([]);
  const [reviewTab, setReviewTab] = useState<'scrapbook' | 'collage' | 'explain'>('scrapbook');
  const [variationSeed, setVariationSeed] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setUploadError(
        lang === 'ru'
          ? `Можно прикрепить до ${MAX_PHOTOS} фотографий на одно воспоминание.`
          : `You can attach up to ${MAX_PHOTOS} photographs per memory.`
      );
      return;
    }

    const nextPhotos: SelectedPhoto[] = [];
    for (const file of files.slice(0, remaining)) {
      const type = file.type.toLowerCase();
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const validExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
      if (type && !ALLOWED_TYPES.has(type) && !validExt) {
        setUploadError(
          lang === 'ru'
            ? `Неподдерживаемый формат (${file.name}). Используйте JPG, PNG, WEBP или HEIC.`
            : `Unsupported format (${file.name}). Use JPG, PNG, WEBP, or HEIC.`
        );
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(
          lang === 'ru'
            ? `${file.name} превышает лимит 15 МБ для одной фотографии.`
            : `${file.name} exceeds the 15 MB limit per photograph.`
        );
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      createdUrlsRef.current.push(previewUrl);
      nextPhotos.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
      });
    }

    setPhotos((prev) => [...prev, ...nextPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const currentQuestion = MEMORY_QUESTIONS[stepIdx];

  const adaptiveChips = useMemo(() => {
    if (!currentQuestion) return [];
    const base =
      lang === 'ru' ? [...currentQuestion.suggestionsRu] : [...currentQuestion.suggestions];
    const adaptiveMap =
      lang === 'ru' ? currentQuestion.adaptiveSuggestionsRu : currentQuestion.adaptiveSuggestions;
    if (adaptiveMap) {
      const priorTags = Object.values(answers).flatMap((a) => a.selected);
      for (const tag of priorTags) {
        const extra = adaptiveMap[tag];
        if (extra) {
          for (const item of extra) {
            if (!base.includes(item)) base.unshift(item);
          }
        }
      }
    }
    return base;
  }, [currentQuestion, answers, lang]);

  const toggleSuggestion = (questionId: string, label: string, multi?: boolean) => {
    setAnswers((prev) => {
      const curr = prev[questionId] || { selected: [], custom: '' };
      if (multi) {
        const exists = curr.selected.includes(label);
        return {
          ...prev,
          [questionId]: {
            ...curr,
            selected: exists ? curr.selected.filter((x) => x !== label) : [...curr.selected, label],
          },
        };
      }
      return {
        ...prev,
        [questionId]: {
          ...curr,
          selected: curr.selected.includes(label) ? [] : [label],
        },
      };
    });
  };

  const setCustomAnswer = (questionId: string, custom: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        selected: prev[questionId]?.selected || [],
        custom,
      },
    }));
  };

  const buildCompiledAnswers = (): MemoryAnswerRecord[] =>
    MEMORY_QUESTIONS.filter((q) => !q.isMusicQuestion).map((q) => {
      const entry = answers[q.id] || { selected: [], custom: '' };
      const parts = [...entry.selected];
      if (entry.custom.trim()) parts.push(entry.custom.trim());
      return {
        questionId: q.id,
        question: memoryLanguage === 'ru' ? q.questionRu : q.question,
        answer: parts.join(', '),
        tags: entry.selected,
      };
    });

  const renderCollagePreview = async (
    photoUrls: string[],
    designSpec: DesignSpecification,
    nextAnswers: MemoryAnswerRecord[]
  ) => {
    const handwrittenNotes = nextAnswers
      .filter((a) => ['smell', 'sounds', 'detail_remember'].includes(a.questionId))
      .map((a) => a.answer)
      .filter(Boolean);

    try {
      const { blob, previewDataUrl } = await renderStaticCollageToBlob({
        seedKey: `${memoryDate}-${designSpec.generatedTitle}`,
        title: designSpec.generatedTitle,
        photoUrls,
        memoryDate,
        language: memoryLanguage,
        designSpec,
        storySnippet: storyText,
        isAiOnlyText: !storyText.trim(),
        handwrittenNotes,
        answers: nextAnswers,
        musicLabel: music?.trackTitle
          ? `${music.trackTitle}${music.artist ? ` — ${music.artist}` : ''}`
          : music?.queryOrMood || undefined,
      });
      setPreviewCollageBlob(blob);
      setPreviewCollageUrl(previewDataUrl);
    } catch {
      setPreviewCollageBlob(null);
      setPreviewCollageUrl(null);
    }
  };

  const handleGeneratePreview = async () => {
    if (photos.length === 0) return;
    setPhase('generating');
    setSubmitError(null);
    setProgressStage(t('create.stageInspecting'));
    setProgressPct(25);

    const nextCompiled = buildCompiledAnswers();
    setCompiledAnswers(nextCompiled);

    try {
      let resolvedAnalyses: ImageVisualAnalysis[] = [];
      let resolvedSpec: DesignSpecification;
      let resolvedProvider = 'local-heuristic';
      let resolvedNotice: string | undefined;

      try {
        const fd = new FormData();
        photos.forEach((p) => fd.append('photos', p.file));
        fd.append('memoryDate', memoryDate);
        fd.append('memoryLanguage', memoryLanguage);
        fd.append('storyText', storyText);
        fd.append('answersJson', JSON.stringify(nextCompiled));
        if (music) fd.append('musicJson', JSON.stringify(music));
        fd.append('userPreferencesJson', JSON.stringify(user.preferences));

        setProgressStage(t('create.stageWeaving'));
        setProgressPct(55);

        const previewRes = await api.previewMemoryDesign(fd);
        resolvedAnalyses = previewRes.imageAnalyses;
        resolvedSpec = previewRes.designSpec;
        resolvedProvider = previewRes.aiProviderUsed;
        resolvedNotice = previewRes.notice;
      } catch (err) {
        if (!user.isDemoAccount) throw err;
        const localFallback = buildLocalClientFallbackSpec({
          memoryDate,
          storyText,
          answers: nextCompiled,
          music,
          memoryLanguage,
        });
        resolvedAnalyses = localFallback.imageAnalyses;
        resolvedSpec = localFallback.designSpec;
        resolvedProvider = localFallback.aiProviderUsed;
        resolvedNotice =
          lang === 'ru'
            ? 'Создано локально в браузерном демо-режиме.'
            : 'Generated locally in browser Demo Mode.';
      }

      setProgressStage(t('create.stageComposing'));
      setProgressPct(80);

      let urlsForRender = photos.map((p) => p.previewUrl);
      if (user.isDemoAccount) {
        const compactUrls = await Promise.all(photos.map((p) => fileToCompactDataUrl(p.file)));
        setDemoPhotoDataUrls(compactUrls);
        urlsForRender = compactUrls;
      }

      setPreviewAnalyses(resolvedAnalyses);
      setPreviewSpec(resolvedSpec);
      setPreviewProviderUsed(resolvedProvider);
      setPreviewNotice(resolvedNotice);
      setVariationSeed(0);

      await renderCollagePreview(urlsForRender, resolvedSpec, nextCompiled);

      setProgressPct(100);
      setReviewTab('scrapbook');
      setPhase('review');
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : lang === 'ru'
          ? 'Не удалось создать композицию. Попробуйте ещё раз.'
          : 'Unable to generate your memory design. Please try again.'
      );
      setPhase('narrative');
    }
  };

  const handleRegenerateComposition = async () => {
    if (!previewSpec) return;
    setRegenerating(true);
    setSubmitError(null);
    const nextSeed = variationSeed + 1;
    setVariationSeed(nextSeed);

    try {
      const res = await api.regenerateDesignSpec({
        imageAnalyses: previewAnalyses,
        memoryDate,
        memoryLanguage,
        storyText,
        answers: compiledAnswers,
        music,
        userPreferences: user.preferences,
        variationSeed: nextSeed,
      });
      setPreviewSpec(res.designSpec);
      setPreviewProviderUsed(res.aiProviderUsed);
      if (res.notice) setPreviewNotice(res.notice);
      const urls =
        user.isDemoAccount && demoPhotoDataUrls.length > 0
          ? demoPhotoDataUrls
          : photos.map((p) => p.previewUrl);
      await renderCollagePreview(urls, res.designSpec, compiledAnswers);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : lang === 'ru'
          ? 'Не удалось пересобрать композицию.'
          : 'Could not regenerate composition right now.'
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!previewSpec || photos.length === 0) return;
    setSaving(true);
    setSubmitError(null);

    try {
      if (user.isDemoAccount) {
        const now = new Date().toISOString();
        const memId = `demo-created-${crypto.randomUUID().slice(0, 8)}`;
        const storedUrls =
          demoPhotoDataUrls.length === photos.length
            ? demoPhotoDataUrls
            : await Promise.all(photos.map((p) => fileToCompactDataUrl(p.file)));

        const demoRecord: MemoryRecord = {
          id: memId,
          userId: user.id,
          memoryDate,
          title: previewSpec.generatedTitle,
          storyText,
          language: memoryLanguage,
          createdAt: now,
          updatedAt: now,
          isDemo: true,
          isPresetDemo: false,
          demoLabel: 'Local Demo Memory',
          photos: photos.map((p, idx) => ({
            id: `demo-photo-${idx}-${Date.now()}`,
            url: storedUrls[idx] || p.previewUrl,
            originalName: p.file.name,
            mimeType: p.file.type || 'image/jpeg',
            sizeBytes: p.file.size,
            sortOrder: idx,
            imageAnalysis: previewAnalyses[idx] || previewAnalyses[0] || null,
            createdAt: now,
          })),
          answers: compiledAnswers,
          music,
          design: {
            collageUrl: previewCollageUrl,
            designSpec: previewSpec,
            aiProviderUsed: previewProviderUsed,
            updatedAt: now,
          },
          video: {
            videoUrl: null,
            status: 'not_generated',
            durationSec: null,
            mimeType: null,
          },
        };

        onMemoryCreated(
          demoRecord,
          previewNotice ||
            (lang === 'ru'
              ? 'Сохранено в локальный демо-архив этого браузера.'
              : 'Saved to Local Demo Mode in this browser only.')
        );
        return;
      }

      const fd = new FormData();
      photos.forEach((p) => fd.append('photos', p.file));
      fd.append('memoryDate', memoryDate);
      fd.append('memoryLanguage', memoryLanguage);
      fd.append('storyText', storyText);
      fd.append('answersJson', JSON.stringify(compiledAnswers));
      if (music) fd.append('musicJson', JSON.stringify(music));
      fd.append('precomputedAnalysesJson', JSON.stringify(previewAnalyses));
      fd.append('precomputedDesignJson', JSON.stringify(previewSpec));
      fd.append('aiProviderUsed', previewProviderUsed);

      const { memory, notice } = await api.createMemory(fd);

      if (previewCollageBlob) {
        try {
          const saved = await api.saveCollage(memory.id, previewCollageBlob);
          if (memory.design) memory.design.collageUrl = saved.collageUrl;
        } catch {
          // Recoverable
        }
      }

      onMemoryCreated(memory, notice || previewNotice);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : lang === 'ru'
          ? 'Не удалось сохранить воспоминание.'
          : 'Unable to save this memory right now. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const reviewMemoryRecord: MemoryRecord | null = useMemo(() => {
    if (!previewSpec) return null;
    const now = new Date().toISOString();
    const urls =
      user.isDemoAccount && demoPhotoDataUrls.length === photos.length
        ? demoPhotoDataUrls
        : photos.map((p) => p.previewUrl);

    return {
      id: 'preview-draft',
      userId: user.id,
      memoryDate,
      title: previewSpec.generatedTitle,
      storyText,
      language: memoryLanguage,
      createdAt: now,
      updatedAt: now,
      isDemo: true,
      photos: photos.map((p, idx) => ({
        id: p.id,
        url: urls[idx] || p.previewUrl,
        originalName: p.file.name,
        mimeType: p.file.type || 'image/jpeg',
        sizeBytes: p.file.size,
        sortOrder: idx,
        imageAnalysis: previewAnalyses[idx] || null,
        createdAt: now,
      })),
      answers: compiledAnswers,
      music,
      design: {
        collageUrl: previewCollageUrl,
        designSpec: previewSpec,
        aiProviderUsed: previewProviderUsed,
        updatedAt: now,
      },
      video: {
        videoUrl: null,
        status: 'not_generated',
        durationSec: null,
        mimeType: null,
      },
    };
  }, [
    previewSpec,
    user.id,
    user.isDemoAccount,
    demoPhotoDataUrls,
    photos,
    memoryDate,
    storyText,
    memoryLanguage,
    previewAnalyses,
    compiledAnswers,
    music,
    previewCollageUrl,
    previewProviderUsed,
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      {/* Step Header + Manual / Auto-Year Switcher */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            {t('create.eyebrow')}
            {user.isDemoAccount ? ` · ${t('demo.bannerLead').replace(':', '')}` : ''}
          </p>
          <h1 className="font-display mt-1 text-3xl font-medium text-stone-900 sm:text-4xl">
            {phase === 'upload' && t('create.phaseUpload')}
            {phase === 'questionnaire' && t('create.phaseQuestions')}
            {phase === 'narrative' && t('create.phaseNarrative')}
            {phase === 'generating' && t('create.phaseGenerating')}
            {phase === 'review' && t('create.phaseReview')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {onSwitchToAutoYear && (
            <div className="flex border border-stone-300 bg-white p-0.5">
              <button
                type="button"
                className="min-h-[36px] cursor-pointer bg-stone-900 px-3 text-xs font-medium text-white"
              >
                {t('create.modeManual')}
              </button>
              <button
                type="button"
                onClick={onSwitchToAutoYear}
                className="min-h-[36px] cursor-pointer px-3 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                {t('create.modeAutoYear')}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] cursor-pointer border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
          >
            {t('create.cancel')}
          </button>
        </div>
      </div>

      {/* PHASE 1: PHOTO UPLOAD, DATE & MEMORY LANGUAGE */}
      {phase === 'upload' && (
        <div className="space-y-8 border border-stone-200 bg-white p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="memory-date" className="mb-1.5 block text-xs font-medium text-stone-700">
                {t('create.dateLabel')}
              </label>
              <input
                id="memory-date"
                type="date"
                value={memoryDate}
                onChange={(e) => setMemoryDate(e.target.value)}
                className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-700">{t('create.memoryLangLabel')}</p>
              <div className="inline-flex border border-stone-300 bg-[#faf8f3] p-0.5">
                <button
                  type="button"
                  onClick={() => setMemoryLanguage('en')}
                  className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium ${
                    memoryLanguage === 'en' ? 'bg-stone-900 text-white' : 'text-stone-700'
                  }`}
                >
                  {t('create.langEn')}
                </button>
                <button
                  type="button"
                  onClick={() => setMemoryLanguage('ru')}
                  className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium ${
                    memoryLanguage === 'ru' ? 'bg-stone-900 text-white' : 'text-stone-700'
                  }`}
                >
                  {t('create.langRu')}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">{t('create.memoryLangHint')}</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-stone-500">
            {user.isDemoAccount ? t('create.demoPrivacyNote') : t('create.privatePrivacyNote')}
          </p>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={handleFilePick}
              className="sr-only"
              id="memento-photo-picker"
            />
            <label
              htmlFor="memento-photo-picker"
              className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed border-stone-400 bg-[#faf8f3] p-6 text-center transition-colors hover:border-stone-900 hover:bg-stone-100/70"
            >
              <ImagePlus className="mb-3 h-8 w-8 text-stone-600" />
              <span className="font-display text-2xl font-medium text-stone-900">
                {t('create.dropTitle')}
              </span>
              <span className="mt-1 text-xs text-stone-500">{t('create.dropSub')}</span>
            </label>
          </div>

          {uploadError && (
            <p role="alert" className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {uploadError}
            </p>
          )}

          {photos.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-stone-700">
                {t('create.selectedPhotos', { count: photos.length })}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="polaroid-card relative p-2 pb-3">
                    <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                      <img
                        src={photo.previewUrl}
                        alt={photo.file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 px-1">
                      <span className="truncate text-[11px] text-stone-500">
                        {idx + 1}. {photo.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        aria-label={photo.file.name}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-stone-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-stone-200 pt-5">
            <button
              type="button"
              disabled={photos.length === 0}
              onClick={() => setPhase('questionnaire')}
              className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 bg-stone-900 px-6 text-sm font-medium text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{t('create.beginQuestions')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: 10-STEP ADAPTIVE CONVERSATIONAL QUESTIONNAIRE */}
      {phase === 'questionnaire' && currentQuestion && (
        <div className="grid gap-8 lg:grid-cols-12">
          <aside className="space-y-4 lg:col-span-4">
            <div className="polaroid-card p-2.5 pb-5">
              <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                <img
                  src={photos[0]?.previewUrl}
                  alt={t('create.eyebrow')}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-2.5 px-1 text-xs text-stone-500 tabular-nums">
                {formatDate(memoryDate)}
                {photos.length > 1 ? ` · ${t('create.photosCount', { count: photos.length })}` : ''}
              </p>
            </div>

            <div className="border border-stone-200 bg-white p-4">
              <p className="mb-2.5 text-[11px] uppercase tracking-wider text-stone-500">
                {t('create.questionsProgress', { current: stepIdx + 1, total: MEMORY_QUESTIONS.length })}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {MEMORY_QUESTIONS.map((q, idx) => {
                  const hasAnswer = q.isMusicQuestion
                    ? Boolean(music)
                    : Boolean(answers[q.id]?.selected.length || answers[q.id]?.custom.trim());
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setStepIdx(idx)}
                      className={`min-h-[36px] cursor-pointer text-xs tabular-nums transition-colors ${
                        idx === stepIdx
                          ? 'bg-stone-900 font-medium text-white'
                          : hasAnswer
                          ? 'border border-stone-400 bg-stone-100 text-stone-900'
                          : 'border border-stone-200 bg-[#faf8f3] text-stone-500 hover:border-stone-400'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="flex flex-col justify-between border border-stone-200 bg-white p-6 sm:p-8 lg:col-span-8">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {lang === 'ru' ? currentQuestion.stepLabelRu : currentQuestion.stepLabel}
                </p>
                <h2 className="font-display mt-2 text-3xl font-medium text-stone-900">
                  {lang === 'ru' ? currentQuestion.questionRu : currentQuestion.question}
                </h2>
                <p className="mt-1.5 text-sm text-stone-500">
                  {lang === 'ru' ? currentQuestion.promptHintRu : currentQuestion.promptHint}
                </p>
              </div>

              {currentQuestion.isMusicQuestion ? (
                <MusicPicker value={music} onChange={setMusic} />
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    {adaptiveChips.map((chip) => {
                      const selected = answers[currentQuestion.id]?.selected.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            toggleSuggestion(currentQuestion.id, chip, currentQuestion.multiSelect)
                          }
                          className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border px-3.5 py-2 text-xs transition-colors ${
                            selected
                              ? 'border-stone-900 bg-stone-900 text-stone-50'
                              : 'border-stone-300 bg-[#faf8f3] text-stone-800 hover:border-stone-700'
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                          <span>{chip}</span>
                        </button>
                      );
                    })}
                  </div>

                  {currentQuestion.isColorQuestion && (
                    <div className="flex flex-wrap items-center gap-4 border border-stone-200 bg-[#faf8f3] p-3.5">
                      <label htmlFor="custom-memory-color" className="text-xs font-medium text-stone-700">
                        {t('create.pickShade')}
                      </label>
                      <input
                        id="custom-memory-color"
                        type="color"
                        value={customColorHex}
                        onChange={(e) => {
                          const hex = e.target.value.toUpperCase();
                          setCustomColorHex(hex);
                          setCustomAnswer(
                            currentQuestion.id,
                            lang === 'ru' ? `Свой оттенок (${hex})` : `Custom shade (${hex})`
                          );
                        }}
                        className="h-10 w-16 cursor-pointer border border-stone-300 bg-white p-0.5"
                      />
                      <span className="font-mono text-xs text-stone-600">{customColorHex}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`custom-${currentQuestion.id}`}
                      className="mb-1.5 block text-xs font-medium text-stone-600"
                    >
                      {t('create.customWords')}
                    </label>
                    <input
                      id={`custom-${currentQuestion.id}`}
                      type="text"
                      value={answers[currentQuestion.id]?.custom || ''}
                      onChange={(e) => setCustomAnswer(currentQuestion.id, e.target.value)}
                      placeholder={t('create.customWordsPlaceholder')}
                      className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
              <button
                type="button"
                onClick={() => {
                  if (stepIdx === 0) setPhase('upload');
                  else setStepIdx((i) => i - 1);
                }}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t('create.previous')}</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (stepIdx < MEMORY_QUESTIONS.length - 1) setStepIdx((i) => i + 1);
                    else setPhase('narrative');
                  }}
                  className="min-h-[44px] cursor-pointer px-4 text-xs text-stone-500 hover:text-stone-900"
                >
                  {t('create.skip')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stepIdx < MEMORY_QUESTIONS.length - 1) setStepIdx((i) => i + 1);
                    else setPhase('narrative');
                  }}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-stone-50 hover:bg-stone-800"
                >
                  <span>{stepIdx === MEMORY_QUESTIONS.length - 1 ? t('create.writeStory') : t('create.next')}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* PHASE 3: OPEN-ENDED STORY */}
      {phase === 'narrative' && (
        <div className="space-y-6 border border-stone-200 bg-white p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{t('create.finalReflection')}</p>
            <h2 className="font-display mt-1 text-3xl font-medium text-stone-900">
              {t('create.describeDay')}
            </h2>
            <p className="mt-1 text-sm text-stone-500">{t('create.describeSub')}</p>
          </div>

          <textarea
            rows={6}
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            placeholder={t('create.storyPlaceholder')}
            className="font-serif-prose w-full border border-stone-300 bg-[#faf8f3] p-4 text-base leading-relaxed text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
          />

          {submitError && (
            <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              {submitError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
            <button
              type="button"
              onClick={() => {
                setPhase('questionnaire');
                setStepIdx(MEMORY_QUESTIONS.length - 1);
              }}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone-300 px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('create.backQuestions')}</span>
            </button>

            <button
              type="button"
              onClick={handleGeneratePreview}
              className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 bg-stone-900 px-6 text-sm font-medium text-stone-50 hover:bg-stone-800"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('create.generatePreview')}</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: PROGRESS */}
      {phase === 'generating' && (
        <div className="space-y-6 border border-stone-200 bg-white p-8 text-center sm:p-12">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-stone-800" />
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-medium text-stone-900">{progressStage}</h2>
            <p className="text-xs text-stone-500">{t('create.generatingSub')}</p>
          </div>
          <div className="mx-auto h-1.5 max-w-md overflow-hidden bg-stone-200">
            <div
              className="h-full bg-stone-900 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* PHASE 5: REVIEW, REGENERATE, SAVE */}
      {phase === 'review' && previewSpec && reviewMemoryRecord && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-stone-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPhase('narrative')}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-stone-300 px-3.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{t('create.editAnswers')}</span>
              </button>
              <button
                type="button"
                disabled={regenerating || saving}
                onClick={handleRegenerateComposition}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-stone-900 px-4 text-xs font-medium text-stone-900 hover:bg-stone-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{regenerating ? t('create.regenerating') : t('create.regenerate')}</span>
              </button>
            </div>

            <button
              type="button"
              disabled={saving || regenerating}
              onClick={handleConfirmAndSave}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 bg-stone-900 px-6 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>
                {saving
                  ? t('create.saving')
                  : user.isDemoAccount
                  ? t('create.saveDemo')
                  : t('create.saveArchive')}
              </span>
            </button>
          </div>

          {previewNotice && (
            <div className="border border-stone-300 bg-white px-4 py-3 text-xs text-stone-700">
              {previewNotice}
            </div>
          )}

          {submitError && (
            <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              {submitError}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
            {(
              [
                { id: 'scrapbook', label: t('create.tabScrapbook') },
                { id: 'collage', label: t('create.tabCollage') },
                { id: 'explain', label: t('create.tabExplain') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReviewTab(tab.id)}
                className={`min-h-[38px] cursor-pointer px-4 text-xs font-medium transition-colors ${
                  reviewTab === tab.id
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-300 bg-white text-stone-700 hover:border-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {reviewTab === 'scrapbook' && <ScrapbookCanvas memory={reviewMemoryRecord} />}

          {reviewTab === 'collage' && (
            <div className="flex justify-center border border-stone-200 bg-white p-6">
              {previewCollageUrl ? (
                <img
                  src={previewCollageUrl}
                  alt={previewSpec.generatedTitle}
                  className="max-h-[75vh] w-auto border border-stone-200 shadow-lg"
                />
              ) : (
                <p className="py-12 text-xs text-stone-500">
                  {t('detail.staticSub')}
                </p>
              )}
            </div>
          )}

          {reviewTab === 'explain' && (
            <div className="grid gap-6 border border-stone-200 bg-white p-6 md:grid-cols-2">
              <div className="space-y-3 text-sm">
                <h2 className="font-display text-2xl font-medium text-stone-900">
                  {t('create.whyTitle')}
                </h2>
                <p className="text-xs text-stone-500">{t('create.engine', { provider: previewProviderUsed })}</p>
                <p>
                  <strong className="font-medium">{t('detail.palette')}:</strong>{' '}
                  {previewSpec.explainability.paletteReason}
                </p>
                <p>
                  <strong className="font-medium">
                    {localizeLayoutLabel(previewSpec.layoutId, lang)}:
                  </strong>{' '}
                  {previewSpec.explainability.layoutReason}
                </p>
                <p>
                  <strong className="font-medium">
                    {localizeTextureLabel(previewSpec.paperTexture, lang)} ·{' '}
                    {lang === 'ru'
                      ? FILM_FILTERS[previewSpec.filmEffect]?.labelRu
                      : FILM_FILTERS[previewSpec.filmEffect]?.label}
                    :
                  </strong>{' '}
                  {previewSpec.explainability.textureAndFilmReason}
                </p>
                <p>
                  <strong className="font-medium">
                    {lang === 'ru'
                      ? TYPOGRAPHY_PAIRS[previewSpec.typography]?.labelRu
                      : TYPOGRAPHY_PAIRS[previewSpec.typography]?.label}
                    :
                  </strong>{' '}
                  {previewSpec.explainability.typographyAndMotifReason}
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <h3 className="font-display text-xl font-medium text-stone-900">{t('create.paletteHeading')}</h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    previewSpec.palette.chosenByUser,
                    previewSpec.palette.primaryAccent,
                    previewSpec.palette.secondaryAccent,
                    ...previewSpec.palette.extractedFromPhoto.slice(0, 3),
                  ].map((hex, i) => (
                    <div key={`${hex}-${i}`} className="flex items-center gap-1.5 border border-stone-200 px-2.5 py-1">
                      <span className="h-4 w-4 rounded-full border border-stone-300" style={{ backgroundColor: hex }} />
                      <span className="font-mono text-[11px]">{hex}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-stone-600">{previewSpec.moodSummary}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
