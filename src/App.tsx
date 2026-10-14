/**
 * Melaka Heritage Photo Scavenger Hunt - Root Application
 * Path: src/App.tsx
 */

import React, { useState, useEffect } from 'react';
import type { Game, Team, Clue, Submission } from './types/index.ts';
import { gameService, getDataSourceMode } from './services/gameService.ts';
import { useGeolocation } from './hooks/useGeolocation.ts';
import { PlayerHuntView } from './components/Player/PlayerHuntView.tsx';
import { JoinTeamModal } from './components/Player/JoinTeamModal.tsx';
import { GMDashboard } from './components/GM/GMDashboard.tsx';
import { Shield, Smartphone } from 'lucide-react';

export const App: React.FC = () => {
  const [role, setRole] = useState<'player' | 'gm'>('player');
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Player session state
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [playerNickname, setPlayerNickname] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const dataSourceMode = getDataSourceMode();

  // Detect mode from URL (e.g. ?mode=gm or /gm)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'gm' || window.location.pathname.includes('/gm')) {
        setRole('gm');
      }
    }
  }, []);

  // Initialize Game and Real-time Subscriptions
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    async function init() {
      try {
        const initializedGame = await gameService.initializeDefaultGame();
        setGame(initializedGame);

        // Realtime Listeners
        unsubs.push(
          gameService.subscribeToGame(initializedGame.id, (g) => {
            if (g) setGame(g);
          })
        );

        unsubs.push(
          gameService.subscribeToTeams(initializedGame.id, (t) => {
            setTeams(t);
            // Keep current team updated if joined
            setCurrentTeam((prev) => (prev ? t.find((item) => item.id === prev.id) || prev : null));
          })
        );

        unsubs.push(
          gameService.subscribeToClues(initializedGame.id, (c) => {
            setClues(c);
          })
        );

        unsubs.push(
          gameService.subscribeToSubmissions(initializedGame.id, (s) => {
            setSubmissions(s);
          })
        );
      } catch (err: any) {
        console.error('Failed to initialize game:', err);
      }
    }

    init();

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

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
      const { team } = await gameService.joinTeamByPin(game.id, pin, nickname);
      setCurrentTeam(team);
      setPlayerNickname(nickname);
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join team. Please check the PIN.');
    } finally {
      setIsJoining(false);
    }
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
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Universal Dev Switcher & Connection Status */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs z-50">
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
        </div>

        {/* Perspective Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setRole('player')}
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
            onClick={() => setRole('gm')}
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

      {/* Main Role Views */}
      <div className="flex-1 flex flex-col">
        {role === 'gm' ? (
          <GMDashboard
            game={game}
            teams={teams}
            clues={clues}
            submissions={submissions}
          />
        ) : !currentTeam ? (
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
          />
        )}
      </div>
    </div>
  );
};

export default App;
