/**
 * Melaka Heritage Hunt - Mobile-First Player Experience
 * Path: src/components/Player/PlayerHuntView.tsx
 *
 * Provides real-time map, clue cards, native camera selfie capture, instant client compression, and celebratory confetti.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import type {
  Game,
  Team,
  Clue,
  Submission,
  GeoCoordinate,
} from '../../types/index.ts';
import { HuntMap } from '../Map/HuntMap.tsx';
import { compressPhoto, formatBytes } from '../../services/imageCompression.ts';
import { gameService } from '../../services/gameService.ts';
import {
  MapPin,
  Camera,
  Trophy,
  List,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  UploadCloud,
  HelpCircle,
  Maximize2,
  Compass,
  ChevronDown,
  Users,
} from 'lucide-react';
import { ImageLightboxModal } from '../Common/ImageLightboxModal.tsx';
import { useDialog } from '../../context/DialogContext.tsx';
import { InteractiveTour, type TourStep } from '../Common/InteractiveTour.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

export interface PlayerHuntViewProps {
  game: Game;
  currentTeam: Team;
  clues: Clue[];
  teams: Team[];
  submissions: Submission[];
  playerCoords: GeoCoordinate | null;
  nickname: string;
  playerId?: string;
}

export const PlayerHuntView: React.FC<PlayerHuntViewProps> = ({
  game,
  currentTeam,
  clues,
  teams,
  submissions,
  playerCoords,
  nickname,
  playerId,
}) => {
  const { showAlert } = useDialog();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'map' | 'clues' | 'leaderboard'>('map');
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');

  // Camera & submission state
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionStats, setCompressionStats] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  // Fullscreen uncropped image lightbox state
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title?: string;
    subtitle?: string;
    badge?: string;
  } | null>(null);

  // Interactive Onboarding Tour State for Player
  const [showTour, setShowTour] = useState<boolean>(() => {
    try {
      return localStorage.getItem('melaka_hunt_seen_player_tour') !== 'true';
    } catch {
      return false;
    }
  });
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);

  // Leaderboard team members dropdown state
  const [expandedLeaderboardTeams, setExpandedLeaderboardTeams] = useState<Set<string>>(new Set());

  const toggleLeaderboardTeamExpand = (teamId: string) => {
    setExpandedLeaderboardTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  // Leaderboard ranking calculations for top bar (e.g. 1/3)
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.completedClueIds?.length || 0) - (a.completedClueIds?.length || 0);
    });
  }, [teams]);

  const teamRank = useMemo(() => {
    const index = sortedTeams.findIndex((tItem) => tItem.id === currentTeam.id);
    return index !== -1 ? index + 1 : 1;
  }, [sortedTeams, currentTeam.id]);

  const playerTourSteps = useMemo<TourStep[]>(() => {
    if (language === 'zh') {
      return [
        {
          id: 'player-welcome',
          title: '欢迎参加马六甲寻宝大冒险！',
          description:
            '您正在代表小队穿梭于马六甲古迹街头！请查看顶部状态栏，实时查看队伍专属颜色、个人昵称、当前积分、实时排名以及已找到地标数量。',
          icon: <Trophy className="w-5 h-5 text-amber-400" />,
          badge: '第1步：你的小队',
          tips: '您的参赛信息会自动保存在本机。即使刷新或重新打开浏览器，队伍状态依然完整保留。',
          tabKey: 'map',
        },
        {
          id: 'player-map',
          title: '1. 寻宝地图与历史区域',
          description:
            '漫步马六甲世界文化遗产保护区。彩色多边形区域划定了鸡场街、荷兰红屋、圣地亚哥古城门与圣保罗山等。探索时您的实时 GPS 位置将精准显示在地图上！',
          icon: <MapPin className="w-5 h-5 text-rose-500" />,
          badge: '第2步：地图界面',
          tips: '请保持手机 GPS 定位开启，队伍图钉将实时同步到裁判 GM 的雷达大屏上。',
          tabKey: 'map',
        },
        {
          id: 'player-clues',
          title: '2. 寻宝线索与目标地标',
          description:
            '切换到【线索】标签页查看历史目标。可按区域筛选或查看全部。每张卡片均标有积分奖励、寻找提示与参考照片。点击任意照片可查看高清无裁切原图！',
          icon: <List className="w-5 h-5 text-amber-400" />,
          badge: '第3步：线索清单',
          tips: '仔细观察殖民地雕花、荷兰红砖砌块与古老巷弄壁画细节。',
          tabKey: 'clues',
        },
        {
          id: 'player-camera',
          title: '3. 现场拍摄自拍并赢取积分',
          description:
            '到达地标位置后，点击“拍摄地标打卡自拍”！拍摄一张队伍与地标建筑的合影。系统将在数秒内完成极速压缩（<150KB）并提交给 GM 审核。',
          icon: <Camera className="w-5 h-5 text-emerald-400" />,
          badge: '第4步：相机打卡审核',
          tips: '富有创意或有趣的合影姿势可赢取 GM 裁判额外的 +25 创意加分！',
          tabKey: 'clues',
        },
        {
          id: 'player-leaderboard',
          title: '4. 实时排行榜与积分总榜',
          description:
            '实时追踪队伍的排名与得分。与竞争对手展开角逐，寻找更多地标，登上冠军领奖台！',
          icon: <Trophy className="w-5 h-5 text-amber-400" />,
          badge: '第5步：实时排行榜',
          tips: '随时点击顶部罗盘图标即可重新打开此操作向导。',
          tabKey: 'leaderboard',
        },
      ];
    }

    return [
      {
        id: 'player-welcome',
        title: 'Welcome, Heritage Explorer!',
        description:
          'You are on the street representing your team in the Melaka Heritage Photo Hunt! Look at the header bar above to view your squad color, nickname, live score, leaderboard rank, and completed clues count.',
        icon: <Trophy className="w-5 h-5 text-amber-400" />,
        badge: 'Step 1: Your Squad',
        tips: 'Your session is saved automatically. If you close your browser or refresh, you will remain in your team.',
        tabKey: 'map',
      },
      {
        id: 'player-map',
        title: '1. Hunt Map & Heritage Zones',
        description:
          'Navigate through Melaka’s historic core. Color-coded polygon zones outline Jonker Street, Dutch Square, A Famosa, and St. Paul’s Hill. Your real-time GPS position appears right on the map as you explore!',
        icon: <MapPin className="w-5 h-5 text-rose-500" />,
        badge: 'Step 2: Map Tab',
        tips: 'Keep GPS enabled on your phone so your team marker updates live for the Game Master radar.',
        tabKey: 'map',
      },
      {
        id: 'player-clues',
        title: '2. Clues & Target Landmarks',
        description:
          'Switch to the Clues tab to browse historic targets. Filter by heritage zone or view all. Each card shows the points reward, landmark hint, and a photo. Tap any photo to view the full uncropped image in high resolution!',
        icon: <List className="w-5 h-5 text-amber-400" />,
        badge: 'Step 3: Clues Tab',
        tips: 'Scout out distinctive colonial carvings, Dutch brickwork, and alleyway details.',
        tabKey: 'clues',
      },
      {
        id: 'player-camera',
        title: '3. Snap Selfie & Earn Points',
        description:
          'When you arrive at the landmark, tap "Capture Landmark Selfie"! Take a clear selfie photo with your team and the landmark. The app compresses the image in seconds (< 150KB) and uploads it for GM verification.',
        icon: <Camera className="w-5 h-5 text-emerald-400" />,
        badge: 'Step 4: Camera Verification',
        tips: 'Creative and fast submissions can earn +25 bonus points from the Game Master!',
        tabKey: 'clues',
      },
      {
        id: 'player-leaderboard',
        title: '4. Live Leaderboard & Standings',
        description:
          'Track your team’s rank and score in real time. Compete with rival squads to find the most landmarks and take the #1 podium spot!',
        icon: <Trophy className="w-5 h-5 text-amber-400" />,
        badge: 'Step 5: Leaderboard Tab',
        tips: 'Tap the compass icon in the top header anytime to reopen this walkthrough.',
        tabKey: 'leaderboard',
      },
    ];
  }, [language]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousCompletedCountRef = useRef<number>(currentTeam.completedClueIds?.length || 0);

  // Trigger celebratory confetti when team completes a clue
  useEffect(() => {
    const currentCompleted = currentTeam.completedClueIds?.length || 0;
    if (currentCompleted > previousCompletedCountRef.current) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: [currentTeam.color, '#F59E0B', '#10B981', '#ffffff'],
      });
      previousCompletedCountRef.current = currentCompleted;
    }
  }, [currentTeam.completedClueIds, currentTeam.color]);

  // Real-time Presence Heartbeat & Auto-detection of Tab Closure / Turn-off
  useEffect(() => {
    const pId = playerId || `player_${nickname}`;

    // 1. Send initial heartbeat immediately
    gameService.updatePlayerHeartbeat(game.id, currentTeam.id, pId, nickname);

    // 2. Periodic heartbeat every 20 seconds while tab is active
    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        gameService.updatePlayerHeartbeat(game.id, currentTeam.id, pId, nickname);
      }
    }, 20000);

    // 3. Auto-detect when player closes tab or navigates away
    const handleTabClose = () => {
      gameService.markPlayerOffline(game.id, currentTeam.id, pId, nickname);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        gameService.updatePlayerHeartbeat(game.id, currentTeam.id, pId, nickname);
      } else {
        // Tab backgrounded or turned off
        gameService.markPlayerOffline(game.id, currentTeam.id, pId, nickname);
      }
    };

    window.addEventListener('beforeunload', handleTabClose);
    window.addEventListener('pagehide', handleTabClose);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleTabClose);
      window.removeEventListener('pagehide', handleTabClose);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      handleTabClose();
    };
  }, [game.id, currentTeam.id, playerId, nickname]);

  // Derived sets
  const completedClueIds = useMemo(
    () => new Set(currentTeam.completedClueIds || []),
    [currentTeam.completedClueIds]
  );

  const teamSubmissions = useMemo(
    () => submissions.filter((s) => s.teamId === currentTeam.id),
    [submissions, currentTeam.id]
  );

  const pendingClueIds = useMemo(
    () =>
      new Set(
        teamSubmissions
          .filter((s) => s.status === 'pending')
          .map((s) => s.clueId)
      ),
    [teamSubmissions]
  );

  // Filtered clues list
  const filteredClues = useMemo(() => {
    if (selectedZoneFilter === 'all') return clues;
    return clues.filter((c) => c.zoneId === selectedZoneFilter);
  }, [clues, selectedZoneFilter]);

  // Trigger Native Camera Input
  const handleOpenNativeCamera = (clue: Clue) => {
    setSelectedClue(clue);
    setCapturedPreview(null);
    setCompressionStats(null);
    setIsCapturing(true);
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const originalSize = formatBytes(file.size);

      // Perform instant client-side compression (< 150KB Base64)
      const compressed = await compressPhoto(file);
      const compressedSize = formatBytes(compressed.sizeBytes);

      setCapturedPreview(compressed.base64);
      setCompressionStats(`Compressed: ${originalSize} ➔ ${compressedSize} (< 150 KB)`);
    } catch (err: any) {
      await showAlert({
        title: 'Compression Error',
        message: 'Photo compression error: ' + (err.message || 'Unknown error'),
        variant: 'danger',
      });
    } finally {
      setIsCompressing(false);
      // Reset input value so same photo can be re-selected if retrying
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitPhoto = async () => {
    if (!selectedClue || !capturedPreview) return;

    try {
      setIsSubmitting(true);
      const coords = playerCoords || selectedClue.location || { latitude: 2.1944, longitude: 102.2491 };

      await gameService.submitCluePhoto(game.id, {
        gameId: game.id,
        teamId: currentTeam.id,
        teamName: currentTeam.name,
        teamColor: currentTeam.color,
        clueId: selectedClue.id,
        clueTitle: selectedClue.title,
        selfieBase64: capturedPreview,
        submittedBy: nickname,
        submissionCoords: coords,
        captureCoords: coords,
        awardedPoints: 0,
      });

      setSubmissionFeedback('Selfie submitted! Waiting for Game Master verification.');
      setIsCapturing(false);
      const submittedTitle = selectedClue.title;
      setSelectedClue(null);
      setCapturedPreview(null);

      await showAlert({
        title: 'Selfie Submitted!',
        message: `Your selfie for "${submittedTitle}" was uploaded successfully! Waiting for Game Master verification.`,
        variant: 'success',
      });

      setTimeout(() => setSubmissionFeedback(null), 5000);
    } catch (err: any) {
      await showAlert({
        title: 'Submission Failed',
        message: 'Submission failed: ' + (err.message || 'Please try again.'),
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full max-w-lg mx-auto bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* 1. Mobile Header & Scoreboard */}
      <header className="px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg z-30 gap-1.5">
        <div className="flex items-center gap-2 min-w-0 pr-1">
          <span
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ring-2 ring-white/40 shadow-sm shrink-0"
            style={{ background: currentTeam.color }}
          />
          <div className="min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-white tracking-tight leading-tight truncate">
              {currentTeam.name}
            </h1>
            <span className="text-[10px] text-slate-400 font-medium truncate block leading-tight mt-0.5">
              {t('player.playerLabel')} <strong className="text-slate-200">{nickname}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Points Badge */}
          <div className="bg-amber-500/15 border border-amber-500/30 px-2 sm:px-3 py-1 rounded-xl text-center shrink-0">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block leading-none">
              {t('player.score')}
            </span>
            <span className="text-sm sm:text-base font-black text-amber-300 leading-none">
              {currentTeam.score}
            </span>
          </div>

          {/* Small Leaderboard Rank Badge (e.g. 1/3) */}
          <div
            className="bg-rose-500/15 border border-rose-500/30 px-2 sm:px-2.5 py-1 rounded-xl text-center shrink-0"
            title={`${t('player.rank')}: ${teamRank}/${teams.length || 1}`}
          >
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest block leading-none">
              {t('player.rank')}
            </span>
            <span className="text-sm sm:text-base font-black text-rose-300 leading-none">
              {teamRank}/{teams.length || 1}
            </span>
          </div>

          {/* Clues Count Badge */}
          <div className="bg-emerald-500/15 border border-emerald-500/30 px-2 sm:px-2.5 py-1 rounded-xl text-center shrink-0">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block leading-none">
              {t('player.found')}
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-300 leading-none">
              {completedClueIds.size}/{clues.length}
            </span>
          </div>

          {/* Tour Guide Button */}
          <button
            type="button"
            onClick={() => {
              setTourStepIndex(0);
              setShowTour(true);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 shadow-sm cursor-pointer transition-colors shrink-0"
            title={t('player.tourTitle')}
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Floating Status / Feedback Banner */}
      {submissionFeedback && (
        <div className="absolute top-16 left-4 right-4 z-40 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{submissionFeedback}</span>
        </div>
      )}

      {/* 2. Main Content Area */}
      <main className="flex-1 min-h-0 w-full relative overflow-hidden pb-16">
        {activeTab === 'map' && (
          <div className="absolute inset-0 w-full h-full pb-16">
            <HuntMap
              zones={game.zones}
              clues={clues}
              teams={teams}
              currentTeamId={currentTeam.id}
              playerCoords={playerCoords}
              completedClueIds={Array.from(completedClueIds)}
              onSelectClue={handleOpenNativeCamera}
              className="h-full w-full rounded-none border-none"
              bottomOffsetClass="bottom-20"
            />
          </div>
        )}

        {activeTab === 'clues' && (
          <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 pb-28">
            {/* Zone Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedZoneFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedZoneFilter === 'all'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {t('player.allZones')} ({clues.length})
              </button>
              {game.zones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZoneFilter(z.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedZoneFilter === z.id
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: z.color }}
                  />
                  {z.name}
                </button>
              ))}
            </div>

            {/* Clue Cards Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
              {filteredClues.map((clue) => {
                const isDone = completedClueIds.has(clue.id);
                const isPending = pendingClueIds.has(clue.id);

                return (
                  <div
                    key={clue.id}
                    onClick={() => !isDone && handleOpenNativeCamera(clue)}
                    className={`p-3 rounded-2xl border transition-all flex items-center gap-3.5 relative overflow-hidden ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-800/40 opacity-80'
                        : isPending
                        ? 'bg-amber-950/20 border-amber-800/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 cursor-pointer shadow-lg'
                    }`}
                  >
                    {/* Clue Target Photo Thumbnail */}
                    <div
                      onClick={(e) => {
                        if (clue.targetPhotoBase64) {
                          e.stopPropagation();
                          setLightboxImage({
                            url: clue.targetPhotoBase64,
                            title: clue.title,
                            subtitle: clue.landmarkName || clue.zoneId,
                            badge: t('common.targetLandmarkBadge'),
                          });
                        }
                      }}
                      className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700 relative cursor-pointer group"
                      title={t('player.modalTapUncropped')}
                    >
                      {clue.targetPhotoBase64 ? (
                        <>
                          <img
                            src={clue.targetPhotoBase64}
                            alt={clue.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-5 h-5 text-white drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                      {isDone && (
                        <div className="absolute inset-0 bg-emerald-950/70 flex items-center justify-center">
                          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                          {clue.landmarkName || clue.zoneId}
                        </span>
                        <span className="text-xs font-black text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0">
                          +{clue.points} {t('player.pointsUnit')}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-100 truncate mb-1">
                        {clue.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {clue.hint || clue.description || t('player.noHint')}
                      </p>

                      {/* Status indicator */}
                      <div className="mt-2 flex items-center gap-2">
                        {isDone ? (
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('player.foundAndVerified')}
                          </span>
                        ) : isPending ? (
                          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> {t('player.pendingReview')}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5" /> {t('player.tapToSnap')}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isDone && <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="h-full overflow-y-auto p-3 sm:p-4 pb-28">
            <div className="text-center mb-4">
              <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-1" />
              <h2 className="text-lg font-black text-white">{t('player.leaderboardTitle')}</h2>
              <p className="text-[11px] text-slate-400">
                {t('player.leaderboardSubtitle')}
              </p>
            </div>

            <div className="space-y-2.5">
              {[...teams]
                .sort((a, b) => b.score - a.score)
                .map((tItem, idx) => {
                  const isMe = tItem.id === currentTeam.id;
                  const isExpanded = expandedLeaderboardTeams.has(tItem.id);
                  const memberCount = tItem.members?.length || 0;

                  return (
                    <div
                      key={tItem.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isMe
                          ? 'bg-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/5'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Team Card Header */}
                      <div
                        className="flex items-center justify-between cursor-pointer select-none"
                        onClick={() => toggleLeaderboardTeamExpand(tItem.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span
                            className={`font-black text-sm w-5 text-center ${
                              idx === 0
                                ? 'text-amber-400'
                                : idx === 1
                                ? 'text-slate-300'
                                : idx === 2
                                ? 'text-amber-600'
                                : 'text-slate-500'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <span
                            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/30 shrink-0"
                            style={{ background: tItem.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                              <span className="truncate">{tItem.name}</span>
                              {isMe && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                                  {t('player.youBadge')}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {t('player.cluesFoundCount', { count: tItem.completedClueIds?.length || 0 })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-base font-black text-amber-400 leading-none">
                              {tItem.score}
                            </span>
                            <span className="text-[10px] text-slate-500 block leading-none mt-0.5">
                              {t('player.pointsUnit')}
                            </span>
                          </div>

                          {/* Dropdown Toggle Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLeaderboardTeamExpand(tItem.id);
                            }}
                            className={`px-2 py-1 rounded-lg border transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
                              isExpanded
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            }`}
                            title={isExpanded ? 'Hide members' : 'View members'}
                          >
                            <Users className="w-3 h-3 text-amber-400" />
                            <span className="font-mono">{memberCount}</span>
                            <ChevronDown
                              className={`w-3 h-3 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-amber-400' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Drawer: Team Members */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between mb-2 px-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Users className="w-3 h-3 text-amber-400" />
                              <span>{t('player.squadMembers')} ({memberCount})</span>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {tItem.members?.filter((m) => m.isOnline !== false).length || 0} {t('player.online')}
                            </span>
                          </div>

                          {tItem.members && tItem.members.length > 0 ? (
                            <div className="space-y-1.5 mt-1">
                              {tItem.members.map((m) => {
                                const isOnline = m.isOnline !== false;
                                const isCurrentPlayer = m.nickname === nickname;
                                return (
                                  <div
                                    key={m.id || m.nickname}
                                    className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                      isCurrentPlayer
                                        ? 'bg-amber-500/10 border-amber-500/30'
                                        : 'bg-slate-950/70 border-slate-800/80'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          isOnline
                                            ? 'bg-emerald-400 ring-2 ring-emerald-400/30'
                                            : 'bg-slate-600'
                                        }`}
                                        title={isOnline ? t('player.online') : t('player.offline')}
                                      />
                                      <span className="font-medium text-slate-200 truncate">
                                        {m.nickname}
                                      </span>
                                      {isCurrentPlayer && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                                          {t('player.youBadge')}
                                        </span>
                                      )}
                                      {m.isLeader && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          {t('player.leader')}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`text-[10px] font-medium shrink-0 ${
                                        isOnline ? 'text-emerald-400' : 'text-slate-500'
                                      }`}
                                    >
                                      {isOnline ? t('player.online') : t('player.offline')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-2.5 text-[11px] text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60 mt-1">
                              {t('player.noMembers')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      {/* 3. Bottom Navigation Bar - Fixed & Locked to Screen Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-40 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-3 shadow-[0_-4px_25px_rgba(0,0,0,0.6)]">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all cursor-pointer rounded-xl ${
            activeTab === 'map'
              ? 'text-rose-500 font-bold bg-rose-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[11px] leading-tight">{t('player.navMap')}</span>
        </button>

        <button
          onClick={() => setActiveTab('clues')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all cursor-pointer rounded-xl relative ${
            activeTab === 'clues'
              ? 'text-rose-500 font-bold bg-rose-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <List className="w-5 h-5" />
            {clues.length > 0 && (
              <span className="absolute -top-1.5 -right-3.5 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-sm">
                {clues.length - completedClueIds.size}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight">{t('player.navClues')}</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all cursor-pointer rounded-xl ${
            activeTab === 'leaderboard'
              ? 'text-rose-500 font-bold bg-rose-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[11px] leading-tight">{t('player.navLeaderboard')}</span>
        </button>
      </nav>

      {/* 4. Camera Selfie Capture Modal */}
      {isCapturing && selectedClue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative max-h-[90dvh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => {
                setIsCapturing(false);
                setSelectedClue(null);
                setCapturedPreview(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                {t('player.modalChallenge')}
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">{selectedClue.title}</h2>
              <span className="text-xs text-emerald-400 font-bold">
                {t('player.modalReward', { points: selectedClue.points })}
              </span>
            </div>

            {/* Target Clue Photo */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('player.modalTargetLabel')}
                </label>
                {selectedClue.targetPhotoBase64 && (
                  <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                    <Maximize2 className="w-3 h-3" />
                    <span>{t('player.modalTapUncropped')}</span>
                  </span>
                )}
              </div>
              <div
                onClick={() => {
                  if (selectedClue.targetPhotoBase64) {
                    setLightboxImage({
                      url: selectedClue.targetPhotoBase64,
                      title: selectedClue.title,
                      subtitle: selectedClue.landmarkName || selectedClue.zoneId,
                      badge: t('common.targetLandmarkBadge'),
                    });
                  }
                }}
                className="w-full h-44 sm:h-48 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shadow-inner relative cursor-pointer group flex items-center justify-center"
                title={t('player.modalTapUncropped')}
              >
                {selectedClue.targetPhotoBase64 ? (
                  <>
                    <img
                      src={selectedClue.targetPhotoBase64}
                      alt={selectedClue.title}
                      className="w-full h-full object-contain p-1 group-hover:scale-[1.02] transition-transform"
                    />
                    <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm p-1.5 rounded-lg border border-slate-700 text-slate-300 group-hover:text-amber-400 transition-colors shadow">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                    {t('player.modalNoTargetImg')}
                  </div>
                )}
              </div>
              {selectedClue.hint && (
                <p className="text-xs text-amber-300/80 mt-1.5 flex items-center gap-1.5 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <HelpCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{t('player.hint')} {selectedClue.hint}</span>
                </p>
              )}
            </div>

            {/* Captured Selfie Preview or Shutter Trigger */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('player.modalSelfieLabel')}
                </label>
                {capturedPreview && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Maximize2 className="w-3 h-3" />
                    <span>{t('player.modalTapUncropped')}</span>
                  </span>
                )}
              </div>

              {capturedPreview ? (
                <div
                  onClick={() => {
                    setLightboxImage({
                      url: capturedPreview,
                      title: 'Your Team Submission Selfie',
                      subtitle: selectedClue.title,
                      badge: t('common.capturedSelfieBadge'),
                    });
                  }}
                  className="relative w-full h-48 sm:h-52 rounded-xl overflow-hidden bg-slate-950 border-2 border-emerald-500 shadow-md cursor-pointer group flex items-center justify-center"
                  title={t('player.modalTapUncropped')}
                >
                  <img
                    src={capturedPreview}
                    alt="Captured selfie"
                    className="w-full h-full object-contain p-1 group-hover:scale-[1.02] transition-transform"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm p-1.5 rounded-lg border border-slate-700 text-emerald-300 shadow">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 backdrop-blur-md p-2 rounded-lg text-center">
                    <span className="text-[11px] font-mono text-emerald-400 block font-bold">
                      {t('player.modalReadySubmit')}
                    </span>
                    {compressionStats && (
                      <span className="text-[10px] text-slate-300 block">
                        {compressionStats}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-5 sm:p-6 text-center hover:border-rose-500 transition-colors">
                  <Camera className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-200">
                    {t('player.modalCapturePrompt')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t('player.modalDirectCamera')}
                  </p>
                </div>
              )}
            </div>

            {/* Hidden Native Camera File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileCapture}
              className="hidden"
            />

            {/* Action Buttons */}
            <div className="space-y-2">
              {!capturedPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressing}
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span>{isCompressing ? 'Compressing Photo...' : t('player.modalOpenCamBtn')}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t('player.modalRetakeBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitPhoto}
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-3 rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isSubmitting ? (
                      <span>{t('player.modalSubmittingBtn')}</span>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>{t('player.modalSubmitBtn')} (+{selectedClue.points})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
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

      {/* Interactive Onboarding Tour Guide for Player */}
      <InteractiveTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        tourName={language === 'zh' ? '马六甲寻宝向导' : 'Player Scavenger Hunt'}
        steps={playerTourSteps}
        currentStepIndex={tourStepIndex}
        onStepChange={setTourStepIndex}
        onTabChange={(tabKey) => setActiveTab(tabKey)}
        storageKey="melaka_hunt_seen_player_tour"
      />
    </div>
  );
};
