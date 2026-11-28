import { computeTeamStandings, TeamStandingsSummary } from '../shared/quizLogic';
import { PlayerPublic } from '../shared/types';

export type ShowcasePlace = 1 | 2 | 3;

export const SHOWCASE_AUDIO = {
  rank2And3: '/assets/audio/rank_2_3.mp3',
  rank1: '/assets/audio/rank_1.mp3',
} as const;

export const SHOWCASE_TIMINGS = {
  INITIAL_PODIUM_WAIT_MS: 900,
  RANK_2_3_NAME_REVEAL_MS: 1200,
  RANK_2_3_SETTLE_MS: 3100,
  AFTER_RANK_3_WAIT_MS: 5000,
  AFTER_RANK_2_WAIT_MS: 5000,
  RANK_1_NAME_REVEAL_MS: 4600,
  RANK_1_SETTLE_MS: 6900,
  RANK_1_CELEBRATION_MS: 3800,
} as const;

export interface ShowcaseEntry {
  place: ShowcasePlace;
  player: PlayerPublic;
  audioPath: string;
  nameRevealMs: number;
  settleMs: number;
  postSettlePauseMs: number;
}

export function getShowcaseAudioForPlace(place: ShowcasePlace): string {
  return place === 1 ? SHOWCASE_AUDIO.rank1 : SHOWCASE_AUDIO.rank2And3;
}

export function buildShowcaseQueue(players: PlayerPublic[]): ShowcaseEntry[] {
  const top3 = players.slice(0, 3);
  const entries: ShowcaseEntry[] = [];

  for (const place of [3, 2, 1] as const) {
    const player = top3[place - 1];
    if (!player) continue;

    if (place === 1) {
      entries.push({
        place: 1,
        player,
        audioPath: getShowcaseAudioForPlace(1),
        nameRevealMs: SHOWCASE_TIMINGS.RANK_1_NAME_REVEAL_MS,
        settleMs: SHOWCASE_TIMINGS.RANK_1_SETTLE_MS,
        postSettlePauseMs: SHOWCASE_TIMINGS.RANK_1_CELEBRATION_MS,
      });
    } else {
      entries.push({
        place,
        player,
        audioPath: getShowcaseAudioForPlace(place),
        nameRevealMs: SHOWCASE_TIMINGS.RANK_2_3_NAME_REVEAL_MS,
        settleMs: SHOWCASE_TIMINGS.RANK_2_3_SETTLE_MS,
        postSettlePauseMs:
          place === 3
            ? SHOWCASE_TIMINGS.AFTER_RANK_3_WAIT_MS
            : SHOWCASE_TIMINGS.AFTER_RANK_2_WAIT_MS,
      });
    }
  }

  return entries;
}

export function getPlacedPlacesForStep(
  queue: ShowcaseEntry[],
  currentIndex: number,
  currentSettled: boolean
): ShowcasePlace[] {
  if (currentIndex < 0) return [];
  const places: ShowcasePlace[] = [];
  for (let i = 0; i < queue.length; i++) {
    if (i < currentIndex || (i === currentIndex && currentSettled)) {
      places.push(queue[i].place);
    }
  }
  return places;
}

export function buildShowcaseTeamSummary(players: PlayerPublic[]): TeamStandingsSummary {
  return computeTeamStandings(players);
}
