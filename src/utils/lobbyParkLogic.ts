import { AvatarId, PlayerPublic } from '../shared/types';

export type ParkAction = 'walk' | 'run' | 'sit' | 'wave' | 'chat';

export interface ParkActor {
  id: string;
  name: string;
  avatarId: AvatarId;
  x: number; // percentage 8..92
  y: number; // percentage 62..89
  targetX: number;
  targetY: number;
  facing: 1 | -1;
  action: ParkAction;
  actionUntilMs: number;
  chatCooldownUntilMs: number;
  emote: string | null;
  emoteUntilMs: number;
  seatIndex: number | null;
}

export const PARK_PLAYABLE_BOUNDS = {
  minX: 8,
  maxX: 92,
  minY: 62,
  maxY: 89,
} as const;

export const PARK_REST_SPOTS: ReadonlyArray<{ x: number; y: number; label: string }> = [
  { x: 13.5, y: 75.5, label: 'ม้านั่งซ้าย' },
  { x: 17.5, y: 74.8, label: 'ม้านั่งซ้าย' },
  { x: 21.5, y: 74.2, label: 'ม้านั่งซ้าย' },
  { x: 72.5, y: 73.2, label: 'ม้านั่งขวา' },
  { x: 76.2, y: 73.6, label: 'ม้านั่งขวา' },
  { x: 79.8, y: 74.0, label: 'ม้านั่งขวา' },
  { x: 35.0, y: 66.5, label: 'สนามหญ้า' },
  { x: 52.0, y: 65.5, label: 'สนามหญ้า' },
  { x: 46.5, y: 84.5, label: 'ทางเดินสวน' },
  { x: 63.0, y: 82.0, label: 'สนามหญ้า' },
];

const GREETING_EMOTES = [
  'พร้อมแล้ว!',
  'สู้ๆ นะ!',
  'มาแข่งกัน!',
  'สวัสดีทุกคน!',
  'รอลุ้นข้อแรก!',
  'เย้!',
];

const CHAT_EMOTES = ['ทักทาย!', 'ดีจ้า!', 'เจอกันบนโพเดียม!', 'พร้อมยัง?'];

const SIT_EMOTES = ['นั่งพักแป๊บ', 'รอเริ่มเกม...', 'ชิลๆ ในสวน'];

const RUN_EMOTES = ['วิ่งเล่นๆ!', 'วู้ฮู้!', 'ฟิตร่างกาย!'];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickFrom<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

function randomWalkTarget(rng: () => number): { x: number; y: number } {
  return {
    x:
      PARK_PLAYABLE_BOUNDS.minX +
      rng() * (PARK_PLAYABLE_BOUNDS.maxX - PARK_PLAYABLE_BOUNDS.minX),
    y:
      PARK_PLAYABLE_BOUNDS.minY +
      rng() * (PARK_PLAYABLE_BOUNDS.maxY - PARK_PLAYABLE_BOUNDS.minY),
  };
}

function chooseNextAction(
  actor: ParkActor,
  occupiedSeats: Set<number>,
  nowMs: number,
  rng: () => number
): ParkActor {
  const roll = rng();

  if (roll < 0.42) {
    // Walk around the lawn
    const target = randomWalkTarget(rng);
    return {
      ...actor,
      action: 'walk',
      targetX: target.x,
      targetY: target.y,
      seatIndex: null,
      actionUntilMs: nowMs + 3500 + rng() * 3500,
    };
  }

  if (roll < 0.68) {
    // Run playfully across the park
    const target = randomWalkTarget(rng);
    return {
      ...actor,
      action: 'run',
      targetX: target.x,
      targetY: target.y,
      seatIndex: null,
      actionUntilMs: nowMs + 2200 + rng() * 2200,
      emote: rng() < 0.45 ? pickFrom(RUN_EMOTES, rng) : null,
      emoteUntilMs: nowMs + 2400,
    };
  }

  if (roll < 0.88) {
    // Sit/rest on a bench or lawn spot
    const availableSeats = PARK_REST_SPOTS.map((_, idx) => idx).filter(
      (idx) => !occupiedSeats.has(idx)
    );
    const chosenIdx =
      availableSeats.length > 0
        ? pickFrom(availableSeats, rng)
        : Math.floor(rng() * PARK_REST_SPOTS.length);
    occupiedSeats.add(chosenIdx);
    const spot = PARK_REST_SPOTS[chosenIdx];
    return {
      ...actor,
      action: 'sit',
      targetX: spot.x,
      targetY: spot.y,
      seatIndex: chosenIdx,
      actionUntilMs: nowMs + 5000 + rng() * 4500,
      emote: rng() < 0.4 ? pickFrom(SIT_EMOTES, rng) : null,
      emoteUntilMs: nowMs + 2800,
    };
  }

  // Wave and cheer
  return {
    ...actor,
    action: 'wave',
    targetX: actor.x,
    targetY: actor.y,
    seatIndex: null,
    actionUntilMs: nowMs + 2200 + rng() * 1400,
    emote: pickFrom(GREETING_EMOTES, rng),
    emoteUntilMs: nowMs + 2800,
  };
}

export function syncParkActors(
  prevActors: ParkActor[],
  players: PlayerPublic[],
  maxActors = 45,
  nowMs = Date.now(),
  rng: () => number = Math.random
): ParkActor[] {
  const visiblePlayers = players.slice(0, maxActors);
  const prevMap = new Map(prevActors.map((a) => [a.id, a]));
  const occupiedSeats = new Set<number>();

  prevActors.forEach((a) => {
    if (a.seatIndex !== null && visiblePlayers.some((p) => p.id === a.id)) {
      occupiedSeats.add(a.seatIndex);
    }
  });

  return visiblePlayers.map((player) => {
    const existing = prevMap.get(player.id);
    if (existing) {
      return {
        ...existing,
        name: player.name,
        avatarId: player.avatarId,
      };
    }

    // Deterministic entry spawn spread along the sandy path & grass
    const seed = hashString(player.id);
    const spawnX = 18 + ((seed % 65) + rng() * 6);
    const spawnY = 71 + (((seed >> 4) % 15) + rng() * 3);
    const boundedX = clamp(spawnX, PARK_PLAYABLE_BOUNDS.minX, PARK_PLAYABLE_BOUNDS.maxX);
    const boundedY = clamp(spawnY, PARK_PLAYABLE_BOUNDS.minY, PARK_PLAYABLE_BOUNDS.maxY);

    const initialAction: ParkAction = seed % 3 === 0 ? 'run' : seed % 3 === 1 ? 'walk' : 'wave';
    const target =
      initialAction === 'wave'
        ? { x: boundedX, y: boundedY }
        : randomWalkTarget(rng);

    return {
      id: player.id,
      name: player.name,
      avatarId: player.avatarId,
      x: boundedX,
      y: boundedY,
      targetX: target.x,
      targetY: target.y,
      facing: target.x >= boundedX ? 1 : -1,
      action: initialAction,
      actionUntilMs: nowMs + 2500 + (seed % 2500),
      chatCooldownUntilMs: nowMs + 3000,
      emote: 'เข้าห้องแล้ว!',
      emoteUntilMs: nowMs + 3200,
      seatIndex: null,
    };
  });
}

export function stepParkActors(
  actors: ParkActor[],
  dtSec: number,
  nowMs = Date.now(),
  rng: () => number = Math.random
): ParkActor[] {
  const safeDt = Math.max(0, Math.min(0.2, dtSec));
  const occupiedSeats = new Set<number>();
  for (const actor of actors) {
    if (actor.seatIndex !== null) occupiedSeats.add(actor.seatIndex);
  }

  // 1. Move actors toward target or rotate expired actions
  const moved = actors.map((actor) => {
    let next = actor;

    if (next.emote && nowMs >= next.emoteUntilMs) {
      next = { ...next, emote: null };
    }

    const dx = next.targetX - next.x;
    const dy = next.targetY - next.y;
    const dist = Math.hypot(dx, dy);

    const isMovingAction = next.action === 'walk' || next.action === 'run' || (next.action === 'sit' && dist > 0.6);

    if (isMovingAction && dist > 0.4) {
      const speed =
        next.action === 'run'
          ? 11.5
          : next.action === 'sit'
          ? 7.0
          : 5.5;
      const step = Math.min(dist, speed * safeDt);
      const nx = clamp(
        next.x + (dx / dist) * step,
        PARK_PLAYABLE_BOUNDS.minX,
        PARK_PLAYABLE_BOUNDS.maxX
      );
      const ny = clamp(
        next.y + (dy / dist) * step,
        PARK_PLAYABLE_BOUNDS.minY,
        PARK_PLAYABLE_BOUNDS.maxY
      );
      const facing: 1 | -1 = Math.abs(dx) > 0.25 ? (dx >= 0 ? 1 : -1) : next.facing;
      next = { ...next, x: nx, y: ny, facing };
    } else if (nowMs >= next.actionUntilMs) {
      if (next.seatIndex !== null) {
        occupiedSeats.delete(next.seatIndex);
      }
      next = chooseNextAction(next, occupiedSeats, nowMs, rng);
    }

    return next;
  });

  // 2. Proximity friendly chat interaction between roaming actors
  for (let i = 0; i < moved.length; i++) {
    const a = moved[i];
    if (
      (a.action !== 'walk' && a.action !== 'run') ||
      nowMs < a.chatCooldownUntilMs
    ) {
      continue;
    }

    for (let j = i + 1; j < moved.length; j++) {
      const b = moved[j];
      if (
        (b.action !== 'walk' && b.action !== 'run') ||
        nowMs < b.chatCooldownUntilMs
      ) {
        continue;
      }

      const dist = Math.hypot(a.x - b.x, (a.y - b.y) * 1.4);
      if (dist < 7.5 && rng() < 0.22) {
        const aFacing: 1 | -1 = b.x >= a.x ? 1 : -1;
        const bFacing: 1 | -1 = a.x >= b.x ? 1 : -1;
        moved[i] = {
          ...a,
          action: 'chat',
          targetX: a.x,
          targetY: a.y,
          facing: aFacing,
          actionUntilMs: nowMs + 2200,
          chatCooldownUntilMs: nowMs + 11000,
          emote: pickFrom(CHAT_EMOTES, rng),
          emoteUntilMs: nowMs + 2400,
        };
        moved[j] = {
          ...b,
          action: 'chat',
          targetX: b.x,
          targetY: b.y,
          facing: bFacing,
          actionUntilMs: nowMs + 2200,
          chatCooldownUntilMs: nowMs + 11000,
          emote: pickFrom(CHAT_EMOTES, rng),
          emoteUntilMs: nowMs + 2400,
        };
        break;
      }
    }
  }

  return moved;
}

export function triggerParkReaction(
  actors: ParkActor[],
  targetId: string | 'all',
  command: 'wave' | 'run' | 'sit',
  nowMs = Date.now(),
  rng: () => number = Math.random
): ParkActor[] {
  const occupiedSeats = new Set<number>();

  return actors.map((actor, index) => {
    if (targetId !== 'all' && actor.id !== targetId) {
      return actor;
    }

    if (command === 'wave') {
      return {
        ...actor,
        action: 'wave',
        targetX: actor.x,
        targetY: actor.y,
        seatIndex: null,
        actionUntilMs: nowMs + 2600,
        emote: pickFrom(GREETING_EMOTES, rng),
        emoteUntilMs: nowMs + 2800,
      };
    }

    if (command === 'run') {
      const target = randomWalkTarget(rng);
      return {
        ...actor,
        action: 'run',
        targetX: target.x,
        targetY: target.y,
        seatIndex: null,
        actionUntilMs: nowMs + 3400,
        emote: pickFrom(RUN_EMOTES, rng),
        emoteUntilMs: nowMs + 2500,
      };
    }

    // Sit/rest
    const spotIdx = index % PARK_REST_SPOTS.length;
    occupiedSeats.add(spotIdx);
    const spot = PARK_REST_SPOTS[spotIdx];
    return {
      ...actor,
      action: 'sit',
      targetX: spot.x,
      targetY: spot.y,
      seatIndex: spotIdx,
      actionUntilMs: nowMs + 6000,
      emote: pickFrom(SIT_EMOTES, rng),
      emoteUntilMs: nowMs + 2800,
    };
  });
}

export function getParkActionLabel(action: ParkAction): string {
  switch (action) {
    case 'walk':
      return 'กำลังเดินเล่น';
    case 'run':
      return 'กำลังวิ่งเล่น';
    case 'sit':
      return 'นั่งพักรอ';
    case 'wave':
      return 'กำลังทักทาย';
    case 'chat':
      return 'คุยกับเพื่อน';
  }
}
