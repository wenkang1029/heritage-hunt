/**
 * Melaka Heritage Hunt - Interactive Onboarding Tour Guide
 * Path: src/components/Common/InteractiveTour.tsx
 *
 * Provides a step-by-step interactive walkthrough for new Game Masters and Players,
 * introducing each button and feature, seamlessly leading users through the tabs,
 * with skip and re-trigger capabilities.
 */

import React, { useEffect } from 'react';
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tabKey?: string;
  badge?: string;
  tips?: string;
}

export interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  tourName: string; // e.g. "Game Master War Room" or "Player Explorer"
  steps: TourStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onTabChange?: (tabKey: any) => void;
  storageKey?: string;
}

export const InteractiveTour: React.FC<InteractiveTourProps> = ({
  isOpen,
  onClose,
  tourName,
  steps,
  currentStepIndex,
  onStepChange,
  onTabChange,
  storageKey,
}) => {
  const { t } = useLanguage();

  // Automatically switch tab when current step changes
  useEffect(() => {
    if (!isOpen) return;
    const currentStep = steps[currentStepIndex];
    if (currentStep?.tabKey && onTabChange) {
      onTabChange(currentStep.tabKey);
    }
  }, [isOpen, currentStepIndex, steps, onTabChange]);

  // Handle keyboard arrow navigation & Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex] || steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      const nextIdx = currentStepIndex + 1;
      onStepChange(nextIdx);
      if (steps[nextIdx]?.tabKey && onTabChange) {
        onTabChange(steps[nextIdx].tabKey);
      }
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      const prevIdx = currentStepIndex - 1;
      onStepChange(prevIdx);
      if (steps[prevIdx]?.tabKey && onTabChange) {
        onTabChange(steps[prevIdx].tabKey);
      }
    }
  };

  const handleSkip = () => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    onClose();
  };

  const handleComplete = () => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px] z-[95] animate-in fade-in slide-in-from-bottom-6 duration-300 pointer-events-auto"
      role="dialog"
      aria-modal="false"
      aria-label={`${tourName} Tour`}
    >
      <div className="bg-slate-900/95 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl ring-4 ring-amber-500/10 text-left max-h-[85dvh] overflow-y-auto">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
              {tourName}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {t('common.tourStepOf', { current: currentStepIndex + 1, total: steps.length })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer font-bold flex items-center gap-1"
            title={t('common.tourSkip')}
          >
            <span>{t('common.tourSkip')}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Icon & Title */}
        <div className="flex items-start gap-3 my-3">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 shrink-0 shadow-inner">
            {currentStep.icon}
          </div>
          <div>
            <h4 className="text-base font-black text-white leading-tight">
              {currentStep.title}
            </h4>
            {currentStep.badge && (
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                {currentStep.badge}
              </span>
            )}
          </div>
        </div>

        {/* Step Description */}
        <p className="text-xs text-slate-300 leading-relaxed my-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          {currentStep.description}
        </p>

        {/* Pro Tip Box if available */}
        {currentStep.tips && (
          <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong>{t('common.tourTip')}</strong> {currentStep.tips}
            </span>
          </div>
        )}

        {/* Footer: Progress Dots & Buttons */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
          {/* Step Progress Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onStepChange(idx);
                  if (steps[idx]?.tabKey && onTabChange) {
                    onTabChange(steps[idx].tabKey);
                  }
                }}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-5 bg-amber-400 shadow-sm'
                    : 'w-2 bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t('common.tourBack')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                isLastStep
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
              }`}
            >
              <span>{isLastStep ? t('common.tourFinish') : t('common.tourNext')}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
