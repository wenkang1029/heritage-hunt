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
import { uploadPhotoToNas } from '../../services/nasPhotoService.ts';
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
  Filter,
  RotateCcw,
} from 'lucide-react';
import { getClueNumber, getClueLabel } from '../../data/cluesZh.ts';
import {
  calculateHaversineDistance,
  calculateBearing,
  getCompassDirection,
  getRadarProximityStage,
  formatDistance,
} from '../../utils/haversine.ts';
import { ImageLightboxModal } from '../Common/ImageLightboxModal.tsx';
import { useDialog } from '../../context/DialogContext.tsx';
import Tourguide, { type TourguideStep } from 'tourguidejs';
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
  const [clueStatusFilter, setClueStatusFilter] = useState<'all' | 'uncompleted' | 'completed'>('all');

  // Camera & submission state
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedRawFile, setCapturedRawFile] = useState<File | null>(null);
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

  const tourguideSteps = useMemo<TourguideStep[]>(() => {
    if (language === 'zh') {
      return [
        {
          selector: '#player-squad-status',
          step: 1,
          title: '📍 第 1/6 步 · 欢迎参加马六甲寻宝！',
          content:
            '您正在代表小队穿梭于马六甲古迹街头！请查看顶部状态栏，实时查看队伍专属颜色、个人昵称、当前总积分、实时排行榜名次以及已完成线索数。顶部还可随时接收裁判赛事广播或切换语言。',
        },
        {
          selector: '#scavenger-radar-card',
          step: 2,
          title: '🧭 第 2/6 步 · 寻宝地图与智能雷达',
          content:
            '彩色多边形区域划定了鸡场街、荷兰红屋等古迹区。地图上已标出全部 121 个寻宝点位图钉；浮动雷达会自动锁定最近线索，配备 360° 旋转罗盘与实时距离；当步入目标 20 米内将触发高能提醒！',
        },
        {
          selector: '#clues-tab-nav',
          step: 3,
          title: '🔍 第 3/6 步 · 纯视觉找茬寻宝（每题 50分）',
          content:
            '切换到【线索】浏览全部 121 个寻宝目标，所有线索均为 50 分！地标名称与文字介绍已被隐藏，请用双眼比对摄影特写与老店屋砖瓦雕花。线索单行排列，点击【📸 拍照】可直接打卡！',
        },
        {
          selector: '#clues-status-filter',
          step: 4,
          title: '🎯 第 4/6 步 · 区域聚焦与完成度横幅',
          content:
            '可使用顶部的【全部 / 待探索 / 已完成】状态栏快速过滤。点击任意古迹区域（如鸡场街、荷兰红屋），顶部会立刻展开该区域专属颜色的【聚焦横幅】，显示该区域的完成进度条（如 已探索 4/32）与剩余线索。点击【✕ 清除筛选】可随时返回全览。',
        },
        {
          selector: '#first-clue-card',
          step: 5,
          title: '📸 第 5/6 步 · 身边线索与现场打卡自拍',
          content:
            '当你走近任何地标（<100米），顶部会自动浮现“就在身边”轮播卡片。到达建筑面前后，点击【📸 拍照】拍摄一张包含队员与建筑特写的合影！系统内置极速压缩（<150KB，零流量负担）并立即提交给 GM 审核。',
        },
        {
          selector: '#leaderboard-tab-nav',
          step: 6,
          title: '🏆 第 6/6 步 · 实时排行榜与终点集结导航',
          content:
            '实时追踪所有参赛队伍的分数与排名，点击队伍可展开查看队友成员与在线状态。当比赛倒计时结束，裁判会公布终点集结地（Rally Point），地图将标出集结旗帜并提供一键 Google 地图导航！随时点击右上角【向导】按钮可重新开启教程。',
        },
      ];
    }

    return [
      {
        selector: '#player-squad-status',
        step: 1,
        title: '📍 Step 1/6 · Welcome to Heritage Hunt!',
        content:
          'You are representing your squad on the historic streets of Melaka! Check the header bar above for your squad theme color, nickname, live score, official leaderboard rank, and completed clues count. You can also view broadcasts and toggle languages anytime.',
      },
      {
        selector: '#scavenger-radar-card',
        step: 2,
        title: '🧭 Step 2/6 · Hunt Map & Explorer Radar',
        content:
          'Color-coded polygon zones outline UNESCO districts. All 121 photo clue pins are displayed directly on your map! The floating radar tracks the nearest clue with a 360° Adventure Compass and distance. Walking within 20m triggers a pulse alert!',
      },
      {
        selector: '#clues-tab-nav',
        step: 3,
        title: '🔍 Step 3/6 · Pure Visual Scavenger Hunt (50 pts)',
        content:
          'Switch to the Clues tab to browse all 121 photo clues. Every clue awards 50 points! To keep the challenge exciting, landmark names and text titles are hidden. Use your eyes to match photo teasers with real architectural carvings, tiles, and shophouses. Tap any photo to view in high resolution!',
      },
      {
        selector: '#clues-status-filter',
        step: 4,
        title: '🎯 Step 4/6 · Smart Zone Filters & Focus Progress Banner',
        content:
          'Use the top segmented status bar (All / Uncompleted / Completed) to filter clues. Tapping any zone pill opens the Active Filter Hero Banner, displaying a live progress bar (e.g. 4/32 Completed) and uncompleted counts. Tap [✕ Clear] anytime to reset.',
      },
      {
        selector: '#first-clue-card',
        step: 5,
        title: '📸 Step 5/6 · Nearby Highlights & Squad Selfie',
        content:
          'When you walk within 100m of clues, the "Right Beside You" carousel pops up automatically. In front of the landmark, tap [📸 Snap] to take a squad selfie! Built-in instant compression (<150KB) saves mobile data and uploads in seconds for GM review.',
      },
      {
        selector: '#leaderboard-tab-nav',
        step: 6,
        title: '🏆 Step 6/6 · Live Standings & Rally Point',
        content:
          'Track team scores and standings in real time, and tap any squad to inspect its members. When the hunt concludes, the GM broadcasts the final Rally Point with a map flag and direct Google Maps navigation button! Tap the "Tour Guide" button in the top-right header anytime to reopen this walkthrough.',
      },
    ];
  }, [language]);

  // Tourguide.js integration: attach startTour event listener to #tourbutton
  useEffect(() => {
    const tourguide = new Tourguide({
      steps: tourguideSteps,
      padding: 10,
      colors: {
        overlayColor: 'rgba(0, 0, 0, 0.85)',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        accentColor: '#f59e0b',
        focusColor: '#f59e0b',
        bulletColor: '#cbd5e1',
        bulletVisitedColor: '#10b981',
        bulletCurrentColor: '#f59e0b',
        stepButtonCloseColor: '#64748b',
        stepButtonPrevColor: '#334155',
        stepButtonNextColor: '#ffffff',
        stepButtonCompleteColor: '#ffffff',
      },
      onStep: (currentStep) => {
        const stepNum = currentStep?.index ?? 0;
        if (stepNum <= 1) {
          setActiveTab('map');
        } else if (stepNum >= 2 && stepNum <= 4) {
          setActiveTab('clues');
        } else if (stepNum >= 5) {
          setActiveTab('leaderboard');
        }
        setTimeout(() => {
          try {
            currentStep?.position?.();
          } catch {
            // ignore
          }
        }, 80);
      },
      onComplete: () => {
        try {
          localStorage.setItem('melaka_hunt_seen_player_tour', 'true');
        } catch {
          // ignore
        }
      },
      onStop: () => {
        try {
          localStorage.setItem('melaka_hunt_seen_player_tour', 'true');
        } catch {
          // ignore
        }
      },
    });

    // Inject high-contrast custom styles directly into Tourguide Shadow DOM
    const shadowRoot = (tourguide as any)._shadowRoot as ShadowRoot | undefined;
    if (shadowRoot) {
      const customStyle = document.createElement('style');
      customStyle.textContent = `
        /* 1. Ultra-visible Target Highlight Box with Glowing Golden Pulse */
        .guided-tour-step.active .guided-tour-step-highlight {
          border: 3.5px solid #f59e0b !important;
          border-radius: 14px !important;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85), 0 0 25px rgba(245, 158, 11, 0.95), inset 0 0 15px rgba(245, 158, 11, 0.3) !important;
          animation: tourGlowPulse 1.8s ease-in-out infinite alternate !important;
          pointer-events: none !important;
        }

        @keyframes tourGlowPulse {
          0% {
            border-color: #f59e0b;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85), 0 0 15px rgba(245, 158, 11, 0.7);
          }
          100% {
            border-color: #fde047;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85), 0 0 35px rgba(253, 224, 71, 1), inset 0 0 20px rgba(245, 158, 11, 0.45);
          }
        }

        /* 2. High-contrast, Crisp White Tour Card with Golden Amber Rim */
        .guided-tour-step.active .guided-tour-step-tooltip {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 2.5px solid #f59e0b !important;
          border-radius: 20px !important;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(245, 158, 11, 0.35) !important;
          padding: 8px !important;
          overflow: visible !important;
        }

        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner {
          background-color: #ffffff !important;
          border-radius: 16px !important;
          position: relative !important;
          z-index: 2 !important;
        }

        /* 3. Bold, High-Legibility Title */
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-title {
          color: #0f172a !important;
          font-weight: 900 !important;
          font-size: 1.15rem !important;
          line-height: 1.35 !important;
          border-bottom: 2px solid #f1f5f9 !important;
          padding-bottom: 10px !important;
          margin-bottom: 10px !important;
          letter-spacing: -0.01em !important;
        }

        /* 4. Slate-700 Description Text (100% readable in sunlight) */
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-content {
          color: #334155 !important;
          font-size: 0.925rem !important;
          line-height: 1.6 !important;
          font-weight: 500 !important;
        }

        /* 5. Crystal-Clear Pointer Arrow with Matching Border */
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-arrow {
          background: #ffffff !important;
          border: 2.5px solid #f59e0b !important;
          width: 14px !important;
          height: 14px !important;
          z-index: 1 !important;
        }

        /* 6. Navigation Buttons */
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-close {
          color: #64748b !important;
          top: 10px !important;
          right: 10px !important;
          width: 28px !important;
          height: 28px !important;
          transition: color 0.15s ease, transform 0.15s ease !important;
        }
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-close:hover {
          color: #0f172a !important;
          transform: scale(1.15) !important;
        }

        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-next,
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-complete {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          color: #ffffff !important;
          border: 2px solid #fbbf24 !important;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5) !important;
          width: 38px !important;
          height: 38px !important;
          margin-top: -19px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: transform 0.15s ease !important;
        }
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-next:hover,
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-complete:hover {
          transform: translateY(-50%) scale(1.12) !important;
        }

        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-prev {
          background: #f1f5f9 !important;
          color: #334155 !important;
          border: 1.5px solid #cbd5e1 !important;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15) !important;
          width: 38px !important;
          height: 38px !important;
          margin-top: -19px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: transform 0.15s ease !important;
        }
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-button-prev:hover {
          transform: translateY(-50%) scale(1.12) !important;
        }

        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-bullets ul li button {
          background-color: #cbd5e1 !important;
          border: 3px solid #ffffff !important;
          width: 10px !important;
          height: 10px !important;
        }
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-bullets ul li button.current {
          background-color: #f59e0b !important;
          transform: scale(1.3) !important;
        }
        .guided-tour-step.active .guided-tour-step-tooltip .guided-tour-step-tooltip-inner .guided-tour-step-bullets ul li button.complete {
          background-color: #10b981 !important;
        }
      `;
      shadowRoot.append(customStyle);
    }

    function startTour() {
      tourguide.start();
    }

    // Attach the tourguide start event to the button press
    const tourbutton = document.getElementById('tourbutton');
    tourbutton?.addEventListener('click', startTour);

    (window as any).tourguide = tourguide;
    (window as any).startTour = startTour;

    return () => {
      tourbutton?.removeEventListener('click', startTour);
      try {
        tourguide.deinit();
      } catch {
        // ignore
      }
    };
  }, [tourguideSteps]);

  // Auto-launch tour on first visit
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('melaka_hunt_seen_player_tour');
      if (!hasSeen) {
        const timer = setTimeout(() => {
          const btn = document.getElementById('tourbutton');
          btn?.click();
        }, 700);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

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

  // Zone Progress Statistics for Filtering
  const zoneStatsMap = useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {};
    for (const z of game.zones) {
      stats[z.id] = { total: 0, completed: 0 };
    }
    for (const c of clues) {
      if (!stats[c.zoneId]) {
        stats[c.zoneId] = { total: 0, completed: 0 };
      }
      stats[c.zoneId].total += 1;
      if (completedClueIds.has(c.id)) {
        stats[c.zoneId].completed += 1;
      }
    }
    return stats;
  }, [game.zones, clues, completedClueIds]);

  const activeZone = useMemo(() => {
    if (selectedZoneFilter === 'all') return null;
    return game.zones.find((z) => z.id === selectedZoneFilter) || null;
  }, [selectedZoneFilter, game.zones]);

  // Filtered and Sorted clues for the Clues Tab
  const filteredClues = useMemo(() => {
    let list =
      selectedZoneFilter === 'all'
        ? [...clues]
        : clues.filter((c) => c.zoneId === selectedZoneFilter);

    if (clueStatusFilter === 'uncompleted') {
      list = list.filter((c) => !completedClueIds.has(c.id));
    } else if (clueStatusFilter === 'completed') {
      list = list.filter((c) => completedClueIds.has(c.id));
    }

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
  }, [clues, selectedZoneFilter, clueStatusFilter, sortBy, playerCoords, completedClueIds]);

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
    setCapturedRawFile(null);
    setCompressionStats(null);
    setIsCapturing(true);
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      setCapturedRawFile(file);
      const originalSize = formatBytes(file.size);

      // Perform instant client-side compression (< 150KB Base64) for instant preview & offline fallback
      const compressed = await compressPhoto(file);
      const compressedSize = formatBytes(compressed.sizeBytes);

      setCapturedPreview(compressed.base64);
      setCompressionStats(`Original: ${originalSize} ➔ Full Quality NAS Ready (${compressedSize} preview)`);
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

      const clueDisplayTitle = selectedClue.title || getClueLabel(selectedClue.id, language);

      let uploadedPhotoUrl: string | undefined;
      let uploadedFileId: number | undefined;

      // Try uploading full uncompressed photo to NAS via secure backend proxy
      if (capturedRawFile) {
        try {
          setSubmissionFeedback('Uploading full-resolution photo to Heritage NAS...');
          const nasRes = await uploadPhotoToNas(capturedRawFile, {
            gameId: game.id,
            teamId: currentTeam.id,
            clueId: selectedClue.id,
          });
          if (nasRes.success && nasRes.photoUrl) {
            uploadedPhotoUrl = nasRes.photoUrl;
            uploadedFileId = nasRes.fileId;
          }
        } catch (nasErr: any) {
          console.warn('NAS upload unavailable, submitting local compressed copy:', nasErr);
        }
      }

      await gameService.submitCluePhoto(game.id, {
        gameId: game.id,
        teamId: currentTeam.id,
        teamName: currentTeam.name,
        teamColor: currentTeam.color,
        clueId: selectedClue.id,
        clueTitle: clueDisplayTitle,
        selfieBase64: capturedPreview,
        photoUrl: uploadedPhotoUrl,
        fileId: uploadedFileId,
        submittedBy: nickname,
        submissionCoords: coords,
        captureCoords: coords,
        awardedPoints: 0,
      });

      setSubmissionFeedback('Selfie submitted! Waiting for Game Master verification.');
      setIsCapturing(false);
      setSelectedClue(null);
      setCapturedPreview(null);
      setCapturedRawFile(null);

      await showAlert({
        title: 'Selfie Submitted!',
        message: `Your selfie for "${clueDisplayTitle}" was uploaded successfully! Waiting for Game Master verification.`,
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
      <header id="player-squad-status" className="px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg z-30 gap-1.5">
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
            id="tourbutton"
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm cursor-pointer transition-all shrink-0 active:scale-95"
            title={t('player.tourTitle')}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-black">{t('player.tourTitle')}</span>
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
        <div
          id="player-map-container"
          className={`absolute inset-0 w-full h-full pb-16 transition-opacity duration-200 ${
            activeTab === 'map' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'
          }`}
        >
          <HuntMap
            zones={game.zones}
            clues={clues}
            teams={teams}
            currentTeamId={currentTeam.id}
            playerCoords={playerCoords}
            completedClueIds={Array.from(completedClueIds)}
            onSelectClue={handleOpenNativeCamera}
            onTrackClue={(clue) => setTrackedClueId(clue.id)}
            className="h-full w-full rounded-none border-none"
            bottomOffsetClass={trackedClue ? 'bottom-40' : 'bottom-20'}
            hideCluePins={false}
            trackedClue={trackedClue}
            rallyPoint={game.rallyPoint}
          />
        </div>

        <div
          id="clues-panel-container"
          className={`h-full overflow-y-auto p-3 sm:p-4 space-y-3.5 pb-28 ${
            activeTab === 'clues' ? 'block' : 'hidden'
          }`}
        >
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
                    const cZone = game.zones.find((z) => z.id === c.zoneId);
                    const clueLabel = getClueLabel(c.id, language);

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
                              alt={clueLabel}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                              <Camera className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-sm border border-slate-700 text-[10px] font-mono font-black text-amber-300">
                            {getClueNumber(c.id)}
                          </div>
                          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-sm border border-slate-700 text-[10px] font-black text-amber-400">
                            +50 分
                          </div>
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-emerald-950/90 backdrop-blur-sm border border-emerald-600/50 text-[10px] font-bold text-emerald-300 flex items-center gap-1 shadow">
                            <span>📍</span>
                            <span>{dist}m {dist <= 25 ? `· ${t('player.distancePillVeryClose')}` : ''}</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white truncate mb-0.5">{clueLabel}</h4>
                          <p className="text-[10px] text-slate-400 truncate mb-2">
                            {cZone?.name || c.zoneId}
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

            {/* Segmented Status Bar & View Mode Switcher */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div id="clues-status-filter" className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                <button
                  onClick={() => setClueStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    clueStatusFilter === 'all'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('player.filterAll')} ({clues.length})
                </button>
                <button
                  onClick={() => setClueStatusFilter('uncompleted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    clueStatusFilter === 'uncompleted'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('player.filterUncompleted')} ({Math.max(0, clues.length - completedClueIds.size)})
                </button>
                <button
                  onClick={() => setClueStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    clueStatusFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('player.filterCompleted')} ({completedClueIds.size})
                </button>
              </div>

              {/* Distance Sort Toggle */}
              {playerCoords && (
                <div className="shrink-0 ml-auto">
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
                </div>
              )}
            </div>

            {/* Zone Filter Carousel */}
            <div id="clues-zone-carousel" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedZoneFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  selectedZoneFilter === 'all'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{t('player.allZones')}</span>
                <span className="text-[10px] opacity-80 font-mono">({clues.length})</span>
              </button>
              {game.zones.map((z) => {
                const isSelected = selectedZoneFilter === z.id;
                const stats = zoneStatsMap[z.id] || { total: 0, completed: 0 };
                const allDone = stats.total > 0 && stats.completed === stats.total;

                return (
                  <button
                    key={z.id}
                    onClick={() => setSelectedZoneFilter(z.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'text-white shadow-lg ring-2 ring-white/30'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: z.color,
                            borderColor: z.color,
                            boxShadow: `0 0 14px ${z.color}66`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm"
                      style={{ background: isSelected ? '#ffffff' : z.color }}
                    />
                    <span>{z.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-black/30 text-white'
                          : allDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {stats.completed}/{stats.total}
                    </span>
                    {allDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* 🔥 High-Impact Active Filter Focus Hero Banner */}
            {(selectedZoneFilter !== 'all' || clueStatusFilter !== 'all') && (
              <div
                className="relative rounded-2xl p-3.5 border transition-all duration-300 shadow-xl overflow-hidden"
                style={{
                  background: activeZone
                    ? `linear-gradient(135deg, ${activeZone.color}26 0%, #0f172a 100%)`
                    : 'linear-gradient(135deg, rgba(244, 63, 94, 0.18) 0%, #0f172a 100%)',
                  borderColor: activeZone ? `${activeZone.color}66` : 'rgba(244, 63, 94, 0.45)',
                }}
              >
                <div
                  className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl pointer-events-none opacity-25"
                  style={{ background: activeZone ? activeZone.color : '#f43f5e' }}
                />

                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1">
                        <Filter className="w-3 h-3 text-amber-400" />
                        <span>{t('player.filterActiveZone')}</span>
                      </span>
                      {clueStatusFilter !== 'all' && (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                            clueStatusFilter === 'uncompleted'
                              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          }`}
                        >
                          {clueStatusFilter === 'uncompleted'
                            ? t('player.filterUncompleted')
                            : t('player.filterCompleted')}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-white flex items-center gap-2 truncate">
                      {activeZone ? (
                        <>
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ background: activeZone.color }}
                          />
                          <span className="truncate">{activeZone.name}</span>
                        </>
                      ) : (
                        <span>{t('player.allZones')}</span>
                      )}
                    </h3>

                    {/* Zone Progress bar */}
                    {(() => {
                      const totalCount = activeZone ? (zoneStatsMap[activeZone.id]?.total || 0) : clues.length;
                      const doneCount = activeZone ? (zoneStatsMap[activeZone.id]?.completed || 0) : completedClueIds.size;
                      const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                      return (
                        <div className="mt-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-2 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/60">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pct}%`,
                                  background: activeZone ? activeZone.color : '#10b981',
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-slate-300 shrink-0">
                              {doneCount}/{totalCount} ({pct}%)
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-300 flex items-center gap-1.5 flex-wrap">
                            <span>
                              {language === 'zh'
                                ? `显示 ${filteredClues.length} 个线索`
                                : `Showing ${filteredClues.length} clues`}
                            </span>
                            {activeZone && (
                              <span className="text-slate-400">
                                · {language === 'zh' ? `待探索: ${totalCount - doneCount}` : `Uncompleted: ${totalCount - doneCount}`}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedZoneFilter('all');
                      setClueStatusFilter('all');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{t('player.filterClear')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty State when no clues match */}
            {filteredClues.length === 0 && (
              <div className="py-12 px-4 text-center rounded-2xl bg-slate-900/60 border border-slate-800 my-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center mb-3 text-slate-400">
                  <Compass className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="font-black text-sm text-white mb-1">
                  {t('player.noCluesMatch')}
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
                  {language === 'zh'
                    ? '请尝试切换其他区域或切换上方“全部 / 待探索”筛选'
                    : 'Try selecting a different zone or switching to "All / Uncompleted"'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZoneFilter('all');
                    setClueStatusFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('player.resetFilterBtn')}</span>
                </button>
              </div>
            )}

            {/* Clue Cards (1 Clue Per Row) */}
            {filteredClues.length > 0 && (
              <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                {filteredClues.map((clue, clueIdx) => {
                  const isDone = completedClueIds.has(clue.id);
                  const isPending = pendingClueIds.has(clue.id);
                  const latestSub = latestSubByClue.get(clue.id);
                  const isRejected = !isDone && !isPending && latestSub?.status === 'rejected';
                  const clueZone = game.zones.find((z) => z.id === clue.zoneId);
                  const dist = playerCoords && clue.location ? calculateHaversineDistance(playerCoords, clue.location) : null;
                  const clueLabel = getClueLabel(clue.id, language);

                  return (
                    <div
                      key={clue.id}
                      id={clueIdx === 0 ? 'first-clue-card' : `clue-card-${clue.id}`}
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
                              title: clueLabel,
                              subtitle: clueZone?.name || clue.zoneId,
                              badge: t('common.targetLandmarkBadge'),
                            });
                          }
                        }}
                        className="w-22 h-22 sm:w-26 sm:h-26 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700 relative cursor-pointer group shadow"
                        title={t('player.modalTapUncropped')}
                      >
                        {clue.targetPhotoBase64 ? (
                          <>
                            <img
                              src={clue.targetPhotoBase64}
                              alt={clueLabel}
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
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-950/85 text-amber-300 font-mono font-black text-[10px] border border-amber-500/30 shadow">
                          {getClueNumber(clue.id)}
                        </div>
                        {isDone && (
                          <div className="absolute inset-0 bg-emerald-950/70 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                          </div>
                        )}
                        {isPending && (
                          <div className="absolute inset-0 bg-amber-950/70 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: clueZone?.color || '#94a3b8' }}
                            />
                            <span className="truncate">{clueZone?.name || clue.zoneId}</span>
                          </span>
                          <span className="text-xs font-black text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0">
                            +50 分
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-100 truncate mb-1">
                          {clueLabel}
                        </h3>

                        {/* Status indicator & Track Button */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isDone ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('player.foundAndVerified')}
                                </span>
                                <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded font-black">
                                  +50 分
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
                              {dist !== null && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                  📍 {dist}m
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
            )}
        </div>

        <div
          id="leaderboard-panel-container"
          className={`h-full overflow-y-auto p-3 sm:p-4 pb-28 ${
            activeTab === 'leaderboard' ? 'block' : 'hidden'
          }`}
        >
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
            id="scavenger-radar-card"
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
                  {getClueLabel(trackedClue.id, language)}
                </h4>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  +50 分
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
                      title: getClueLabel(trackedClue.id, language),
                      subtitle: game.zones.find((z) => z.id === trackedClue.zoneId)?.name || trackedClue.zoneId,
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
                      alt={getClueLabel(trackedClue.id, language)}
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
          id="map-tab-nav"
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
          id="clues-tab-nav"
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
          id="leaderboard-tab-nav"
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
              <h2 className="text-base sm:text-lg font-black text-white">{getClueLabel(selectedClue.id, language)}</h2>
              <span className="text-xs text-emerald-400 font-bold">
                {t('player.modalReward', { points: selectedClue.points || 50 })}
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
                      title: getClueLabel(selectedClue.id, language),
                      subtitle: game.zones.find((z) => z.id === selectedClue.zoneId)?.name || selectedClue.zoneId,
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
                      alt={getClueLabel(selectedClue.id, language)}
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
                      subtitle: getClueLabel(selectedClue.id, language),
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
    </div>
  );
};
