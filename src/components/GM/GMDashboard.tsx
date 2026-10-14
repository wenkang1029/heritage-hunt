/**
 * Melaka Heritage Hunt - Game Master (GM) War Room Dashboard
 * Path: src/components/GM/GMDashboard.tsx
 *
 * Wide-screen organizer dashboard with live radar map, 1-click photo verification queue,
 * bulk clue photo uploader with auto EXIF GPS parsing, and team QR code generator.
 */

import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type {
  Game,
  Team,
  Clue,
  Submission,
  GameStatus,
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
} from 'lucide-react';

export interface GMDashboardProps {
  game: Game;
  teams: Team[];
  clues: Clue[];
  submissions: Submission[];
}

export const GMDashboard: React.FC<GMDashboardProps> = ({
  game,
  teams,
  clues,
  submissions,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'radar' | 'queue' | 'clues' | 'teams' | 'leaderboard'>('queue');

  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // New Team Form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#DC2626');
  const [newTeamPin, setNewTeamPin] = useState('');

  // Bulk Clue Upload State
  const [isUploadingClues, setIsUploadingClues] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Authenticate GM
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctCode = (import.meta as any).env?.VITE_GM_PASSCODE || 'melaka2026';
    if (passcode.trim() === correctCode) {
      setIsAuthenticated(true);
      setAuthError(null);
    } else {
      setAuthError('Incorrect GM Passcode. Please try again.');
    }
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

  // Handle Game Status Change
  const handleStatusChange = async (newStatus: GameStatus) => {
    try {
      await gameService.updateGameStatus(game.id, newStatus);
    } catch (err: any) {
      alert('Failed to update game status: ' + err.message);
    }
  };

  // Create New Team
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

  // Handle Bulk Clue Photo Upload with EXIF GPS extraction
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

        // Fallback coordinates within Melaka center if EXIF stripped
        const location = gps || {
          latitude: 2.1944 + (Math.random() - 0.5) * 0.005,
          longitude: 102.2491 + (Math.random() - 0.5) * 0.005,
        };

        const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        await gameService.addClue(game.id, {
          gameId: game.id,
          title,
          landmarkName: 'Melaka Historic Landmark',
          zoneId: 'dutch-square',
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
          <h2 className="text-xl font-black text-white">GM War Room Access</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Enter the master passcode to open the Game Master dashboard.
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
              <span>Unlock Dashboard</span>
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
      {/* Top War Room Control Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-black text-base text-white flex items-center gap-2">
              GM War Room
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                {game.status.toUpperCase()}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Melaka Heritage Photo Hunt Control Center
            </p>
          </div>
        </div>

        {/* Game State Control Buttons */}
        <div className="flex items-center gap-2">
          {game.status !== 'active' ? (
            <button
              onClick={() => handleStatusChange('active')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Game</span>
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('paused')}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Game</span>
            </button>
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
            Clues Manager ({clues.length})
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'teams' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Teams & QR Codes ({teams.length})
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

      {/* Main War Room Body */}
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
                        {/* Team and Clue Header */}
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
                          {/* Target Photo */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">
                              Target Landmark:
                            </span>
                            <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
                              {targetClue?.targetPhotoBase64 ? (
                                <img
                                  src={targetClue.targetPhotoBase64}
                                  alt="Target"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600">
                                  No Target
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Submitted Team Selfie */}
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 block mb-1">
                              Team Selfie:
                            </span>
                            <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border-2 border-emerald-500/50">
                              <img
                                src={sub.selfieBase64}
                                alt="Selfie"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Distance estimation badge */}
                        {sub.distanceFromClueMeters !== null && sub.distanceFromClueMeters !== undefined && (
                          <div className="text-[10px] text-slate-400 mb-3 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block">
                            Distance from landmark: <strong className="text-slate-200">{Math.round(sub.distanceFromClueMeters)}m</strong>
                          </div>
                        )}
                      </div>

                      {/* 1-Click Verification Action Buttons */}
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
                  Bulk upload cropped photos. EXIF GPS coordinates will be automatically extracted to drop map pins!
                </p>
              </div>

              {/* Bulk Photo Upload Button */}
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
                  <div className="w-full h-36 bg-slate-950 overflow-hidden">
                    {clue.targetPhotoBase64 ? (
                      <img
                        src={clue.targetPhotoBase64}
                        alt={clue.title}
                        className="w-full h-full object-cover"
                      />
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
                  Players can scan these QR codes directly with their smartphone cameras to join their team instantly.
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
                const joinUrl = typeof window !== 'undefined'
                  ? `${window.location.origin}/play?pin=${t.pin}`
                  : `https://heritage-hunt.vercel.app/play?pin=${t.pin}`;

                return (
                  <div
                    key={t.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-2"
                      style={{ background: t.color }}
                    />

                    <span
                      className="w-4 h-4 rounded-full mb-2"
                      style={{ background: t.color }}
                    />
                    <h3 className="font-black text-base text-white">{t.name}</h3>
                    <div className="mt-1 mb-4 flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">Team PIN:</span>
                      <span className="text-base font-black font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {t.pin}
                      </span>
                    </div>

                    {/* Printable / Scanable QR Code */}
                    <div className="p-3 bg-white rounded-2xl shadow-md mb-4">
                      <QRCodeSVG value={joinUrl} size={150} level="M" />
                    </div>

                    <a
                      href={joinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{joinUrl}</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: Leaderboard */}
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
    </div>
  );
};
