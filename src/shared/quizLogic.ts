import { AnswerIndex, AvatarId, AVATARS, PlayerPublic, QuizQuestion } from './types';

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

export function calculatePoints(params: {
  isCorrect: boolean;
  remainingMs: number;
  totalMs: number;
  streak: number;
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
  return basePoints + speedBonus + streakBonus;
}

export function rankPlayers<
  T extends {
    id: string;
    name: string;
    avatarId: AvatarId;
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
    avatarId: p.avatarId,
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
  const str = value === undefined ? '' : String(value);
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
  totalQuestions: number
): string {
  const header = ['อันดับ', 'ชื่อผู้เล่น', 'ตัวละคร', 'คะแนนรวม', 'ตอบถูก', 'จำนวนข้อทั้งหมด', 'ความแม่นยำ (%)'];
  const lines = [
    `${escapeCsvCell('ชุดคำถาม')},${escapeCsvCell(quizTitle)}`,
    header.join(','),
  ];

  for (const p of players) {
    const accuracy = totalQuestions > 0 ? Math.round((p.correctCount / totalQuestions) * 100) : 0;
    const avatarName = AVATARS.find((a) => a.id === p.avatarId)?.name ?? p.avatarId;
    lines.push(
      [
        escapeCsvCell(p.rank),
        escapeCsvCell(p.name),
        escapeCsvCell(avatarName),
        escapeCsvCell(p.score),
        escapeCsvCell(p.correctCount),
        escapeCsvCell(totalQuestions),
        escapeCsvCell(`${accuracy}%`),
      ].join(',')
    );
  }

  return '\uFEFF' + lines.join('\n');
}

export function parseVideoEmbed(url?: string): {
  type: 'youtube' | 'video' | 'none';
  src: string;
} {
  if (!url || !url.trim()) {
    return { type: 'none', src: '' };
  }
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      let videoId = parsed.searchParams.get('v');
      if (!videoId && parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] ?? null;
      }
      if (!videoId && parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2] ?? null;
      }
      if (videoId) {
        return {
          type: 'youtube',
          src: `https://www.youtube.com/embed/${videoId}?rel=0`,
        };
      }
    }

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0];
      if (videoId) {
        return {
          type: 'youtube',
          src: `https://www.youtube.com/embed/${videoId}?rel=0`,
        };
      }
    }
  } catch {
    return { type: 'none', src: '' };
  }

  return { type: 'video', src: trimmed };
}
