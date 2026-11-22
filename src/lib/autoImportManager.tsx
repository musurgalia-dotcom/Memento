import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { DesignSpecification, ImageVisualAnalysis } from './artLibrary';
import { renderStaticCollageToBlob } from './collageRenderer';
import { buildLocalClientFallbackSpec, fileToCompactDataUrl } from './demoWorkspace';
import {
  buildLocalFallbackAnalysis,
  compressPhotoThumbnail,
  computePhotoFingerprint,
  extractExifCaptureDate,
  readCachedPhotoAnalysis,
  writeCachedPhotoAnalysis,
} from './exifAndThumb';
import type {
  AppLanguage,
  AutoYearAnalyzedItem,
  MemoryAnswerRecord,
  MemoryRecord,
  UserProfile,
} from './types';

export interface QueuedImportPhoto {
  clientId: string;
  fingerprint: string;
  file: File;
  previewUrl: string;
  thumbnailDataUrl?: string;
  captureDate: string | null;
  captureTime: string | null;
  captureMinutes: number | null;
  dateSource: 'exif' | 'file-modified' | 'manual' | 'unknown';
  detectedYear: string | null;
  dominantColors?: string[];
  brightnessScore?: number;
  failedReason?: string;
}

export type AutoImportStage =
  | 'idle'
  | 'preparing'
  | 'analyzing'
  | 'clustering'
  | 'creating'
  | 'paused'
  | 'completed'
  | 'error';

export interface AutoImportState {
  stage: AutoImportStage;
  resumeFromStage: 'analyzing' | 'clustering' | 'creating' | null;
  analyzedDone: number;
  analyzedTotal: number;
  discoveredGroups: number;
  createdDone: number;
  createdTotal: number;
  failedCount: number;
  duplicatesSkipped: number;
  errorMessage: string | null;
  interruptedPreviousRun: boolean;
  bannerDismissed: boolean;
}

interface AutoImportContextValue {
  queue: QueuedImportPhoto[];
  state: AutoImportState;
  yearFilter: string;
  setYearFilter: (year: string) => void;
  memoryLanguage: AppLanguage;
  setMemoryLanguage: (lang: AppLanguage) => void;
  enqueueFiles: (
    fileList: FileList | File[],
    options?: { autoStart?: boolean; language?: AppLanguage; skipDuplicateCheck?: boolean }
  ) => Promise<{ addedCount: number; skippedDuplicates: number }>;
  updateQueuedDate: (clientId: string, nextDate: string) => void;
  removeQueuedPhoto: (clientId: string) => void;
  clearQueue: () => void;
  startBackgroundDiscovery: (overrideQueue?: QueuedImportPhoto[], overrideLang?: AppLanguage) => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  retryFailed: () => Promise<void>;
  dismissBanner: () => void;
  clearInterruptedNotice: () => void;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const ACTIVE_JOB_FLAG_KEY = 'memento_bg_import_active_v1';

const AutoImportContext = createContext<AutoImportContextValue | null>(null);

function getLocalTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildSmartClientFallbackClusters(
  items: AutoYearAnalyzedItem[],
  lang: AppLanguage
): Array<{
  clusterId: string;
  title: string;
  memoryDate: string;
  dateUncertain: boolean;
  eventTimeLabel?: string;
  themeLabel: string;
  groupingReason: string;
  photoIds: string[];
  storyText: string;
  inferredAnswers: MemoryAnswerRecord[];
}> {
  const sorted = [...items].sort((a, b) => {
    if (a.captureDate && b.captureDate) {
      const dc = a.captureDate.localeCompare(b.captureDate);
      if (dc !== 0) return dc;
      if (a.captureMinutes != null && b.captureMinutes != null) return a.captureMinutes - b.captureMinutes;
    }
    return a.originalName.localeCompare(b.originalName);
  });

  const groups: AutoYearAnalyzedItem[][] = [];
  for (const item of sorted) {
    const lastGrp = groups[groups.length - 1];
    if (lastGrp && lastGrp.length < 8) {
      const anchor = lastGrp[lastGrp.length - 1];
      const sameDate = item.captureDate && anchor.captureDate && item.captureDate === anchor.captureDate;
      const minsGap =
        item.captureMinutes != null && anchor.captureMinutes != null
          ? Math.abs(item.captureMinutes - anchor.captureMinutes)
          : null;
      const sameCat = item.analysis.sceneCategory === anchor.analysis.sceneCategory;
      const compatibleTime = minsGap === null ? item.analysis.timeOfDay === anchor.analysis.timeOfDay : minsGap <= 95;
      if (sameDate && compatibleTime && (sameCat || minsGap !== null)) {
        lastGrp.push(item);
        continue;
      }
    }
    groups.push([item]);
  }

  return groups.map((group, idx) => {
    const first = group[0];
    const dateStr = first.captureDate || getLocalTodayIso();
    const uncertain = !first.captureDate || first.dateSource === 'file-modified' || first.dateSource === 'unknown';
    const isNight = group.every((g) => (g.analysis.brightnessScore ?? 0.5) < 0.36);

    return {
      clusterId: `cluster-local-${idx + 1}-${crypto.randomUUID().slice(0, 6)}`,
      title:
        lang === 'ru'
          ? isNight
            ? 'Вечерние огни и тишина'
            : `Моменты дня · ${dateStr}`
          : isNight
          ? 'Evening Lights and Quiet Air'
          : `Moments on ${dateStr}`,
      memoryDate: dateStr,
      dateUncertain: uncertain,
      eventTimeLabel: first.captureTime ? first.captureTime.slice(0, 5) : undefined,
      themeLabel: first.analysis.sceneCategory || (lang === 'ru' ? 'Глава года' : 'Year Chapter'),
      groupingReason:
        lang === 'ru'
          ? 'Сгруппировано по времени съёмки и близкой визуальной сцене.'
          : 'Grouped by capture time window and matching scene context.',
      photoIds: group.slice(0, 8).map((g) => g.clientId),
      storyText:
        lang === 'ru'
          ? `Подборка из ${group.length} снимков этого события.`
          : `Curated from ${group.length} photograph${group.length > 1 ? 's' : ''} from this event.`,
      inferredAnswers: [
        {
          questionId: 'mood_emotions',
          question: lang === 'ru' ? 'Настроение момента' : 'Moment atmosphere',
          answer:
            lang === 'ru'
              ? isNight
                ? 'Спокойствие, вечер'
                : 'Тепло, память'
              : isNight
              ? 'Calm, nocturnal'
              : 'Warmth, nostalgia',
          tags: [],
        },
        {
          questionId: 'associated_color',
          question: lang === 'ru' ? 'Связанный оттенок' : 'Associated color',
          answer: first.analysis.dominantColors[0] || '#5D8AA8',
          tags: [],
        },
      ],
    };
  });
}

interface AutoImportProviderProps {
  user: UserProfile | null;
  defaultLanguage: AppLanguage;
  onMemorySaved: (memory: MemoryRecord) => void;
  onUserPreferencesSynced: (nextUser: UserProfile) => void;
  children: ReactNode;
}

export function AutoImportProvider({
  user,
  defaultLanguage,
  onMemorySaved,
  onUserPreferencesSynced,
  children,
}: AutoImportProviderProps) {
  const [queue, setQueue] = useState<QueuedImportPhoto[]>([]);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [memoryLanguage, setMemoryLanguage] = useState<AppLanguage>(defaultLanguage);
  const [state, setState] = useState<AutoImportState>(() => {
    let interrupted = false;
    try {
      interrupted = sessionStorage.getItem(ACTIVE_JOB_FLAG_KEY) === '1';
      if (interrupted) sessionStorage.removeItem(ACTIVE_JOB_FLAG_KEY);
    } catch {
      // Ignore storage errors
    }
    return {
      stage: 'idle',
      resumeFromStage: null,
      analyzedDone: 0,
      analyzedTotal: 0,
      discoveredGroups: 0,
      createdDone: 0,
      createdTotal: 0,
      failedCount: 0,
      duplicatesSkipped: 0,
      errorMessage: null,
      interruptedPreviousRun: interrupted,
      bannerDismissed: false,
    };
  });

  const userRef = useRef(user);
  userRef.current = user;
  const onMemorySavedRef = useRef(onMemorySaved);
  onMemorySavedRef.current = onMemorySaved;
  const onUserPrefsRef = useRef(onUserPreferencesSynced);
  onUserPrefsRef.current = onUserPreferencesSynced;

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);
  const createdUrlsRef = useRef<string[]>([]);
  const memAnalysisCacheRef = useRef<Map<string, AutoYearAnalyzedItem>>(new Map());

  useEffect(() => {
    setMemoryLanguage(defaultLanguage);
  }, [defaultLanguage]);

  // Clear queue cleanly on user logout
  useEffect(() => {
    if (!user) {
      cancelRef.current = true;
      pauseRef.current = false;
      setQueue([]);
      setState((prev) => ({
        ...prev,
        stage: 'idle',
        resumeFromStage: null,
        errorMessage: null,
      }));
    }
  }, [user]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const waitWhilePaused = async () => {
    while (pauseRef.current && !cancelRef.current) {
      await new Promise((r) => setTimeout(r, 150));
    }
  };

  const syncImportedFingerprints = useCallback(async (newFingerprints: string[]) => {
    const activeUser = userRef.current;
    if (!activeUser || newFingerprints.length === 0) return;

    const merged = Array.from(
      new Set([...(activeUser.preferences?.importedFingerprints || []), ...newFingerprints])
    ).slice(-2000);

    const updatedUser: UserProfile = {
      ...activeUser,
      preferences: {
        ...activeUser.preferences,
        onboardingCompleted: true,
        galleryConnected: true,
        importedFingerprints: merged,
      },
    };
    onUserPrefsRef.current(updatedUser);

    if (!activeUser.isDemoAccount) {
      try {
        const res = await api.updateProfile({
          preferences: {
            onboardingCompleted: true,
            galleryConnected: true,
            importedFingerprints: merged,
          },
        });
        onUserPrefsRef.current(res.user);
      } catch {
        // Recoverable
      }
    }
  }, []);

  const persistSingleCluster = useCallback(
    async (params: {
      cluster: {
        clusterId: string;
        title: string;
        memoryDate: string;
        eventTimeLabel?: string;
        photoIds: string[];
        storyText: string;
        inferredAnswers: MemoryAnswerRecord[];
      };
      selectedPhotos: QueuedImportPhoto[];
      analyzedMap: Map<string, AutoYearAnalyzedItem>;
      targetLang: AppLanguage;
      variationSeed: number;
    }): Promise<MemoryRecord | null> => {
      const activeUser = userRef.current;
      if (!activeUser || params.selectedPhotos.length === 0) return null;

      const clusterAnalyses = params.selectedPhotos
        .map((p) => params.analyzedMap.get(p.clientId)?.analysis)
        .filter((a): a is ImageVisualAnalysis => Boolean(a));

      let spec: DesignSpecification;
      let providerUsed = 'local-heuristic';

      try {
        const gen = await api.generateClusterDesign({
          imageAnalyses: clusterAnalyses,
          memoryDate: params.cluster.memoryDate,
          memoryLanguage: params.targetLang,
          storyText: params.cluster.storyText,
          answers: params.cluster.inferredAnswers,
          music: null,
          userPreferences: activeUser.preferences,
          variationSeed: params.variationSeed,
        });
        spec = {
          ...gen.designSpec,
          generatedTitle: params.cluster.title || gen.designSpec.generatedTitle,
        };
        providerUsed = gen.aiProviderUsed;
      } catch {
        const local = buildLocalClientFallbackSpec({
          memoryDate: params.cluster.memoryDate,
          storyText: params.cluster.storyText,
          answers: params.cluster.inferredAnswers,
          music: null,
          memoryLanguage: params.targetLang,
        });
        spec = {
          ...local.designSpec,
          generatedTitle: params.cluster.title || local.designSpec.generatedTitle,
        };
        providerUsed = local.aiProviderUsed;
      }

      // Render high-resolution static archival PNG collage immediately before saving
      let collageBlob: Blob | null = null;
      let collageDataUrl: string | null = null;
      try {
        const notes = params.cluster.inferredAnswers
          .filter((a) => ['smell', 'sounds', 'detail_remember'].includes(a.questionId))
          .map((a) => a.answer)
          .filter(Boolean);
        const rendered = await renderStaticCollageToBlob({
          seedKey: params.cluster.clusterId,
          title: spec.generatedTitle,
          photoUrls: params.selectedPhotos.map((p) => p.previewUrl),
          memoryDate: params.cluster.memoryDate,
          language: params.targetLang,
          designSpec: spec,
          storySnippet: params.cluster.storyText,
          isAiOnlyText: !params.cluster.storyText?.trim(),
          handwrittenNotes: notes,
          answers: params.cluster.inferredAnswers,
        });
        collageBlob = rendered.blob;
        collageDataUrl = rendered.previewDataUrl;
      } catch {
        // Recoverable fallback: Scrapbook still renders cleanly live
      }

      if (activeUser.isDemoAccount) {
        const now = new Date().toISOString();
        const compactUrls = await Promise.all(
          params.selectedPhotos.map((p) => fileToCompactDataUrl(p.file, 1024))
        );
        const demoMem: MemoryRecord = {
          id: `demo-auto-${crypto.randomUUID().slice(0, 8)}`,
          userId: activeUser.id,
          memoryDate: params.cluster.memoryDate,
          title: spec.generatedTitle,
          storyText: params.cluster.storyText,
          language: params.targetLang,
          origin: 'automatic',
          eventTimeLabel: params.cluster.eventTimeLabel || '',
          createdAt: now,
          updatedAt: now,
          isDemo: true,
          isPresetDemo: false,
          demoLabel: 'Local Demo Memory',
          photos: params.selectedPhotos.map((p, idx) => ({
            id: `demo-photo-${idx}-${Date.now()}`,
            url: compactUrls[idx] || p.previewUrl,
            originalName: p.file.name,
            mimeType: p.file.type || 'image/jpeg',
            sizeBytes: p.file.size,
            sortOrder: idx,
            imageAnalysis: params.analyzedMap.get(p.clientId)?.analysis || null,
            createdAt: now,
          })),
          answers: params.cluster.inferredAnswers,
          music: null,
          design: {
            collageUrl: collageDataUrl,
            designSpec: spec,
            aiProviderUsed: providerUsed,
            updatedAt: now,
          },
          video: {
            videoUrl: null,
            status: 'not_generated',
            durationSec: null,
            mimeType: null,
          },
        };
        return demoMem;
      }

      const fd = new FormData();
      params.selectedPhotos.forEach((p) => fd.append('photos', p.file));
      fd.append('memoryDate', params.cluster.memoryDate);
      fd.append('memoryLanguage', params.targetLang);
      fd.append('origin', 'automatic');
      if (params.cluster.eventTimeLabel) fd.append('eventTimeLabel', params.cluster.eventTimeLabel);
      fd.append('title', spec.generatedTitle);
      fd.append('storyText', params.cluster.storyText);
      fd.append('answersJson', JSON.stringify(params.cluster.inferredAnswers));
      if (clusterAnalyses.length === params.selectedPhotos.length) {
        fd.append('precomputedAnalysesJson', JSON.stringify(clusterAnalyses));
      }
      fd.append('precomputedDesignJson', JSON.stringify(spec));
      fd.append('aiProviderUsed', providerUsed);

      const { memory } = await api.createMemory(fd);
      if (collageBlob) {
        try {
          const savedCollage = await api.saveCollage(memory.id, collageBlob);
          if (memory.design) memory.design.collageUrl = savedCollage.collageUrl;
        } catch {
          // Non-fatal
        }
      }
      return memory;
    },
    []
  );

  const startBackgroundDiscovery = useCallback(
    async (overrideQueue?: QueuedImportPhoto[], overrideLang?: AppLanguage) => {
      if (runningRef.current) return;
      const itemsToRun = (overrideQueue || queue).filter(
        (q) => yearFilter === 'all' || !q.detectedYear || q.detectedYear === yearFilter
      );
      if (itemsToRun.length === 0) return;

      const targetLang = overrideLang || memoryLanguage;
      runningRef.current = true;
      cancelRef.current = false;
      pauseRef.current = false;

      try {
        sessionStorage.setItem(ACTIVE_JOB_FLAG_KEY, '1');
      } catch {
        // Ignore
      }

      setState((prev) => ({
        ...prev,
        stage: 'analyzing',
        resumeFromStage: null,
        analyzedDone: 0,
        analyzedTotal: itemsToRun.length,
        discoveredGroups: 0,
        createdDone: 0,
        createdTotal: 0,
        failedCount: 0,
        errorMessage: null,
        interruptedPreviousRun: false,
        bannerDismissed: false,
      }));

      try {
        // 1. Analyze photos in small concurrent-safe batches (reusing browser fingerprint cache)
        const analyzedMap = new Map<string, AutoYearAnalyzedItem>();
        const pendingToAnalyze: QueuedImportPhoto[] = [];
        let cachedCount = 0;

        for (const q of itemsToRun) {
          const inMem = memAnalysisCacheRef.current.get(q.fingerprint);
          const inDisk = inMem?.analysis || readCachedPhotoAnalysis(q.fingerprint, targetLang);
          if (inDisk && !q.failedReason) {
            const record: AutoYearAnalyzedItem = {
              clientId: q.clientId,
              fingerprint: q.fingerprint,
              originalName: q.file.name,
              captureDate: q.captureDate,
              captureTime: q.captureTime,
              captureMinutes: q.captureMinutes,
              dateSource: q.dateSource,
              analysis: inDisk,
            };
            memAnalysisCacheRef.current.set(q.fingerprint, record);
            analyzedMap.set(q.clientId, record);
            cachedCount += 1;
          } else {
            pendingToAnalyze.push(q);
          }
        }

        setState((prev) => ({ ...prev, analyzedDone: cachedCount }));

        let failures = 0;
        const newlyCached: Array<{ fingerprint: string; language: AppLanguage; analysis: ImageVisualAnalysis }> = [];

        for (let i = 0; i < pendingToAnalyze.length; i += 5) {
          await waitWhilePaused();
          if (cancelRef.current) {
            setState((prev) => ({ ...prev, stage: 'idle', resumeFromStage: null }));
            return;
          }

          const slice = pendingToAnalyze.slice(i, i + 5);
          const validSlice = slice.filter((s) => Boolean(s.thumbnailDataUrl));

          if (validSlice.length > 0) {
            try {
              const res = await api.analyzeYearBatch({
                language: targetLang,
                items: validSlice.map((s) => ({
                  clientId: s.clientId,
                  base64DataUrl: s.thumbnailDataUrl!,
                })),
              });

              for (const entry of res.results) {
                const q = slice.find((x) => x.clientId === entry.clientId);
                if (!q) continue;
                if (entry.ok && entry.analysis) {
                  const record: AutoYearAnalyzedItem = {
                    clientId: q.clientId,
                    fingerprint: q.fingerprint,
                    originalName: q.file.name,
                    captureDate: q.captureDate,
                    captureTime: q.captureTime,
                    captureMinutes: q.captureMinutes,
                    dateSource: q.dateSource,
                    analysis: entry.analysis,
                  };
                  memAnalysisCacheRef.current.set(q.fingerprint, record);
                  analyzedMap.set(q.clientId, record);
                  newlyCached.push({ fingerprint: q.fingerprint, language: targetLang, analysis: entry.analysis });
                  setQueue((prev) =>
                    prev.map((x) => (x.clientId === q.clientId ? { ...x, failedReason: undefined } : x))
                  );
                } else {
                  failures += 1;
                  const fallback = buildLocalFallbackAnalysis(
                    q.dominantColors || ['#C2B29F', '#6B7785'],
                    q.brightnessScore ?? 0.55,
                    targetLang
                  );
                  analyzedMap.set(q.clientId, {
                    clientId: q.clientId,
                    fingerprint: q.fingerprint,
                    originalName: q.file.name,
                    captureDate: q.captureDate,
                    captureTime: q.captureTime,
                    captureMinutes: q.captureMinutes,
                    dateSource: q.dateSource,
                    analysis: fallback,
                  });
                }
              }
            } catch {
              failures += validSlice.length;
              for (const q of validSlice) {
                const fallback = buildLocalFallbackAnalysis(
                  q.dominantColors || ['#C2B29F', '#6B7785'],
                  q.brightnessScore ?? 0.55,
                  targetLang
                );
                analyzedMap.set(q.clientId, {
                  clientId: q.clientId,
                  fingerprint: q.fingerprint,
                  originalName: q.file.name,
                  captureDate: q.captureDate,
                  captureTime: q.captureTime,
                  captureMinutes: q.captureMinutes,
                  dateSource: q.dateSource,
                  analysis: fallback,
                });
              }
            }
          }

          for (const q of slice) {
            if (!analyzedMap.has(q.clientId)) {
              const fallback = buildLocalFallbackAnalysis(
                q.dominantColors || ['#C2B29F', '#6B7785'],
                q.brightnessScore ?? 0.55,
                targetLang
              );
              analyzedMap.set(q.clientId, {
                clientId: q.clientId,
                fingerprint: q.fingerprint,
                originalName: q.file.name,
                captureDate: q.captureDate,
                captureTime: q.captureTime,
                captureMinutes: q.captureMinutes,
                dateSource: q.dateSource,
                analysis: fallback,
              });
            }
          }

          setState((prev) => ({
            ...prev,
            analyzedDone: Math.min(itemsToRun.length, prev.analyzedDone + slice.length),
            failedCount: failures,
          }));
        }

        writeCachedPhotoAnalysis(newlyCached);

        await waitWhilePaused();
        if (cancelRef.current) {
          setState((prev) => ({ ...prev, stage: 'idle', resumeFromStage: null }));
          return;
        }

        // 2. Cluster into distinct multi-event groups (even within the same day)
        setState((prev) => ({ ...prev, stage: 'clustering' }));
        const orderedAnalyzed = itemsToRun
          .map((q) => analyzedMap.get(q.clientId))
          .filter((x): x is AutoYearAnalyzedItem => Boolean(x));

        let rawClusters: ReturnType<typeof buildSmartClientFallbackClusters>;
        try {
          const clusterRes = await api.clusterYearPhotos({
            language: targetLang,
            photos: orderedAnalyzed.map((item) => ({
              clientId: item.clientId,
              originalName: item.originalName,
              captureDate: item.captureDate,
              captureTime: item.captureTime,
              captureMinutes: item.captureMinutes,
              dateSource: item.dateSource,
              analysis: item.analysis,
            })),
          });
          rawClusters = clusterRes.clusters;
        } catch {
          rawClusters = buildSmartClientFallbackClusters(orderedAnalyzed, targetLang);
        }

        await waitWhilePaused();
        if (cancelRef.current) {
          setState((prev) => ({ ...prev, stage: 'idle', resumeFromStage: null }));
          return;
        }

        // 3. Incrementally create design spec + PNG collage + save each cluster immediately
        setState((prev) => ({
          ...prev,
          stage: 'creating',
          discoveredGroups: rawClusters.length,
          createdDone: 0,
          createdTotal: rawClusters.length,
        }));

        const itemById = new Map(itemsToRun.map((q) => [q.clientId, q]));
        const savedFingerprints: string[] = [];

        for (let idx = 0; idx < rawClusters.length; idx++) {
          await waitWhilePaused();
          if (cancelRef.current) {
            setState((prev) => ({ ...prev, stage: 'idle', resumeFromStage: null }));
            return;
          }

          const cluster = rawClusters[idx];
          const selectedPhotos = cluster.photoIds
            .map((id) => itemById.get(id))
            .filter((q): q is QueuedImportPhoto => Boolean(q))
            .slice(0, 8);

          if (selectedPhotos.length > 0) {
            try {
              const savedMemory = await persistSingleCluster({
                cluster,
                selectedPhotos,
                analyzedMap,
                targetLang,
                variationSeed: idx,
              });
              if (savedMemory) {
                onMemorySavedRef.current(savedMemory);
                selectedPhotos.forEach((p) => savedFingerprints.push(p.fingerprint));
              }
            } catch (err) {
              setState((prev) => ({
                ...prev,
                failedCount: prev.failedCount + 1,
                errorMessage: err instanceof Error ? err.message : prev.errorMessage,
              }));
            }
          }

          setState((prev) => ({ ...prev, createdDone: idx + 1 }));
        }

        await syncImportedFingerprints(savedFingerprints);

        // Remove saved items from the working queue while keeping unqueued if filtered
        const savedSet = new Set(savedFingerprints);
        setQueue((prev) => prev.filter((q) => !savedSet.has(q.fingerprint)));

        setState((prev) => ({
          ...prev,
          stage: 'completed',
          resumeFromStage: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          stage: 'error',
          errorMessage: err instanceof Error ? err.message : 'Unable to finish automatic memory creation.',
        }));
      } finally {
        runningRef.current = false;
        try {
          sessionStorage.removeItem(ACTIVE_JOB_FLAG_KEY);
        } catch {
          // Ignore
        }
      }
    },
    [memoryLanguage, persistSingleCluster, queue, syncImportedFingerprints, yearFilter]
  );

  const enqueueFiles = useCallback(
    async (
      fileList: FileList | File[],
      options?: { autoStart?: boolean; language?: AppLanguage; skipDuplicateCheck?: boolean }
    ): Promise<{ addedCount: number; skippedDuplicates: number }> => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return { addedCount: 0, skippedDuplicates: 0 };

      const prevQueueFingerprints = new Set(queue.map((q) => q.fingerprint));
      const alreadyImportedFingerprints = new Set(
        options?.skipDuplicateCheck ? [] : userRef.current?.preferences?.importedFingerprints || []
      );

      let skippedDuplicates = 0;
      const valid: File[] = [];

      for (const file of files) {
        const type = file.type.toLowerCase();
        const ext = file.name.toLowerCase().split('.').pop() || '';
        const validExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
        if ((type && !ALLOWED_TYPES.has(type) && !validExt) || (!type && !validExt)) continue;
        if (file.size > MAX_FILE_SIZE) continue;

        const fp = computePhotoFingerprint(file);
        if (prevQueueFingerprints.has(fp) || alreadyImportedFingerprints.has(fp)) {
          skippedDuplicates += 1;
          continue;
        }
        prevQueueFingerprints.add(fp);
        valid.push(file);
      }

      if (valid.length === 0) {
        setState((prev) => ({
          ...prev,
          duplicatesSkipped: skippedDuplicates,
          bannerDismissed: false,
        }));
        return { addedCount: 0, skippedDuplicates };
      }

      if (!runningRef.current) {
        setState((prev) => ({
          ...prev,
          stage: 'preparing',
          duplicatesSkipped: skippedDuplicates,
          errorMessage: null,
          bannerDismissed: false,
        }));
      }

      const capped = valid.slice(0, 120);
      const added: QueuedImportPhoto[] = [];

      for (let i = 0; i < capped.length; i += 2) {
        const chunk = capped.slice(i, i + 2);
        const results = await Promise.all(
          chunk.map(async (file): Promise<QueuedImportPhoto> => {
            const clientId = crypto.randomUUID();
            const fingerprint = computePhotoFingerprint(file);
            const meta = await extractExifCaptureDate(file);
            try {
              const thumb = await compressPhotoThumbnail(file, 512);
              createdUrlsRef.current.push(thumb.previewUrl);
              return {
                clientId,
                fingerprint,
                file,
                previewUrl: thumb.previewUrl,
                thumbnailDataUrl: thumb.thumbnailDataUrl,
                captureDate: meta.captureDate,
                captureTime: meta.captureTime,
                captureMinutes: meta.captureMinutes,
                dateSource: meta.dateSource,
                detectedYear: meta.captureDate ? meta.captureDate.slice(0, 4) : null,
                dominantColors: thumb.dominantColors,
                brightnessScore: thumb.brightnessScore,
              };
            } catch {
              const fallbackUrl = URL.createObjectURL(file);
              createdUrlsRef.current.push(fallbackUrl);
              return {
                clientId,
                fingerprint,
                file,
                previewUrl: fallbackUrl,
                captureDate: meta.captureDate,
                captureTime: meta.captureTime,
                captureMinutes: meta.captureMinutes,
                dateSource: meta.dateSource,
                detectedYear: meta.captureDate ? meta.captureDate.slice(0, 4) : null,
              };
            }
          })
        );
        added.push(...results);
      }

      const nextQueue = [...queue, ...added];
      setQueue(nextQueue);

      if (!runningRef.current) {
        setState((prev) => ({
          ...prev,
          stage: options?.autoStart ? prev.stage : 'idle',
          duplicatesSkipped: skippedDuplicates,
        }));
      }

      if (options?.autoStart && added.length > 0 && !runningRef.current) {
        // Trigger background organizer non-blocking
        void startBackgroundDiscovery(nextQueue, options.language || memoryLanguage);
      }

      return { addedCount: added.length, skippedDuplicates };
    },
    [memoryLanguage, queue, startBackgroundDiscovery]
  );

  const updateQueuedDate = useCallback((clientId: string, nextDate: string) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.clientId === clientId
          ? {
              ...q,
              captureDate: nextDate || null,
              dateSource: nextDate ? 'manual' : 'unknown',
              detectedYear: nextDate ? nextDate.slice(0, 4) : null,
            }
          : q
      )
    );
  }, []);

  const removeQueuedPhoto = useCallback((clientId: string) => {
    setQueue((prev) => prev.filter((q) => q.clientId !== clientId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const pause = useCallback(() => {
    pauseRef.current = true;
    setState((prev) => {
      if (prev.stage === 'analyzing' || prev.stage === 'clustering' || prev.stage === 'creating') {
        return { ...prev, stage: 'paused', resumeFromStage: prev.stage };
      }
      return prev;
    });
  }, []);

  const resume = useCallback(() => {
    pauseRef.current = false;
    setState((prev) => ({
      ...prev,
      stage: prev.resumeFromStage || 'analyzing',
      resumeFromStage: null,
    }));
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    pauseRef.current = false;
    try {
      sessionStorage.removeItem(ACTIVE_JOB_FLAG_KEY);
    } catch {
      // Ignore
    }
    setState((prev) => ({
      ...prev,
      stage: 'idle',
      resumeFromStage: null,
    }));
  }, []);

  const retryFailed = useCallback(async () => {
    await startBackgroundDiscovery();
  }, [startBackgroundDiscovery]);

  const dismissBanner = useCallback(() => {
    setState((prev) => ({ ...prev, bannerDismissed: true, interruptedPreviousRun: false }));
  }, []);

  const clearInterruptedNotice = useCallback(() => {
    setState((prev) => ({ ...prev, interruptedPreviousRun: false }));
  }, []);

  const value = useMemo<AutoImportContextValue>(
    () => ({
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
      dismissBanner,
      clearInterruptedNotice,
    }),
    [
      queue,
      state,
      yearFilter,
      memoryLanguage,
      enqueueFiles,
      updateQueuedDate,
      removeQueuedPhoto,
      clearQueue,
      startBackgroundDiscovery,
      pause,
      resume,
      cancel,
      retryFailed,
      dismissBanner,
      clearInterruptedNotice,
    ]
  );

  return <AutoImportContext.Provider value={value}>{children}</AutoImportContext.Provider>;
}

export function useAutoImport() {
  const ctx = useContext(AutoImportContext);
  if (!ctx) throw new Error('useAutoImport must be used inside AutoImportProvider');
  return ctx;
}
