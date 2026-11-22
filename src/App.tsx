/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useState } from 'react';
import { AuthView } from './components/AuthView';
import { AutoImportBanner } from './components/AutoImportBanner';
import { GalleryOnboarding } from './components/GalleryOnboarding';
import { TopNav } from './components/TopNav';
import { api, setUnauthorizedHandler } from './lib/api';
import { AutoImportProvider } from './lib/autoImportManager';
import { localizeDemoMemory } from './lib/demoMemories';
import {
  computeDemoOnThisDay,
  loadDemoWorkspace,
  resetDemoWorkspace,
  saveDemoWorkspace,
} from './lib/demoWorkspace';
import { useI18n } from './lib/i18n';
import type { AppLanguage, AppRoute, MemoryRecord, OnThisDayEntry, UserProfile } from './lib/types';
import { ArchivePage } from './pages/ArchivePage';
import { AutoYearPage } from './pages/AutoYearPage';
import { CalendarPage } from './pages/CalendarPage';
import { CreateMemoryPage } from './pages/CreateMemoryPage';
import { DayMemoriesPage } from './pages/DayMemoriesPage';
import { HomePage } from './pages/HomePage';
import { MemoryDetailPage } from './pages/MemoryDetailPage';
import { OnThisDayPage } from './pages/OnThisDayPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

const ROUTE_STORAGE_KEY = 'memento_active_route_v1';
const MEMORY_ID_STORAGE_KEY = 'memento_selected_memory_v1';
const DAY_ISO_STORAGE_KEY = 'memento_selected_day_v1';
const DEMO_MODE_FLAG_KEY = 'memento_demo_mode_v1';

const VALID_ROUTES = new Set<AppRoute>([
  'home',
  'calendar',
  'day',
  'create',
  'auto-year',
  'archive',
  'on-this-day',
  'profile',
  'settings',
  'memory',
]);

function readInitialRoute(): AppRoute {
  try {
    const raw = sessionStorage.getItem(ROUTE_STORAGE_KEY) as AppRoute | null;
    if (raw && VALID_ROUTES.has(raw)) return raw;
  } catch {
    // Ignore storage errors
  }
  return 'home';
}

function readInitialDayIso(): string {
  try {
    const raw = sessionStorage.getItem(DAY_ISO_STORAGE_KEY);
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    // Ignore storage errors
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [route, setRoute] = useState<AppRoute>(readInitialRoute);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [onThisDay, setOnThisDay] = useState<OnThisDayEntry[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryRecord | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string>(readInitialDayIso);
  const [returnRouteAfterMemory, setReturnRouteAfterMemory] = useState<AppRoute>('home');
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const [createInitialDate, setCreateInitialDate] = useState<string | undefined>(undefined);
  const [demoPreview, setDemoPreview] = useState<MemoryRecord | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const persistViewState = useCallback(
    (nextRoute: AppRoute, memId?: string | null, dayIso?: string | null) => {
      try {
        sessionStorage.setItem(ROUTE_STORAGE_KEY, nextRoute);
        if (memId) sessionStorage.setItem(MEMORY_ID_STORAGE_KEY, memId);
        else if (nextRoute !== 'memory') sessionStorage.removeItem(MEMORY_ID_STORAGE_KEY);
        if (dayIso) sessionStorage.setItem(DAY_ISO_STORAGE_KEY, dayIso);
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  const navigate = useCallback(
    (nextRoute: AppRoute, mem?: MemoryRecord | null) => {
      setRoute((prevRoute) => {
        if (nextRoute === 'memory' && prevRoute !== 'memory') {
          setReturnRouteAfterMemory(prevRoute);
        }
        return nextRoute;
      });
      if (mem) {
        setSelectedMemory(mem);
        persistViewState(nextRoute, mem.id);
      } else {
        persistViewState(nextRoute, null);
      }
    },
    [persistViewState]
  );

  const openDayView = useCallback(
    (isoDate: string) => {
      const clean = isoDate.slice(0, 10);
      setSelectedDayIso(clean);
      setMemoryNotice(null);
      setRoute('day');
      persistViewState('day', null, clean);
    },
    [persistViewState]
  );

  const handleLanguageChange = useCallback(
    (nextLang: AppLanguage) => {
      setLang(nextLang);
      if (!user) return;
      const updatedUser: UserProfile = {
        ...user,
        preferences: {
          ...user.preferences,
          uiLanguage: nextLang,
        },
      };
      setUser(updatedUser);
      if (!user.isDemoAccount) {
        api.updateProfile({ preferences: { uiLanguage: nextLang } }).catch(() => {});
      }
    },
    [setLang, user]
  );

  const handleCompleteOnboarding = useCallback(
    (connected: boolean) => {
      setShowOnboardingModal(false);
      if (!user) return;
      const updated: UserProfile = {
        ...user,
        preferences: {
          ...user.preferences,
          onboardingCompleted: true,
          galleryConnected: connected || Boolean(user.preferences?.galleryConnected),
        },
      };
      setUser(updated);
      if (!user.isDemoAccount) {
        api
          .updateProfile({
            preferences: {
              onboardingCompleted: true,
              galleryConnected: connected || Boolean(user.preferences?.galleryConnected),
            },
          })
          .catch(() => {});
      }
    },
    [user]
  );

  const enterLocalDemoMode = useCallback(
    (preserveRoute = false) => {
      try {
        sessionStorage.setItem(DEMO_MODE_FLAG_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      const ws = loadDemoWorkspace();
      setUser(ws.user);
      setMemories(ws.memories);
      setOnThisDay(computeDemoOnThisDay(ws.memories));
      setDemoPreview(null);
      setAuthNotice(null);

      if (preserveRoute) {
        const savedRoute = readInitialRoute();
        let savedMem: MemoryRecord | null = null;
        try {
          const savedId = sessionStorage.getItem(MEMORY_ID_STORAGE_KEY);
          if (savedId) savedMem = ws.memories.find((m) => m.id === savedId) || null;
        } catch {
          // Ignore
        }
        if (savedRoute === 'memory' && savedMem) {
          setSelectedMemory(savedMem);
          setRoute('memory');
        } else if (savedRoute === 'memory') {
          setRoute('home');
        } else {
          setRoute(savedRoute);
        }
      } else {
        navigate('home');
      }
    },
    [navigate]
  );

  const loadUserWorkspace = useCallback(async (restoreSavedSelection = false) => {
    const [memRes, otdRes] = await Promise.all([api.listMemories(), api.onThisDay()]);
    setMemories(memRes.memories);
    setOnThisDay(otdRes.memories);

    if (restoreSavedSelection) {
      const savedRoute = readInitialRoute();
      let savedMem: MemoryRecord | null = null;
      try {
        const savedId = sessionStorage.getItem(MEMORY_ID_STORAGE_KEY);
        if (savedId) savedMem = memRes.memories.find((m) => m.id === savedId) || null;
      } catch {
        // Ignore
      }
      if (savedRoute === 'memory' && savedMem) {
        setSelectedMemory(savedMem);
        setRoute('memory');
      } else if (savedRoute === 'memory') {
        setRoute('home');
      } else {
        setRoute(savedRoute);
      }
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((prev) => {
        if (!prev || prev.isDemoAccount) return prev;
        setAuthNotice('Your session expired. Sign in again to open your private archive, or continue in Local Demo Mode.');
        setMemories([]);
        setOnThisDay([]);
        setSelectedMemory(null);
        return null;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    const checkInitialSession = async () => {
      try {
        const res = await api.me();
        if (!active) return;
        if (res.user) {
          try {
            sessionStorage.removeItem(DEMO_MODE_FLAG_KEY);
          } catch {
            // Ignore
          }
          setUser(res.user);
          if (
            (res.user.preferences?.uiLanguage === 'ru' || res.user.preferences?.uiLanguage === 'en') &&
            !localStorage.getItem('memento_ui_language_v1')
          ) {
            setLang(res.user.preferences.uiLanguage);
          }
          await loadUserWorkspace(true);
          return;
        }
      } catch {
        // Fall through cleanly if backend auth cannot verify session
      }

      if (!active) return;
      try {
        if (sessionStorage.getItem(DEMO_MODE_FLAG_KEY) === '1') {
          enterLocalDemoMode(true);
          return;
        }
      } catch {
        // Ignore
      }
    };

    checkInitialSession().finally(() => {
      if (active) setAuthChecked(true);
    });

    return () => {
      active = false;
    };
  }, [enterLocalDemoMode, loadUserWorkspace, setLang]);

  useEffect(() => {
    if (user?.isDemoAccount) {
      saveDemoWorkspace({ user, memories });
      setOnThisDay(computeDemoOnThisDay(memories));
    }
  }, [user, memories]);

  const handleAuthenticated = async (loggedUser: UserProfile) => {
    try {
      sessionStorage.removeItem(DEMO_MODE_FLAG_KEY);
    } catch {
      // Ignore
    }
    setUser(loggedUser);
    setDemoPreview(null);
    setAuthNotice(null);
    if (
      (loggedUser.preferences?.uiLanguage === 'ru' || loggedUser.preferences?.uiLanguage === 'en') &&
      !localStorage.getItem('memento_ui_language_v1')
    ) {
      setLang(loggedUser.preferences.uiLanguage);
    }
    await loadUserWorkspace(false);
    navigate('home');
  };

  const handleLogout = async () => {
    const wasDemo = Boolean(user?.isDemoAccount);
    try {
      sessionStorage.removeItem(DEMO_MODE_FLAG_KEY);
      sessionStorage.removeItem(MEMORY_ID_STORAGE_KEY);
    } catch {
      // Ignore
    }
    if (!wasDemo) {
      await api.logout().catch(() => {});
    }
    setUser(null);
    setMemories([]);
    setOnThisDay([]);
    setSelectedMemory(null);
    setDemoPreview(null);
    setAuthNotice(null);
    setShowOnboardingModal(false);
    navigate('home');
  };

  const handleResetDemo = () => {
    const fresh = resetDemoWorkspace();
    setUser(fresh.user);
    setMemories(fresh.memories);
    setOnThisDay(computeDemoOnThisDay(fresh.memories));
    setSelectedMemory(null);
  };

  const handleBackgroundMemorySaved = useCallback(
    (mem: MemoryRecord) => {
      setMemories((prev) => {
        if (prev.some((m) => m.id === mem.id)) return prev;
        return [mem, ...prev];
      });
      if (user && !user.isDemoAccount) {
        api.onThisDay().then((r) => setOnThisDay(r.memories)).catch(() => {});
      }
    },
    [user]
  );

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f3] text-stone-600">
        <p className="font-display text-2xl">{t('app.opening')}</p>
      </div>
    );
  }

  if (!user && demoPreview) {
    const localizedPreview = demoPreview.isPresetDemo ? localizeDemoMemory(demoPreview, lang) : demoPreview;
    return (
      <div className="min-h-screen bg-[#faf8f3]">
        <header className="border-b border-stone-200 bg-[#faf8f3] px-4 py-3.5 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setDemoPreview(null)}
              className="font-display cursor-pointer text-2xl font-semibold text-stone-900"
            >
              MEMENTO
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex border border-stone-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`min-h-[34px] cursor-pointer px-2.5 text-[11px] font-medium ${
                    lang === 'en' ? 'bg-stone-900 text-white' : 'text-stone-600'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ru')}
                  className={`min-h-[34px] cursor-pointer px-2.5 text-[11px] font-medium ${
                    lang === 'ru' ? 'bg-stone-900 text-white' : 'text-stone-600'
                  }`}
                >
                  RU
                </button>
              </div>
              <button
                type="button"
                onClick={() => enterLocalDemoMode(false)}
                className="min-h-[40px] cursor-pointer border border-stone-300 bg-white px-4 text-xs font-medium text-stone-800 hover:border-stone-900"
              >
                {t('demo.enterInteractive')}
              </button>
              <button
                type="button"
                onClick={() => setDemoPreview(null)}
                className="min-h-[40px] cursor-pointer bg-stone-900 px-4 text-xs font-medium text-white"
              >
                {t('demo.signInReal')}
              </button>
            </div>
          </div>
        </header>
        <MemoryDetailPage
          memory={localizedPreview}
          onBack={() => setDemoPreview(null)}
          onUpdated={() => {}}
          onDeleted={() => {}}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView
        initialNotice={authNotice}
        onAuthenticated={handleAuthenticated}
        onEnterDemoMode={() => enterLocalDemoMode(false)}
        onOpenDemo={(demo) => setDemoPreview({ ...demo, isPresetDemo: true })}
      />
    );
  }

  const isDemoMode = Boolean(user.isDemoAccount);
  const shouldShowOnboarding =
    showOnboardingModal || user.preferences?.onboardingCompleted === false;

  return (
    <AutoImportProvider
      user={user}
      defaultLanguage={lang}
      onMemorySaved={handleBackgroundMemorySaved}
      onUserPreferencesSynced={setUser}
    >
      <div className="min-h-screen bg-[#faf8f3] text-stone-900">
        <TopNav
          currentRoute={route}
          onLanguageChange={handleLanguageChange}
          onNavigate={(next) => {
            setMemoryNotice(null);
            if (next === 'create') setCreateInitialDate(undefined);
            navigate(next);
          }}
        />

        <AutoImportBanner onOpenOrganizer={() => navigate('auto-year')} />

        {isDemoMode && (
          <div className="border-b border-stone-200 bg-stone-100/90 px-4 py-2 text-xs text-stone-700 sm:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="font-medium text-stone-900">{t('demo.bannerLead')}</strong>{' '}
                {t('demo.bannerBody')}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer font-medium text-stone-900 underline underline-offset-4 hover:opacity-75"
              >
                {t('demo.bannerAction')}
              </button>
            </div>
          </div>
        )}

        {shouldShowOnboarding && (
          <GalleryOnboarding
            onStartAutoImportFinished={() => {
              handleCompleteOnboarding(true);
              navigate('auto-year');
            }}
            onSkip={() => handleCompleteOnboarding(false)}
          />
        )}

        {route === 'home' && (
          <HomePage
            user={user}
            memories={memories}
            onThisDay={onThisDay}
            onOpenMemory={(mem) => {
              setMemoryNotice(null);
              navigate('memory', mem);
            }}
            onOpenDay={openDayView}
            onOpenCalendar={() => navigate('calendar')}
            onOpenArchive={() => navigate('archive')}
            onCreateManual={() => {
              setCreateInitialDate(undefined);
              navigate('create');
            }}
            onAutoImport={() => navigate('auto-year')}
            onOpenOnboarding={() => setShowOnboardingModal(true)}
          />
        )}

        {route === 'calendar' && (
          <CalendarPage
            user={user}
            memories={memories}
            onThisDay={onThisDay}
            onOpenDay={openDayView}
            onCreateForDate={(isoDate) => {
              setCreateInitialDate(isoDate);
              navigate('create');
            }}
            onCreateFromYear={() => navigate('auto-year')}
            onOpenOnThisDay={() => navigate('on-this-day')}
            onUserUpdated={setUser}
          />
        )}

        {route === 'day' && (
          <DayMemoriesPage
            isoDate={selectedDayIso}
            user={user}
            memories={memories}
            onBackToCalendar={() => navigate('calendar')}
            onOpenMemory={(mem) => {
              setMemoryNotice(null);
              navigate('memory', mem);
            }}
            onCreateForDate={(isoDate) => {
              setCreateInitialDate(isoDate);
              navigate('create');
            }}
            onAutoImport={() => navigate('auto-year')}
            onMemoryUpdated={(updated) => {
              setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }}
            onMemoryDeleted={(id) => {
              setMemories((prev) => prev.filter((m) => m.id !== id));
              if (!isDemoMode) {
                api.onThisDay().then((r) => setOnThisDay(r.memories)).catch(() => {});
              }
            }}
          />
        )}

        {route === 'create' && (
          <CreateMemoryPage
            user={user}
            initialDate={createInitialDate}
            onSwitchToAutoYear={() => navigate('auto-year')}
            onMemoryCreated={(mem, notice) => {
              setMemories((prev) => [mem, ...prev]);
              setMemoryNotice(notice || null);
              navigate('memory', mem);
              if (!isDemoMode) {
                api.onThisDay().then((r) => setOnThisDay(r.memories)).catch(() => {});
              }
            }}
            onCancel={() => navigate(createInitialDate ? 'day' : 'home')}
          />
        )}

        {route === 'auto-year' && (
          <AutoYearPage
            user={user}
            memories={memories}
            onSwitchToManual={() => navigate('create')}
            onOpenMemory={(mem) => {
              setMemoryNotice(null);
              navigate('memory', mem);
            }}
            onOpenDay={openDayView}
            onBrowseInBackground={() => navigate('calendar')}
            onCancel={() => navigate('home')}
          />
        )}

        {route === 'archive' && (
          <ArchivePage
            memories={memories}
            isDemoMode={isDemoMode}
            onOpenMemory={(mem) => {
              setMemoryNotice(null);
              navigate('memory', mem);
            }}
            onCreateNew={() => {
              setCreateInitialDate(undefined);
              navigate('create');
            }}
            onCreateFromYear={() => navigate('auto-year')}
          />
        )}

        {route === 'on-this-day' && (
          <OnThisDayPage
            memories={memories}
            isDemoMode={isDemoMode}
            onOpenMemory={(mem) => {
              setMemoryNotice(null);
              navigate('memory', mem);
            }}
            onCreateMemory={() => {
              setCreateInitialDate(undefined);
              navigate('create');
            }}
          />
        )}

        {route === 'profile' && (
          <ProfilePage
            user={user}
            memoryCount={memories.length}
            onUserUpdated={setUser}
          />
        )}

        {route === 'settings' && (
          <SettingsPage
            user={user}
            memories={memories}
            onUserUpdated={setUser}
            onLanguageChange={handleLanguageChange}
            onOpenAutoImport={() => navigate('auto-year')}
            onAutomaticMemoriesDisconnected={() => {
              setMemories((prev) => prev.filter((m) => m.origin !== 'automatic'));
              if (!isDemoMode) {
                api.onThisDay().then((r) => setOnThisDay(r.memories)).catch(() => {});
              }
            }}
            onResetDemo={handleResetDemo}
            onLogout={handleLogout}
          />
        )}

        {route === 'memory' && selectedMemory && (
          <MemoryDetailPage
            memory={selectedMemory.isPresetDemo ? localizeDemoMemory(selectedMemory, lang) : selectedMemory}
            userPreferences={user.preferences}
            sameDayMemories={
              selectedMemory.isPresetDemo
                ? []
                : memories.filter(
                    (m) => m.memoryDate.slice(0, 10) === selectedMemory.memoryDate.slice(0, 10)
                  )
            }
            onSelectMemory={(mem) => {
              setMemoryNotice(null);
              navigate('memory', mem);
            }}
            initialNotice={memoryNotice}
            onBack={() =>
              navigate(
                selectedMemory.isPresetDemo && !isDemoMode
                  ? 'archive'
                  : returnRouteAfterMemory === 'day'
                  ? 'day'
                  : returnRouteAfterMemory === 'archive'
                  ? 'archive'
                  : returnRouteAfterMemory === 'home'
                  ? 'home'
                  : 'calendar'
              )
            }
            onUpdated={(updated) => {
              setSelectedMemory(updated);
              if (!updated.isPresetDemo) {
                setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
              }
            }}
            onDeleted={(id) => {
              setMemories((prev) => prev.filter((m) => m.id !== id));
              setSelectedMemory(null);
              navigate(returnRouteAfterMemory === 'day' ? 'day' : 'archive');
              if (!isDemoMode) {
                api.onThisDay().then((r) => setOnThisDay(r.memories)).catch(() => {});
              }
            }}
          />
        )}
      </div>
    </AutoImportProvider>
  );
}
