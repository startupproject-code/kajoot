import { PlayerPublic } from '../shared/types';

export type LobbyDisplayMode = 'empty' | 'static_few' | 'static_grid' | 'dual_carousel';

export interface PartitionedLobbyRows {
  mode: LobbyDisplayMode;
  topRow: PlayerPublic[];
  bottomRow: PlayerPublic[];
}

export const DUAL_CAROUSEL_PLAYER_THRESHOLD = 10;
export const LOBBY_CAROUSEL_INTERVAL_MS = 2000;

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
