import React from 'react';
import { Crown, Shield, Swords, Trophy } from 'lucide-react';
import { computeTeamStandings, isValidTeamId, TEAM_META } from '../shared/quizLogic';
import { PlayerPublic, TeamId } from '../shared/types';

interface TeamBadgeProps {
  team?: TeamId | null;
  compact?: boolean;
  className?: string;
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({
  team,
  compact = false,
  className = '',
}) => {
  if (!isValidTeamId(team)) return null;
  const meta = TEAM_META[team];
  return (
    <span
      data-testid={`team-badge-${team}`}
      className={`inline-flex items-center gap-1 rounded-md font-bold shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } ${meta.badgeClass} ${className}`}
    >
      <span
        className={`rounded-sm shrink-0 ${
          compact ? 'w-1.5 h-1.5' : 'w-2 h-2'
        } ${team === 'red' ? 'bg-rose-400' : 'bg-sky-400'}`}
      />
      <span>{meta.label}</span>
    </span>
  );
};

interface TeamBattleBoardProps {
  players: PlayerPublic[];
  showWinner?: boolean;
  showMvp?: boolean;
  myTeam?: TeamId | null;
  title?: string;
  compact?: boolean;
}

export const TeamBattleBoard: React.FC<TeamBattleBoardProps> = ({
  players,
  showWinner = false,
  showMvp = false,
  myTeam = null,
  title = 'คะแนนรวม Team Battle (ทีมแดง VS ทีมน้ำเงิน)',
  compact = false,
}) => {
  const summary = computeTeamStandings(players);
  const redWins = showWinner && summary.winner === 'red';
  const blueWins = showWinner && summary.winner === 'blue';
  const isTie = showWinner && summary.winner === 'tie';

  const totalCombined = summary.red.totalScore + summary.blue.totalScore;
  const redRatio =
    totalCombined > 0 ? Math.round((summary.red.totalScore / totalCombined) * 100) : 50;

  return (
    <section
      data-testid="team-battle-board"
      className={`rounded-2xl border border-slate-700/90 bg-slate-800/85 ${
        compact ? 'p-3.5 space-y-3' : 'p-4 sm:p-5 space-y-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-amber-400 shrink-0" />
          <h3 className="text-sm sm:text-base font-extrabold text-white">{title}</h3>
        </div>

        {showWinner && (
          <div
            data-testid="team-battle-winner-banner"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold border ${
              redWins
                ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                : blueWins
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-amber-500/20 border-amber-400 text-amber-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>
              {redWins
                ? `ทีมแดงชนะ! (นำ ${summary.scoreDiff.toLocaleString()} คะแนน)`
                : blueWins
                  ? `ทีมน้ำเงินชนะ! (นำ ${summary.scoreDiff.toLocaleString()} คะแนน)`
                  : isTie
                    ? 'เสมอกันสุดมัน!'
                    : ''}
            </span>
          </div>
        )}
      </div>

      {/* Team VS Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          data-testid="team-score-card-red"
          className={`rounded-2xl border p-3.5 transition-all ${
            redWins
              ? 'bg-rose-950/80 border-rose-400 ring-2 ring-rose-400/50 shadow-lg shadow-rose-950/60'
              : 'bg-rose-950/45 border-rose-500/45'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base text-rose-200">
              <Shield className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{TEAM_META.red.label}</span>
              {myTeam === 'red' && (
                <span className="text-[11px] font-bold text-amber-300">(ทีมคุณ)</span>
              )}
            </div>
            {redWins && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl sm:text-3xl font-black text-white">
            {summary.red.totalScore.toLocaleString()}
          </div>
          <div className="text-xs text-rose-200/80">
            สมาชิก {summary.red.memberCount} คน
          </div>
        </div>

        <div
          data-testid="team-score-card-blue"
          className={`rounded-2xl border p-3.5 transition-all ${
            blueWins
              ? 'bg-sky-950/80 border-sky-400 ring-2 ring-sky-400/50 shadow-lg shadow-sky-950/60'
              : 'bg-sky-950/45 border-sky-500/45'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base text-sky-200">
              <Shield className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{TEAM_META.blue.label}</span>
              {myTeam === 'blue' && (
                <span className="text-[11px] font-bold text-amber-300">(ทีมคุณ)</span>
              )}
            </div>
            {blueWins && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl sm:text-3xl font-black text-white">
            {summary.blue.totalScore.toLocaleString()}
          </div>
          <div className="text-xs text-sky-200/80">
            สมาชิก {summary.blue.memberCount} คน
          </div>
        </div>
      </div>

      {/* Balance Bar */}
      <div className="h-2.5 w-full rounded-full overflow-hidden bg-sky-500/80 flex">
        <div
          className="h-full bg-rose-500 transition-all duration-500"
          style={{ width: `${redRatio}%` }}
        />
      </div>

      {showMvp && summary.mvp && (
        <div
          data-testid="team-battle-mvp-banner"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 border border-amber-400/40 px-3.5 py-2.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-amber-300">MVP คะแนนสูงสุด:</span>
            <span className="font-extrabold text-sm text-white truncate">
              {summary.mvp.name}
            </span>
            <TeamBadge team={summary.mvp.team} compact />
          </div>
          <span className="font-mono tabular-nums text-sm font-extrabold text-amber-300 shrink-0">
            {summary.mvp.score.toLocaleString()} คะแนน
          </span>
        </div>
      )}
    </section>
  );
};
