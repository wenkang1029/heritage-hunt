/**
 * Melaka Heritage Photo Scavenger Hunt - Root Application
 * Path: src/App.tsx
 *
 * Provides persistent sessions (never logs out on refresh), home page with direct GM login,
 * game link routing, and seamless live Firestore sync.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Game, Team, Clue, Submission } from './types/index.ts';
import { gameService, getDataSourceMode } from './services/gameService.ts';
import { useGeolocation } from './hooks/useGeolocation.ts';
import { PlayerHuntView } from './components/Player/PlayerHuntView.tsx';
import { JoinTeamModal } from './components/Player/JoinTeamModal.tsx';
import { GMDashboard } from './components/GM/GMDashboard.tsx';
import { Shield, Smartphone, ArrowRight, Lock, MapPin } from 'lucide-react';

const LS_GM_AUTH = 'HERITAGE_GM_AUTH';
const LS_ACTIVE_GAME_ID = 'HERITAGE_ACTIVE_GAME_ID';
const LS_PLAYER_SESSION = 'HERITAGE_PLAYER_SESSION';

interface PlayerSession {
  gameId: string;
  teamId: string;
  nickname: string;
  pin: string;
  playerId?: string;
}

export const App: React.FC = () => {
  // Navigation & Role states
  const [role, setRole] = useState<'player' | 'gm' | 'home'>('home');
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Player session state
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [playerNickname, setPlayerNickname] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Home Page GM Login Form State
  const [showGmLoginModal, setShowGmLoginModal] = useState<boolean>(false);
  const [gmPasscode, setGmPasscode] = useState<string>('');
  const [gmPasscodeError, setGmPasscodeError] = useState<string | null>(null);

  const dataSourceMode = getDataSourceMode();

  // Helper to sync URL without triggering page reloads
  const updateUrlParams = useCallback((params: { game?: string; mode?: string; pin?: string }) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (params.game) url.searchParams.set('game', params.game);
    if (params.mode) url.searchParams.set('mode', params.mode);
    else url.searchParams.delete('mode');

    if (params.pin) url.searchParams.set('pin', params.pin);

    window.history.replaceState({}, '', url.toString());
  }, []);

  // 1. Detect Initial Route & Restore Persistent Session on Page Load / Refresh
  useEffect(() => {
    async function initApp() {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const urlGameId = params.get('game');
      const urlMode = params.get('mode');

      const savedGameId = localStorage.getItem(LS_ACTIVE_GAME_ID);
      const isGmAuthed = localStorage.getItem(LS_GM_AUTH) === 'true';

      const savedPlayerSessionRaw = localStorage.getItem(LS_PLAYER_SESSION);
      let savedPlayerSession: PlayerSession | null = null;
      if (savedPlayerSessionRaw) {
        try {
          savedPlayerSession = JSON.parse(savedPlayerSessionRaw);
        } catch {
          // Ignore parse error
        }
      }

      // Determine target game ID to load (defaulting to active room hunt-nkvcz)
      const targetGameId = urlGameId || savedPlayerSession?.gameId || savedGameId || 'hunt-nkvcz';

      try {
        const loadedGame = await gameService.initializeDefaultGame(targetGameId);
        setGame(loadedGame);
        localStorage.setItem(LS_ACTIVE_GAME_ID, loadedGame.id);

        // Determine view role without losing state on refresh
        if (urlMode === 'gm' || isGmAuthed) {
          setRole('gm');
          updateUrlParams({ game: loadedGame.id, mode: 'gm' });
        } else if (urlGameId || savedPlayerSession) {
          setRole('player');
          updateUrlParams({ game: loadedGame.id });
        } else {
          setRole('home');
        }
      } catch (err: any) {
        console.error('Failed to load application:', err);
      }
    }

    initApp();
  }, [updateUrlParams]);

  // 2. Reactively Subscribe to Game Data whenever active game ID changes
  useEffect(() => {
    if (!game?.id) return;
    const gameId = game.id;
    const unsubs: (() => void)[] = [];

    // Subscribe to Game document
    unsubs.push(
      gameService.subscribeToGame(gameId, (g) => {
        if (g) setGame(g);
      })
    );

    // Subscribe to Teams
    unsubs.push(
      gameService.subscribeToTeams(gameId, (t) => {
        setTeams(t);

        // Re-connect saved player session seamlessly if present
        const savedPlayerSessionRaw = localStorage.getItem(LS_PLAYER_SESSION);
        if (savedPlayerSessionRaw) {
          try {
            const savedSession: PlayerSession = JSON.parse(savedPlayerSessionRaw);
            if (savedSession.gameId === gameId) {
              const matchedTeam = t.find((team) => team.id === savedSession.teamId);
              if (matchedTeam) {
                setCurrentTeam(matchedTeam);
                setPlayerNickname(savedSession.nickname);
                if (savedSession.playerId) {
                  setPlayerId(savedSession.playerId);
                }
              }
            }
          } catch {
            // Ignore parse error
          }
        } else {
          setCurrentTeam((prev) => (prev ? t.find((item) => item.id === prev.id) || prev : null));
        }
      })
    );

    // Subscribe to Clues (guarantees player receives 100% up-to-date GM clues)
    unsubs.push(
      gameService.subscribeToClues(gameId, (c) => {
        setClues(c);
      })
    );

    // Subscribe to Submissions
    unsubs.push(
      gameService.subscribeToSubmissions(gameId, (s) => {
        setSubmissions(s);
      })
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [game?.id]);

  // GPS Tracking for Player
  const { currentCoords: playerCoords } = useGeolocation({
    gameId: game?.id,
    teamId: currentTeam?.id,
    enabled: role === 'player' && !!currentTeam,
    throttleMs: 15000,
  });

  // Handle Join Team
  const handleJoinTeam = async (pin: string, nickname: string) => {
    if (!game) return;
    try {
      setIsJoining(true);
      setJoinError(null);
      const { team, playerId: assignedPlayerId } = await gameService.joinTeamByPin(game.id, pin, nickname);
      setCurrentTeam(team);
      setPlayerNickname(nickname);
      setPlayerId(assignedPlayerId);

      // Save player session so refreshing never logs them out!
      const session: PlayerSession = {
        gameId: game.id,
        teamId: team.id,
        nickname,
        pin,
        playerId: assignedPlayerId,
      };
      localStorage.setItem(LS_PLAYER_SESSION, JSON.stringify(session));
      updateUrlParams({ game: game.id, pin });
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join team. Please check the PIN.');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle GM Login on Home Page
  const handleGmHomeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctCode = (import.meta as any).env?.VITE_GM_PASSCODE || 'melaka2026';
    if (gmPasscode.trim() === correctCode) {
      localStorage.setItem(LS_GM_AUTH, 'true');
      setShowGmLoginModal(false);
      setRole('gm');
      if (game) updateUrlParams({ game: game.id, mode: 'gm' });
    } else {
      setGmPasscodeError('Incorrect GM Passcode.');
    }
  };

  // Switch Game callback (when GM creates or changes game)
  const handleGameChange = (newGame: Game) => {
    setGame(newGame);
    localStorage.setItem(LS_ACTIVE_GAME_ID, newGame.id);
    updateUrlParams({ game: newGame.id, mode: role === 'gm' ? 'gm' : undefined });
  };

  const handleLogoutGm = () => {
    localStorage.removeItem(LS_GM_AUTH);
    setRole('home');
    updateUrlParams({});
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-10 h-10 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-white">Connecting to Melaka Heritage Hunt...</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing real-time Firestore synchronization</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-slate-950 flex flex-col overflow-hidden text-slate-100 font-sans antialiased selection:bg-rose-500 selection:text-white">
      {/* Universal Status & Perspective Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs shrink-0 z-50">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                dataSourceMode === 'firestore' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                dataSourceMode === 'firestore' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {dataSourceMode === 'firestore' ? 'Firestore Live Connected' : 'Local Mock Mode'}
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            • Room: <strong className="text-amber-400 font-mono">{game.id}</strong>
          </span>
        </div>

        {/* Perspective Quick Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => {
              setRole('player');
              updateUrlParams({ game: game.id });
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              role === 'player'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Player Mode</span>
          </button>
          <button
            onClick={() => {
              setRole('gm');
              updateUrlParams({ game: game.id, mode: 'gm' });
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              role === 'gm'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>GM War Room</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. HOME / LANDING SCREEN (If on homepage with direct GM Login) */}
      {/* ========================================================================= */}
      {role === 'home' && (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full text-center">
          <div className="inline-flex p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4 shadow-xl">
            <MapPin className="w-12 h-12" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Melaka Heritage Photo Hunt
          </h1>
          <p className="text-sm text-slate-400 max-w-md mb-8">
            An interactive outdoor photo scavenger hunt across Jonker Street, Dutch Square, A Famosa, Jalan Tokong, and St. Paul's Hill.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl text-left">
            {/* Player Entry Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-rose-400">
                  <Smartphone className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wider">Participants</span>
                </div>
                <h3 className="font-black text-lg text-white mb-1">Join Photo Hunt</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Enter your team PIN or open your Game Link to start hunting landmarks and earning points.
                </p>
              </div>

              <button
                onClick={() => {
                  setRole('player');
                  updateUrlParams({ game: game.id });
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <span>Enter Player Hunt</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* GM Entry Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-amber-400">
                  <Shield className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wider">Organizers</span>
                </div>
                <h3 className="font-black text-lg text-white mb-1">Game Master Portal</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Log in to create games, configure teams & zones, monitor live radar, and approve team selfies.
                </p>
              </div>

              <button
                onClick={() => setShowGmLoginModal(true)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Game Master Login</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GM WAR ROOM */}
      {/* ========================================================================= */}
      {role === 'gm' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <GMDashboard
            game={game}
            teams={teams}
            clues={clues}
            submissions={submissions}
            onGameChange={handleGameChange}
            onLogout={handleLogoutGm}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PLAYER EXPERIENCE */}
      {/* ========================================================================= */}
      {role === 'player' && (
        !currentTeam ? (
          <JoinTeamModal
            teams={teams}
            onJoin={handleJoinTeam}
            isLoading={isJoining}
            error={joinError}
          />
        ) : (
          <PlayerHuntView
            game={game}
            currentTeam={currentTeam}
            clues={clues}
            teams={teams}
            submissions={submissions}
            playerCoords={playerCoords}
            nickname={playerNickname}
            playerId={playerId}
          />
        )
      )}

      {/* GM Home Login Modal */}
      {showGmLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">Organizer Login</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Enter your master passcode to access the War Room.
            </p>

            {gmPasscodeError && (
              <div className="mb-3 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {gmPasscodeError}
              </div>
            )}

            <form onSubmit={handleGmHomeLogin} className="space-y-3">
              <input
                type="password"
                value={gmPasscode}
                onChange={(e) => setGmPasscode(e.target.value)}
                placeholder="Enter GM Passcode"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                autoFocus
                required
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGmLoginModal(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg cursor-pointer"
                >
                  Enter War Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
