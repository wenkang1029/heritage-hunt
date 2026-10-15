/**
 * Melaka Heritage Hunt - Game Master (GM) War Room Dashboard
 * Path: src/components/GM/GMDashboard.tsx
 *
 * Wide-screen organizer dashboard with live radar map, 1-click photo verification queue,
 * game creator with configurable teams, shareable game link, team editor & safe deletion,
 * zone configuration, and EXIF GPS bulk photo uploader.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type {
  Game,
  Team,
  TeamMember,
  Clue,
  Submission,
  GameStatus,
  Zone,
  GeoCoordinate,
} from '../../types/index.ts';
import { HuntMap } from '../Map/HuntMap.tsx';
import { gameService } from '../../services/gameService.ts';
import { compressPhoto, extractExifGps } from '../../services/imageCompression.ts';
import {
  Radio,
  CheckCircle,
  XCircle,
  PlusCircle,
  Trophy,
  Play,
  Pause,
  Snowflake,
  Upload,
  Lock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  Layers,
  LogOut,
  Share2,
  MousePointerClick,
  Maximize2,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { ImageLightboxModal } from '../Common/ImageLightboxModal.tsx';

export interface GMDashboardProps {
  game: Game;
  teams: Team[];
  clues: Clue[];
  submissions: Submission[];
  onGameChange?: (game: Game) => void;
  onLogout?: () => void;
}

export const GMDashboard: React.FC<GMDashboardProps> = ({
  game,
  teams,
  clues,
  submissions,
  onGameChange,
  onLogout,
}) => {
  // Session persistence for GM
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('HERITAGE_GM_AUTH') === 'true';
    } catch {
      return false;
    }
  });

  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'queue' | 'radar' | 'clues' | 'teams' | 'zones' | 'leaderboard'>('queue');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Copy Link State
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Create Game Modal
  const [showCreateGameModal, setShowCreateGameModal] = useState<boolean>(false);
  const [newGameName, setNewGameName] = useState('Melaka Heritage Scavenger Hunt');
  const [newGameNumTeams, setNewGameNumTeams] = useState<number>(5);
  const [newGameDuration, setNewGameDuration] = useState<number>(120);
  const [isCreatingGame, setIsCreatingGame] = useState<boolean>(false);

  // Edit Team Modal
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamPin, setEditTeamPin] = useState('');
  const [editTeamColor, setEditTeamColor] = useState('');
  const [editTeamError, setEditTeamError] = useState<string | null>(null);

  // New Team Form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#DC2626');
  const [newTeamPin, setNewTeamPin] = useState('');

  // Bulk Clue Upload State
  const [isUploadingClues, setIsUploadingClues] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Force Stop Game Confirmation Modal
  const [showForceStopModal, setShowForceStopModal] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<GameStatus | null>(null);

  // Zone Editing & Visual Map Plotting State
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#DC2626');
  const [newZoneDescription, setNewZoneDescription] = useState('');
  const [activePlotZone, setActivePlotZone] = useState<Zone | null>(null);
  const [plotVertices, setPlotVertices] = useState<GeoCoordinate[]>([]);
  const [isSavingPlot, setIsSavingPlot] = useState<boolean>(false);

  // Fullscreen uncropped image lightbox state
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title?: string;
    subtitle?: string;
    badge?: string;
  } | null>(null);

  // Calculate shareable Game Link for participants
  const gameLink = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?game=${game.id}`;
    }
    return `https://heritage-hunt.vercel.app/?game=${game.id}`;
  }, [game.id]);

  const handleCopyGameLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(gameLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  // Authenticate GM
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctCode = (import.meta as any).env?.VITE_GM_PASSCODE || 'melaka2026';
    if (passcode.trim() === correctCode) {
      setIsAuthenticated(true);
      setAuthError(null);
      try {
        localStorage.setItem('HERITAGE_GM_AUTH', 'true');
      } catch {
        // Ignore localStorage error
      }
    } else {
      setAuthError('Incorrect GM Passcode. Please try again.');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('HERITAGE_GM_AUTH');
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
    if (onLogout) onLogout();
  };

  // Pending Submissions Queue
  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  );

  // Handle Review Action (Approve, Reject, Bonus)
  const handleReviewAction = async (
    submission: Submission,
    action: 'approve' | 'reject' | 'bonus'
  ) => {
    try {
      setIsProcessingAction(true);
      const bonus = action === 'bonus' ? 25 : 0;
      await gameService.reviewSubmission(game.id, submission.id, action, {
        bonusPoints: bonus,
        rejectionReason: action === 'reject' ? 'Photo does not clearly match the landmark detail.' : undefined,
      });
    } catch (err: any) {
      alert('Review action error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Real-time active players and online tab detection
  const isMemberOnline = useCallback((member: TeamMember, team: Team) => {
    if (member.isOnline === false) return false;
    if (member.lastSeenAt) {
      return Date.now() - Number(member.lastSeenAt) < 60000;
    }
    // Fallback: check team's lastActiveAt within last 60 seconds
    if (team.lastActiveAt) {
      const teamTime =
        typeof team.lastActiveAt === 'number'
          ? team.lastActiveAt
          : new Date(team.lastActiveAt).getTime();
      return Date.now() - teamTime < 60000;
    }
    return false;
  }, []);

  const totalPlayersJoined = useMemo(
    () => teams.reduce((acc, t) => acc + (t.members ? t.members.length : 0), 0),
    [teams]
  );

  // Compute live active online players across all teams (tabs currently open)
  const activeOnlinePlayers = useMemo(() => {
    const list: { member: TeamMember; team: Team }[] = [];
    teams.forEach((t) => {
      if (t.members && Array.isArray(t.members)) {
        t.members.forEach((m) => {
          if (isMemberOnline(m, t)) {
            list.push({ member: m, team: t });
          }
        });
      }
    });
    return list;
  }, [teams, isMemberOnline]);

  const onlinePlayersCount = activeOnlinePlayers.length;
  const hasActiveOnlinePlayers = onlinePlayersCount > 0;

  // Handle Game Status Change
  const handleStatusChange = async (newStatus: GameStatus, force: boolean = false) => {
    const isStoppingAction = newStatus === 'ended' || newStatus === 'paused';
    if (isStoppingAction && hasActiveOnlinePlayers && !force) {
      setPendingStatus(newStatus);
      setShowForceStopModal(true);
      return;
    }

    try {
      await gameService.updateGameStatus(game.id, newStatus);
      setShowForceStopModal(false);
      setPendingStatus(null);
    } catch (err: any) {
      alert('Failed to update game status: ' + err.message);
    }
  };

  // Create New Game with specified number of teams
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingGame(true);
      const createdGame = await gameService.createGameWithTeams(
        newGameName,
        newGameNumTeams,
        newGameDuration
      );
      setShowCreateGameModal(false);
      if (onGameChange) {
        onGameChange(createdGame);
      }
      alert(`Game "${createdGame.name}" created! Participants can now join via the game link.`);
    } catch (err: any) {
      alert('Failed to create game: ' + err.message);
    } finally {
      setIsCreatingGame(false);
    }
  };

  // Create Single New Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamPin.trim()) return;

    try {
      await gameService.createTeam(game.id, newTeamName.trim(), newTeamColor, newTeamPin.trim());
      setNewTeamName('');
      setNewTeamPin('');
      alert(`Team "${newTeamName}" created successfully!`);
    } catch (err: any) {
      alert('Failed to create team: ' + err.message);
    }
  };

  // Open Edit Team Modal
  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamPin(team.pin);
    setEditTeamColor(team.color);
    setEditTeamError(null);
  };

  // Save Edited Team
  const handleSaveEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    try {
      await gameService.updateTeam(game.id, editingTeam.id, {
        name: editTeamName.trim(),
        pin: editTeamPin.trim(),
        color: editTeamColor,
      });
      setEditingTeam(null);
    } catch (err: any) {
      setEditTeamError(err.message || 'Failed to update team');
    }
  };

  // Delete Team (Only if no players have joined)
  const handleDeleteTeam = async (team: Team) => {
    if (team.members && team.members.length > 0) {
      alert(`Cannot delete "${team.name}" because it already has ${team.members.length} player(s) joined.`);
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${team.name}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      await gameService.deleteTeam(game.id, team.id);
    } catch (err: any) {
      alert('Failed to delete team: ' + err.message);
    }
  };

  // Bulk Clue Upload
  const handleBulkClueUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingClues(true);
    setUploadFeedback(`Processing ${files.length} clue photos...`);

    let addedCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressPhoto(file);
        const gps = await extractExifGps(file);

        const location = gps || {
          latitude: 2.1944 + (Math.random() - 0.5) * 0.005,
          longitude: 102.2491 + (Math.random() - 0.5) * 0.005,
        };

        const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        await gameService.addClue(game.id, {
          gameId: game.id,
          title,
          landmarkName: 'Melaka Historic Landmark',
          zoneId: game.zones[0]?.id || 'dutch-square',
          points: 100,
          targetPhotoBase64: compressed.base64,
          location,
          hint: 'Look closely at the shophouse details and walls.',
        });
        addedCount++;
      }
      setUploadFeedback(`✓ Successfully added ${addedCount} clue photos with GPS pins!`);
      setTimeout(() => setUploadFeedback(null), 5000);
    } catch (err: any) {
      alert('Bulk upload error: ' + err.message);
    } finally {
      setIsUploadingClues(false);
    }
  };

  // Zone configuration update
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;

    try {
      const updatedZones = game.zones.map((z) =>
        z.id === editingZone.id
          ? {
              ...z,
              name: newZoneName.trim() || z.name,
              color: newZoneColor,
              description: newZoneDescription.trim() || z.description,
            }
          : z
      );
      await gameService.updateZones(game.id, updatedZones);
      setEditingZone(null);
    } catch (err: any) {
      alert('Failed to update zone: ' + err.message);
    }
  };

  const handleStartPlotting = (zone: Zone) => {
    setActivePlotZone(zone);
    setPlotVertices(zone.polygon ? [...zone.polygon] : []);
    if (activeTab !== 'zones') {
      setActiveTab('zones');
    }
    const mapEl = document.getElementById('gm-zone-map-editor');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSavePlotZone = async () => {
    if (!activePlotZone) return;
    if (plotVertices.length < 3) {
      alert('A zone polygon must contain at least 3 boundary points.');
      return;
    }
    setIsSavingPlot(true);
    try {
      const sumLat = plotVertices.reduce((acc, p) => acc + p.latitude, 0);
      const sumLng = plotVertices.reduce((acc, p) => acc + p.longitude, 0);
      const newCenter = {
        latitude: Number((sumLat / plotVertices.length).toFixed(6)),
        longitude: Number((sumLng / plotVertices.length).toFixed(6)),
      };
      const updatedZones = game.zones.map((z) =>
        z.id === activePlotZone.id
          ? {
              ...z,
              polygon: plotVertices,
              center: newCenter,
            }
          : z
      );
      await gameService.updateZones(game.id, updatedZones);
      setActivePlotZone(null);
      setPlotVertices([]);
    } catch (err: any) {
      alert('Failed to save plotted zone: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingPlot(false);
    }
  };

  // ============================================================================
  // Passcode Lock Screen
  // ============================================================================

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white">Game Master Portal</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Enter the master passcode to access the event management War Room.
          </p>

          {authError && (
            <div className="mb-4 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handlePasscodeSubmit} className="space-y-3">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter GM Passcode"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Unlock War Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-slate-500 mt-3 font-mono">
            Default passcode: melaka2026
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main GM Dashboard Interface
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 1. Top War Room Control Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-black text-base text-white flex items-center gap-2">
              {game.name}
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                {game.status.toUpperCase()}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Game ID: <strong className="text-amber-400 font-mono">{game.id}</strong>
            </p>
          </div>
        </div>

        {/* Game State Control Buttons & Create Game Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateGameModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Game</span>
          </button>

          {/* Active players online status indicator */}
          {game.status === 'active' && (
            <span
              className={`hidden md:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl font-bold border transition-colors ${
                hasActiveOnlinePlayers
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={
                hasActiveOnlinePlayers
                  ? `${onlinePlayersCount} of ${totalPlayersJoined} total player(s) currently online with tabs open`
                  : `All ${totalPlayersJoined} player tabs are closed / offline (Game can be stopped freely)`
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasActiveOnlinePlayers ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>
                {hasActiveOnlinePlayers
                  ? `${onlinePlayersCount} Player(s) Online`
                  : '0 Online (Ready to Stop)'}
              </span>
            </span>
          )}

          {game.status !== 'active' ? (
            <button
              onClick={() => handleStatusChange('active')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Game</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleStatusChange('paused')}
                title="Pause Game"
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>

              <button
                onClick={() => handleStatusChange('ended')}
                title={hasActiveOnlinePlayers ? `Stop Game (${onlinePlayersCount} online)` : 'Stop Game'}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Game</span>
              </button>
            </div>
          )}

          <button
            onClick={() => handleStatusChange(game.isLeaderboardFrozen ? 'active' : 'frozen')}
            className={`font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors border ${
              game.isLeaderboardFrozen
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            <span>{game.isLeaderboardFrozen ? 'Unfreeze' : 'Freeze Leaderboard'}</span>
          </button>

          <button
            onClick={handleLogout}
            title="Log out Game Master"
            className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 p-1.5 rounded-xl border border-slate-700 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Review Queue</span>
            {pendingSubmissions.length > 0 && (
              <span className="bg-white text-rose-600 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {pendingSubmissions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'radar' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Radar Map
          </button>

          <button
            onClick={() => setActiveTab('clues')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'clues' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Clues ({clues.length})
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'teams' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Teams & PINs ({teams.length})
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'zones' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Zones ({game.zones.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'leaderboard' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Leaderboard
          </button>
        </nav>
      </header>

      {/* 2. Shareable Participant Game Link Banner */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold text-slate-300">Participant Game Link:</span>
          <code className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-amber-300 font-mono">
            {gameLink}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyGameLink}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Participant Link</span>
              </>
            )}
          </button>
          <a
            href={gameLink}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Link</span>
          </a>
        </div>
      </div>

      {/* 3. Main War Room Body */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* ========================================================================= */}
        {/* TAB 1: Verification Queue */}
        {/* ========================================================================= */}
        {activeTab === 'queue' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white">Live Verification Queue</h2>
                <p className="text-xs text-slate-400">
                  Review incoming player selfies in real time with 1-click approvals.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {pendingSubmissions.length} pending submissions
              </span>
            </div>

            {pendingSubmissions.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-60" />
                <h3 className="font-bold text-slate-200 text-sm">Verification Queue is Empty</h3>
                <p className="text-xs text-slate-400 mt-1">
                  When teams submit landmark selfies, they will instantly appear here for 1-click approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingSubmissions.map((sub) => {
                  const targetClue = clues.find((c) => c.id === sub.clueId);

                  return (
                    <div
                      key={sub.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ background: sub.teamColor }}
                            />
                            <span className="font-bold text-xs text-white">
                              {sub.teamName}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            by {sub.submittedBy}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-amber-400 mb-3 truncate">
                          {sub.clueTitle}
                        </h3>

                        {/* Side-by-Side Photo Comparison */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-400">
                                Target Landmark:
                              </span>
                              {targetClue?.targetPhotoBase64 && (
                                <span className="text-[9px] text-amber-400 flex items-center gap-0.5 font-semibold">
                                  <Maximize2 className="w-2.5 h-2.5" />
                                  <span>View full</span>
                                </span>
                              )}
                            </div>
                            <div
                              onClick={() => {
                                if (targetClue?.targetPhotoBase64) {
                                  setLightboxImage({
                                    url: targetClue.targetPhotoBase64,
                                    title: targetClue.title,
                                    subtitle: targetClue.landmarkName || targetClue.zoneId,
                                    badge: 'Target Landmark',
                                  });
                                }
                              }}
                              className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 relative cursor-pointer group flex items-center justify-center"
                              title="Tap to view full uncropped photo"
                            >
                              {targetClue?.targetPhotoBase64 ? (
                                <>
                                  <img
                                    src={targetClue.targetPhotoBase64}
                                    alt="Target"
                                    className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute top-1.5 right-1.5 bg-slate-900/80 p-1 rounded-md text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600">
                                  No Target
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-emerald-400">
                                Team Selfie:
                              </span>
                              <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 font-semibold">
                                <Maximize2 className="w-2.5 h-2.5" />
                                <span>View full</span>
                              </span>
                            </div>
                            <div
                              onClick={() => {
                                setLightboxImage({
                                  url: sub.selfieBase64,
                                  title: `${sub.teamName} Submission Selfie`,
                                  subtitle: sub.clueTitle,
                                  badge: 'Team Selfie',
                                });
                              }}
                              className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border-2 border-emerald-500/50 relative cursor-pointer group flex items-center justify-center"
                              title="Tap to view full uncropped selfie"
                            >
                              <img
                                src={sub.selfieBase64}
                                alt="Selfie"
                                className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute top-1.5 right-1.5 bg-slate-900/80 p-1 rounded-md text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {sub.distanceFromClueMeters !== null && sub.distanceFromClueMeters !== undefined && (
                          <div className="text-[10px] text-slate-400 mb-3 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block">
                            Distance from landmark: <strong className="text-slate-200">{Math.round(sub.distanceFromClueMeters)}m</strong>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleReviewAction(sub, 'approve')}
                          disabled={isProcessingAction}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-md"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReviewAction(sub, 'bonus')}
                          disabled={isProcessingAction}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-md"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>+25 Bonus</span>
                        </button>
                        <button
                          onClick={() => handleReviewAction(sub, 'reject')}
                          disabled={isProcessingAction}
                          className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors border border-rose-800"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: Live Radar Map */}
        {/* ========================================================================= */}
        {activeTab === 'radar' && (
          <div className="h-[75vh]">
            <HuntMap
              zones={game.zones}
              clues={clues}
              teams={teams}
              className="h-full w-full"
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: Clues Manager */}
        {/* ========================================================================= */}
        {activeTab === 'clues' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-white">Clues & Landmark Manager</h2>
                <p className="text-xs text-slate-400">
                  Bulk upload photos from your machine. EXIF GPS coordinates will auto-drop map pins!
                </p>
              </div>

              <label className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-all">
                <Upload className="w-4 h-4" />
                <span>{isUploadingClues ? 'Processing Photos...' : 'Bulk Upload Clue Photos'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleBulkClueUpload}
                  disabled={isUploadingClues}
                  className="hidden"
                />
              </label>
            </div>

            {uploadFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                {uploadFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {clues.map((clue) => (
                <div
                  key={clue.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col"
                >
                  <div
                    onClick={() => {
                      if (clue.targetPhotoBase64) {
                        setLightboxImage({
                          url: clue.targetPhotoBase64,
                          title: clue.title,
                          subtitle: clue.landmarkName || clue.zoneId,
                          badge: 'Target Landmark',
                        });
                      }
                    }}
                    className="w-full h-36 bg-slate-950 overflow-hidden relative cursor-pointer group flex items-center justify-center border-b border-slate-800"
                    title="Tap to view full uncropped photo"
                  >
                    {clue.targetPhotoBase64 ? (
                      <>
                        <img
                          src={clue.targetPhotoBase64}
                          alt={clue.title}
                          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute top-2 right-2 bg-slate-900/80 p-1.5 rounded-lg text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {clue.zoneId}
                        </span>
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {clue.points} pts
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 truncate mb-1">
                        {clue.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {clue.hint || 'No hint specified'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 truncate">
                      GPS: {clue.location.latitude.toFixed(4)}, {clue.location.longitude.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: Teams & QR Codes */}
        {/* ========================================================================= */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-white">Teams & QR Join Codes</h2>
                <p className="text-xs text-slate-400">
                  Players can scan these QR codes or enter the 4-digit PIN to join.
                </p>
              </div>

              {/* Create Team Inline Form */}
              <form onSubmit={handleCreateTeam} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Team Name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="4-digit PIN"
                  value={newTeamPin}
                  onChange={(e) => setNewTeamPin(e.target.value)}
                  maxLength={6}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-mono text-center"
                  required
                />
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  title="Choose Team Color"
                />
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Team</span>
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((t) => {
                const teamJoinUrl = `${gameLink}&pin=${t.pin}`;
                const hasPlayers = t.members && t.members.length > 0;

                return (
                  <div
                    key={t.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-2"
                      style={{ background: t.color }}
                    />

                    <div className="flex items-center justify-between w-full mb-2">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ background: t.color }}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditTeam(t)}
                          title="Edit Team Name and PIN"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(t)}
                          disabled={hasPlayers}
                          title={hasPlayers ? `Cannot delete: ${t.members.length} player(s) joined` : 'Delete Team'}
                          className={`p-1 rounded-lg transition-colors cursor-pointer ${
                            hasPlayers
                              ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                              : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/40'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-black text-base text-white">{t.name}</h3>
                    <div className="mt-1 mb-3 flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">Team PIN:</span>
                      <span className="text-base font-black font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {t.pin}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-2xl shadow-md mb-3">
                      <QRCodeSVG value={teamJoinUrl} size={140} level="M" />
                    </div>

                    <div className="text-[11px] text-slate-400 mb-1 w-full">
                      {hasPlayers ? (
                        <div className="space-y-1.5">
                          <span className="text-emerald-400 font-bold block">
                            ● {t.members.length} player(s) joined
                          </span>
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {t.members.map((m) => {
                              const online = isMemberOnline(m, t);
                              return (
                                <span
                                  key={m.id || m.nickname}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                    online
                                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-sm'
                                      : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                                  }`}
                                  title={online ? 'Online now' : 'Tab closed / Offline'}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                    }`}
                                  />
                                  <span>{m.nickname}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">No players yet (Can be deleted)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: Zone Configuration & Interactive Map Plotting */}
        {/* ========================================================================= */}
        {activeTab === 'zones' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-rose-500" />
                  <span>Zone Map & Boundary Editor</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Click <strong className="text-amber-400">"Plot on Map"</strong> on any zone below to draw and adjust its polygon boundary directly on the map.
                </p>
              </div>

              {activePlotZone && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 animate-pulse">
                    <MousePointerClick className="w-4 h-4 text-amber-400" />
                    <span>Plotting: {activePlotZone.name} ({plotVertices.length} points)</span>
                  </span>
                </div>
              )}
            </div>

            {/* Interactive Leaflet Zone Plotting Map */}
            <div id="gm-zone-map-editor" className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
              <HuntMap
                zones={game.zones}
                clues={clues}
                teams={teams}
                className="h-[480px] w-full"
                isPlottingZone={!!activePlotZone}
                plottingZoneId={activePlotZone?.id}
                plottingZoneName={activePlotZone?.name}
                plottingZoneColor={activePlotZone?.color}
                plottingPoints={plotVertices}
                onPlotPointAdd={(p) => setPlotVertices((prev) => [...prev, p])}
                onUndoPoint={() => setPlotVertices((prev) => prev.slice(0, -1))}
                onClearPoints={() => setPlotVertices([])}
                onSavePlot={handleSavePlotZone}
                onCancelPlot={() => {
                  setActivePlotZone(null);
                  setPlotVertices([]);
                }}
                isSavingPlot={isSavingPlot}
                targetCenter={activePlotZone?.center}
              />
            </div>

            {/* Zone Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {game.zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`bg-slate-900 border rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all ${
                    activePlotZone?.id === zone.id
                      ? 'border-amber-500/60 ring-2 ring-amber-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shadow"
                          style={{ background: zone.color }}
                        />
                        <span className="text-xs font-bold text-slate-300">{zone.name}</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingZone(zone);
                          setNewZoneName(zone.name);
                          setNewZoneColor(zone.color);
                          setNewZoneDescription(zone.description || '');
                        }}
                        className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                        title="Edit Zone Details"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Details</span>
                      </button>
                    </div>

                    <h3 className="font-bold text-sm text-white">{zone.name}</h3>
                    {zone.localName && (
                      <span className="text-[11px] text-slate-400 block mb-1">
                        {zone.localName}
                      </span>
                    )}
                    <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                      {zone.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      {zone.polygon.length} boundary points
                    </span>
                    <button
                      onClick={() => handleStartPlotting(zone)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activePlotZone?.id === zone.id
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      <MousePointerClick className="w-3.5 h-3.5" />
                      <span>{activePlotZone?.id === zone.id ? 'Plotting...' : 'Plot on Map'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: Leaderboard */}
        {/* ========================================================================= */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <h2 className="text-xl font-black text-white">Event Leaderboard</h2>
              <p className="text-xs text-slate-400">
                Official real-time rankings and scores for all participating teams.
              </p>
            </div>

            <div className="space-y-3">
              {teams.map((t, idx) => (
                <div
                  key={t.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-black text-base text-slate-500 w-6 text-center">
                      #{idx + 1}
                    </span>
                    <span
                      className="w-4 h-4 rounded-full ring-2 ring-white/30"
                      style={{ background: t.color }}
                    />
                    <div>
                      <h4 className="font-bold text-sm text-white">{t.name}</h4>
                      <span className="text-xs text-slate-400">
                        PIN: #{t.pin} • {t.completedClueIds?.length || 0} clues completed
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-black text-amber-400">{t.score}</span>
                    <span className="text-[10px] text-slate-500 block">points</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: Create New Game */}
      {/* ========================================================================= */}
      {showCreateGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-1">Create New Hunt Game</h3>
            <p className="text-xs text-slate-400 mb-4">
              Set up a new event room with automatically generated teams.
            </p>

            <form onSubmit={handleCreateGame} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Game Event Name
                </label>
                <input
                  type="text"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Number of Teams (2 to 10)
                </label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={newGameNumTeams}
                  onChange={(e) => setNewGameNumTeams(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-400 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={10}
                  max={360}
                  value={newGameDuration}
                  onChange={(e) => setNewGameDuration(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGameModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGame}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg"
                >
                  {isCreatingGame ? 'Creating Game...' : 'Create & Launch Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Edit Team Name & PIN */}
      {/* ========================================================================= */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-1">Edit Team Details</h3>
            <p className="text-xs text-slate-400 mb-4">
              Update team name or 4-digit PIN code.
            </p>

            {editTeamError && (
              <div className="mb-3 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {editTeamError}
              </div>
            )}

            <form onSubmit={handleSaveEditTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  4-Digit Numeric PIN
                </label>
                <input
                  type="text"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={editTeamPin}
                  onChange={(e) => setEditTeamPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Team Color
                </label>
                <input
                  type="color"
                  value={editTeamColor}
                  onChange={(e) => setEditTeamColor(e.target.value)}
                  className="w-full h-9 rounded-xl cursor-pointer bg-transparent border-0"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Edit Zone */}
      {/* ========================================================================= */}
      {editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-1">Edit Zone</h3>
            <p className="text-xs text-slate-400 mb-4">
              Update zone title, color, or description.
            </p>

            <form onSubmit={handleSaveZone} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Zone Name
                </label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Zone Color
                </label>
                <input
                  type="color"
                  value={newZoneColor}
                  onChange={(e) => setNewZoneColor(e.target.value)}
                  className="w-full h-9 rounded-xl cursor-pointer bg-transparent border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newZoneDescription}
                  onChange={(e) => setNewZoneDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md"
                >
                  Save Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Stop Game Confirmation Modal */}
      {showForceStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Active Players Detected</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Some participants still have their game tab open.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Currently Connected ({onlinePlayersCount}):
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {activeOnlinePlayers.map(({ member, team }) => (
                  <span
                    key={`${team.id}_${member.id || member.nickname}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200"
                  >
                    <span
                      className="w-2 h-2 rounded-full ring-1 ring-white/30 shrink-0"
                      style={{ background: team.color }}
                    />
                    <span>{member.nickname}</span>
                    <span className="text-[10px] text-slate-400">({team.name})</span>
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5">
              Stopping the game will end the hunt for everyone. Are you sure you want to stop the game now?
            </p>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowForceStopModal(false);
                  setPendingStatus(null);
                }}
                className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Keep Game Running
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(pendingStatus || 'ended', true)}
                className="w-1/2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg cursor-pointer transition-colors"
              >
                Force Stop Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Uncropped Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title}
        subtitle={lightboxImage?.subtitle}
        badge={lightboxImage?.badge}
      />
    </div>
  );
};
