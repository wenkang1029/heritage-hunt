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
  BroadcastMessage,
  BroadcastType,
  RallyPoint,
} from '../../types/index.ts';
import { HuntMap } from '../Map/HuntMap.tsx';
import { RallyMapPicker } from './RallyMapPicker.tsx';
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
  X,
  Compass,
  ChevronDown,
  Users,
  Megaphone,
  History,
  Send,
} from 'lucide-react';
import { ImageLightboxModal } from '../Common/ImageLightboxModal.tsx';
import { useDialog } from '../../context/DialogContext.tsx';
import { InteractiveTour, type TourStep } from '../Common/InteractiveTour.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { getClueNumber, getClueLabel } from '../../data/cluesZh.ts';

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
  const { showAlert, showConfirm } = useDialog();
  const { t, language } = useLanguage();

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
  const [rejectingSub, setRejectingSub] = useState<Submission | null>(null);
  const [selectedRejectPreset, setSelectedRejectPreset] = useState<string>('');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');

  // End Game & Rally Point Modal State
  const [showRallyModal, setShowRallyModal] = useState<boolean>(false);
  const [selectedRallyPreset, setSelectedRallyPreset] = useState<number>(0);
  const [rallyCoords, setRallyCoords] = useState<GeoCoordinate>({ latitude: 2.1944, longitude: 102.2491 });
  const [rallyLocationName, setRallyLocationName] = useState<string>('');
  const [rallyNote, setRallyNote] = useState<string>('');
  const [rallyFlyTrigger, setRallyFlyTrigger] = useState<number>(0);

  const RALLY_PRESETS = useMemo(() => [
    {
      name: language === 'zh' ? '红屋荷兰广场喷水池 (Dutch Square)' : 'Dutch Square Fountain (Red Square)',
      location: { latitude: 2.1944, longitude: 102.2491 },
      icon: '🏛️',
    },
    {
      name: language === 'zh' ? '鸡场街文化坊大舞台 (Jonker Street Stage)' : 'Jonker Street Stage & Plaza',
      location: { latitude: 2.1983, longitude: 102.2464 },
      icon: '🎭',
    },
    {
      name: language === 'zh' ? '圣地亚哥古城门广场 (Porta de Santiago / A Famosa)' : 'Porta de Santiago / A Famosa Square',
      location: { latitude: 2.1918, longitude: 102.2505 },
      icon: '🏰',
    },
    {
      name: language === 'zh' ? '马六甲运河游船码头 / Hard Rock 广场' : 'River Walk Plaza / Hard Rock Cafe Melaka',
      location: { latitude: 2.1953, longitude: 102.2486 },
      icon: '🎸',
    },
    {
      name: language === 'zh' ? '旋转景观塔广场 (Menara Taming Sari)' : 'Menara Taming Sari Plaza',
      location: { latitude: 2.1925, longitude: 102.2472 },
      icon: '🗼',
    },
  ], [language]);
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

  // Zone Editing, Creating & Visual Map Plotting State
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#DC2626');
  const [newZoneDescription, setNewZoneDescription] = useState('');
  const [showCreateZoneModal, setShowCreateZoneModal] = useState<boolean>(false);
  const [createZoneName, setCreateZoneName] = useState<string>('');
  const [createZoneLocalName, setCreateZoneLocalName] = useState<string>('');
  const [createZoneColor, setCreateZoneColor] = useState<string>('#3B82F6');
  const [createZoneDescription, setCreateZoneDescription] = useState<string>('');
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

  // Interactive Onboarding Tour State for GM
  const [showTour, setShowTour] = useState<boolean>(() => {
    try {
      return localStorage.getItem('melaka_hunt_seen_gm_tour') !== 'true';
    } catch {
      return false;
    }
  });
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);

  // Leaderboard team members dropdown state
  const [expandedLeaderboardTeams, setExpandedLeaderboardTeams] = useState<Set<string>>(new Set());

  // Broadcast Center State & History Subscription (Option A & B)
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastText, setBroadcastText] = useState<string>('');
  const [broadcastType, setBroadcastType] = useState<BroadcastType>('info');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState<boolean>(false);
  const [isClearingBroadcast, setIsClearingBroadcast] = useState<boolean>(false);

  React.useEffect(() => {
    const unsub = gameService.subscribeToBroadcasts(game.id, (bList) => {
      setBroadcasts(bList);
    });
    return () => unsub();
  }, [game.id]);

  const handleSendBroadcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!broadcastText.trim()) return;

    try {
      setIsSendingBroadcast(true);
      await gameService.sendBroadcast({
        gameId: game.id,
        message: broadcastText.trim(),
        type: broadcastType,
        sender: 'Game Master',
      });
      setBroadcastText('');
      await showAlert({
        title: language === 'zh' ? '广播已发送' : 'Broadcast Sent',
        message:
          language === 'zh'
            ? '已成功向所有在线参赛者推送广播消息！'
            : 'Live broadcast sent to all participants!',
        variant: 'success',
      });
    } catch (err: any) {
      await showAlert({
        title: language === 'zh' ? '发送广播失败' : 'Broadcast Failed',
        message: err.message,
        variant: 'danger',
      });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleClearBroadcast = async () => {
    try {
      setIsClearingBroadcast(true);
      await gameService.clearActiveBroadcast(game.id);
    } catch (err: any) {
      await showAlert({
        title: language === 'zh' ? '清除广播失败' : 'Clear Failed',
        message: err.message,
        variant: 'danger',
      });
    } finally {
      setIsClearingBroadcast(false);
    }
  };

  const applyPreset = (presetText: string, type: BroadcastType = 'info') => {
    setBroadcastText(presetText);
    setBroadcastType(type);
  };

  const toggleLeaderboardTeamExpand = (teamId: string) => {
    setExpandedLeaderboardTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const gmTourSteps = useMemo<TourStep[]>(() => {
    if (language === 'zh') {
      return [
        {
          id: 'gm-overview',
          title: '欢迎来到 GM 裁判控制室',
          description:
            '这里是活动的核心控制中心。在上方控制条中，可实时查看在线队员数，点击【启动比赛】开启计时，并在需要时【暂停】或【结束比赛】。',
          icon: <Radio className="w-5 h-5 text-amber-400" />,
          badge: '顶部管理工具条',
          tips: '点击“复制参赛链接”或进入队伍标签页展示二维码以邀请队员加入。',
          tabKey: 'queue',
        },
        {
          id: 'gm-queue',
          title: '1. 实时自拍审核队列',
          description:
            '每当有参赛小队找到地标并上传自拍，都会实时推送至此处。并排对比目标建筑与队员合影，点击【标准 50分】通过、打赏【创意 60/80分】或【驳回】重拍。',
          icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
          badge: '标签页：审核队列',
          tips: '点击任意地标缩略图或队员自拍，均可放大查看高清无损原图。',
          tabKey: 'queue',
        },
        {
          id: 'gm-radar',
          title: '2. 实时街头雷达追踪',
          description:
            '在马六甲历史核心区全景地图上监控所有队伍的行进动向。彩色脉冲雷达图钉代表各小队的实时 GPS 经纬度与区域穿梭轨迹。',
          icon: <Radio className="w-5 h-5 text-rose-500" />,
          badge: '标签页：实时雷达',
          tips: '点击地图上的任意队伍标记或文化遗产多边形区域可查看详细信息。',
          tabKey: 'radar',
        },
        {
          id: 'gm-clues',
          title: '3. 寻宝线索与地标管理',
          description:
            '管理所有文化遗产寻宝线索。卡片完整展示地标细节，点击【批量上传地标照片】即可一键批量导入照片，并自动提取 EXIF GPS 经纬度落点在地图上！',
          icon: <Sparkles className="w-5 h-5 text-amber-400" />,
          badge: '标签页：线索与地标',
          tips: '马六甲核心区121处精选真实历史地标已完成编目与预置。',
          tabKey: 'clues',
        },
        {
          id: 'gm-teams',
          title: '4. 队伍阵容与 PIN 码管理',
          description:
            '管理各参赛队伍及其身份凭据。查看每支队伍的4位 PIN 码、在线队员状态、成员阵容与累计积分。可随时点击【添加队伍】或修改队色与 PIN 码。',
          icon: <PlusCircle className="w-5 h-5 text-rose-400" />,
          badge: '标签页：队伍与PIN码',
          tips: '队员可直接扫描专属二维码或输入4位数字 PIN 码秒级进入小队。',
          tabKey: 'teams',
        },
        {
          id: 'gm-zones',
          title: '5. 可视化多边形区域编辑器',
          description:
            '配置文化遗产保护区域（鸡场街、荷兰红屋、圣地亚哥古城门等）。可点击【创建新区域】，或点击【在地图上绘制】直接在 Leaflet 地图上点击多边形顶点进行可视化标定！',
          icon: <Layers className="w-5 h-5 text-rose-400" />,
          badge: '标签页：区域划分',
          tips: '交互式标定顶点时，地图多边形边界将实时闭合重绘。',
          tabKey: 'zones',
        },
        {
          id: 'gm-leaderboard',
          title: '6. 官方实时总积分排行榜',
          description:
            '实时追踪所有参赛队伍的当前得分、已完成地标数量与官方总排名。比赛结束时，榜首队伍将荣获马六甲文化遗产寻宝冠军奖杯！',
          icon: <Trophy className="w-5 h-5 text-amber-400" />,
          badge: '标签页：积分总榜',
          tips: '随时点击顶部工具条中的“操作向导”按钮即可重新回顾本导览。',
          tabKey: 'leaderboard',
        },
      ];
    }

    return [
      {
        id: 'gm-overview',
        title: 'Welcome to the GM War Room',
        description:
          'This is your central command center. In the header bar above, track connected participants, start the hunt with "Start Game", and use "Pause" or "Stop Game" when finished.',
        icon: <Radio className="w-5 h-5 text-amber-400" />,
        badge: 'Header Controls',
        tips: 'Click "Copy Link" or the "QR Code" icon to invite teams and players.',
        tabKey: 'queue',
      },
      {
        id: 'gm-queue',
        title: '1. Live Verification Queue',
        description:
          'Whenever player squads find a landmark, their selfie photo appears here in real time. Inspect each photo and click "Standard (50 pts)" to approve, award "Creative (60/80 pts)" for great poses, or "Reject" if incorrect.',
        icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
        badge: 'Tab: Submissions',
        tips: 'Tap any clue thumbnail or player selfie to view the uncropped high-resolution photo.',
        tabKey: 'queue',
      },
      {
        id: 'gm-radar',
        title: '2. Real-Time Radar Tracker',
        description:
          'Track all participating squads roaming the streets of Melaka. Pulsing colored radar pins represent each team’s real-time GPS coordinates and movement across heritage zones.',
        icon: <Radio className="w-5 h-5 text-rose-500" />,
        badge: 'Tab: Live Radar',
        tips: 'Click on any team marker or zone boundary on the map to inspect live details.',
        tabKey: 'radar',
      },
      {
        id: 'gm-clues',
        title: '3. Clues & Landmark Manager',
        description:
          'Manage all heritage scavenger clues. Photos fill each card with natural framing. Tap any card thumbnail to view the uncropped photo. Click "Upload Clues" to bulk-import photos with automatic GPS extraction!',
        icon: <Sparkles className="w-5 h-5 text-amber-400" />,
        badge: 'Tab: Clues & Landmarks',
        tips: '121 historical Melaka landmarks are currently cataloged and ready.',
        tabKey: 'clues',
      },
      {
        id: 'gm-teams',
        title: '4. Teams & PIN Management',
        description:
          'Manage squads and credentials. View each team’s 4-digit PIN, online player status, member count, and total score. Click "Add Team" to create additional squads or edit team colors and PINs.',
        icon: <PlusCircle className="w-5 h-5 text-rose-400" />,
        badge: 'Tab: Squads & PINs',
        tips: 'Players can scan your direct team link or type the 4-digit PIN to join instantly.',
        tabKey: 'teams',
      },
      {
        id: 'gm-zones',
        title: '5. Visual Zone Boundary Editor',
        description:
          'Configure heritage zones (Jonker Street, Dutch Square, A Famosa, etc.). Use "Create New Zone" or "Delete" to customize zones, or click "Plot on Map" to click points directly on the Leaflet map to visually draw custom polygon boundaries!',
        icon: <Layers className="w-5 h-5 text-rose-400" />,
        badge: 'Tab: Zone Editor',
        tips: 'Plotting points interactively redraws the polygon boundary in real time.',
        tabKey: 'zones',
      },
      {
        id: 'gm-leaderboard',
        title: '6. Official Event Leaderboard',
        description:
          'Follow live team scores, verified landmarks count, and current rankings. When you stop the game, the top team claims the Melaka Heritage Scavenger Hunt Trophy!',
        icon: <Trophy className="w-5 h-5 text-amber-400" />,
        badge: 'Tab: Leaderboard',
        tips: 'Click the "Tour Guide" button in the header bar anytime to revisit this walkthrough.',
        tabKey: 'leaderboard',
      },
    ];
  }, [language]);

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

  // Handle Review Action (Tiered points: 50, 60, 80; Reject with reason)
  const handleReviewAction = async (
    submission: Submission,
    action: 'approve' | 'reject' | 'bonus',
    points?: number,
    rejectionReason?: string
  ) => {
    try {
      setIsProcessingAction(true);
      await gameService.reviewSubmission(game.id, submission.id, action, {
        points: action === 'approve' ? (points ?? 50) : undefined,
        bonusPoints: action === 'bonus' ? (points ?? 25) : undefined,
        rejectionReason: action === 'reject' ? (rejectionReason || 'Photo does not match landmark criteria') : undefined,
      });
      if (rejectingSub?.id === submission.id) {
        setRejectingSub(null);
      }
    } catch (err: any) {
      await showAlert({
        title: 'Review Action Failed',
        message: 'Review action error: ' + (err.message || 'Unknown error'),
        variant: 'danger',
      });
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
    if (newStatus === 'ended') {
      setSelectedRallyPreset(0);
      setRallyCoords(RALLY_PRESETS[0].location);
      setRallyLocationName(RALLY_PRESETS[0].name);
      setShowRallyModal(true);
      return;
    }

    const isStoppingAction = newStatus === 'paused';
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
      await showAlert({
        title: 'Status Update Failed',
        message: 'Failed to update game status: ' + err.message,
        variant: 'danger',
      });
    }
  };

  const handleConfirmEndGameWithRally = async (includeRally: boolean) => {
    try {
      let rallyPointData: RallyPoint | null = null;
      if (includeRally) {
        const trimmedNote = rallyNote.trim();
        rallyPointData = {
          name: rallyLocationName.trim() || (language === 'zh' ? '马六甲集结点' : 'Melaka Rally Point'),
          location: {
            latitude: Number(rallyCoords.latitude),
            longitude: Number(rallyCoords.longitude),
          },
          setAt: Date.now(),
          ...(trimmedNote ? { note: trimmedNote } : {}),
        };
      }
      await gameService.updateGameStatus(game.id, 'ended', rallyPointData);
      setShowRallyModal(false);
      setShowForceStopModal(false);
      setPendingStatus(null);
    } catch (err: any) {
      await showAlert({
        title: 'End Game Failed',
        message: 'Failed to end game: ' + err.message,
        variant: 'danger',
      });
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
        newGameDuration,
        game.zones,
        game.id
      );
      setShowCreateGameModal(false);
      if (onGameChange) {
        onGameChange(createdGame);
      }
      await showAlert({
        title: 'Game Created',
        message: `Game "${createdGame.name}" created! Participants can now join via the game link.`,
        variant: 'success',
      });
    } catch (err: any) {
      await showAlert({
        title: 'Game Creation Failed',
        message: 'Failed to create game: ' + err.message,
        variant: 'danger',
      });
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
      await showAlert({
        title: 'Team Created',
        message: `Team "${newTeamName}" created successfully!`,
        variant: 'success',
      });
    } catch (err: any) {
      await showAlert({
        title: 'Team Creation Failed',
        message: 'Failed to create team: ' + err.message,
        variant: 'danger',
      });
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
      await showAlert({
        title: 'Cannot Delete Team',
        message: `Cannot delete "${team.name}" because it already has ${team.members.length} player(s) joined.`,
        variant: 'warning',
      });
      return;
    }

    const confirmDelete = await showConfirm({
      title: 'Delete Team',
      message: `Are you sure you want to delete team "${team.name}"? This action cannot be undone.`,
      confirmText: 'Delete Team',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmDelete) return;

    try {
      await gameService.deleteTeam(game.id, team.id);
    } catch (err: any) {
      await showAlert({
        title: 'Delete Team Failed',
        message: 'Failed to delete team: ' + err.message,
        variant: 'danger',
      });
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
          landmarkName: '马六甲历史地标',
          zoneId: game.zones[0]?.id || 'dutch-square',
          points: 50,
          targetPhotoBase64: compressed.base64,
          location,
          hint: '仔细观察店屋外观与建筑细节。',
        });
        addedCount++;
      }
      setUploadFeedback(`✓ Successfully added ${addedCount} clue photos with GPS pins!`);
      setTimeout(() => setUploadFeedback(null), 5000);
    } catch (err: any) {
      await showAlert({
        title: 'Bulk Upload Failed',
        message: 'Bulk upload error: ' + err.message,
        variant: 'danger',
      });
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
      await showAlert({
        title: 'Update Failed',
        message: 'Failed to update zone: ' + err.message,
        variant: 'danger',
      });
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
      await showAlert({
        title: 'Insufficient Points',
        message: 'A zone polygon must contain at least 3 boundary points.',
        variant: 'warning',
      });
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
      await showAlert({
        title: 'Save Failed',
        message: 'Failed to save plotted zone: ' + (err.message || 'Unknown error'),
        variant: 'danger',
      });
    } finally {
      setIsSavingPlot(false);
    }
  };

  // Create New Zone
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createZoneName.trim()) {
      await showAlert({
        title: 'Zone Name Required',
        message: 'Please enter a zone name.',
        variant: 'warning',
      });
      return;
    }

    try {
      const zoneId = `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const center = { latitude: 2.1944, longitude: 102.2491 }; // Melaka Historic Core center
      // Starter 3-point polygon around Melaka core
      const starterPolygon: GeoCoordinate[] = [
        { latitude: 2.1955, longitude: 102.2485 },
        { latitude: 2.1960, longitude: 102.2505 },
        { latitude: 2.1935, longitude: 102.2495 },
      ];

      const newZone: Zone = {
        id: zoneId,
        name: createZoneName.trim(),
        ...(createZoneLocalName.trim() ? { localName: createZoneLocalName.trim() } : {}),
        description: createZoneDescription.trim() || 'Custom heritage zone in Melaka',
        color: createZoneColor,
        borderColor: createZoneColor,
        fillColor: createZoneColor,
        center,
        polygon: starterPolygon,
      };

      const updatedZones = [...game.zones, newZone];
      await gameService.updateZones(game.id, updatedZones);

      setShowCreateZoneModal(false);
      setCreateZoneName('');
      setCreateZoneLocalName('');
      setCreateZoneDescription('');

      const startPlot = await showConfirm({
        title: 'Zone Created!',
        message: `Zone "${newZone.name}" created! Would you like to plot its boundary points on the map now?`,
        confirmText: 'Plot on Map',
        cancelText: 'Later',
        variant: 'info',
      });
      if (startPlot) {
        handleStartPlotting(newZone);
      }
    } catch (err: any) {
      await showAlert({
        title: 'Creation Failed',
        message: 'Failed to create zone: ' + (err.message || 'Unknown error'),
        variant: 'danger',
      });
    }
  };

  // Delete Zone
  const handleDeleteZone = async (zone: Zone) => {
    const cluesInZone = clues.filter((c) => c.zoneId === zone.id);
    let confirmMsg = `Are you sure you want to delete zone "${zone.name}"? This action cannot be undone.`;
    if (cluesInZone.length > 0) {
      confirmMsg = `Warning: Zone "${zone.name}" currently has ${cluesInZone.length} clue(s) assigned to it.\n\nDeleting this zone will remove it from the map. Are you sure you want to proceed?`;
    }

    const confirmed = await showConfirm({
      title: 'Delete Zone',
      message: confirmMsg,
      confirmText: 'Delete Zone',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const remainingZones = game.zones.filter((z) => z.id !== zone.id);
      if (remainingZones.length === 0) {
        await showAlert({
          title: 'Cannot Delete Zone',
          message: 'You must have at least one zone in the game.',
          variant: 'warning',
        });
        return;
      }
      await gameService.updateZones(game.id, remainingZones);
      if (activePlotZone?.id === zone.id) {
        setActivePlotZone(null);
        setPlotVertices([]);
      }
    } catch (err: any) {
      await showAlert({
        title: 'Delete Failed',
        message: 'Failed to delete zone: ' + (err.message || 'Unknown error'),
        variant: 'danger',
      });
    }
  };

  // ============================================================================
  // Passcode Lock Screen
  // ============================================================================

  if (!isAuthenticated) {
    return (
      <div className="h-full w-full bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white">{t('gm.portalTitle')}</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            {t('gm.portalDesc')}
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
              placeholder={t('gm.enterPasscode')}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{t('gm.unlockBtn')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main GM Dashboard Interface
  // ============================================================================

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* 1. Top War Room Control Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 shrink-0 shadow-md">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5 truncate">
                <span className="truncate">{game.name}</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full border border-slate-700 font-mono shrink-0">
                  {game.status.toUpperCase()}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                ID: <strong className="text-amber-400">{game.id}</strong>
              </p>
            </div>
          </div>

          {/* Mobile quick logout */}
          <div className="flex sm:hidden items-center gap-1.5">
            <button
              onClick={handleLogout}
              title={t('gm.logOutBtn')}
              className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 p-2 rounded-xl border border-slate-700 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Game State Control Buttons & Create Game Button */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowCreateGameModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 sm:px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-md transition-colors shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('gm.newGameBtn')}</span>
          </button>

          {/* GM Live Broadcast Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className={`font-bold px-2.5 sm:px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0 ${
              game.activeBroadcast
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={t('gm.broadcastBtn')}
          >
            <Megaphone
              className={`w-3.5 h-3.5 ${
                game.activeBroadcast ? 'text-amber-400 animate-bounce' : 'text-slate-400'
              }`}
            />
            <span>{t('gm.broadcastBtn')}</span>
            {game.activeBroadcast && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
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
                  ? t('gm.playersOnline', { online: onlinePlayersCount, total: totalPlayersJoined })
                  : t('gm.zeroOnline')}
              </span>
            </span>
          )}

          {game.status !== 'active' ? (
            <button
              onClick={() => handleStatusChange('active')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 sm:px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-md transition-colors shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{t('gm.startGameBtn')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => handleStatusChange('paused')}
                title={t('gm.pauseBtn')}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-2.5 sm:px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-md transition-colors cursor-pointer shrink-0"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>{t('gm.pauseBtn')}</span>
              </button>

              <button
                onClick={() => handleStatusChange('ended')}
                title={hasActiveOnlinePlayers ? `${t('gm.stopGameBtn')} (${onlinePlayersCount})` : t('gm.stopGameBtn')}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 sm:px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-md transition-colors cursor-pointer shrink-0"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{t('gm.stopGameBtn')}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setTourStepIndex(0);
              setShowTour(true);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0"
            title={t('gm.tourGuideBtn')}
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{t('gm.tourGuideBtn')}</span>
          </button>

          <button
            onClick={handleLogout}
            title={t('gm.logOutBtn')}
            className="hidden sm:flex bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 p-1.5 rounded-xl border border-slate-700 cursor-pointer transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Horizontally scrollable on mobile) */}
        <div className="w-full sm:w-auto overflow-x-auto scrollbar-none pb-0.5">
          <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-max shrink-0">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'queue'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t('gm.tabs.queue')}</span>
              {pendingSubmissions.length > 0 && (
                <span className="bg-white text-rose-600 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {pendingSubmissions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'radar' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('gm.tabs.radar')}
            </button>

            <button
              onClick={() => setActiveTab('clues')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'clues' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('gm.tabs.clues', { count: clues.length })}
            </button>

            <button
              onClick={() => setActiveTab('teams')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'teams' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('gm.tabs.teams', { count: teams.length })}
            </button>

            <button
              onClick={() => setActiveTab('zones')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                activeTab === 'zones' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('gm.tabs.zones', { count: game.zones.length })}</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'leaderboard' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('gm.tabs.leaderboard')}
            </button>
          </nav>
        </div>
      </header>

      {/* Active Broadcast Live Banner across GM War Room */}
      {game.activeBroadcast && (
        <div
          className={`px-3 sm:px-6 py-2 border-b flex items-center justify-between gap-3 text-xs shrink-0 shadow-sm transition-all ${
            game.activeBroadcast.type === 'urgent'
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              : game.activeBroadcast.type === 'alert'
              ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
              : 'bg-sky-950/80 border-sky-500/40 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-4 h-4 shrink-0 animate-pulse text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40 border border-white/10 shrink-0">
              {game.activeBroadcast.type}
            </span>
            <span className="truncate font-semibold text-white">
              {game.activeBroadcast.message}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer transition-colors"
            >
              {language === 'zh' ? '管理广播' : 'Manage'}
            </button>
            <button
              type="button"
              onClick={handleClearBroadcast}
              disabled={isClearingBroadcast}
              className="px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] font-bold cursor-pointer transition-colors"
            >
              {isClearingBroadcast ? t('gm.clearingBroadcast') : t('gm.clearBroadcastBtn')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Shareable Participant Game Link Banner */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-3 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold text-slate-300 shrink-0">{t('gm.gameLink')}</span>
          <code className="bg-slate-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-slate-800 text-amber-300 font-mono text-[11px] truncate max-w-[200px] sm:max-w-md">
            {gameLink}
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyGameLink}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 sm:px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{t('gm.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('gm.copyLink')}</span>
              </>
            )}
          </button>
          <a
            href={gameLink}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t('gm.openLink')}</span>
          </a>
        </div>
      </div>

      {/* 3. Main War Room Body (Scrollable with min-h-0 and ample phone bottom padding) */}
      <main className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto pb-32 sm:pb-16">
        {/* ========================================================================= */}
        {/* TAB 1: Verification Queue */}
        {/* ========================================================================= */}
        {activeTab === 'queue' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">{t('gm.queueTitle')}</h2>
                <p className="text-xs text-slate-400">
                  {t('gm.queueDesc')}
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {t('gm.queuePending', { count: pendingSubmissions.length })}
              </span>
            </div>

            {pendingSubmissions.length === 0 ? (
              <div className="text-center py-12 sm:py-16 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/40 px-4">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-60" />
                <h3 className="font-bold text-slate-200 text-sm">{t('gm.queueEmptyTitle')}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {t('gm.queueEmptyDesc')}
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
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: sub.teamColor }}
                            />
                            <span className="font-bold text-xs text-white truncate">
                              {sub.teamName}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {t('gm.byPlayer', { name: sub.submittedBy })}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-amber-400 mb-3 truncate">
                          {sub.clueTitle || getClueLabel(sub.clueId, language)}
                        </h3>

                        {/* Side-by-Side Photo Comparison */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-400">
                                {t('gm.targetLandmark')}
                              </span>
                              {targetClue?.targetPhotoBase64 && (
                                <span className="text-[9px] text-amber-400 flex items-center gap-0.5 font-semibold">
                                  <Maximize2 className="w-2.5 h-2.5" />
                                  <span>{t('gm.viewFull')}</span>
                                </span>
                              )}
                            </div>
                            <div
                              onClick={() => {
                                if (targetClue?.targetPhotoBase64) {
                                  setLightboxImage({
                                    url: targetClue.targetPhotoBase64,
                                    title: targetClue.title || getClueLabel(targetClue.id, language),
                                    subtitle: targetClue.zoneId,
                                    badge: t('common.targetLandmarkBadge'),
                                  });
                                }
                              }}
                              className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 relative cursor-pointer group flex items-center justify-center"
                              title={t('common.viewFullUncropped')}
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
                                  {t('gm.noImage')}
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-emerald-400">
                                {t('gm.teamSelfie')}
                              </span>
                              <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 font-semibold">
                                <Maximize2 className="w-2.5 h-2.5" />
                                <span>{t('gm.viewFull')}</span>
                              </span>
                            </div>
                            <div
                              onClick={() => {
                                setLightboxImage({
                                  url: sub.selfieBase64,
                                  title: `${sub.teamName} Submission Selfie`,
                                  subtitle: sub.clueTitle || getClueLabel(sub.clueId, language),
                                  badge: t('common.teamSelfieBadge'),
                                });
                              }}
                              className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border-2 border-emerald-500/50 relative cursor-pointer group flex items-center justify-center"
                              title={t('common.viewFullUncropped')}
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
                            {t('gm.distFromLandmark')} <strong className="text-slate-200">{Math.round(sub.distanceFromClueMeters)}m</strong>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>{language === 'zh' ? '创意自拍审核打分:' : 'Creative Selfie Scoring:'}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {language === 'zh' ? '基准 50分 · 创意加成' : 'Base 50 · Creative Bonus'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                          <button
                            onClick={() => handleReviewAction(sub, 'approve', 50)}
                            disabled={isProcessingAction}
                            title="Standard: Found landmark & valid selfie (50 pts)"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-md"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{t('gm.scoreStandard')}</span>
                          </button>
                          <button
                            onClick={() => handleReviewAction(sub, 'approve', 60)}
                            disabled={isProcessingAction}
                            title="Creative: Good pose, composition (+10 pts)"
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-md"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                            <span>{t('gm.scoreCreative')}</span>
                          </button>
                          <button
                            onClick={() => handleReviewAction(sub, 'approve', 80)}
                            disabled={isProcessingAction}
                            title="Very Creative: Outstanding pose, humor, artistic (+30 pts)"
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-md"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                            <span>{t('gm.scoreVeryCreative')}</span>
                          </button>
                          <button
                            onClick={() => setRejectingSub(sub)}
                            disabled={isProcessingAction}
                            title="Reject submission"
                            className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors border border-rose-800"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t('gm.rejectBtn')}</span>
                          </button>
                        </div>
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
          <div className="h-[55dvh] sm:h-[70vh] min-h-[380px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
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
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-6">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">{t('gm.cluesTitle')}</h2>
                <p className="text-xs text-slate-400">
                  {t('gm.cluesDesc')}
                </p>
              </div>

              <label className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold py-2 px-3.5 sm:py-2.5 sm:px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-all shrink-0">
                <Upload className="w-4 h-4" />
                <span>{isUploadingClues ? t('gm.processingPhotos') : t('gm.bulkUploadBtn')}</span>
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
              {clues.map((clue) => {
                const clueZone = game.zones.find((z) => z.id === clue.zoneId);
                const clueTitle = getClueLabel(clue.id, language);

                return (
                  <div
                    key={clue.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col hover:border-slate-700 transition-all"
                  >
                    <div
                      onClick={() => {
                        if (clue.targetPhotoBase64) {
                          setLightboxImage({
                            url: clue.targetPhotoBase64,
                            title: clueTitle,
                            subtitle: clueZone?.name || clue.zoneId,
                            badge: t('common.targetLandmarkBadge'),
                          });
                        }
                      }}
                      className="w-full h-44 sm:h-48 bg-slate-950 overflow-hidden relative cursor-pointer group flex items-center justify-center border-b border-slate-800"
                      title={t('common.viewFullUncropped')}
                    >
                      {clue.targetPhotoBase64 ? (
                        <>
                          <img
                            src={clue.targetPhotoBase64}
                            alt={clueTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="bg-slate-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 shadow-lg flex items-center gap-1.5">
                              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>{t('gm.viewFullImage')}</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                          {t('gm.noImage')}
                        </div>
                      )}

                      {/* Top Badges: Clue # Number & 50 Pts */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="bg-slate-950/85 backdrop-blur-sm text-amber-300 font-mono font-black text-xs px-2 py-0.5 rounded-lg border border-amber-500/30 shadow-md">
                          {getClueNumber(clue.id)}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className="bg-amber-500/20 backdrop-blur-sm text-amber-300 border border-amber-500/40 font-black text-xs px-2 py-0.5 rounded-lg shadow-md">
                          50 {t('gm.gmPointsUnit')}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className="font-black text-sm text-white truncate">
                            {clueTitle}
                          </h4>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: clueZone?.color || '#94a3b8' }}
                            />
                            <span className="truncate max-w-[100px]">{clueZone?.name || clue.zoneId}</span>
                          </span>
                        </div>

                        {clue.hint && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                            💡 {clue.hint}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="truncate">
                          📍 {clue.location.latitude.toFixed(4)}, {clue.location.longitude.toFixed(4)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                          15m
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <h2 className="text-base sm:text-lg font-black text-white">{t('gm.teamsTitle')}</h2>
                <p className="text-xs text-slate-400">
                  {t('gm.teamsDesc')}
                </p>
              </div>

              {/* Create Team Inline Form (Responsive wrapping on phone) */}
              <form onSubmit={handleCreateTeam} className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder={t('gm.teamNamePlaceholder')}
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white flex-1 sm:w-36"
                  required
                />
                <input
                  type="text"
                  placeholder={t('gm.pinPlaceholder')}
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
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                  title="Choose Team Color"
                />
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{t('gm.addTeamBtn')}</span>
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((tItem) => {
                const teamJoinUrl = `${gameLink}&pin=${tItem.pin}`;
                const hasPlayers = tItem.members && tItem.members.length > 0;

                return (
                  <div
                    key={tItem.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-2"
                      style={{ background: tItem.color }}
                    />

                    <div className="flex items-center justify-between w-full mb-2">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ background: tItem.color }}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditTeam(tItem)}
                          title={t('gm.editTeamTitle')}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(tItem)}
                          disabled={hasPlayers}
                          title={hasPlayers ? `Cannot delete: ${tItem.members.length} player(s) joined` : 'Delete Team'}
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

                    <h3 className="font-black text-base text-white">{tItem.name}</h3>
                    <div className="mt-1 mb-3 flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">{t('gm.teamPin')}</span>
                      <span className="text-base font-black font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {tItem.pin}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-2xl shadow-md mb-3">
                      <QRCodeSVG value={teamJoinUrl} size={140} level="M" />
                    </div>

                    <div className="text-[11px] text-slate-400 mb-1 w-full">
                      {hasPlayers ? (
                        <div className="space-y-1.5">
                          <span className="text-emerald-400 font-bold block">
                            {t('gm.playersJoinedCount', { count: tItem.members.length })}
                          </span>
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {tItem.members.map((m) => {
                              const online = isMemberOnline(m, tItem);
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
                        <span className="text-slate-500">{t('gm.noPlayersYet')}</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-rose-500" />
                  <span>{t('gm.zonesTitle')}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {t('gm.zonesDesc')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {activePlotZone && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 animate-pulse">
                    <MousePointerClick className="w-4 h-4 text-amber-400" />
                    <span>{t('gm.plottingBadge', { name: activePlotZone.name, count: plotVertices.length })}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowCreateZoneModal(true)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('gm.createZoneBtn')}</span>
                </button>
              </div>
            </div>

            {/* Interactive Leaflet Zone Plotting Map */}
            <div id="gm-zone-map-editor" className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
              <HuntMap
                zones={game.zones}
                clues={clues}
                teams={teams}
                className="h-[45dvh] sm:h-[480px] min-h-[340px] w-full"
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
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingZone(zone);
                            setNewZoneName(zone.name);
                            setNewZoneColor(zone.color);
                            setNewZoneDescription(zone.description || '');
                          }}
                          className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                          title={t('gm.zoneDetailsBtn')}
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{t('gm.zoneDetailsBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteZone(zone)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
                          title={t('gm.zoneDeleteBtn')}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t('gm.zoneDeleteBtn')}</span>
                        </button>
                      </div>
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
                      {t('gm.pointsCount', { count: zone.polygon.length })}
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
                      <span>{activePlotZone?.id === zone.id ? t('gm.plottingBtn') : t('gm.plotOnMapBtn')}</span>
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
              <h2 className="text-xl font-black text-white">{t('gm.gmLeaderboardTitle')}</h2>
              <p className="text-xs text-slate-400">
                {t('gm.gmLeaderboardDesc')}
              </p>
            </div>

            <div className="space-y-3">
              {[...teams]
                .sort((a, b) => b.score - a.score)
                .map((tItem, idx) => {
                  const isExpanded = expandedLeaderboardTeams.has(tItem.id);
                  const memberCount = tItem.members?.length || 0;

                  return (
                    <div
                      key={tItem.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg transition-all"
                    >
                      {/* Team Card Header */}
                      <div
                        className="flex items-center justify-between cursor-pointer select-none"
                        onClick={() => toggleLeaderboardTeamExpand(tItem.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span
                            className={`font-black text-base w-6 text-center ${
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
                            className="w-4 h-4 rounded-full ring-2 ring-white/30 shrink-0"
                            style={{ background: tItem.color }}
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">{tItem.name}</h4>
                            <span className="text-xs text-slate-400 block truncate">
                              PIN: #{tItem.pin} • {t('gm.gmCluesCompleted', { count: tItem.completedClueIds?.length || 0 })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xl font-black text-amber-400">{tItem.score}</span>
                            <span className="text-[10px] text-slate-500 block leading-none">{t('gm.gmPointsUnit')}</span>
                          </div>

                          {/* Dropdown Toggle Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLeaderboardTeamExpand(tItem.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                              isExpanded
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                            title={isExpanded ? 'Hide team members' : 'View team members'}
                          >
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-mono font-bold">{memberCount}</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-amber-400' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Drawer: Team Members List */}
                      {isExpanded && (
                        <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-amber-400" />
                              <span>Squad Members ({memberCount})</span>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {tItem.members?.filter((m) => m.isOnline !== false).length || 0} active
                            </span>
                          </div>

                          {tItem.members && tItem.members.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                              {tItem.members.map((m) => {
                                const isOnline = m.isOnline !== false;
                                return (
                                  <div
                                    key={m.id || m.nickname}
                                    className="bg-slate-950/80 border border-slate-800/90 rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          isOnline
                                            ? 'bg-emerald-400 ring-2 ring-emerald-400/30'
                                            : 'bg-slate-600'
                                        }`}
                                        title={isOnline ? 'Online' : 'Offline'}
                                      />
                                      <span className="font-semibold text-slate-200 truncate">
                                        {m.nickname}
                                      </span>
                                      {m.isLeader && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          Leader
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`text-[10px] shrink-0 font-medium ${
                                        isOnline ? 'text-emerald-400' : 'text-slate-500'
                                      }`}
                                    >
                                      {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-3 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60 mt-1">
                              No players have joined this squad yet.
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

      {/* ========================================================================= */}
      {/* MODAL: Create New Game */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: Create New Game */}
      {/* ========================================================================= */}
      {showCreateGameModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-black text-white mb-1">{t('gm.createGameTitle')}</h3>
            <p className="text-xs text-slate-400 mb-4">
              {t('gm.createGameDesc')}
            </p>

            <form onSubmit={handleCreateGame} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.eventNameLabel')}
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
                  {t('gm.numTeamsLabel')}
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
                  {t('gm.durationLabel')}
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('gm.cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGame}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg cursor-pointer transition-colors"
                >
                  {isCreatingGame ? t('gm.creatingGameBtn') : t('gm.createLaunchBtn')}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-base font-black text-white mb-1">{t('gm.editTeamTitle')}</h3>
            <p className="text-xs text-slate-400 mb-4">
              {t('gm.editTeamDesc')}
            </p>

            {editTeamError && (
              <div className="mb-3 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {editTeamError}
              </div>
            )}

            <form onSubmit={handleSaveEditTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.teamNamePlaceholder')}
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
                  {t('gm.pinPlaceholder')}
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
                  {t('gm.zoneColorLabel')}
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
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('gm.cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer transition-colors"
                >
                  {t('gm.saveChangesBtn')}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-base font-black text-white mb-1">{t('gm.editZoneTitle')}</h3>
            <p className="text-xs text-slate-400 mb-4">
              {t('gm.zonesDesc')}
            </p>

            <form onSubmit={handleSaveZone} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.zoneNameLabel')}
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
                  {t('gm.zoneColorLabel')}
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
                  {t('gm.zoneDescLabel')}
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
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('gm.cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer transition-colors"
                >
                  {t('gm.saveZoneBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Zone Modal */}
      {showCreateZoneModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-rose-500" />
                <span>{t('gm.createZoneTitle')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateZoneModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateZone} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.zoneNameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Little India & Kampung Jawa"
                  value={createZoneName}
                  onChange={(e) => setCreateZoneName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.zoneLocalNameLabel')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Heritage Enclave 4"
                  value={createZoneLocalName}
                  onChange={(e) => setCreateZoneLocalName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.zoneColorLabel')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={createZoneColor}
                    onChange={(e) => setCreateZoneColor(e.target.value)}
                    className="w-12 h-9 rounded-xl cursor-pointer bg-transparent border-0"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['#DC2626', '#EA580C', '#EAB308', '#16A34A', '#0284C7', '#8B5CF6', '#EC4899'].map(
                      (presetColor) => (
                        <button
                          key={presetColor}
                          type="button"
                          onClick={() => setCreateZoneColor(presetColor)}
                          className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                            createZoneColor === presetColor ? 'border-white scale-110 ring-2 ring-white/50' : 'border-white/20'
                          }`}
                          style={{ background: presetColor }}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t('gm.zoneDescLabel')}
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe landmarks or boundaries included in this zone..."
                  value={createZoneDescription}
                  onChange={(e) => setCreateZoneDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400">
                <span className="text-amber-400 font-bold">Interactive Boundary:</span> After creating, you will be prompted to visually click points directly on the interactive map to plot its boundary!
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateZoneModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('gm.cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer transition-colors"
                >
                  {t('gm.createZoneConfirmBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Stop Game Confirmation Modal */}
      {showForceStopModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">{t('gm.forceStopTitle')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('gm.forceStopSubtitle')}
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {t('gm.connectedCount', { count: onlinePlayersCount })}
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
              {t('gm.forceStopWarn')}
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
                {t('gm.keepRunningBtn')}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(pendingStatus || 'ended', true)}
                className="w-1/2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg cursor-pointer transition-colors"
              >
                {t('gm.forceStopConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Uncropped Image Lightbox Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <Megaphone className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>{t('gm.broadcastModalTitle')}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('gm.broadcastModalDesc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Active Broadcast Live Status (Option A) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  {t('gm.activeBroadcastLabel')}
                </span>
                {game.activeBroadcast && (
                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    disabled={isClearingBroadcast}
                    className="px-2 py-0.5 rounded-md bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    {isClearingBroadcast ? t('gm.clearingBroadcast') : t('gm.clearBroadcastBtn')}
                  </button>
                )}
              </div>
              {game.activeBroadcast ? (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    game.activeBroadcast.type === 'urgent'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : game.activeBroadcast.type === 'alert'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-sky-950/40 border-sky-500/40 text-sky-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/40 border border-white/10">
                      {game.activeBroadcast.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(game.activeBroadcast.sentAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-medium text-white leading-relaxed">
                    {game.activeBroadcast.message}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-1">
                  {t('gm.noActiveBroadcast')}
                </p>
              )}
            </div>

            {/* Section 2: Quick Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {t('gm.presetsTitle')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(t('gm.preset15MinText'), 'alert')}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left text-xs text-slate-200 font-medium transition-colors cursor-pointer group"
                >
                  <div className="font-bold text-amber-400 group-hover:text-amber-300">
                    {t('gm.preset15Min')}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    15m warning
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(t('gm.preset5MinText'), 'urgent')}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-left text-xs text-slate-200 font-medium transition-colors cursor-pointer group"
                >
                  <div className="font-bold text-rose-400 group-hover:text-rose-300">
                    {t('gm.preset5Min')}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    5m countdown
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(t('gm.presetFreezeText'), 'alert')}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left text-xs text-slate-200 font-medium transition-colors cursor-pointer group"
                >
                  <div className="font-bold text-amber-400 group-hover:text-amber-300">
                    {t('gm.presetFreeze')}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    Scores frozen
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(t('gm.presetRegroupText'), 'urgent')}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-left text-xs text-slate-200 font-medium transition-colors cursor-pointer group"
                >
                  <div className="font-bold text-rose-400 group-hover:text-rose-300">
                    {t('gm.presetRegroup')}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    Return to base
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(t('gm.presetRainText'), 'alert')}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-left text-xs text-slate-200 font-medium transition-colors cursor-pointer group"
                >
                  <div className="font-bold text-sky-400 group-hover:text-sky-300">
                    {t('gm.presetRain')}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    Seek shelter
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(t('gm.presetBonusText'), 'info')}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-left text-xs text-slate-200 font-medium transition-colors cursor-pointer group"
                >
                  <div className="font-bold text-emerald-400 group-hover:text-emerald-300">
                    {t('gm.presetBonus')}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    Bonus challenge
                  </div>
                </button>
              </div>
            </div>

            {/* Section 3: Custom Compose Form */}
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t('gm.urgencyLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastType('info')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      broadcastType === 'info'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {t('gm.urgencyInfo')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastType('alert')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      broadcastType === 'alert'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {t('gm.urgencyAlert')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastType('urgent')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      broadcastType === 'urgent'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {t('gm.urgencyUrgent')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t('gm.customMsgLabel')}
                </label>
                <textarea
                  rows={3}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder={t('gm.customMsgPlaceholder')}
                  maxLength={300}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                <div className="text-[10px] text-right text-slate-500 mt-0.5">
                  {broadcastText.length}/300
                </div>
              </div>

              <button
                type="submit"
                disabled={!broadcastText.trim() || isSendingBroadcast}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingBroadcast ? t('gm.sendingBroadcast') : t('gm.sendBroadcastBtn')}</span>
              </button>
            </form>

            {/* Section 4: Broadcast History Log (Option B) */}
            <div className="border-t border-slate-800 pt-3">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('gm.broadcastHistoryTitle', { count: broadcasts.length })}</span>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {broadcasts.length > 0 ? (
                  broadcasts.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex flex-col gap-1"
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
                      <p className="text-slate-200 text-[11px] leading-snug">
                        {b.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    {t('gm.noBroadcastsYet')}
                  </p>
                )}
              </div>
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

      {/* Rejection Reason Modal */}
      {rejectingSub && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-black text-rose-400 mb-1 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{t('gm.rejectModalTitle')}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">{t('gm.rejectModalSubtitle')}</p>

            {/* Target Clue & Team info */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-3 text-xs space-y-1">
              <div className="text-slate-400">
                {language === 'zh' ? '队伍：' : 'Team: '}<span className="font-bold text-white">{rejectingSub.teamName}</span>
              </div>
              <div className="text-slate-400">
                {language === 'zh' ? '线索：' : 'Clue: '}<span className="font-bold text-amber-300">{rejectingSub.clueTitle || getClueLabel(rejectingSub.clueId, language)}</span>
              </div>
            </div>

            {/* Reason Presets */}
            <div className="space-y-1.5 mb-3">
              {[
                t('gm.rejectDisrespect'),
                t('gm.rejectNotMatching'),
                t('gm.rejectBlurry'),
                t('gm.rejectFarAway'),
              ].map((reasonText) => (
                <button
                  key={reasonText}
                  type="button"
                  onClick={() => setSelectedRejectPreset(reasonText)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    (selectedRejectPreset || t('gm.rejectDisrespect')) === reasonText
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-bold'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span>{reasonText}</span>
                  {(selectedRejectPreset || t('gm.rejectDisrespect')) === reasonText && (
                    <span className="text-rose-400 font-black text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Optional Custom Reason Input */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {language === 'zh' ? '其他补充说明（选填）：' : 'Custom Additional Reason (Optional):'}
              </label>
              <textarea
                rows={2}
                value={customRejectNote}
                onChange={(e) => setCustomRejectNote(e.target.value)}
                placeholder={language === 'zh' ? '如：请靠近石碑重新拍摄清楚的队旗合照' : 'e.g. Please step closer to the stone tablet with visible team flag'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRejectingSub(null);
                  setCustomRejectNote('');
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {t('gm.rejectCancelBtn')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const defaultReason = t('gm.rejectDisrespect');
                  const finalReason = customRejectNote.trim() || selectedRejectPreset || defaultReason;
                  await handleReviewAction(rejectingSub, 'reject', undefined, finalReason);
                  setRejectingSub(null);
                  setCustomRejectNote('');
                }}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>{t('gm.rejectConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Game & Set Gathering Point Modal */}
      {showRallyModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
              <span className="text-xl">🏁</span>
              <span>{t('gm.rallyModalTitle')}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">{t('gm.rallyModalDesc')}</p>

            {hasActiveOnlinePlayers && (
              <div className="mb-4 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span>
                  {language === 'zh'
                    ? `注意：目前仍有 ${onlinePlayersCount} 位选手在现场活跃运行，确认结束比赛吗？`
                    : `Note: ${onlinePlayersCount} player(s) are currently active in the field.`}
                </span>
              </div>
            )}

            {/* Quick Landmark Presets (Horizontal Scrollable Chips) */}
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {t('gm.rallyPresetLabel')}
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                {RALLY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedRallyPreset(idx);
                      setRallyCoords(preset.location);
                      setRallyLocationName(preset.name);
                      setRallyFlyTrigger((prev) => prev + 1);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      selectedRallyPreset === idx
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name.split('(')[0].trim()}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedRallyPreset(-1)}
                  className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    selectedRallyPreset === -1
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold shadow-sm'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span>📍</span>
                  <span>{language === 'zh' ? '自由选点' : 'Custom Pin'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Pinpoint Map */}
            <div className="mb-4">
              <RallyMapPicker
                selectedCoords={rallyCoords}
                onCoordsChange={(coords) => setRallyCoords(coords)}
                onCustomSelect={() => setSelectedRallyPreset(-1)}
                flyTrigger={rallyFlyTrigger}
              />
            </div>

            {/* Gathering Location Name Input */}
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {t('gm.rallyNameLabel')}
              </label>
              <input
                type="text"
                value={rallyLocationName}
                onChange={(e) => setRallyLocationName(e.target.value)}
                placeholder="e.g. Geographer Cafe (鸡场街地理学家咖啡馆)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {/* Optional Instructions */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {t('gm.rallyNoteLabel')}
              </label>
              <textarea
                rows={2}
                value={rallyNote}
                onChange={(e) => setRallyNote(e.target.value)}
                placeholder={t('gm.rallyNotePlaceholder')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRallyModal(false)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {t('gm.rallyCancelBtn')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmEndGameWithRally(false)}
                className="px-3.5 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {t('gm.rallyEndWithoutBtn')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmEndGameWithRally(true)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <span>🚩</span>
                <span>{t('gm.rallyConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Onboarding Tour Guide for GM */}
      <InteractiveTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        tourName="Game Master War Room"
        steps={gmTourSteps}
        currentStepIndex={tourStepIndex}
        onStepChange={setTourStepIndex}
        onTabChange={(tabKey) => setActiveTab(tabKey)}
        storageKey="melaka_hunt_seen_gm_tour"
      />
    </div>
  );
};
