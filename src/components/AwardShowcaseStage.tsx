import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, Swords } from 'lucide-react';
import { PlayerPublic, RoomMode } from '../shared/types';
import {
  SHOWCASE_AUDIO,
  SHOWCASE_TIMINGS,
  ShowcasePlace,
  buildShowcaseQueue,
  getPlacedPlacesForStep,
} from '../utils/showcaseLogic';
import { PodiumStage } from './PodiumStage';
import { TeamBadge, TeamBattleBoard } from './TeamBattleBoard';

interface AwardShowcaseStageProps {
  quizTitle: string;
  totalPlayers: number;
  players: PlayerPublic[];
  mode?: RoomMode;
  muted: boolean;
  onComplete: () => void;
}

const RANK_NAME_COLOR: Record<ShowcasePlace, string> = {
  1: 'text-amber-300 drop-shadow-[0_4px_24px_rgba(251,191,36,0.55)]',
  2: 'text-slate-100 drop-shadow-[0_4px_22px_rgba(226,232,240,0.45)]',
  3: 'text-orange-300 drop-shadow-[0_4px_22px_rgba(251,146,60,0.45)]',
};

export const AwardShowcaseStage: React.FC<AwardShowcaseStageProps> = ({
  quizTitle,
  totalPlayers,
  players,
  mode = 'single',
  muted,
  onComplete,
}) => {
  // Snapshot queue once at ceremony start so mid-showcase Firestore reads cannot restart timers
  const frozenPlayersRef = useRef<PlayerPublic[]>(players);
  const queue = useMemo(() => buildShowcaseQueue(frozenPlayersRef.current), []);

  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [nameRevealed, setNameRevealed] = useState(false);
  const [currentSettled, setCurrentSettled] = useState(false);
  const [newlyRevealedPlace, setNewlyRevealedPlace] = useState<ShowcasePlace | null>(null);
  const [fireworksBurstKey, setFireworksBurstKey] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finishShowcase = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    onCompleteRef.current();
  };

  // Sync top-right Mute button immediately to active audio element
  useEffect(() => {
    mutedRef.current = muted;
    const audio = audioRef.current;
    if (audio) {
      audio.muted = muted;
      audio.volume = muted ? 0 : 1;
    }
  }, [muted]);

  // If there are no ranked players to announce, jump straight to summary
  useEffect(() => {
    if (queue.length === 0) {
      finishShowcase();
    }
  }, [queue.length]);

  // Initial empty-podium wait before announcing Rank 3 (or highest starting rank)
  useEffect(() => {
    if (queue.length === 0 || queueIndex !== -1) return;
    const timer = window.setTimeout(() => {
      setQueueIndex(0);
      setNameRevealed(false);
      setCurrentSettled(false);
      setNewlyRevealedPlace(null);
    }, SHOWCASE_TIMINGS.INITIAL_PODIUM_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [queue.length, queueIndex]);

  // Preload showcase MP3s for instant cue timing
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const preload1 = new Audio(SHOWCASE_AUDIO.rank2And3);
    const preload2 = new Audio(SHOWCASE_AUDIO.rank1);
    preload1.preload = 'auto';
    preload2.preload = 'auto';
  }, []);

  // Per-rank suspense sequence synchronized with audio buildup + muted/autoplay wall-clock fallback
  useEffect(() => {
    if (queueIndex < 0 || queueIndex >= queue.length) return;
    const entry = queue[queueIndex];

    let cancelled = false;
    let rafId = 0;
    let nextStepTimer = 0;
    let didRevealName = false;
    let didSettle = false;
    let maxElapsedMs = 0;
    let wallStartMs = performance.now();

    const audio = audioRef.current;
    const handleAudioPlaying = () => {
      if (!audio) return;
      wallStartMs = performance.now() - audio.currentTime * 1000;
    };

    if (audio) {
      audio.pause();
      audio.src = entry.audioPath;
      audio.currentTime = 0;
      audio.muted = mutedRef.current;
      audio.volume = mutedRef.current ? 0 : 1;
      audio.addEventListener('playing', handleAudioPlaying);
      void audio.play().catch(() => {
        // Fallback wall-clock timer drives timeline smoothly if browser blocks autoplay
      });
    }

    const tick = () => {
      if (cancelled || completedRef.current) return;

      const audioActiveMs =
        audio && !audio.paused && !audio.ended && audio.currentTime > 0
          ? audio.currentTime * 1000
          : null;
      const wallElapsedMs = performance.now() - wallStartMs;
      const rawElapsed = audioActiveMs !== null ? audioActiveMs : wallElapsedMs;
      maxElapsedMs = Math.max(maxElapsedMs, rawElapsed);

      if (!didRevealName && maxElapsedMs >= entry.nameRevealMs) {
        didRevealName = true;
        setNameRevealed(true);
      }

      if (!didSettle && maxElapsedMs >= entry.settleMs) {
        didSettle = true;
        setCurrentSettled(true);
        setNewlyRevealedPlace(entry.place);

        if (entry.place === 1) {
          setFireworksBurstKey((k) => k + 1);
        }

        nextStepTimer = window.setTimeout(() => {
          if (cancelled || completedRef.current) return;
          if (queueIndex + 1 < queue.length) {
            setNameRevealed(false);
            setCurrentSettled(false);
            setNewlyRevealedPlace(null);
            setQueueIndex(queueIndex + 1);
          } else {
            finishShowcase();
          }
        }, entry.postSettlePauseMs);
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (nextStepTimer) window.clearTimeout(nextStepTimer);
      if (audio) {
        audio.removeEventListener('playing', handleAudioPlaying);
        audio.pause();
      }
    };
  }, [queue, queueIndex]);

  const currentEntry = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;
  const isAnnouncementActive = Boolean(currentEntry && !currentSettled);
  const visiblePlaces = useMemo(
    () => getPlacedPlacesForStep(queue, queueIndex, currentSettled),
    [queue, queueIndex, currentSettled]
  );
  const isTeamResultRevealed = Boolean(
    mode === 'team' && currentEntry?.place === 1 && currentSettled
  );

  return (
    <main
      data-testid="moderator-showcase-stage"
      className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-5"
    >
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* Top Title Row matching mockup layout */}
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-3xl w-full mx-auto">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              สรุปผลการแข่งขันทั้งหมด
            </h2>
            {mode === 'team' && (
              <span
                data-testid="showcase-team-mode-label"
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 text-xs font-extrabold text-amber-200"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Team Battle</span>
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {quizTitle} · ผู้เล่นทั้งหมด {totalPlayers} คน
          </p>
        </div>

        <button
          type="button"
          data-testid="showcase-skip-btn"
          onClick={finishShowcase}
          className="min-h-[40px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <FastForward className="w-4 h-4" />
          <span>ข้ามไปหน้าสรุปผล</span>
        </button>
      </div>

      {/* Centered Spotlight Podium Stage */}
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <PodiumStage
          players={frozenPlayersRef.current}
          mode={mode}
          visiblePlaces={visiblePlaces}
          dimmed={isAnnouncementActive}
          newlyRevealedPlace={newlyRevealedPlace}
          fireworksBurstKey={fireworksBurstKey}
          hideEmptyHint={true}
          darkSurface={true}
        >
          {/* Front-most Foreground Layer: Strictly 3 Announcement Lines (+ Team tag in Team Battle) */}
          {isAnnouncementActive && currentEntry && (
            <div
              data-testid="showcase-announcement-overlay"
              data-place={currentEntry.place}
              data-name-revealed={nameRevealed ? 'true' : 'false'}
              className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-5 sm:px-10 gap-2 sm:gap-3"
            >
              {/* Line 1: Large */}
              <div
                data-testid="showcase-line-1"
                className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_3px_14px_rgba(0,0,0,0.9)]"
              >
                ผู้ที่ได้คะแนนเป็นอันดับที่ {currentEntry.place}
              </div>

              {/* Line 2: Medium */}
              <div
                data-testid="showcase-line-2"
                className="text-lg sm:text-2xl font-bold text-slate-200 tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
              >
                ได้แก่
              </div>

              {/* Line 3: Largest (reserved space before beat drop + ~500ms) */}
              <div className="min-h-[3.2rem] sm:min-h-[4.5rem] flex flex-col items-center justify-center max-w-full gap-2">
                {nameRevealed && (
                  <>
                    <div
                      data-testid="showcase-line-3"
                      className={`animate-showcase-name-slam text-4xl sm:text-6xl font-black tracking-tight leading-tight break-words max-w-full ${
                        RANK_NAME_COLOR[currentEntry.place]
                      }`}
                    >
                      {currentEntry.player.name}
                    </div>
                    {mode === 'team' && currentEntry.player.team && (
                      <TeamBadge
                        team={currentEntry.player.team}
                        className="animate-showcase-name-slam px-3 py-1 text-sm sm:text-base shadow-lg"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </PodiumStage>

        {/* Team Battle Summary & Winner Reveal (only when mode === 'team') */}
        {mode === 'team' && (
          isTeamResultRevealed ? (
            <TeamBattleBoard
              players={frozenPlayersRef.current}
              showWinner={true}
              showMvp={true}
              title="สรุปผล Team Battle (ทีมแดง VS ทีมน้ำเงิน)"
              compact={true}
            />
          ) : (
            <div
              data-testid="showcase-team-suspense"
              className="rounded-2xl border border-slate-700/80 bg-slate-800/75 px-4 py-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-300"
            >
              <Swords className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                โหมด Team Battle (ทีมแดง VS ทีมน้ำเงิน) · กำลังรอลุ้นผลรวมทีมชนะและ MVP หลังประกาศอันดับที่ 1
              </span>
            </div>
          )
        )}
      </div>
    </main>
  );
};
