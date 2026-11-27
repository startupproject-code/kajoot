import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { resolvePlayerPoseImage } from '../shared/characterPoses';
import { PlayerPublic } from '../shared/types';
import {
  LOBBY_CAROUSEL_INTERVAL_MS,
  MAX_LOBBY_CARDS_PER_ROW,
  getWindowedCarouselItems,
  partitionLobbyPlayers,
} from '../utils/lobbyPoseLogic';

interface LobbyPoseStageProps {
  players: PlayerPublic[];
  roomCode: string;
}

const CAROUSEL_CARD_STEP_PX = 162; // 150px card + 12px gap

interface PoseCardProps {
  player: PlayerPublic;
  sizeClass?: string;
}

const PoseCard: React.FC<PoseCardProps> = React.memo(({
  player,
  sizeClass = 'w-[150px]',
}) => {
  const poseMeta = resolvePlayerPoseImage(player.avatarId, player.poseId);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [poseMeta.imagePath]);

  return (
    <article
      data-testid={`lobby-pose-card-${player.id}`}
      data-pose-id={poseMeta.id}
      className={`${sizeClass} shrink-0 rounded-2xl overflow-hidden bg-slate-900 border border-slate-600/80 shadow-lg flex flex-col`}
    >
      <div className="relative w-full pb-[100%] bg-slate-800 overflow-hidden">
        {!imgFailed ? (
          <img
            src={poseMeta.imagePath}
            alt={`${player.name} (${poseMeta.label})`}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-slate-300">
            {player.name.slice(0, 2)}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2 bg-slate-950 border-t border-slate-700/80 text-center flex-1 flex flex-col justify-center min-h-[52px]">
        <div className="text-sm font-extrabold text-white truncate">
          {player.name}
        </div>
        {poseMeta.id !== 'default' && (
          <div className="text-[11px] font-medium text-indigo-300 truncate">
            {poseMeta.label}
          </div>
        )}
      </div>
    </article>
  );
});

interface SlidingCarouselRowProps {
  players: PlayerPublic[];
  direction: 'right' | 'left';
  tick: number;
  testId: string;
}

const SlidingCarouselRow: React.FC<SlidingCarouselRowProps> = ({
  players,
  direction,
  tick,
  testId,
}) => {
  const [shiftPx, setShiftPx] = useState(0);
  const [animateTransition, setAnimateTransition] = useState(false);
  const [settledTick, setSettledTick] = useState(tick);
  const prevTickRef = useRef(tick);

  const len = players.length;
  const activeTick = direction === 'right' ? tick : settledTick;
  const offset = useMemo(() => {
    if (len <= 1) return 0;
    return direction === 'right' ? -activeTick : activeTick;
  }, [direction, len, activeTick]);

  const visiblePlayers = useMemo(
    () => getWindowedCarouselItems(players, offset, MAX_LOBBY_CARDS_PER_ROW),
    [players, offset]
  );

  useEffect(() => {
    if (prevTickRef.current === tick) return;
    prevTickRef.current = tick;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (len <= 1 || prefersReduced) {
      setAnimateTransition(false);
      setShiftPx(0);
      setSettledTick(tick);
      return;
    }

    if (direction === 'right') {
      // Prepend incoming card at -162px then glide right to 0
      setAnimateTransition(false);
      setShiftPx(-CAROUSEL_CARD_STEP_PX);

      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setAnimateTransition(true);
          setShiftPx(0);
        });
      });

      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    // Leftward: glide current cards left (0 -> -162px), then snap-reset and rotate window
    setAnimateTransition(true);
    setShiftPx(-CAROUSEL_CARD_STEP_PX);
    const settleTimer = window.setTimeout(() => {
      setAnimateTransition(false);
      setShiftPx(0);
      setSettledTick(tick);
    }, 560);

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [tick, direction, len]);

  return (
    <div
      data-testid={testId}
      data-direction={direction}
      data-offset={direction === 'right' ? -tick : tick}
      data-rendered-cards={visiblePlayers.length}
      className="w-full overflow-hidden py-1"
    >
      <div
        className="flex items-stretch gap-3"
        style={{
          transform: `translate3d(${shiftPx}px, 0, 0)`,
          willChange: animateTransition ? 'transform' : 'auto',
          transition: animateTransition
            ? 'transform 550ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none',
        }}
      >
        {visiblePlayers.map((p) => (
          <PoseCard key={p.id} player={p} sizeClass="w-[150px]" />
        ))}
      </div>
    </div>
  );
};

export const LobbyPoseStage: React.FC<LobbyPoseStageProps> = ({
  players,
  roomCode,
}) => {
  const partitioned = useMemo(() => partitionLobbyPlayers(players), [players]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (partitioned.mode !== 'dual_carousel') {
      setTick(0);
      return;
    }
    const timer = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, LOBBY_CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [partitioned.mode]);

  return (
    <section
      data-testid="lobby-pose-stage"
      data-mode={partitioned.mode}
      className="w-full h-full rounded-3xl bg-slate-800/60 border border-slate-700 p-4 sm:p-5 flex flex-col justify-start gap-3 min-h-[420px] lg:min-h-[540px]"
    >
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h2 className="text-base sm:text-lg font-bold text-white">
            การ์ดตัวละครผู้เล่นในห้อง
          </h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-400">
          {players.length} การ์ด
        </span>
      </div>

      {partitioned.mode === 'empty' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 border border-dashed border-slate-700 rounded-2xl space-y-2">
          <p className="text-slate-300 font-semibold">
            กำลังรอผู้เล่นเข้าร่วมห้อง...
          </p>
          <p className="text-sm text-slate-400 max-w-md">
            เมื่อผู้เล่นสแกน QR Code หรือกรอกรหัส {roomCode} แล้วเลือกท่าทางตัวละคร การ์ดตัวละครจะมาแสดงบนหน้าจอนี้
          </p>
        </div>
      )}

      {partitioned.mode === 'static_few' && (
        <div
          data-testid="lobby-pose-static-few"
          className="flex-1 flex flex-wrap items-center justify-center gap-4 py-4"
        >
          {partitioned.topRow.map((p) => (
            <PoseCard key={p.id} player={p} sizeClass="w-[168px] sm:w-[184px]" />
          ))}
        </div>
      )}

      {partitioned.mode === 'static_grid' && (
        <div
          data-testid="lobby-pose-static-grid"
          className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 content-start max-h-[470px] overflow-y-auto pr-1 py-1"
        >
          {partitioned.topRow.map((p) => (
            <PoseCard key={p.id} player={p} sizeClass="w-full" />
          ))}
        </div>
      )}

      {partitioned.mode === 'dual_carousel' && (
        <div
          data-testid="lobby-pose-dual-carousel"
          className="flex-1 flex flex-col justify-center gap-5"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>แถวบน ({partitioned.topRow.length} คน)</span>
              <span className="inline-flex items-center gap-1 text-indigo-300">
                <span>เลื่อนขวา</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <SlidingCarouselRow
              players={partitioned.topRow}
              direction="right"
              tick={tick}
              testId="lobby-pose-row-top"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>แถวล่าง ({partitioned.bottomRow.length} คน)</span>
              <span className="inline-flex items-center gap-1 text-indigo-300">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>เลื่อนซ้าย</span>
              </span>
            </div>
            <SlidingCarouselRow
              players={partitioned.bottomRow}
              direction="left"
              tick={tick}
              testId="lobby-pose-row-bottom"
            />
          </div>
        </div>
      )}
    </section>
  );
};
