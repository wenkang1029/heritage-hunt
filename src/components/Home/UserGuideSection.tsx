/**
 * Melaka Heritage Photo Hunt - Home Page User Guide Component
 * Path: src/components/Home/UserGuideSection.tsx
 *
 * Provides a clear, simple, mobile-friendly guide covering both Players and Game Masters.
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

export const UserGuideSection: React.FC = () => {
  const [guideTab, setGuideTab] = useState<'all' | 'player' | 'gm'>('all');

  return (
    <section className="w-full mt-10 text-left">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Scavenger Hunt Quick Guide
            </h2>
            <p className="text-xs text-slate-400">
              Simple walkthrough for participants and game organizers.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setGuideTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              guideTab === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Guides
          </button>
          <button
            type="button"
            onClick={() => setGuideTab('player')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              guideTab === 'player'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Player Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setGuideTab('gm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              guideTab === 'gm'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>GM Guide</span>
          </button>
        </div>
      </div>

      {/* Guide Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================================= */}
        {/* PLAYER GUIDE */}
        {/* ========================================================================= */}
        {(guideTab === 'all' || guideTab === 'player') && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <Smartphone className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white">Player & Team Guide</h3>
                    <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider">
                      For Participants On The Street
                    </span>
                  </div>
                </div>
                <span className="text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2.5 py-1 rounded-full font-bold">
                  4 Easy Steps
                </span>
              </div>

              {/* Steps List */}
              <div className="space-y-4 my-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30 gap-0.5">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5 flex items-center gap-1.5">
                      <span>1. Join Your Team</span>
                    </h4>
                    <p className="text-slate-400 leading-relaxed">
                      Tap <strong className="text-rose-400">Enter Player Hunt</strong> or scan your team's QR code. Enter your team's <strong className="text-amber-300">4-digit PIN</strong> and your nickname. Your session is saved automatically so refreshing won't log you out!
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">2. Explore Map & Landmarks</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Use the permanently locked bottom bar to switch between <strong className="text-white">Hunt Map</strong> and <strong className="text-white">Clues</strong>. Tap on any clue card or landmark pin to view points, hints, and tap the image for a full uncropped view.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">3. Snap & Submit Team Selfie</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Walk to the historic site. Tap <strong className="text-rose-400">Tap to Snap Selfie</strong> to open your camera. Take a group selfie in front of the landmark and submit it for instant GM verification.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                    <Trophy className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">4. Score Points & Climb Leaderboard</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Verified submissions award full clue points (+bonus points for great poses!). Track your rank and progress on the live <strong className="text-white">Leaderboard</strong> tab.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="mt-4 p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl text-[11px] text-rose-300 flex items-center gap-2">
              <Compass className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                <strong>Player Tip:</strong> Keep GPS enabled on your phone so your team's live position appears on the historic map!
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* GAME MASTER (GM) GUIDE */}
        {/* ========================================================================= */}
        {(guideTab === 'all' || guideTab === 'gm') && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Shield className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white">Game Master Guide</h3>
                    <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                      For Event Organizers
                    </span>
                  </div>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold">
                  GM War Room
                </span>
              </div>

              {/* Steps List */}
              <div className="space-y-4 my-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">1. Log In & Start Hunt</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Click <strong className="text-amber-400">Game Master Login</strong> using passcode <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">melaka2026</code>. Create a new game with 2 to 10 teams or use the active game, then click <strong className="text-emerald-400">Start Game</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">2. Share Team Links & QR Codes</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Head to the <strong className="text-white">Teams</strong> tab. Copy the universal game link or have teams scan their custom QR codes with assigned 4-digit PINs. Live presence indicators show who is online vs offline in real-time.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">3. Live Radar & Visual Zone Plotting</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Monitor all team positions on the <strong className="text-white">Live Radar</strong>. In the <strong className="text-white">Zones</strong> tab, click <strong className="text-white">Plot on Map</strong> to click points directly on the Leaflet map to visually draw and reshape heritage boundaries.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-white text-sm mb-0.5">4. 1-Click Verification & Game Controls</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Review incoming selfies in real time with <strong className="text-emerald-400">Approve</strong>, <strong className="text-amber-400">+Bonus</strong>, or <strong className="text-rose-400">Reject</strong>. Use <strong className="text-cyan-400">Freeze Leaderboard</strong> for the final minutes, and stop the game once players finish.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="mt-4 p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>GM Tip:</strong> If participants close their browser tabs, the system automatically detects them as offline so you can safely stop the game.
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
            <p className="text-slate-200 font-bold">Heritage Zone Etiquette & Safety</p>
            <p className="text-[11px] text-slate-400">
              Please respect historic buildings, watch out for street traffic, and stay hydrated while exploring UNESCO Melaka.
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
