import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, Footprints, Hand, Sparkles, Zap } from 'lucide-react';
import { AVATARS, PlayerPublic } from '../shared/types';
import {
  getParkActionLabel,
  ParkActor,
  stepParkActors,
  syncParkActors,
  triggerParkReaction,
} from '../utils/lobbyParkLogic';
import { soundFx } from '../utils/soundFx';

interface LobbyParkStageProps {
  roomCode: string;
  players: PlayerPublic[];
  highlightedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
}

const PARK_IMAGE_URL = '/assets/aistudio/Gemini_Generated_Image_odhsctodhsctodhs_52acc856.jpg';
const MAX_PARK_ACTORS = 45;

export const LobbyParkStage: React.FC<LobbyParkStageProps> = ({
  roomCode,
  players,
  highlightedPlayerId = null,
  onSelectPlayer,
}) => {
  const [actors, setActors] = useState<ParkActor[]>(() =>
    syncParkActors([], players, MAX_PARK_ACTORS, Date.now())
  );
  const lastFrameRef = useRef<number>(Date.now());

  // Sync incoming/leaving players while keeping existing positions & animations
  useEffect(() => {
    setActors((prev) => syncParkActors(prev, players, MAX_PARK_ACTORS, Date.now()));
  }, [players]);

  // Smooth ~24fps actor simulation loop (CSS transition smooths between ticks)
  useEffect(() => {
    if (players.length === 0) return;

    lastFrameRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const dtSec = Math.min(0.15, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      setActors((prev) => stepParkActors(prev, dtSec, now));
    }, 65);

    return () => window.clearInterval(interval);
  }, [players.length]);

  // Trigger cheerful wave reaction when moderator highlights a player from roster
  useEffect(() => {
    if (!highlightedPlayerId) return;
    setActors((prev) => triggerParkReaction(prev, highlightedPlayerId, 'wave', Date.now()));
  }, [highlightedPlayerId]);

  const sortedActors = useMemo(() => {
    return [...actors].sort((a, b) => a.y - b.y);
  }, [actors]);

  const actionCounts = useMemo(() => {
    let walking = 0;
    let running = 0;
    let sitting = 0;
    for (const a of actors) {
      if (a.action === 'walk') walking++;
      else if (a.action === 'run') running++;
      else if (a.action === 'sit') sitting++;
    }
    return { walking, running, sitting };
  }, [actors]);

  const handleActorClick = (actorId: string) => {
    soundFx.unlock();
    soundFx.playAnswerLock();
    setActors((prev) => triggerParkReaction(prev, actorId, 'wave', Date.now()));
    onSelectPlayer?.(actorId);
  };

  const handleGroupCommand = (command: 'wave' | 'run' | 'sit') => {
    if (actors.length === 0) return;
    soundFx.unlock();
    soundFx.playAnswerLock();
    setActors((prev) => triggerParkReaction(prev, 'all', command, Date.now()));
  };

  return (
    <div
      className="rounded-3xl bg-slate-800/70 border border-slate-700 p-4 sm:p-5 flex flex-col gap-3.5"
      data-testid="lobby-park-stage"
    >
      {/* Top Park Controls & Activity Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              ลานกิจกรรมรอเริ่มเกม
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            {players.length === 0
              ? 'ผู้เล่นที่เลือกตัวละครแล้วจะมาเดินเล่น วิ่งเล่น และนั่งรอในลานหญ้านี้'
              : `เดินเล่น ${actionCounts.walking} · วิ่งเล่น ${actionCounts.running} · นั่งรอ ${actionCounts.sitting}${
                  players.length > MAX_PARK_ACTORS
                    ? ` · แสดงในลาน ${MAX_PARK_ACTORS} จาก ${players.length} คน`
                    : ''
                }`}
          </p>
        </div>

        {/* Moderator Interactive Park Commands */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={actors.length === 0}
            onClick={() => handleGroupCommand('wave')}
            className="min-h-[34px] px-3 rounded-xl bg-slate-700/90 hover:bg-indigo-600 disabled:opacity-40 text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>ทักทายทุกคน</span>
          </button>
          <button
            type="button"
            disabled={actors.length === 0}
            onClick={() => handleGroupCommand('run')}
            className="min-h-[34px] px-3 rounded-xl bg-slate-700/90 hover:bg-emerald-600 disabled:opacity-40 text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>ชวนวิ่งเล่น</span>
          </button>
          <button
            type="button"
            disabled={actors.length === 0}
            onClick={() => handleGroupCommand('sit')}
            className="min-h-[34px] px-3 rounded-xl bg-slate-700/90 hover:bg-amber-600 disabled:opacity-40 text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Armchair className="w-3.5 h-3.5" />
            <span>นั่งพักรอ</span>
          </button>
        </div>
      </div>

      {/* Grassy Park 16:9 Canvas */}
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-slate-700/80 bg-sky-200 shadow-inner select-none">
        <img
          src={PARK_IMAGE_URL}
          alt="ลานหญ้าสวนสาธารณะสำหรับผู้เล่นรอเริ่มเกม"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Subtle bottom contrast vignette so player names pop cleanly against bright grass */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/35 to-transparent"
        />

        {/* Empty State Overlay inside Park */}
        {players.length === 0 && (
          <div className="absolute inset-x-4 bottom-6 sm:bottom-8 flex justify-center pointer-events-none">
            <div className="max-w-md rounded-2xl bg-slate-950/75 backdrop-blur-sm border border-white/15 px-5 py-3.5 text-center shadow-xl">
              <p className="text-sm sm:text-base font-bold text-white">
                กำลังรอผู้เล่นเข้ามาเดินเล่นในลานหญ้า...
              </p>
              <p className="text-xs text-slate-200 mt-0.5">
                สแกน QR Code หรือกรอกรหัส {roomCode} เพื่อส่งตัวละครเข้าลานนี้
              </p>
            </div>
          </div>
        )}

        {/* Live Animated Player Characters */}
        {sortedActors.map((actor) => {
          const meta = AVATARS.find((a) => a.id === actor.avatarId) ?? AVATARS[0];
          const isCharacter = meta.category === 'character';
          const isHighlighted = highlightedPlayerId === actor.id;
          // Depth scale: back lawn (62%) -> 0.78x, front lawn (89%) -> 1.08x
          const depthScale = 0.78 + ((actor.y - 62) / (89 - 62)) * 0.3;

          const animClass =
            actor.action === 'run'
              ? 'animate-park-run'
              : actor.action === 'walk'
              ? 'animate-park-walk'
              : actor.action === 'sit'
              ? 'animate-park-sit'
              : 'animate-park-wave';

          const distToTarget = Math.hypot(actor.targetX - actor.x, actor.targetY - actor.y);
          const isSittingStill = actor.action === 'sit' && distToTarget < 1.2;

          return (
            <button
              key={actor.id}
              type="button"
              data-testid={`park-actor-${actor.id}`}
              onClick={() => handleActorClick(actor.id)}
              title={`${actor.name} · ${getParkActionLabel(actor.action)} (คลิกเพื่อทักทาย)`}
              className="group absolute -translate-x-1/2 -translate-y-full focus:outline-none cursor-pointer"
              style={{
                left: `${actor.x}%`,
                top: `${actor.y}%`,
                zIndex: isHighlighted ? 999 : Math.round(actor.y * 10),
                transition: 'left 90ms linear, top 90ms linear',
              }}
            >
              <div
                className="relative flex flex-col items-center"
                style={{
                  transform: `scale(${depthScale})`,
                  transformOrigin: 'bottom center',
                }}
              >
                {/* Speech / Emote Bubble */}
                {actor.emote && (
                  <div
                    key={`${actor.id}-${actor.emoteUntilMs}`}
                    className="animate-park-bubble pointer-events-none absolute -top-9 left-1/2 whitespace-nowrap rounded-xl bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-900 shadow-md border border-slate-200 z-20"
                  >
                    {actor.emote}
                  </div>
                )}

                {/* Player Nameplate + Action Hint on Hover */}
                <div
                  className={`mb-0.5 px-2 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap shadow-sm transition-colors ${
                    isHighlighted
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                      : 'bg-slate-950/80 text-white group-hover:bg-indigo-600'
                  }`}
                >
                  <span className="max-w-[96px] inline-block truncate align-bottom">
                    {actor.name}
                  </span>
                </div>

                {/* Character Sprite with Action Motion & Direction Flip */}
                <div
                  className={`relative ${animClass}`}
                  style={{
                    transformOrigin: 'bottom center',
                  }}
                >
                  <div
                    style={{
                      transform: `scaleX(${actor.facing})`,
                      transition: 'transform 140ms ease',
                    }}
                  >
                    {isCharacter ? (
                      <img
                        src={meta.imagePath}
                        alt={actor.name}
                        draggable={false}
                        className={`w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)] ${
                          isSittingStill ? 'translate-y-1.5' : ''
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full overflow-hidden border-2 border-white shadow-md ${meta.bgClass}`}
                      >
                        <img
                          src={meta.imagePath}
                          alt={actor.name}
                          draggable={false}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Soft Ground Shadow */}
                <div
                  aria-hidden="true"
                  className={`-mt-1.5 h-2 rounded-full bg-slate-950/35 blur-[1.5px] transition-all ${
                    actor.action === 'run' ? 'w-9 opacity-25' : 'w-11 opacity-40'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
        <span className="inline-flex items-center gap-1.5">
          <Footprints className="w-3.5 h-3.5 text-emerald-400" />
          <span>คลิกที่ตัวละครในสวน หรือคลิกชื่อผู้เล่นทางซ้าย เพื่อทักทายและเรียกความสนใจ</span>
        </span>
        <span className="font-mono tabular-nums text-slate-300">
          ในลาน {actors.length} ตัวละคร
        </span>
      </div>
    </div>
  );
};
