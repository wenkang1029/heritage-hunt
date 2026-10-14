/**
 * Melaka Heritage Hunt - Join Team Modal
 * Path: src/components/Player/JoinTeamModal.tsx
 *
 * Frictionless player onboarding via 4-digit PIN and nickname.
 */

import React, { useState, useEffect } from 'react';
import type { Team } from '../../types/index.ts';
import { Users, Shield, ArrowRight, Sparkles } from 'lucide-react';

export interface JoinTeamModalProps {
  teams: Team[];
  onJoin: (pin: string, nickname: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const JoinTeamModal: React.FC<JoinTeamModalProps> = ({
  teams,
  onJoin,
  isLoading,
  error,
}) => {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');

  // Check URL query parameters for ?pin=XXXX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      if (urlPin) {
        setPin(urlPin);
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) return;
    onJoin(pin.trim(), nickname.trim());
  };

  const handleQuickSelectTeam = (t: Team) => {
    setPin(t.pin);
    if (!nickname) {
      setNickname(`Hunter_${Math.floor(Math.random() * 900) + 100}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Melaka Heritage Header Pattern */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600" />

        <div className="text-center mb-6 pt-2">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-3">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Melaka Heritage Hunt
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Join your team to start the historical photo hunt!
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              4-Digit Team PIN
            </label>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="e.g. 4821"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-amber-400 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Your Nickname / Player Name
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Wei Kang, Sarah"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !pin.trim() || !nickname.trim()}
            className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Joining Team...
              </span>
            ) : (
              <>
                <span>Enter Scavenger Hunt</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Team selector (available teams in game) */}
        {teams.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Or click an active team to auto-fill PIN:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleQuickSelectTeam(t)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs transition-colors cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: t.color }}
                  />
                  <span className="truncate font-semibold text-slate-200">
                    {t.name}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-amber-400">
                    #{t.pin}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
