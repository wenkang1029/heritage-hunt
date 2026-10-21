/**
 * Melaka Heritage Hunt - Mobile-First Player Experience
 * Path: src/components/Player/PlayerHuntView.tsx
 *
 * Provides real-time map, clue cards, native camera selfie capture, instant client compression, and celebratory confetti.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import type {
  Game,
  Team,
  Clue,
  Submission,
  GeoCoordinate,
  BroadcastMessage,
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
  ExternalLink,
  ChevronDown,
  Users,
  Crosshair,
  Flame,
  Megaphone,
  Bell,
  XCircle,
  Pause,
} from 'lucide-react';
import {
  calculateHaversineDistance,
  calculateBearing,
  getCompassDirection,
  getRadarProximityStage,
  formatDistance,
} from '../../utils/haversine.ts';
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

interface AdventureCompassProps {
  bearing: number;
  directionZh: string;
  className?: string;
}

const AdventureCompass: React.FC<AdventureCompassProps> = ({ bearing, directionZh, className = 'w-9 h-9' }) => {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      title={`${directionZh} (${Math.round(bearing)}°)`}
    >
      <svg viewBox="0 0 44 44" className="w-full h-full drop-shadow-md select-none">
        {/* Outer Ring & Bezel */}
        <circle cx="22" cy="22" r="20" fill="#090d16" stroke="#334155" strokeWidth="2" />
        <circle cx="22" cy="22" r="16.5" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
        {/* Cardinal Tick marks */}
        <line x1="22" y1="3" x2="22" y2="6.5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="41" y1="22" x2="37.5" y2="22" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="22" y1="41" x2="22" y2="37.5" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="3" y1="22" x2="6.5" y2="22" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
        {/* Cardinal Lettering: 北 (N) in gold, 东 (E), 南 (S), 西 (W) */}
        <text x="22" y="10.8" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#fbbf24">北</text>
        <text x="35" y="23.8" textAnchor="middle" fontSize="4.6" fontWeight="bold" fill="#94a3b8">东</text>
        <text x="22" y="37" textAnchor="middle" fontSize="4.6" fontWeight="bold" fill="#94a3b8">南</text>
        <text x="9" y="23.8" textAnchor="middle" fontSize="4.6" fontWeight="bold" fill="#94a3b8">西</text>
        {/* Dynamic Rotating 3D Needle */}
        <g style={{ transform: `rotate(${bearing}deg)`, transformOrigin: '22px 22px', transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          {/* Target Pointer (Red Arrow with dual-tone lighting) */}
          <polygon points="22,6.5 25.5,22 22,20" fill="#ef4444" />
          <polygon points="22,6.5 18.5,22 22,20" fill="#b91c1c" />
          {/* Tail Pointer (Silver/Slate with dual-tone shading) */}
          <polygon points="22,35.5 25.5,22 22,24" fill="#94a3b8" />
          <polygon points="22,35.5 18.5,22 22,24" fill="#64748b" />
          {/* Center Brass Ring & Pivot */}
          <circle cx="22" cy="22" r="3.2" fill="#d97706" />
          <circle cx="22" cy="22" r="1.8" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
};

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

  // Web Audio chime generator (self-contained, zero asset dependency)
  const playBroadcastChime = useCallback((type: 'info' | 'alert' | 'urgent' = 'info') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.connect(ctx.destination);
      osc1.connect(gain);
      osc2.connect(gain);

      if (type === 'urgent') {
        osc1.frequency.setValueAtTime(880, now);
        osc2.frequency.setValueAtTime(1174.66, now + 0.15);
      } else if (type === 'alert') {
        osc1.frequency.setValueAtTime(659.25, now);
        osc2.frequency.setValueAtTime(880, now + 0.12);
      } else {
        osc1.frequency.setValueAtTime(523.25, now);
        osc2.frequency.setValueAtTime(659.25, now + 0.12);
      }

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } catch {
      // AudioContext may be restricted before user interaction
    }
  }, []);

  // Broadcasts Subscription (Option B) & Active Alert State (Option A)
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState<boolean>(false);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('melaka_hunt_dismissed_broadcast_id');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const unsub = gameService.subscribeToBroadcasts(game.id, (bList) => {
      setBroadcasts(bList);
    });
    return () => unsub();
  }, [game.id]);

  // Audio / Haptic alert when a new active broadcast arrives
  const lastAlertedBroadcastId = useRef<string | null>(null);
  useEffect(() => {
    if (game.activeBroadcast && game.activeBroadcast.id !== lastAlertedBroadcastId.current) {
      lastAlertedBroadcastId.current = game.activeBroadcast.id;
      playBroadcastChime(game.activeBroadcast.type);
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {
        // ignore
      }
    }
  }, [game.activeBroadcast, playBroadcastChime]);

  const handleDismissActiveAlert = (id: string) => {
    setDismissedBroadcastId(id);
    try {
      localStorage.setItem('melaka_hunt_dismissed_broadcast_id', id);
    } catch {
      // ignore
    }
  };

  const isBroadcastDismissed = game.activeBroadcast?.id === dismissedBroadcastId;
  const hasActiveBroadcastAlert = !!game.activeBroadcast && !isBroadcastDismissed;

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
          title: '1. 寻宝地图与探险家雷达',
          description:
            '彩色多边形区域划定了鸡场街、荷兰红屋等各大历史区。为保障真实寻宝乐趣，地图已开启探险家模式（隐藏所有大头针）。请锁定目标线索，跟随雷达方向与距离探索；进入 20 米搜寻圈将触发雷达高能提醒！',
          icon: <MapPin className="w-5 h-5 text-rose-500" />,
          badge: '第2步：探险家地图',
          tips: '保持手机 GPS 定位开启。当步入目标 20 米内，手机将震动并提示您对照照片用双眼寻找建筑细节。',
          tabKey: 'map',
        },
        {
          id: 'player-clues',
          title: '2. 寻宝线索与目标锁定',
          description:
            '切换到【线索】标签页查看历史目标。点击【🎯 锁定追踪】可将目标固定到顶部雷达。每张卡片均标有积分奖励、寻找提示与参考照片。点击任意照片可查看高清无裁切大图！',
          icon: <List className="w-5 h-5 text-amber-400" />,
          badge: '第3步：线索锁定',
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
        title: '1. Hunt Map & Explorer Radar',
        description:
          'Color-coded polygon zones outline Melaka’s historic districts. To preserve real exploration, Explorer Mode hides exact pins! Lock a target clue to activate your proximity radar with bearing direction & distance. Enter within 20m to trigger the pulse alert!',
        icon: <MapPin className="w-5 h-5 text-rose-500" />,
        badge: 'Step 2: Explorer Map',
        tips: 'Keep GPS enabled. When within 20m of your target, your phone pulses and prompts you to match the photo with your eyes.',
        tabKey: 'map',
      },
      {
        id: 'player-clues',
        title: '2. Clues & Target Tracking',
        description:
          'Browse historic targets in the Clues tab. Tap [🎯 Lock & Track Clue] to engage the radar. Each card shows points, exploration hints, and a reference photo. Tap any photo to view in full resolution!',
        icon: <List className="w-5 h-5 text-amber-400" />,
        badge: 'Step 3: Clue Tracking',
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

  const latestSubByClue = useMemo(() => {
    const map = new Map<string, Submission>();
    teamSubmissions.forEach((s) => {
      const existing = map.get(s.clueId);
      if (!existing || (Number(s.submittedAt) || 0) > (Number(existing.submittedAt) || 0)) {
        map.set(s.clueId, s);
      }
    });
    return map;
  }, [teamSubmissions]);

  const isGameLobby = game.status === 'lobby' || game.status === 'draft';
  const isGamePaused = game.status === 'paused';
  const isGameEnded = game.status === 'ended' || game.status === 'completed';

  const rallyDistanceMeters = useMemo(() => {
    if (!game.rallyPoint?.location || !playerCoords) return null;
    return calculateHaversineDistance(playerCoords, game.rallyPoint.location);
  }, [game.rallyPoint, playerCoords]);

  const rallyBearing = useMemo(() => {
    if (!game.rallyPoint?.location || !playerCoords) return 0;
    return calculateBearing(playerCoords, game.rallyPoint.location);
  }, [game.rallyPoint, playerCoords]);

  const rallyDirectionZh = useMemo(() => {
    return getCompassDirection(rallyBearing).directionZh;
  }, [rallyBearing]);

  // Sort State for Clues
  const [sortBy, setSortBy] = useState<'distance' | 'default'>('distance');

  // Tracked Clue & Scavenger Radar State
  const [trackedClueId, setTrackedClueId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('melaka_hunt_tracked_clue_id');
    } catch {
      return null;
    }
  });

  const [autoRadarIndex, setAutoRadarIndex] = useState<number>(0);

  useEffect(() => {
    try {
      if (trackedClueId) {
        localStorage.setItem('melaka_hunt_tracked_clue_id', trackedClueId);
      } else {
        localStorage.removeItem('melaka_hunt_tracked_clue_id');
      }
    } catch {
      // ignore
    }
  }, [trackedClueId]);

  // Uncompleted clues with coordinates sorted by distance to player
  const nearestUncompletedClues = useMemo(() => {
    if (!playerCoords) return [];
    return clues
      .filter((c) => !completedClueIds.has(c.id) && c.location)
      .map((c) => ({
        clue: c,
        distance: calculateHaversineDistance(playerCoords, c.location!),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [clues, completedClueIds, playerCoords]);

  // Clues within <= 100m for the highlight banner on the Clues tab
  const nearbyCluesUnder100m = useMemo(() => {
    if (!playerCoords) return [];
    return nearestUncompletedClues
      .filter((item) => item.distance <= 100)
      .map((item) => item.clue);
  }, [nearestUncompletedClues, playerCoords]);

  // Active Tracked Clue: manually locked OR auto-tracked from top nearest
  const isAutoTracking = !trackedClueId;
  const trackedClue = useMemo(() => {
    if (trackedClueId) {
      return clues.find((c) => c.id === trackedClueId) || null;
    }
    if (nearestUncompletedClues.length === 0) return null;
    const safeIdx = autoRadarIndex % Math.min(nearestUncompletedClues.length, 5);
    return nearestUncompletedClues[safeIdx]?.clue || null;
  }, [trackedClueId, clues, nearestUncompletedClues, autoRadarIndex]);

  // Filtered and Sorted clues for the Clues Tab
  const filteredClues = useMemo(() => {
    let list =
      selectedZoneFilter === 'all'
        ? [...clues]
        : clues.filter((c) => c.zoneId === selectedZoneFilter);

    if (sortBy === 'distance' && playerCoords) {
      list.sort((a, b) => {
        const aDone = completedClueIds.has(a.id);
        const bDone = completedClueIds.has(b.id);
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;

        const distA = a.location ? calculateHaversineDistance(playerCoords, a.location) : 999999;
        const distB = b.location ? calculateHaversineDistance(playerCoords, b.location) : 999999;
        return distA - distB;
      });
    }
    return list;
  }, [clues, selectedZoneFilter, sortBy, playerCoords, completedClueIds]);

  // Radar Proximity for Tracked Clue
  const trackedDistance = useMemo(() => {
    if (!playerCoords || !trackedClue?.location) return null;
    return calculateHaversineDistance(playerCoords, trackedClue.location);
  }, [playerCoords, trackedClue]);

  const trackedBearing = useMemo(() => {
    if (!playerCoords || !trackedClue?.location) return null;
    return calculateBearing(playerCoords, trackedClue.location);
  }, [playerCoords, trackedClue]);

  const compassHeading = useMemo(() => {
    if (trackedBearing === null) return null;
    return getCompassDirection(trackedBearing, language as 'en' | 'zh');
  }, [trackedBearing, language]);

  const radarStage = useMemo(() => {
    if (trackedDistance === null) return 'far';
    return getRadarProximityStage(trackedDistance);
  }, [trackedDistance]);

  // Haptic feedback vibration when entering target range (<20m)
  const hasVibratedForClue = useRef<string | null>(null);
  useEffect(() => {
    if (radarStage === 'target' && trackedClue?.id && hasVibratedForClue.current !== trackedClue.id) {
      hasVibratedForClue.current = trackedClue.id;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {
        // ignore
      }
    }
  }, [radarStage, trackedClue?.id]);

  // Passive Proximity Radar: Detect closest untracked uncompleted clue within <= 20m
  const nearbyPassiveClue = useMemo(() => {
    if (!playerCoords) return null;
    let closest: { clue: Clue; distance: number } | null = null;

    for (const c of clues) {
      if (completedClueIds.has(c.id) || c.id === trackedClue?.id || !c.location) continue;
      const d = calculateHaversineDistance(playerCoords, c.location);
      if (d <= 20) {
        if (!closest || d < closest.distance) {
          closest = { clue: c, distance: d };
        }
      }
    }
    return closest;
  }, [playerCoords, clues, completedClueIds, trackedClue?.id]);

  // Highlight state for auto-scrolled clue card in the Clues tab
  const [highlightedClueId, setHighlightedClueId] = useState<string | null>(null);

  // Helper to scroll smoothly to a specific clue card in the Clues tab
  const scrollToClueCard = useCallback((clueId: string) => {
    // Delay ensures tab switch and virtual rendering are settled
    setTimeout(() => {
      const el = document.getElementById(`clue-card-${clueId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedClueId(clueId);
        setTimeout(() => {
          setHighlightedClueId((prev) => (prev === clueId ? null : prev));
        }, 2500);
      }
    }, 120);
  }, []);

  // Handle bottom navigation tab switching with auto-scroll to selected clue
  const handleNavigateTab = useCallback((tab: 'map' | 'clues' | 'leaderboard') => {
    if (tab === 'clues' && trackedClue) {
      if (selectedZoneFilter !== 'all' && selectedZoneFilter !== trackedClue.zoneId) {
        setSelectedZoneFilter('all');
      }
      scrollToClueCard(trackedClue.id);
    }
    setActiveTab(tab);
  }, [trackedClue, selectedZoneFilter, scrollToClueCard]);

  // When already on the 'clues' tab, changing the selected/tracked clue card on the Floating Radar Card
  // automatically scrolls the page to that respective clue card
  const prevTrackedClueIdRef = useRef<string | null>(trackedClue?.id || null);
  useEffect(() => {
    if (activeTab === 'clues' && trackedClue && trackedClue.id !== prevTrackedClueIdRef.current) {
      scrollToClueCard(trackedClue.id);
    }
    prevTrackedClueIdRef.current = trackedClue?.id || null;
  }, [activeTab, trackedClue, scrollToClueCard]);

  // Switch to the next available nearby clue from the Floating Radar Card
  const handleSwitchNextRadarTarget = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!nearestUncompletedClues.length) return;
    const nextIdx = (autoRadarIndex + 1) % Math.min(nearestUncompletedClues.length, 5);
    setAutoRadarIndex(nextIdx);
    const target = nearestUncompletedClues[nextIdx]?.clue;
    if (target && activeTab === 'clues') {
      if (selectedZoneFilter !== 'all' && selectedZoneFilter !== target.zoneId) {
        setSelectedZoneFilter('all');
      }
      scrollToClueCard(target.id);
    }
  }, [nearestUncompletedClues, autoRadarIndex, activeTab, selectedZoneFilter, scrollToClueCard]);

  // Reset manual locked tracking back to automatic radar
  const handleResetAutoRadar = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTrackedClueId(null);
    if (activeTab === 'clues' && nearestUncompletedClues[0]?.clue) {
      const topClue = nearestUncompletedClues[0].clue;
      if (selectedZoneFilter !== 'all' && selectedZoneFilter !== topClue.zoneId) {
        setSelectedZoneFilter('all');
      }
      scrollToClueCard(topClue.id);
    }
  }, [activeTab, nearestUncompletedClues, selectedZoneFilter, scrollToClueCard]);

  // Direct action from Floating Radar Card to jump directly to Clues tab and scroll to card
  const handleJumpToClueInList = useCallback((clue: Clue) => {
    if (selectedZoneFilter !== 'all' && selectedZoneFilter !== clue.zoneId) {
      setSelectedZoneFilter('all');
    }
    setActiveTab('clues');
    scrollToClueCard(clue.id);
  }, [selectedZoneFilter, scrollToClueCard]);

  // Trigger Native Camera Input with Lifecycle Checks
  const handleOpenNativeCamera = (clue: Clue) => {
    if (isGameLobby) {
      showAlert({
        title: language === 'zh' ? '比赛尚未开始' : 'Game Not Started Yet',
        message: language === 'zh' ? '请等待主理人开赛哨声，开赛后方可打卡拍照！' : 'Please wait for the Game Master to officially start the game before submitting photos!',
        variant: 'warning',
      });
      return;
    }
    if (isGamePaused) {
      showAlert({
        title: language === 'zh' ? '比赛暂停中' : 'Game Paused',
        message: language === 'zh' ? '打卡提交暂时冻结，请等待裁判恢复比赛！' : 'Photo submissions are currently frozen. Please follow event organizers’ instructions.',
        variant: 'warning',
      });
      return;
    }
    if (isGameEnded) {
      showAlert({
        title: language === 'zh' ? '比赛已结束' : 'Game Concluded',
        message: language === 'zh' ? '打卡通道已关闭，请查看最终积分排行榜！' : 'Submissions are closed. Please view the final leaderboard!',
        variant: 'info',
      });
      return;
    }

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

          {/* GM Announcements & Broadcasts Bell (Option B) */}
          <button
            type="button"
            onClick={() => setShowAnnouncementsModal(true)}
            className={`relative p-1.5 sm:p-2 rounded-xl border shadow-sm cursor-pointer transition-all shrink-0 ${
              hasActiveBroadcastAlert
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={t('player.announcementsBtn')}
          >
            <Bell className={`w-4 h-4 ${hasActiveBroadcastAlert ? 'text-amber-400 animate-bounce' : ''}`} />
            {broadcasts.length > 0 && (
              <span
                className={`absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                  hasActiveBroadcastAlert
                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                    : 'bg-slate-700 text-slate-200 border border-slate-600'
                }`}
              >
                {broadcasts.length}
              </span>
            )}
          </button>

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

      {/* Game Lifecycle Banners */}
      {isGameLobby && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 flex items-center justify-center gap-1.5 font-bold shrink-0">
          <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          <span>{t('player.gameLobbyBanner')}</span>
        </div>
      )}
      {isGamePaused && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-3 py-1.5 text-xs text-yellow-300 flex items-center justify-center gap-1.5 font-bold shrink-0">
          <Pause className="w-3.5 h-3.5 text-yellow-400" />
          <span>{t('player.gamePausedBanner')}</span>
        </div>
      )}
      {isGameEnded && game.rallyPoint ? (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/50 p-2.5 sm:p-3 shadow-xl flex flex-col gap-2 shrink-0 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-xl shrink-0 select-none">🏁</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                    {t('player.rallyBannerTitle')}
                  </span>
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                    {t('player.rallyAssembleBadge')}
                  </span>
                </div>
                <h3 className="text-sm font-black text-white truncate mt-0.5">
                  🚩 {game.rallyPoint.name}
                </h3>
                {game.rallyPoint.note && (
                  <p className="text-[11px] text-amber-200/90 mt-0.5 leading-snug">
                    {game.rallyPoint.note}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold cursor-pointer transition-colors shrink-0"
            >
              {language === 'zh' ? '最终榜单 ➔' : 'Leaderboard ➔'}
            </button>
          </div>

          {/* Compass & Google Maps Action */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-500/20">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <AdventureCompass
                bearing={rallyBearing}
                directionZh={rallyDirectionZh}
                className="w-7 h-7 shrink-0"
              />
              <div className="leading-tight">
                <span className="block text-slate-300 text-[10px]">
                  {rallyDirectionZh} ({Math.round(rallyBearing)}°)
                </span>
                <span className="text-amber-400 font-black text-xs">
                  {rallyDistanceMeters !== null ? `~${formatDistance(rallyDistanceMeters)}` : '--'}
                </span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${game.rallyPoint.location.latitude},${game.rallyPoint.location.longitude}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t('player.openInGoogleMaps')}</span>
              <ExternalLink className="w-3 h-3 text-emerald-200" />
            </a>
          </div>
        </div>
      ) : isGameEnded ? (
        <div className="bg-purple-950/70 border-b border-purple-500/40 px-3 py-1.5 text-xs text-purple-200 flex items-center justify-between font-bold shrink-0">
          <span className="flex items-center gap-1.5">
            <span>🏁</span>
            <span>{t('player.gameEndedBanner')}</span>
          </span>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer shadow-sm transition-colors"
          >
            {language === 'zh' ? '查看排行榜 ➔' : 'Leaderboard ➔'}
          </button>
        </div>
      ) : null}

      {/* Live GM Active Broadcast Slide-Down Alert (Option A) */}
      {game.activeBroadcast && !isBroadcastDismissed && (
        <div
          className={`relative z-40 px-3 sm:px-4 py-2.5 border-b shadow-xl flex items-center justify-between gap-3 text-xs animate-slideDown ${
            game.activeBroadcast.type === 'urgent'
              ? 'bg-gradient-to-r from-rose-950/95 via-rose-900/95 to-slate-950 border-rose-500/60 text-rose-200'
              : game.activeBroadcast.type === 'alert'
              ? 'bg-gradient-to-r from-amber-950/95 via-amber-900/95 to-slate-950 border-amber-500/60 text-amber-200'
              : 'bg-gradient-to-r from-sky-950/95 via-sky-900/95 to-slate-950 border-sky-500/60 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                game.activeBroadcast.type === 'urgent'
                  ? 'bg-rose-500/20 text-rose-400 animate-ping'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/40 border border-white/10">
                  {game.activeBroadcast.type}
                </span>
                <span className="text-[10px] text-slate-300 font-bold truncate">
                  {game.activeBroadcast.sender || 'Game Master'}
                </span>
              </div>
              <p className="text-white font-semibold text-xs truncate mt-0.5">
                {game.activeBroadcast.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAnnouncementsModal(true)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold cursor-pointer transition-colors"
            >
              {language === 'zh' ? '查看' : 'View'}
            </button>
            <button
              type="button"
              onClick={() => handleDismissActiveAlert(game.activeBroadcast!.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              title={t('player.dismissAlert')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
              bottomOffsetClass={trackedClue ? 'bottom-40' : 'bottom-20'}
              hideCluePins={true}
              trackedClue={trackedClue}
              rallyPoint={game.rallyPoint}
            />
          </div>
        )}

        {activeTab === 'clues' && (
          <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 pb-28">
            {/* 📍 Right Beside You (<100m) Highlight Section */}
            {playerCoords && nearbyCluesUnder100m.length > 0 && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-500/40 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      {t('player.nearbySectionTitle')}
                    </h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {nearbyCluesUnder100m.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[150px] text-right">
                    {t('player.nearbySectionSubtitle')}
                  </span>
                </div>

                {/* Horizontal Scroll Carousel */}
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {nearbyCluesUnder100m.map((c) => {
                    const dist = calculateHaversineDistance(playerCoords, c.location!);
                    return (
                      <div
                        key={`nearby-${c.id}`}
                        onClick={() => handleOpenNativeCamera(c)}
                        className="w-44 shrink-0 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400 cursor-pointer transition-all shadow-md group flex flex-col justify-between"
                      >
                        <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-800 mb-2 relative">
                          {c.targetPhotoBase64 ? (
                            <img
                              src={c.targetPhotoBase64}
                              alt={c.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                              <Camera className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-[10px] font-black text-amber-400">
                            +{c.points}
                          </div>
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-emerald-950/90 backdrop-blur-sm border border-emerald-600/50 text-[10px] font-bold text-emerald-300 flex items-center gap-1 shadow">
                            <span>📍</span>
                            <span>{dist}m {dist <= 25 ? `· ${t('player.distancePillVeryClose')}` : ''}</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white truncate mb-0.5">{c.title}</h4>
                          <p className="text-[10px] text-slate-400 truncate mb-2">
                            {c.landmarkName || c.zoneId}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="w-full py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow cursor-pointer transition-colors"
                        >
                          <Camera className="w-3 h-3" />
                          <span>{t('player.snapNowBtn')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zone Filter & Distance Sort Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-1.5 shrink-0">
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

              {/* Distance Sort Toggle */}
              {playerCoords && (
                <button
                  onClick={() => setSortBy((prev) => (prev === 'distance' ? 'default' : 'distance'))}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    sortBy === 'distance'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                  title={sortBy === 'distance' ? t('player.sortByDistance') : t('player.sortByZone')}
                >
                  <span>📍</span>
                  <span className="text-[11px]">{sortBy === 'distance' ? t('player.sortByDistance') : t('player.sortByZone')}</span>
                </button>
              )}
            </div>

            {/* Clue Cards Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
              {filteredClues.map((clue) => {
                const isDone = completedClueIds.has(clue.id);
                const isPending = pendingClueIds.has(clue.id);
                const latestSub = latestSubByClue.get(clue.id);
                const isRejected = !isDone && !isPending && latestSub?.status === 'rejected';

                return (
                  <div
                    key={clue.id}
                    id={`clue-card-${clue.id}`}
                    onClick={() => !isDone && handleOpenNativeCamera(clue)}
                    className={`p-3 rounded-2xl border transition-all duration-300 flex items-center gap-3.5 relative overflow-hidden ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-800/40 opacity-85'
                        : isPending
                        ? 'bg-amber-950/20 border-amber-800/40'
                        : isRejected
                        ? 'bg-rose-950/25 border-rose-800/50'
                        : highlightedClueId === clue.id
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.01]'
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

                      {/* Status indicator & Track Button */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDone ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {t('player.foundAndVerified')}
                              </span>
                              <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded font-black">
                                {t('player.scoreEarned', { points: latestSub?.awardedPoints || clue.points })}
                              </span>
                            </div>
                          ) : isPending ? (
                            <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 animate-pulse" /> {t('player.pendingReview')}
                            </span>
                          ) : isRejected ? (
                            <div className="flex flex-col gap-1 w-full">
                              <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> {t('player.needsRetakeBadge')}
                              </span>
                              {latestSub?.rejectionReason && (
                                <span className="text-[10px] text-rose-300 font-medium">
                                  {t('player.gmRejectReason', { reason: latestSub.rejectionReason })}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenNativeCamera(clue);
                                }}
                                className="mt-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1 px-2.5 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow w-fit"
                              >
                                <Camera className="w-3 h-3" />
                                <span>{t('player.retakeBtn')}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5" /> {t('player.tapToSnap')}
                            </span>
                          )}
                        </div>

                        {!isDone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {playerCoords && clue.location && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                📍 {calculateHaversineDistance(playerCoords, clue.location)}m
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackedClueId((prev) => (prev === clue.id ? null : clue.id));
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                trackedClueId === clue.id
                                  ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400'
                                  : isAutoTracking && trackedClue?.id === clue.id
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                              }`}
                            >
                              <Crosshair className="w-3 h-3" />
                              <span>
                                {trackedClueId === clue.id
                                  ? t('player.trackingBadge')
                                  : isAutoTracking && trackedClue?.id === clue.id
                                  ? '📍 自动感知中'
                                  : t('player.trackClueBtn')}
                              </span>
                            </button>
                          </div>
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

      {/* Passive Radar Ping (Surprise uncompleted clue <= 20m nearby) */}
      {nearbyPassiveClue && (
        <div className="fixed top-18 left-3 right-3 max-w-lg mx-auto z-40 animate-bounce">
          <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 backdrop-blur-xl border border-amber-300 shadow-2xl flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <span className="text-xl shrink-0">💡</span>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider block leading-none text-amber-950">
                  {t('player.passivePingTitle')}
                </span>
                <span className="text-xs font-bold truncate block leading-tight mt-0.5">
                  {t('player.passivePingDesc', {
                    meters: nearbyPassiveClue.distance,
                    title: nearbyPassiveClue.clue.title,
                  })}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setTrackedClueId(nearbyPassiveClue.clue.id);
                handleOpenNativeCamera(nearbyPassiveClue.clue);
              }}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-black px-3 py-1.5 rounded-xl text-xs shrink-0 cursor-pointer transition-all shadow"
            >
              {t('player.passivePingAction')}
            </button>
          </div>
        </div>
      )}

      {/* Floating Scavenger Radar HUD */}
      {trackedClue && (
        <div className="fixed bottom-18 left-0 right-0 max-w-lg mx-auto px-3 z-40 pointer-events-none">
          <div
            className={`pointer-events-auto p-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all ${
              radarStage === 'target'
                ? 'bg-emerald-950/95 border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/50 animate-pulse'
                : radarStage === 'near'
                ? 'bg-slate-900/95 border-orange-500/80 shadow-orange-500/20'
                : radarStage === 'medium'
                ? 'bg-slate-900/95 border-amber-500/80 shadow-amber-500/20'
                : 'bg-slate-900/95 border-slate-700/80 shadow-slate-950/60'
            }`}
          >
            {/* Header: Target Title + Points Badge + Target Switcher / Reset Button */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/80">
              <div
                onClick={() => handleJumpToClueInList(trackedClue)}
                className="flex items-center gap-1.5 min-w-0 cursor-pointer group"
                title={language === 'zh' ? '点击在线索列表中查看' : 'Click to view in Clues list'}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    radarStage === 'target'
                      ? 'bg-emerald-400 animate-ping'
                      : radarStage === 'near'
                      ? 'bg-orange-400 animate-pulse'
                      : radarStage === 'medium'
                      ? 'bg-amber-400'
                      : 'bg-blue-400'
                  }`}
                />
                <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate leading-tight">
                  {trackedClue.title}
                </h4>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  +{trackedClue.points}
                </span>
                {radarStage === 'target' && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 animate-bounce shrink-0">
                    &lt; 20m
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isAutoTracking && nearestUncompletedClues.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSwitchNextRadarTarget}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    title={t('player.nextNearbyClue')}
                  >
                    <span>{autoRadarIndex % Math.min(nearestUncompletedClues.length, 5) + 1}/{Math.min(nearestUncompletedClues.length, 5)}</span>
                    <span className="text-[9px]">切换 ➔</span>
                  </button>
                )}
                {!isAutoTracking && (
                  <button
                    type="button"
                    onClick={handleResetAutoRadar}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    title="恢复自动感知"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                    <span>恢复自动</span>
                  </button>
                )}
              </div>
            </div>

            {/* Target Info: Clue Thumbnail + Adventure Compass & Chinese Direction Guidance + Action Button */}
            <div className="flex items-center gap-3">
              {/* Clue Thumbnail */}
              <div
                onClick={() => {
                  if (trackedClue.targetPhotoBase64) {
                    setLightboxImage({
                      url: trackedClue.targetPhotoBase64,
                      title: trackedClue.title,
                      subtitle: trackedClue.landmarkName || trackedClue.zoneId,
                      badge: t('common.targetLandmarkBadge'),
                    });
                  }
                }}
                className="w-13 h-13 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700 relative cursor-pointer group shadow"
                title={t('player.modalTapUncropped')}
              >
                {trackedClue.targetPhotoBase64 ? (
                  <>
                    <img
                      src={trackedClue.targetPhotoBase64}
                      alt={trackedClue.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Real Adventure Compass + Chinese Direction Guidance */}
              <div
                onClick={() => handleJumpToClueInList(trackedClue)}
                className="flex-1 min-w-0 cursor-pointer group"
                title={language === 'zh' ? '点击在线索列表中查看' : 'Click to view in Clues list'}
              >
                <div className="flex items-center gap-2.5">
                  {trackedBearing !== null && compassHeading && (
                    <AdventureCompass
                      bearing={compassHeading.bearingDeg}
                      directionZh={compassHeading.directionZh}
                      className="w-9 h-9 group-hover:scale-105 transition-transform"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    {trackedDistance !== null && compassHeading ? (
                      <>
                        {radarStage === 'target' ? (
                          <div className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{language === 'zh' ? '目标就在身边！(<20m)' : 'Target in Range (<20m)!'}</span>
                          </div>
                        ) : radarStage === 'near' ? (
                          <div>
                            <div className="text-xs font-black text-orange-400 group-hover:text-amber-300 transition-colors flex items-center gap-1 truncate">
                              <Flame className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                              <span>{language === 'zh' ? `正在接近！朝${compassHeading.label}` : `Closing in! Head ${compassHeading.code}`}</span>
                            </div>
                            <div className="text-[11px] text-amber-300 font-mono font-medium mt-0.5">
                              {language === 'zh' ? `约 ${trackedDistance} 米 (${compassHeading.bearingDeg}°)` : `~${trackedDistance} m (${compassHeading.bearingDeg}°)`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs font-black text-white group-hover:text-amber-300 transition-colors truncate">
                              {language === 'zh' ? `朝【${compassHeading.directionZh}】前行` : `Head ${compassHeading.code} (${compassHeading.label})`}
                            </div>
                            <div className="text-[11px] text-amber-300 font-mono font-medium mt-0.5">
                              {language === 'zh' ? `约 ${trackedDistance} 米 (${compassHeading.bearingDeg}°)` : `~${trackedDistance} m (${compassHeading.bearingDeg}°)`}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>{language === 'zh' ? '正在获取 GPS 定位...' : 'Acquiring GPS...'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                {radarStage === 'target' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenNativeCamera(trackedClue)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 cursor-pointer transition-all animate-bounce"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t('player.snapNowBtn')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenNativeCamera(trackedClue)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold p-2.5 rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors border border-slate-700 shadow"
                    title={t('player.modalOpenCamBtn')}
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Prompt for Target Stage */}
            {radarStage === 'target' && (
              <p className="text-[11px] text-emerald-300/90 font-medium mt-2 pt-2 border-t border-emerald-800/40 leading-snug">
                {t('player.radarLookAroundNotice')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. Bottom Navigation Bar - Fixed & Locked to Screen Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-40 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-3 shadow-[0_-4px_25px_rgba(0,0,0,0.6)]">
        <button
          onClick={() => handleNavigateTab('map')}
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
          onClick={() => handleNavigateTab('clues')}
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
          onClick={() => handleNavigateTab('leaderboard')}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md">
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

            {/* Cultural & Religious Respect Notice */}
            <div className="mb-3.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2 shadow-sm">
              <span className="text-base shrink-0 select-none">🕌</span>
              <div className="leading-tight">
                <strong className="block text-amber-300 font-bold mb-0.5">
                  {t('player.respectNoticeTitle')}
                </strong>
                <p className="text-[11px] text-amber-200/90 leading-snug">
                  {t('player.respectNoticeDesc')}
                </p>
              </div>
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

            {/* Clue Tracking Quick Action Button inside Modal */}
            {!completedClueIds.has(selectedClue.id) && (
              <button
                type="button"
                onClick={() => {
                  setTrackedClueId((prev) => (prev === selectedClue.id ? null : selectedClue.id));
                }}
                className={`w-full mb-4 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  trackedClueId === selectedClue.id
                    ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span>
                  {trackedClueId === selectedClue.id
                    ? `${t('player.trackingBadge')} (${t('player.stopTrackingBtn')})`
                    : t('player.trackClueBtn')}
                </span>
              </button>
            )}

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

      {/* Player Announcements & Broadcast History Modal (Option B) */}
      {showAnnouncementsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl max-h-[90dvh] overflow-y-auto space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <Megaphone className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {t('player.announcementsTitle')}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t('player.announcementsSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnouncementsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Currently Active Broadcast Card (Option A) */}
            {game.activeBroadcast && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    {t('player.activeBroadcastBadge')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(game.activeBroadcast.sentAt).toLocaleTimeString()}
                  </span>
                </div>
                <div
                  className={`p-2.5 rounded-lg border text-xs font-medium text-white leading-relaxed ${
                    game.activeBroadcast.type === 'urgent'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : game.activeBroadcast.type === 'alert'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-sky-950/40 border-sky-500/40 text-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/40 border border-white/10">
                      {game.activeBroadcast.type}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {game.activeBroadcast.sender || 'Game Master'}
                    </span>
                  </div>
                  {game.activeBroadcast.message}
                </div>
              </div>
            )}

            {/* Past Announcements Feed (Option B) */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {t('player.broadcastHistoryBadge')} ({broadcasts.length})
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {broadcasts.length > 0 ? (
                  broadcasts.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={`font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border text-[9px] ${
                            b.type === 'urgent'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : b.type === 'alert'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                          }`}
                        >
                          {b.type}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {new Date(b.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed mt-0.5">
                        {b.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    {t('player.noAnnouncements')}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAnnouncementsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-colors"
            >
              {t('common.close')}
            </button>
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
