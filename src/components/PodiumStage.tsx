import React, { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import {
  FIREWORKS_DURATION_MS,
  PODIUM_STAGE_IMAGE,
  resolvePodiumCharacterAsset,
} from '../shared/podiumAssets';
import { AVATARS, PlayerPublic } from '../shared/types';
import { FireworksOverlay } from './FireworksOverlay';

interface PodiumStageProps {
  players: PlayerPublic[];
  fireworksBurstKey?: number;
  darkSurface?: boolean;
  visiblePlaces?: Array<1 | 2 | 3>;
  dimmed?: boolean;
  newlyRevealedPlace?: 1 | 2 | 3 | null;
  hideEmptyHint?: boolean;
  children?: React.ReactNode;
}

interface PedestalSlotConfig {
  place: 1 | 2 | 3;
  leftPercent: string;
  portraitBottomPercent: string;
  ringClass: string;
  scoreClass: string;
  badgeBgClass: string;
}

const PEDESTAL_SLOTS: PedestalSlotConfig[] = [
  {
    place: 2,
    leftPercent: '26.2%',
    portraitBottomPercent: '34.2%',
    ringClass: 'ring-slate-300',
    scoreClass: 'text-slate-200',
    badgeBgClass: 'border-slate-400/50 bg-slate-950/90',
  },
  {
    place: 1,
    leftPercent: '50%',
    portraitBottomPercent: '40.5%',
    ringClass: 'ring-amber-400',
    scoreClass: 'text-amber-300',
    badgeBgClass: 'border-amber-400/70 bg-slate-950/95 shadow-amber-500/20',
  },
  {
    place: 3,
    leftPercent: '73.8%',
    portraitBottomPercent: '30.5%',
    ringClass: 'ring-orange-400',
    scoreClass: 'text-orange-300',
    badgeBgClass: 'border-orange-400/50 bg-slate-950/90',
  },
];

export const PodiumStage: React.FC<PodiumStageProps> = ({
  players,
  fireworksBurstKey = 0,
  darkSurface = true,
  visiblePlaces,
  dimmed = false,
  newlyRevealedPlace = null,
  hideEmptyHint = false,
  children,
}) => {
  const top3 = players.slice(0, 3);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const visiblePlaceSet = visiblePlaces ? new Set(visiblePlaces) : null;

  useEffect(() => {
    setFailedImages({});
  }, [
    top3[0]?.id,
    top3[0]?.avatarId,
    top3[1]?.id,
    top3[1]?.avatarId,
    top3[2]?.id,
    top3[2]?.avatarId,
  ]);

  const dimFilterClass = dimmed
    ? 'brightness-[0.38] saturate-50 transition-all duration-500'
    : 'brightness-100 saturate-100 transition-all duration-500';

  return (
    <section
      data-testid="podium-stage"
      data-dimmed={dimmed ? 'true' : 'false'}
      className="rounded-3xl bg-slate-800/60 border border-slate-700/80 p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center justify-center gap-2">
        <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
        <h3
          className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
            darkSurface ? 'text-white' : 'text-slate-900'
          }`}
        >
          แท่นผู้ชนะอันดับสูงสุด
        </h3>
      </div>

      {/* 3D Spotlight Podium Stage */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-700/80 bg-[#091221] shadow-2xl select-none">
        <img
          src={PODIUM_STAGE_IMAGE}
          alt="แท่นรับรางวัลอันดับ 1 2 3"
          decoding="async"
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${dimFilterClass}`}
        />

        {top3.length === 0 && !hideEmptyHint && (
          <div className="absolute inset-x-4 bottom-4 flex justify-center">
            <div className="rounded-xl bg-slate-950/85 border border-slate-700 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-300">
              ยังไม่มีผู้เล่นขึ้นแท่นรางวัลในรอบนี้
            </div>
          </div>
        )}

        {/* Subtle bottom contrast band for crisp floor nameplates */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent"
        />

        {/* Top 3 Characters on Pedestals */}
        {PEDESTAL_SLOTS.map((slot) => {
          if (visiblePlaceSet && !visiblePlaceSet.has(slot.place)) return null;
          const player = top3[slot.place - 1];
          if (!player) return null;

          const avatarMeta = AVATARS.find((a) => a.id === player.avatarId) ?? AVATARS[0];
          const podiumAsset = resolvePodiumCharacterAsset(player.avatarId, slot.place);
          const imgKey = `${slot.place}-${player.avatarId}-${podiumAsset.imagePath}`;
          const imgFailed = Boolean(failedImages[imgKey]);
          const landAnimClass =
            newlyRevealedPlace === slot.place ? 'animate-showcase-pedestal-land' : '';

          return (
            <React.Fragment key={player.id}>
              {/* Character Visual Positioned Above Pedestal */}
              {slot.place === 1 && podiumAsset.isFullBodyWinner && !imgFailed ? (
                <div
                  data-testid="podium-winner-1-fullbody"
                  className={`pointer-events-none absolute z-10 -translate-x-1/2 flex items-end justify-center h-[56%] ${dimFilterClass} ${landAnimClass}`}
                  style={{ left: slot.leftPercent, bottom: '39%' }}
                >
                  <img
                    src={podiumAsset.imagePath}
                    alt={`${player.name} (${avatarMeta.name} - ${podiumAsset.label})`}
                    decoding="async"
                    draggable={false}
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [imgKey]: true }))
                    }
                    className="h-full w-auto max-w-none object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.7)]"
                  />
                </div>
              ) : (
                <div
                  data-testid={`podium-winner-${slot.place}-portrait`}
                  className={`pointer-events-none absolute z-10 -translate-x-1/2 flex flex-col items-center ${dimFilterClass} ${landAnimClass}`}
                  style={{
                    left: slot.leftPercent,
                    bottom: slot.portraitBottomPercent,
                    width: slot.place === 1 ? '17.5%' : '14.5%',
                  }}
                >
                  {slot.place === 1 && (
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] sm:text-xs font-extrabold text-slate-950 shadow-md">
                      <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>แชมป์</span>
                    </div>
                  )}
                  <div
                    className={`w-full aspect-square rounded-2xl overflow-hidden ring-2 sm:ring-4 ${slot.ringClass} ${avatarMeta.bgClass} shadow-[0_10px_24px_rgba(0,0,0,0.65)]`}
                  >
                    {!imgFailed ? (
                      <img
                        src={podiumAsset.imagePath}
                        alt={`${player.name} (${avatarMeta.name})`}
                        decoding="async"
                        draggable={false}
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [imgKey]: true }))
                        }
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-extrabold text-slate-800 text-base sm:text-xl">
                        {player.name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Crisp Floor Nameplate & Score Beneath Each Pedestal */}
              <div
                data-testid={`podium-plate-${slot.place}`}
                className={`absolute z-10 -translate-x-1/2 bottom-2 sm:bottom-3 rounded-xl border px-2 sm:px-3 py-1 sm:py-1.5 text-center shadow-lg backdrop-blur-sm ${slot.badgeBgClass} ${dimFilterClass} ${landAnimClass}`}
                style={{
                  left: slot.leftPercent,
                  width: slot.place === 1 ? '26%' : '22.5%',
                }}
              >
                <div className="font-extrabold text-[11px] sm:text-sm text-white truncate">
                  {player.name}
                </div>
                <div className="hidden sm:block text-[10px] text-slate-400 truncate">
                  {avatarMeta.name}
                </div>
                <div
                  className={`font-mono tabular-nums font-extrabold text-[11px] sm:text-sm leading-tight ${slot.scoreClass}`}
                >
                  {player.score.toLocaleString()} <span className="font-sans text-[10px] font-semibold opacity-85">คะแนน</span>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Suspense Scrim Layer (dims podium & placed winners during announcement) */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-20 bg-slate-950/60 transition-opacity duration-500 ${
            dimmed ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Foreground Announcement Overlay Slot */}
        {children}

        {/* 5-Second Fireworks Celebration Layer */}
        <FireworksOverlay
          burstKey={fireworksBurstKey}
          durationMs={FIREWORKS_DURATION_MS}
        />
      </div>
    </section>
  );
};
