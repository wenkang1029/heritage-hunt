/**
 * Melaka Heritage Hunt - Join Team Modal with Seamless OTP PIN Entry
 * Path: src/components/Player/JoinTeamModal.tsx
 *
 * Seamless 4-digit OTP style PIN entry with auto-focus advancing,
 * QR scan auto-fill that directly focuses username input, and instant team matching.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Team } from '../../types/index.ts';
import { Users, Shield, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';

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
  const { t } = useLanguage();
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [nickname, setNickname] = useState('');

  // 4 individual refs for OTP digit boxes
  const digit0Ref = useRef<HTMLInputElement>(null);
  const digit1Ref = useRef<HTMLInputElement>(null);
  const digit2Ref = useRef<HTMLInputElement>(null);
  const digit3Ref = useRef<HTMLInputElement>(null);
  const digitRefs = useMemo(
    () => [digit0Ref, digit1Ref, digit2Ref, digit3Ref],
    [digit0Ref, digit1Ref, digit2Ref, digit3Ref]
  );

  // Ref for nickname input field to auto-focus directly
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const fullPin = useMemo(() => digits.join(''), [digits]);

  // Match active team in real-time
  const matchedTeam = useMemo(() => {
    if (fullPin.length !== 4) return null;
    return teams.find((t) => t.pin === fullPin) || null;
  }, [fullPin, teams]);

  // 1. Detect scanned link with ?pin=XXXX on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get('pin');

    if (urlPin) {
      const cleanDigits = urlPin.replace(/\D/g, '').slice(0, 4).split('');
      while (cleanDigits.length < 4) cleanDigits.push('');
      setDigits(cleanDigits);

      // Requirement: When scanned, fill PIN and straight allow user to input the name
      // without needing to click the input form!
      if (cleanDigits.filter(Boolean).length === 4) {
        setTimeout(() => {
          nicknameInputRef.current?.focus();
        }, 120);
      }
    } else {
      // If no PIN in URL, auto-focus the first OTP digit
      setTimeout(() => {
        digitRefs[0].current?.focus();
      }, 150);
    }
  }, [digitRefs]);

  // Handle single digit input and auto-advance
  const handleDigitChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanNumbers = rawVal.replace(/\D/g, '');

    // Handle fast typing or multi-character paste
    if (cleanNumbers.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < cleanNumbers.length && index + i < 4; i++) {
        newDigits[index + i] = cleanNumbers[i];
      }
      setDigits(newDigits);

      const nextEmptyIdx = newDigits.findIndex((d) => d === '');
      if (nextEmptyIdx !== -1) {
        digitRefs[nextEmptyIdx].current?.focus();
      } else {
        // All 4 digits filled -> straight bring focus to username input!
        setTimeout(() => {
          nicknameInputRef.current?.focus();
        }, 50);
      }
      return;
    }

    const singleDigit = cleanNumbers.slice(-1) || '';
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    if (singleDigit) {
      if (index < 3) {
        // Advance to next OTP box
        digitRefs[index + 1].current?.focus();
      } else {
        // 4th digit entered -> seamlessly focus username/nickname input!
        setTimeout(() => {
          nicknameInputRef.current?.focus();
        }, 50);
      }
    }
  };

  // Handle Backspace navigation across OTP boxes
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        digitRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      digitRefs[index + 1].current?.focus();
    }
  };

  // Handle Paste across OTP boxes
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pastedData) return;

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);

    if (pastedData.length === 4) {
      // 4 digits filled via paste -> straight bring focus to username input!
      setTimeout(() => {
        nicknameInputRef.current?.focus();
      }, 50);
    } else {
      digitRefs[pastedData.length]?.current?.focus();
    }
  };

  // Quick select an active team
  const handleQuickSelectTeam = (t: Team) => {
    const cleanDigits = t.pin.replace(/\D/g, '').slice(0, 4).split('');
    while (cleanDigits.length < 4) cleanDigits.push('');
    setDigits(cleanDigits);

    // Auto-focus username input immediately
    setTimeout(() => {
      nicknameInputRef.current?.focus();
    }, 80);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullPin.length !== 4 || !nickname.trim()) return;
    onJoin(fullPin, nickname.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden max-h-[92dvh] overflow-y-auto">
        {/* Melaka Heritage Header Pattern */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600" />

        <div className="text-center mb-5 pt-2">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-3">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {t('join.title')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('join.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* OTP Digit Input Boxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t('join.pinLabel')}
              </label>
              <span className="text-[11px] text-slate-400">
                {t('join.otpProgress')} ({digits.filter(Boolean).length}/4)
              </span>
            </div>

            <div
              className="grid grid-cols-4 gap-2 sm:gap-3"
              onPaste={handlePaste}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={digitRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-full h-12 sm:h-16 text-center text-xl sm:text-3xl font-black font-mono rounded-2xl border-2 transition-all focus:outline-none ${
                    digit
                      ? 'border-amber-400/80 bg-amber-500/10 text-amber-300 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
                      : 'border-slate-800 bg-slate-950 text-white hover:border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30'
                  }`}
                  placeholder="•"
                  autoComplete="off"
                />
              ))}
            </div>

            {/* Live Team Matched Status */}
            {matchedTeam ? (
              <div className="mt-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-white/30 shrink-0"
                    style={{ background: matchedTeam.color }}
                  />
                  <span className="font-bold text-white truncate">
                    {matchedTeam.name}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{t('join.pinMatched')}</span>
                </span>
              </div>
            ) : fullPin.length === 4 ? (
              <div className="mt-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                {t('join.pinMismatch', { pin: fullPin })}
              </div>
            ) : null}
          </div>

          {/* Nickname Input Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t('join.nicknameLabel')}
            </label>
            <input
              ref={nicknameInputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('join.nicknamePlaceholder')}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 sm:py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-medium text-sm"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              {t('join.nicknameHelp')}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || fullPin.length !== 4 || !nickname.trim()}
            className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 sm:py-3.5 px-4 rounded-xl shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('join.joiningBtn')}
              </span>
            ) : (
              <>
                <span>{t('join.enterBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Team selector (available teams in game) */}
        {teams.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('join.quickSelectHeader')}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {teams.map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => handleQuickSelectTeam(tItem)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                    fullPin === tItem.pin
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: tItem.color }}
                  />
                  <span className="truncate font-semibold text-slate-200">
                    {tItem.name}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-amber-400 font-bold shrink-0">
                    #{tItem.pin}
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
