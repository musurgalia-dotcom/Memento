import { ArrowRight, FolderOpen, Images, Lock, Sparkles, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useAutoImport } from '../lib/autoImportManager';
import { useI18n } from '../lib/i18n';

interface GalleryOnboardingProps {
  onStartAutoImportFinished: () => void;
  onSkip: () => void;
}

export function GalleryOnboarding({
  onStartAutoImportFinished,
  onSkip,
}: GalleryOnboardingProps) {
  const { t, lang } = useI18n();
  const { enqueueFiles } = useAutoImport();
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    try {
      await enqueueFiles(fileList, { autoStart: true, language: lang });
      onStartAutoImportFinished();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/60 p-4 backdrop-blur-xs"
    >
      <div className="relative my-auto w-full max-w-3xl border border-stone-300 bg-[#faf8f3] p-6 shadow-2xl sm:p-10">
        <button
          type="button"
          onClick={onSkip}
          aria-label={t('onb.skipForNow')}
          className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center border border-stone-300 bg-white text-stone-600 hover:text-stone-900"
        >
          <X className="h-4 w-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFilesSelected(e.target.files)}
          className="sr-only"
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          {...({ webkitdirectory: '' } as Record<string, string>)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFilesSelected(e.target.files)}
          className="sr-only"
        />

        <div className="space-y-6">
          <div className="space-y-3 border-b border-stone-200 pb-6">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-500">
              <Sparkles className="h-3.5 w-3.5 text-stone-700" />
              <span>{t('onb.eyebrow')}</span>
            </p>
            <h2
              id="onboarding-title"
              className="font-display headline-balance text-3xl font-medium leading-tight text-stone-900 sm:text-4xl"
            >
              {t('onb.title')}
            </h2>
            <p className="font-serif-prose max-w-2xl text-base leading-relaxed text-stone-700">
              {t('onb.subtitle')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border border-stone-200 bg-white p-4 space-y-1.5">
              <h3 className="font-display text-lg font-medium text-stone-900">{t('onb.feature1Title')}</h3>
              <p className="text-xs leading-relaxed text-stone-600">{t('onb.feature1Desc')}</p>
            </div>
            <div className="border border-stone-200 bg-white p-4 space-y-1.5">
              <h3 className="font-display text-lg font-medium text-stone-900">{t('onb.feature2Title')}</h3>
              <p className="text-xs leading-relaxed text-stone-600">{t('onb.feature2Desc')}</p>
            </div>
            <div className="border border-stone-200 bg-white p-4 space-y-1.5">
              <h3 className="font-display text-lg font-medium text-stone-900">{t('onb.feature3Title')}</h3>
              <p className="text-xs leading-relaxed text-stone-600">{t('onb.feature3Desc')}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 border border-stone-200 bg-white px-4 py-3 text-xs leading-relaxed text-stone-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
            <p>{t('onb.privacyNote')}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 bg-stone-900 px-5 text-xs font-medium text-white transition-colors hover:bg-stone-800 whitespace-nowrap disabled:opacity-50"
              >
                <Images className="h-4 w-4" />
                <span>{busy ? t('auth.pleaseWait') : t('onb.pickPhotos')}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => folderInputRef.current?.click()}
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 border border-stone-400 bg-white px-5 text-xs font-medium text-stone-900 transition-colors hover:bg-stone-100 whitespace-nowrap disabled:opacity-50"
              >
                <FolderOpen className="h-4 w-4" />
                <span>{t('onb.pickFolder')}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 whitespace-nowrap"
            >
              <span>{t('onb.skipForNow')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
