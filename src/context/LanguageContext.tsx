/**
 * Melaka Heritage Hunt - Internationalization (i18n) Language Context
 * Path: src/context/LanguageContext.tsx
 *
 * Provides persistent language state (EN / 中文), reactive translations,
 * and a safe, confirmation-guarded Language Switch Modal that prevents accidental taps.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { translations, type Language } from '../i18n/translations.ts';
import { Globe, Check, X, ShieldAlert } from 'lucide-react';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  isSwitchModalOpen: boolean;
  openSwitchModal: () => void;
  closeSwitchModal: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LS_LANG_KEY = 'HERITAGE_HUNT_LANG';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LS_LANG_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
      // Auto-detect browser language if Chinese
      if (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('zh')) {
        return 'zh';
      }
    } catch {
      // Ignore storage errors
    }
    return 'en';
  });

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState<boolean>(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState<boolean>(false);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LS_LANG_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const openSwitchModal = useCallback(() => {
    setPendingLanguage(language);
    setShowConfirmPrompt(false);
    setIsSwitchModalOpen(true);
  }, [language]);

  const closeSwitchModal = useCallback(() => {
    setIsSwitchModalOpen(false);
    setPendingLanguage(null);
    setShowConfirmPrompt(false);
  }, []);

  // Nested translation lookup with parameter interpolation: {points}, {count}, etc.
  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let result: any = translations[language];

      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = result[k];
        } else {
          // Fallback to English dictionary
          let fallback: any = translations['en'];
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = fallback[fbKey];
            } else {
              return path;
            }
          }
          result = fallback;
          break;
        }
      }

      if (typeof result !== 'string') {
        return path;
      }

      // Replace template params e.g. {count}
      if (params) {
        return Object.entries(params).reduce((str, [key, val]) => {
          return str.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        }, result);
      }

      return result;
    },
    [language]
  );

  const handleSelectLanguage = (lang: Language) => {
    if (lang === language) {
      // Already active, just close
      closeSwitchModal();
      return;
    }
    // Prevent accidental switch: require user to confirm
    setPendingLanguage(lang);
    setShowConfirmPrompt(true);
  };

  const handleConfirmSwitch = () => {
    if (pendingLanguage) {
      setLanguage(pendingLanguage);
    }
    closeSwitchModal();
  };

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isSwitchModalOpen,
      openSwitchModal,
      closeSwitchModal,
    }),
    [language, setLanguage, t, isSwitchModalOpen, openSwitchModal, closeSwitchModal]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}

      {/* Safe Confirmation-Guarded Language Switch Modal */}
      {isSwitchModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={closeSwitchModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closeSwitchModal}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white leading-tight">
                  {t('langModal.title')}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('langModal.subtitle')}
                </p>
              </div>
            </div>

            {!showConfirmPrompt ? (
              /* Step 1: Language Options Selection */
              <div className="space-y-2.5 my-4">
                {/* English Option */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    language === 'en'
                      ? 'bg-amber-500/15 border-amber-500/50 text-white ring-1 ring-amber-500/30'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🇬🇧</span>
                    <div>
                      <span className="font-bold text-sm block text-white">English</span>
                      <span className="text-[11px] text-slate-400">Official English version</span>
                    </div>
                  </div>
                  {language === 'en' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                      <Check className="w-3 h-3" />
                      <span>{t('langModal.activeBadge')}</span>
                    </span>
                  )}
                </button>

                {/* Chinese Option */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('zh')}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    language === 'zh'
                      ? 'bg-amber-500/15 border-amber-500/50 text-white ring-1 ring-amber-500/30'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🇨🇳</span>
                    <div>
                      <span className="font-bold text-sm block text-white">中文 (简体)</span>
                      <span className="text-[11px] text-slate-400">简体中文完整汉化版</span>
                    </div>
                  </div>
                  {language === 'zh' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                      <Check className="w-3 h-3" />
                      <span>{t('langModal.activeBadge')}</span>
                    </span>
                  )}
                </button>
              </div>
            ) : (
              /* Step 2: Intentional Confirmation to avoid accidental switch */
              <div className="my-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    {pendingLanguage === 'zh' ? '确认切换语言？' : 'Confirm Language Switch?'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('langModal.confirmPrompt', {
                    lang: pendingLanguage === 'zh' ? '中文 (简体)' : 'English',
                  })}
                </p>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPrompt(false)}
                    className="w-1/2 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                  >
                    {t('langModal.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSwitch}
                    className="w-1/2 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-lg cursor-pointer transition-colors"
                  >
                    {t('langModal.confirmSwitch')}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
              {t('langModal.savedNotice')}
            </div>
          </div>
        </div>
      )}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
