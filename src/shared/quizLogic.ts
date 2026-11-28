import { AnswerIndex, AvatarId, AVATARS, PlayerPublic, QuizQuestion, RoomMode, TeamId } from './types';

export function generateRoomCode(existingCodes: Set<string>): string {
  if (existingCodes.size >= 9000) {
    throw new Error('ไม่มีรหัสห้องว่างในขณะนี้');
  }
  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  for (let num = 1000; num <= 9999; num++) {
    const code = String(num);
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error('ไม่สามารถสร้างรหัสห้อง 4 หลักได้');
}

export function isValidRoomCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

export function isValidAvatarId(avatarId: string): avatarId is AvatarId {
  return AVATARS.some((a) => a.id === avatarId);
}

export const MIN_CORRECT_ANSWER_POINTS = 50;
export const CORRECT_ORDER_PENALTY_STEP = 50;

export function calculatePoints(params: {
  isCorrect: boolean;
  remainingMs: number;
  totalMs: number;
  streak: number;
  correctOrderIndex?: number;
}): number {
  if (!params.isCorrect) {
    return 0;
  }
  const safeTotal = Math.max(1000, params.totalMs);
  const clampedRemaining = Math.max(0, Math.min(safeTotal, params.remainingMs));
  const ratio = clampedRemaining / safeTotal;
  const basePoints = 500;
  const speedBonus = Math.round(500 * ratio);
  const streakBonus = Math.min(250, Math.max(0, params.streak - 1) * 50);
  const rawPoints = basePoints + speedBonus + streakBonus;
  const orderIndex = Math.max(0, Math.floor(params.correctOrderIndex ?? 0));
  const orderPenalty = orderIndex * CORRECT_ORDER_PENALTY_STEP;
  return Math.max(MIN_CORRECT_ANSWER_POINTS, rawPoints - orderPenalty);
}

export function assignCorrectAnswerOrder(
  correctEntries: Array<{ playerId: string; answeredAtMs: number }>
): Map<string, number> {
  const sorted = [...correctEntries].sort((a, b) => {
    if (a.answeredAtMs !== b.answeredAtMs) {
      return a.answeredAtMs - b.answeredAtMs;
    }
    return a.playerId.localeCompare(b.playerId);
  });
  const orderMap = new Map<string, number>();
  sorted.forEach((entry, idx) => {
    orderMap.set(entry.playerId, idx);
  });
  return orderMap;
}

export interface TeamMeta {
  id: TeamId;
  label: string;
  shortLabel: string;
  badgeClass: string;
  panelClass: string;
  accentTextClass: string;
}

export const TEAM_META: Record<TeamId, TeamMeta> = {
  red: {
    id: 'red',
    label: 'ทีมแดง',
    shortLabel: 'แดง',
    badgeClass: 'bg-rose-500/20 text-rose-200 border border-rose-400/50',
    panelClass: 'bg-rose-950/55 border-rose-500/50',
    accentTextClass: 'text-rose-300',
  },
  blue: {
    id: 'blue',
    label: 'ทีมน้ำเงิน',
    shortLabel: 'น้ำเงิน',
    badgeClass: 'bg-sky-500/20 text-sky-200 border border-sky-400/50',
    panelClass: 'bg-sky-950/55 border-sky-500/50',
    accentTextClass: 'text-sky-300',
  },
};

export function isValidTeamId(team: unknown): team is TeamId {
  return team === 'red' || team === 'blue';
}

export function pickBalancedTeam(players: Array<{ team?: TeamId | null }>): TeamId {
  let redCount = 0;
  let blueCount = 0;
  for (const p of players) {
    if (p.team === 'red') redCount += 1;
    else if (p.team === 'blue') blueCount += 1;
  }
  return redCount <= blueCount ? 'red' : 'blue';
}

export function computeTeamRebalanceUpdates<
  T extends { id: string; team?: TeamId | null },
>(players: T[]): Array<{ id: string; team: TeamId }> {
  if (players.length === 0) return [];

  const assigned = new Map<string, TeamId>();
  let redIds: string[] = [];
  let blueIds: string[] = [];
  const unassignedIds: string[] = [];

  for (const p of players) {
    if (p.team === 'red') {
      assigned.set(p.id, 'red');
      redIds.push(p.id);
    } else if (p.team === 'blue') {
      assigned.set(p.id, 'blue');
      blueIds.push(p.id);
    } else {
      unassignedIds.push(p.id);
    }
  }

  for (const id of unassignedIds) {
    if (redIds.length <= blueIds.length) {
      assigned.set(id, 'red');
      redIds.push(id);
    } else {
      assigned.set(id, 'blue');
      blueIds.push(id);
    }
  }

  while (redIds.length - blueIds.length > 1) {
    const movedId = redIds.pop();
    if (!movedId) break;
    assigned.set(movedId, 'blue');
    blueIds.push(movedId);
  }

  while (blueIds.length - redIds.length > 1) {
    const movedId = blueIds.pop();
    if (!movedId) break;
    assigned.set(movedId, 'red');
    redIds.push(movedId);
  }

  const updates: Array<{ id: string; team: TeamId }> = [];
  for (const p of players) {
    const nextTeam = assigned.get(p.id);
    if (nextTeam && p.team !== nextTeam) {
      updates.push({ id: p.id, team: nextTeam });
    }
  }
  return updates;
}

export interface TeamStanding {
  team: TeamId;
  label: string;
  totalScore: number;
  memberCount: number;
  correctCount: number;
}

export interface TeamStandingsSummary {
  red: TeamStanding;
  blue: TeamStanding;
  winner: TeamId | 'tie';
  scoreDiff: number;
  mvp: PlayerPublic | null;
}

export function computeTeamStandings(players: PlayerPublic[]): TeamStandingsSummary {
  let redScore = 0;
  let redMembers = 0;
  let redCorrect = 0;
  let blueScore = 0;
  let blueMembers = 0;
  let blueCorrect = 0;
  let mvp: PlayerPublic | null = null;

  for (const p of players) {
    if (!mvp || p.score > mvp.score || (p.score === mvp.score && p.rank < mvp.rank)) {
      mvp = p;
    }
    if (p.team === 'red') {
      redScore += p.score;
      redMembers += 1;
      redCorrect += p.correctCount;
    } else if (p.team === 'blue') {
      blueScore += p.score;
      blueMembers += 1;
      blueCorrect += p.correctCount;
    }
  }

  const winner: TeamId | 'tie' =
    redScore > blueScore ? 'red' : blueScore > redScore ? 'blue' : 'tie';

  return {
    red: {
      team: 'red',
      label: TEAM_META.red.label,
      totalScore: redScore,
      memberCount: redMembers,
      correctCount: redCorrect,
    },
    blue: {
      team: 'blue',
      label: TEAM_META.blue.label,
      totalScore: blueScore,
      memberCount: blueMembers,
      correctCount: blueCorrect,
    },
    winner,
    scoreDiff: Math.abs(redScore - blueScore),
    mvp,
  };
}

export function rankPlayers<
  T extends {
    id: string;
    name: string;
    team?: TeamId | null;
    avatarId: AvatarId;
    poseId?: string;
    score: number;
    streak: number;
    bestStreak: number;
    correctCount: number;
    answeredCount: number;
    lastPoints: number;
    lastCorrect: boolean | null;
    lastChoice: AnswerIndex | null;
    connected: boolean;
  },
>(players: T[]): PlayerPublic[] {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.name.localeCompare(b.name, 'th');
  });

  return sorted.map((p, index) => ({
    id: p.id,
    name: p.name,
    ...(isValidTeamId(p.team) ? { team: p.team } : {}),
    avatarId: p.avatarId,
    ...(p.poseId ? { poseId: p.poseId } : {}),
    score: p.score,
    streak: p.streak,
    bestStreak: p.bestStreak,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    lastPoints: p.lastPoints,
    lastCorrect: p.lastCorrect,
    lastChoice: p.lastChoice,
    rank: index + 1,
    connected: p.connected,
  }));
}

export function parseCsvRows(csvText: string): string[][] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.length > 0));
}

function parseCorrectIndex(raw: string): AnswerIndex | null {
  const val = raw.trim().toUpperCase();
  if (val === '1' || val === 'A') return 0;
  if (val === '2' || val === 'B') return 1;
  if (val === '3' || val === 'C') return 2;
  if (val === '4' || val === 'D') return 3;
  return null;
}

export function parseQuizCsv(csvText: string): {
  questions: QuizQuestion[];
  errors: string[];
} {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return { questions: [], errors: ['ไฟล์ CSV ว่างเปล่า'] };
  }

  const errors: string[] = [];
  const questions: QuizQuestion[] = [];

  const firstRowJoined = rows[0].join(',').toLowerCase();
  const hasHeader =
    firstRowJoined.includes('question') ||
    firstRowJoined.includes('คำถาม') ||
    firstRowJoined.includes('option1') ||
    firstRowJoined.includes('ตัวเลือก');

  const dataRows = hasHeader ? rows.slice(1) : rows;

  dataRows.forEach((cols, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;
    if (cols.length < 6) {
      errors.push(`แถวที่ ${rowNum}: ข้อมูลไม่ครบ (ต้องมีคำถาม, 4 ตัวเลือก, และคำตอบที่ถูก)`);
      return;
    }

    const [qText, opt1, opt2, opt3, opt4, correctRaw, timeRaw, imageUrl, videoUrl] = cols;
    if (!qText || !opt1 || !opt2 || !opt3 || !opt4) {
      errors.push(`แถวที่ ${rowNum}: คำถามหรือตัวเลือกทั้ง 4 ข้อห้ามว่าง`);
      return;
    }

    const correctIndex = parseCorrectIndex(correctRaw ?? '');
    if (correctIndex === null) {
      errors.push(`แถวที่ ${rowNum}: คำตอบที่ถูก "${correctRaw}" ไม่ถูกต้อง (ใช้ 1-4 หรือ A-D)`);
      return;
    }

    const parsedTime = Number(timeRaw);
    const timeLimitSec =
      Number.isFinite(parsedTime) && parsedTime >= 5 && parsedTime <= 180
        ? Math.round(parsedTime)
        : 20;

    questions.push({
      id: `csv-q-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
      text: qText,
      options: [opt1, opt2, opt3, opt4],
      correctIndex,
      timeLimitSec,
      imageUrl: imageUrl ? imageUrl.trim() : undefined,
      videoUrl: videoUrl ? videoUrl.trim() : undefined,
    });
  });

  return { questions, errors };
}

function escapeCsvCell(value: string | number | undefined): string {
  const raw = value === undefined ? '' : String(value);
  const str = /^\s*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportQuizToCsv(questions: QuizQuestion[]): string {
  const header = [
    'question',
    'option1',
    'option2',
    'option3',
    'option4',
    'correct',
    'timeLimit',
    'imageUrl',
    'videoUrl',
  ];
  const lines = [header.join(',')];
  for (const q of questions) {
    lines.push(
      [
        escapeCsvCell(q.text),
        escapeCsvCell(q.options[0]),
        escapeCsvCell(q.options[1]),
        escapeCsvCell(q.options[2]),
        escapeCsvCell(q.options[3]),
        escapeCsvCell(q.correctIndex + 1),
        escapeCsvCell(q.timeLimitSec),
        escapeCsvCell(q.imageUrl ?? ''),
        escapeCsvCell(q.videoUrl ?? ''),
      ].join(',')
    );
  }
  return '\uFEFF' + lines.join('\n');
}

export function exportResultsToCsv(
  players: PlayerPublic[],
  quizTitle: string,
  totalQuestions: number,
  mode: RoomMode = 'single'
): string {
  const isTeam = mode === 'team';
  const header = isTeam
    ? ['อันดับ', 'ชื่อผู้เล่น', 'ทีม', 'ตัวละคร', 'คะแนนรวม', 'ตอบถูก', 'จำนวนข้อทั้งหมด', 'ความแม่นยำ (%)']
    : ['อันดับ', 'ชื่อผู้เล่น', 'ตัวละคร', 'คะแนนรวม', 'ตอบถูก', 'จำนวนข้อทั้งหมด', 'ความแม่นยำ (%)'];
  const lines = [
    `${escapeCsvCell('ชุดคำถาม')},${escapeCsvCell(quizTitle)}`,
    header.join(','),
  ];

  for (const p of players) {
    const accuracy = totalQuestions > 0 ? Math.round((p.correctCount / totalQuestions) * 100) : 0;
    const avatarName = AVATARS.find((a) => a.id === p.avatarId)?.name ?? p.avatarId;
    const teamLabel = isValidTeamId(p.team) ? TEAM_META[p.team].label : '-';
    lines.push(
      (isTeam
        ? [
            escapeCsvCell(p.rank),
            escapeCsvCell(p.name),
            escapeCsvCell(teamLabel),
            escapeCsvCell(avatarName),
            escapeCsvCell(p.score),
            escapeCsvCell(p.correctCount),
            escapeCsvCell(totalQuestions),
            escapeCsvCell(`${accuracy}%`),
          ]
        : [
            escapeCsvCell(p.rank),
            escapeCsvCell(p.name),
            escapeCsvCell(avatarName),
            escapeCsvCell(p.score),
            escapeCsvCell(p.correctCount),
            escapeCsvCell(totalQuestions),
            escapeCsvCell(`${accuracy}%`),
          ]
      ).join(',')
    );
  }

  if (isTeam) {
    const summary = computeTeamStandings(players);
    lines.push('');
    lines.push(`${escapeCsvCell('สรุปคะแนนทีม')},${escapeCsvCell(TEAM_META.red.label)},${escapeCsvCell(summary.red.totalScore)},${escapeCsvCell(TEAM_META.blue.label)},${escapeCsvCell(summary.blue.totalScore)}`);
  }

  return '\uFEFF' + lines.join('\n');
}

const SAFE_IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_VIDEO_DATA_URL_RE = /^data:video\/(mp4|webm|ogg|quicktime);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{6,20}$/;

export function sanitizeSafeMediaUrl(
  url: string | undefined,
  kind: 'image' | 'video' = 'image'
): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  if (kind === 'image' && SAFE_IMAGE_DATA_URL_RE.test(trimmed)) {
    return trimmed;
  }

  if (kind === 'video' && SAFE_VIDEO_DATA_URL_RE.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
    if (parsed.protocol === 'blob:') {
      return trimmed;
    }
  } catch {
    return '';
  }

  return '';
}

export function parseVideoEmbed(url?: string): {
  type: 'youtube' | 'video' | 'none';
  src: string;
} {
  const safeSrc = sanitizeSafeMediaUrl(url, 'video');
  if (!safeSrc) {
    return { type: 'none', src: '' };
  }

  try {
    const parsed = new URL(safeSrc, 'http://localhost');
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      let videoId = parsed.searchParams.get('v');
      if (!videoId && parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] ?? null;
      }
      if (!videoId && parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2] ?? null;
      }
      if (videoId && SAFE_YOUTUBE_ID_RE.test(videoId)) {
        return {
          type: 'youtube',
          src: `https://www.youtube.com/embed/${videoId}?rel=0`,
        };
      }
    }

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0];
      if (videoId && SAFE_YOUTUBE_ID_RE.test(videoId)) {
        return {
          type: 'youtube',
          src: `https://www.youtube.com/embed/${videoId}?rel=0`,
        };
      }
    }
  } catch {
    return { type: 'none', src: '' };
  }

  return { type: 'video', src: safeSrc };
}
