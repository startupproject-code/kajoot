import { PlayerPublic } from '../shared/types';

export type LobbyDisplayMode = 'empty' | 'static_few' | 'static_grid' | 'dual_carousel';

export interface PartitionedLobbyRows {
  mode: LobbyDisplayMode;
  topRow: PlayerPublic[];
  bottomRow: PlayerPublic[];
}

export const DUAL_CAROUSEL_PLAYER_THRESHOLD = 10;
export const LOBBY_CAROUSEL_INTERVAL_MS = 2000;
export const MAX_LOBBY_VISIBLE_CARDS = 20;
export const MAX_LOBBY_CARDS_PER_ROW = MAX_LOBBY_VISIBLE_CARDS / 2;

export function partitionLobbyPlayers(players: PlayerPublic[]): PartitionedLobbyRows {
  if (players.length === 0) {
    return { mode: 'empty', topRow: [], bottomRow: [] };
  }
  if (players.length <= 3) {
    return { mode: 'static_few', topRow: players, bottomRow: [] };
  }
  if (players.length <= DUAL_CAROUSEL_PLAYER_THRESHOLD) {
    return { mode: 'static_grid', topRow: players, bottomRow: [] };
  }

  // Strictly unique split between top row and bottom row (zero duplicates across rows)
  const topRow: PlayerPublic[] = [];
  const bottomRow: PlayerPublic[] = [];
  players.forEach((p, idx) => {
    if (idx % 2 === 0) {
      topRow.push(p);
    } else {
      bottomRow.push(p);
    }
  });

  return {
    mode: 'dual_carousel',
    topRow,
    bottomRow,
  };
}

export function rotateItems<T>(items: T[], offset: number): T[] {
  const len = items.length;
  if (len <= 1) return items;
  const normalized = ((offset % len) + len) % len;
  if (normalized === 0) return items;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

export function getWindowedCarouselItems<T>(
  items: T[],
  offset: number,
  maxVisible: number = MAX_LOBBY_CARDS_PER_ROW
): T[] {
  const len = items.length;
  if (len === 0 || maxVisible <= 0) return [];
  const windowSize = Math.min(len, maxVisible);
  const start = ((offset % len) + len) % len;
  const result: T[] = [];
  for (let i = 0; i < windowSize; i += 1) {
    result.push(items[(start + i) % len]);
  }
  return result;
}
