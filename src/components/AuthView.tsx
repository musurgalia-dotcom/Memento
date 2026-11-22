import { ArrowRight, Compass, Eye, EyeOff, Lock, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { DEMO_MEMORIES, localizeDemoMemory } from '../lib/demoMemories';
import { useI18n } from '../lib/i18n';
import type { MemoryRecord, UserProfile } from '../lib/types';

interface AuthViewProps {
  initialNotice?: string | null;
  onAuthenticated: (user: UserProfile) => void;
  onEnterDemoMode: () => void;
  onOpenDemo: (demo: MemoryRecord) => void;
}

export function AuthView({
  initialNotice,
  onAuthenticated,
  onEnterDemoMode,
  onOpenDemo,
}: AuthViewProps) {
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [privacyAgree, setPrivacyAgree] = useState(true);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice || null);
  const [localRecoveryToken, setLocalRecoveryToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ email, password });
        onAuthenticated(res.user);
      } else if (mode === 'register') {
        const res = await api.register({ name, email, password, privacyAgree });
        onAuthenticated(res.user);
      } else if (mode === 'forgot') {
        const res = await api.forgotPassword(email);
        setNotice(res.message);
        if (res.recoveryToken) {
          setLocalRecoveryToken(res.recoveryToken);
          setResetToken(res.recoveryToken);
        }
        setMode('reset');
      } else if (mode === 'reset') {
        const res = await api.resetPassword({ token: resetToken, newPassword });
        setNotice(res.message);
        setLocalRecoveryToken(null);
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.pleaseWait'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f3] text-stone-900">
      <header className="border-b border-stone-200/80 px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="font-display text-2xl font-semibold tracking-tight text-stone-900">MEMENTO</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs tracking-widest uppercase text-stone-500 md:inline">
              {t('auth.privateArchive')}
            </span>
            <div className="inline-flex items-center border border-stone-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`min-h-[32px] cursor-pointer px-2 text-[11px] font-medium ${
                  lang === 'en' ? 'bg-stone-900 text-white' : 'text-stone-600'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ru')}
                className={`min-h-[32px] cursor-pointer px-2 text-[11px] font-medium ${
                  lang === 'ru' ? 'bg-stone-900 text-white' : 'text-stone-600'
                }`}
              >
                RU
              </button>
            </div>
            <button
              type="button"
              onClick={onEnterDemoMode}
              className="min-h-[38px] cursor-pointer border border-stone-300 bg-white px-3.5 text-xs font-medium text-stone-800 hover:border-stone-900"
            >
              {t('auth.tryDemo')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:py-14">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-stretch">
          {/* Editorial Story & Interactive Demo Showcase */}
          <section className="flex flex-col justify-between space-y-10 lg:col-span-7">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{t('auth.eyebrow')}</p>
              <h1 className="font-display headline-balance text-4xl font-medium leading-[1.08] text-stone-900 sm:text-5xl lg:text-6xl">
                {t('auth.tagline')}
              </h1>
              <p className="font-serif-prose max-w-xl text-lg leading-relaxed text-stone-700">
                {t('auth.intro')}
              </p>

              {/* Full Interactive Demo Mode Entry */}
              <div className="border border-stone-300 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-md space-y-1">
                    <p className="font-display text-xl font-medium text-stone-900">
                      {t('auth.demoCardTitle')}
                    </p>
                    <p className="text-xs leading-relaxed text-stone-600">{t('auth.demoCardDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onEnterDemoMode}
                    className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-stone-900 bg-[#faf8f3] px-4 text-xs font-medium text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                  >
                    <Compass className="h-4 w-4" />
                    <span>{t('auth.enterDemo')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Showcase Preset Strip */}
            <div className="space-y-4 border-t border-stone-200 pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-medium text-stone-900">
                    {t('auth.showcaseTitle')}
                  </h2>
                  <p className="text-xs text-stone-500">{t('auth.showcaseSub')}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {DEMO_MEMORIES.map((rawDemo) => {
                  const demo = localizeDemoMemory(rawDemo, lang);
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => onOpenDemo(demo)}
                      className="polaroid-card group flex cursor-pointer flex-col p-2.5 pb-4 text-left"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-200">
                        <img
                          src={demo.photos[0].url}
                          alt={demo.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="mt-3 space-y-1 px-1">
                        <p className="text-[11px] uppercase tracking-wider text-stone-500">
                          {t('auth.samplePrefix')} · {demo.memoryDate.slice(0, 4)}
                        </p>
                        <p className="font-display text-lg font-medium text-stone-900 leading-snug">
                          {demo.title}
                        </p>
                        <p className="font-handwriting text-base text-stone-600 line-clamp-1">
                          {demo.design?.designSpec.atmosphereKeywords.join(' · ')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Private Account Access Panel */}
          <section className="lg:col-span-5">
            <div className="border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4">
                <div>
                  <h2 className="font-display text-3xl font-medium text-stone-900">
                    {mode === 'login' && t('auth.welcomeBack')}
                    {mode === 'register' && t('auth.openArchive')}
                    {mode === 'forgot' && t('auth.passwordRecovery')}
                    {mode === 'reset' && t('auth.setNewPassword')}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {mode === 'login' && t('auth.loginSub')}
                    {mode === 'register' && t('auth.registerSub')}
                    {mode === 'forgot' && t('auth.forgotSub')}
                    {mode === 'reset' && t('auth.resetSub')}
                  </p>
                </div>
                <Lock className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
              </div>

              {error && (
                <div role="alert" className="mb-4 border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 space-y-2">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={onEnterDemoMode}
                    className="cursor-pointer font-medium text-red-900 underline underline-offset-4"
                  >
                    {t('auth.continueDemo')}
                  </button>
                </div>
              )}

              {notice && (
                <div className="mb-4 border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-700 space-y-2">
                  <p>{notice}</p>
                  {localRecoveryToken && (
                    <p className="break-all font-mono text-[11px] bg-white p-2 border border-stone-200">
                      Token: {localRecoveryToken}
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="auth-name" className="mb-1.5 block text-xs font-medium text-stone-700">
                      {t('auth.yourName')}
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth.namePlaceholder')}
                      className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                  <div>
                    <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-stone-700">
                      {t('auth.email')}
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                {(mode === 'login' || mode === 'register') && (
                  <div>
                    <label htmlFor="auth-password" className="mb-1.5 block text-xs font-medium text-stone-700">
                      {t('auth.password')}
                    </label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={mode === 'register' ? 8 : 1}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          mode === 'register'
                            ? t('auth.passwordMinPlaceholder')
                            : t('auth.passwordEnterPlaceholder')
                        }
                        className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 pr-11 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center text-stone-500 hover:text-stone-900"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'reset' && (
                  <>
                    <div>
                      <label htmlFor="reset-token" className="mb-1.5 block text-xs font-medium text-stone-700">
                        {t('auth.recoveryToken')}
                      </label>
                      <input
                        id="reset-token"
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 font-mono text-xs text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-stone-700">
                        {t('auth.newPassword')}
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('auth.passwordMinPlaceholder')}
                        className="min-h-[44px] w-full border border-stone-300 bg-[#faf8f3] px-3.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {mode === 'register' && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-stone-600">
                    <input
                      type="checkbox"
                      checked={privacyAgree}
                      onChange={(e) => setPrivacyAgree(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-stone-900"
                    />
                    <span>{t('auth.privacyAgree')}</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 bg-stone-900 px-5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800 disabled:opacity-50"
                >
                  <span>
                    {loading
                      ? t('auth.pleaseWait')
                      : mode === 'login'
                      ? t('auth.signInBtn')
                      : mode === 'register'
                      ? t('auth.createAccountBtn')
                      : mode === 'forgot'
                      ? t('auth.prepareTokenBtn')
                      : t('auth.updatePasswordBtn')}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4 text-xs text-stone-600">
                {mode === 'login' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setMode('register');
                      }}
                      className="cursor-pointer font-medium text-stone-900 underline underline-offset-4"
                    >
                      {t('auth.createAccountLink')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setMode('forgot');
                      }}
                      className="cursor-pointer hover:text-stone-900"
                    >
                      {t('auth.forgotLink')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setMode('login');
                    }}
                    className="cursor-pointer font-medium text-stone-900 underline underline-offset-4"
                  >
                    {t('auth.backToSignIn')}
                  </button>
                )}
              </div>

              <div className="mt-5 flex items-start gap-2.5 border-t border-stone-100 pt-4 text-[11px] leading-relaxed text-stone-500">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                <span>{t('auth.footerNote')}</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
