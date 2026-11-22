import { Menu, Plus, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import type { AppLanguage, AppRoute } from '../lib/types';

interface TopNavProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onLanguageChange?: (next: AppLanguage) => void;
}

export function TopNav({ currentRoute, onNavigate, onLanguageChange }: TopNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  const navItems: Array<{ route: AppRoute; label: string }> = [
    { route: 'home', label: t('nav.home') },
    { route: 'calendar', label: t('nav.calendar') },
    { route: 'archive', label: t('nav.archive') },
    { route: 'on-this-day', label: t('nav.onThisDay') },
    { route: 'profile', label: t('nav.profile') },
  ];

  const go = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  const switchLanguage = (next: AppLanguage) => {
    if (next === lang) return;
    setLang(next);
    onLanguageChange?.(next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/90 bg-[#faf8f3]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => go('home')}
          className="font-display cursor-pointer text-2xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900"
        >
          MEMENTO
        </button>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-5">
          {navItems.map((item) => {
            const active =
              currentRoute === item.route ||
              (item.route === 'calendar' && currentRoute === 'day');
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => go(item.route)}
                className={`cursor-pointer text-sm whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900 ${
                  active
                    ? 'border-stone-900 font-medium text-stone-900'
                    : 'border-transparent text-stone-600 hover:border-stone-400 hover:text-stone-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Language Switcher + Settings Icon + Primary Action + Mobile Drawer */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Interface language"
            className="inline-flex items-center border border-stone-300 bg-white p-0.5"
          >
            <button
              type="button"
              onClick={() => switchLanguage('en')}
              aria-pressed={lang === 'en'}
              className={`min-h-[34px] cursor-pointer px-2.5 text-[11px] font-medium tracking-wider transition-colors whitespace-nowrap ${
                lang === 'en' ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => switchLanguage('ru')}
              aria-pressed={lang === 'ru'}
              className={`min-h-[34px] cursor-pointer px-2.5 text-[11px] font-medium tracking-wider transition-colors whitespace-nowrap ${
                lang === 'ru' ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              RU
            </button>
          </div>

          <button
            type="button"
            onClick={() => go('settings')}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
            className={`hidden sm:inline-flex h-10 w-10 cursor-pointer items-center justify-center border transition-colors ${
              currentRoute === 'settings'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-white text-stone-700 hover:border-stone-900 hover:text-stone-900'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => go('create')}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 bg-stone-900 px-3.5 sm:px-4 py-2 text-xs font-medium tracking-wide text-stone-50 transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('nav.createMemory')}</span>
            <span className="sm:hidden">{lang === 'ru' ? 'Создать' : 'Create'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center border border-stone-300 text-stone-800 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="border-t border-stone-200 bg-[#faf8f3] px-4 py-3 lg:hidden"
        >
          <div className="flex flex-col gap-1">
            {[...navItems, { route: 'settings' as AppRoute, label: t('nav.settings') }].map((item) => {
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => go(item.route)}
                  className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between px-3 text-left text-sm transition-colors ${
                    active ? 'bg-stone-200/70 font-medium text-stone-900' : 'text-stone-700 hover:bg-stone-200/40'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && <span className="text-xs text-stone-500">{t('nav.current')}</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => go('auto-year')}
              className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between px-3 text-left text-sm transition-colors ${
                currentRoute === 'auto-year'
                  ? 'bg-stone-200/70 font-medium text-stone-900'
                  : 'text-stone-700 hover:bg-stone-200/40'
              }`}
            >
              <span>{t('nav.createFromYear')}</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
