import React, { useState } from 'react';
import { Award, Flame, Search } from 'lucide-react';
import { PlayerPublic, RoomMode } from '../shared/types';
import { CuteAvatar } from './CuteAvatar';
import { PodiumStage } from './PodiumStage';
import { TeamBadge } from './TeamBattleBoard';

interface LeaderboardStageProps {
  players: PlayerPublic[];
  totalQuestions: number;
  mode?: RoomMode;
  highlightPlayerId?: string;
  isFinal?: boolean;
  hidePodium?: boolean;
  fireworksBurstKey?: number;
  darkSurface?: boolean;
}

export const LeaderboardStage: React.FC<LeaderboardStageProps> = ({
  players,
  totalQuestions,
  mode = 'single',
  highlightPlayerId,
  isFinal = false,
  hidePodium = false,
  fireworksBurstKey = 0,
  darkSurface = true,
}) => {
  const [search, setSearch] = useState('');

  const top3 = players.slice(0, 3);
  const filteredPlayers = search.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : players;

  const cardBg = darkSurface
    ? 'bg-slate-800/90 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const rowBg = darkSurface ? 'bg-slate-800/70 border-slate-700/80' : 'bg-slate-50 border-slate-200';
  const mutedText = darkSurface ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="w-full space-y-6" data-testid="leaderboard-stage">
      {isFinal && !hidePodium && top3.length > 0 && (
        <PodiumStage
          players={players}
          mode={mode}
          fireworksBurstKey={fireworksBurstKey}
          darkSurface={darkSurface}
        />
      )}

      <div className={`rounded-2xl border p-4 sm:p-5 ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold">
              ตารางจัดอันดับสด ({players.length} คน)
            </h3>
          </div>

          {players.length > 8 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อผู้เล่น..."
                aria-label="ค้นหาชื่อผู้เล่นในอันดับ"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  darkSurface
                    ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          )}
        </div>

        {filteredPlayers.length === 0 ? (
          <div className={`py-8 text-center text-sm ${mutedText}`}>
            ยังไม่มีผู้เล่นในตารางคะแนน
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredPlayers.map((p) => {
              const isMe = highlightPlayerId === p.id;
              const accuracy =
                totalQuestions > 0 ? Math.round((p.correctCount / totalQuestions) * 100) : 0;

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${
                    isMe
                      ? 'bg-indigo-600/25 border-indigo-400 ring-1 ring-indigo-400'
                      : rowBg
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-mono tabular-nums font-extrabold text-base w-8 text-center shrink-0 ${
                        p.rank === 1
                          ? 'text-amber-400'
                          : p.rank === 2
                            ? 'text-slate-300'
                            : p.rank === 3
                              ? 'text-orange-400'
                              : mutedText
                      }`}
                    >
                      #{p.rank}
                    </span>

                    <CuteAvatar avatarId={p.avatarId} size={40} />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-sm sm:text-base truncate">
                          {p.name}
                        </span>
                        {mode === 'team' && <TeamBadge team={p.team} compact />}
                        {isMe && (
                          <span className="text-xs font-semibold text-indigo-300 shrink-0">
                            (คุณ)
                          </span>
                        )}
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${mutedText}`}>
                        <span>ถูก {p.correctCount}/{Math.max(1, totalQuestions)} ข้อ</span>
                        <span aria-hidden="true">·</span>
                        <span>{accuracy}%</span>
                        {p.streak >= 2 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 text-amber-400 font-semibold">
                              <Flame className="w-3.5 h-3.5" />
                              {p.streak} ต่อเนื่อง
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums font-extrabold text-base sm:text-lg">
                      {p.score.toLocaleString()}
                    </div>
                    {p.lastPoints > 0 && !isFinal && (
                      <div className="font-mono tabular-nums text-xs font-semibold text-emerald-400">
                        +{p.lastPoints}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
