/**
 * Melaka Heritage Photo Hunt - Home Page User Guide Component
 * Path: src/components/Home/UserGuideSection.tsx
 *
 * Provides a clear, centered, mobile-friendly guide covering Players and Game Masters.
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Shield,
  MapPin,
  Camera,
  Trophy,
  CheckCircle2,
  QrCode,
  Radio,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  Clock,
  Compass,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';

export const UserGuideSection: React.FC = () => {
  const [guideTab, setGuideTab] = useState<'player' | 'gm'>('player');
  const { t, language } = useLanguage();

  return (
    <section className="w-full mt-10 max-w-2xl mx-auto text-left">
      {/* Section Header - Centered */}
      <div className="flex flex-col items-center text-center gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {t('guide.title')}
          </h2>
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          {t('guide.subtitle')}
        </p>

        {/* Filter Tabs - Centered Toggle between Player and GM */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 mt-1 shadow-lg">
          <button
            type="button"
            onClick={() => setGuideTab('player')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              guideTab === 'player'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{t('guide.playerTab')}</span>
          </button>
          <button
            type="button"
            onClick={() => setGuideTab('gm')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              guideTab === 'gm'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{t('guide.gmTab')}</span>
          </button>
        </div>
      </div>

      {/* Guide Content - Centered Card */}
      <div className="w-full">
        {/* ========================================================================= */}
        {/* PLAYER GUIDE */}
        {/* ========================================================================= */}
        {guideTab === 'player' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col justify-between">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <Smartphone className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white">{t('guide.playerTab')}</h3>
                    <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider">
                      {t('guide.playerBadge')}
                    </span>
                  </div>
                </div>
                <span className="text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2.5 py-1 rounded-full font-bold">
                  {t('guide.playerStepsCount')}
                </span>
              </div>

              {/* Steps List */}
              <div className="space-y-3.5 my-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.step1Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.step1Desc')}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.step2Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.step2Desc')}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.step3Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.step3Desc')}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.step4Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.step4Desc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="mt-2 p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
              <Compass className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                <strong>{t('guide.playerTips')}:</strong> {t('guide.tip1')}
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* GAME MASTER (GM) GUIDE */}
        {/* ========================================================================= */}
        {guideTab === 'gm' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col justify-between">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Shield className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white">{t('guide.gmTab')}</h3>
                    <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                      {t('guide.gmBadge')}
                    </span>
                  </div>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold">
                  {t('guide.gmStepsCount')}
                </span>
              </div>

              {/* Steps List */}
              <div className="space-y-3.5 my-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.gmStep1Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.gmStep1Desc')}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.gmStep2Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.gmStep2Desc')}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.gmStep3Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.gmStep3Desc')}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">{t('guide.gmStep4Title')}</h4>
                    <p className="text-slate-400 leading-relaxed">
                      {t('guide.gmStep4Desc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="mt-2 p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>GM Tip:</strong> {language === 'zh' ? '参赛队员关闭浏览器后，系统会自动检测其为离线，以便您可以安全无阻地结束游戏。' : 'If participants close their browser tabs, the system automatically detects them as offline so you can safely stop the game.'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Safety & Heritage Etiquette Notice */}
      <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-slate-800 text-slate-300 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </span>
          <div>
            <p className="text-slate-200 font-bold">{language === 'zh' ? '古迹保护与户外安全倡议' : 'Heritage Zone Etiquette & Safety'}</p>
            <p className="text-[11px] text-slate-400">
              {language === 'zh' ? '请爱护世界文化遗产历史建筑，过马路注意道路交通，并在马六甲炎热天气中及时补充水分。' : 'Please respect historic buildings, watch out for street traffic, and stay hydrated while exploring UNESCO Melaka.'}
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-500 shrink-0">
          Melaka World Heritage Site
        </div>
      </div>
    </section>
  );
};
