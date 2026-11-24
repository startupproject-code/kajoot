import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePoints,
  exportQuizToCsv,
  exportResultsToCsv,
  generateRoomCode,
  parseQuizCsv,
  parseVideoEmbed,
  rankPlayers,
} from './quizLogic';
import { DEFAULT_QUIZ, SAMPLE_CSV_TEMPLATE } from './defaultQuiz';

test('generateRoomCode creates unique 4-digit codes', () => {
  const existing = new Set<string>(['1234', '5678']);
  const code = generateRoomCode(existing);
  assert.match(code, /^\d{4}$/);
  assert.equal(existing.has(code), false);
});

test('calculatePoints rewards accuracy, speed, and streak', () => {
  assert.equal(
    calculatePoints({ isCorrect: false, remainingMs: 15000, totalMs: 20000, streak: 3 }),
    0
  );

  const fast = calculatePoints({ isCorrect: true, remainingMs: 20000, totalMs: 20000, streak: 1 });
  const slow = calculatePoints({ isCorrect: true, remainingMs: 2000, totalMs: 20000, streak: 1 });
  const streakBonus = calculatePoints({
    isCorrect: true,
    remainingMs: 20000,
    totalMs: 20000,
    streak: 3,
  });

  assert.equal(fast, 1000);
  assert.ok(fast > slow);
  assert.equal(streakBonus, 1100);
});

test('parseQuizCsv parses Thai questions, quoted commas, and A-D / 1-4 answers', () => {
  const { questions, errors } = parseQuizCsv(SAMPLE_CSV_TEMPLATE);
  assert.equal(errors.length, 0);
  assert.equal(questions.length, 3);
  assert.equal(questions[0].correctIndex, 2);
  assert.equal(questions[0].timeLimitSec, 20);
  assert.equal(questions[2].timeLimitSec, 15);

  const letterCsv = `question,option1,option2,option3,option4,correct,timeLimit,imageUrl,videoUrl
"ข้อใด, ถูกต้อง?",ก,ข,ค,ง,B,25,https://example.com/a.png,https://youtu.be/dQw4w9WgXcQ`;
  const parsed = parseQuizCsv('\uFEFF' + letterCsv);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.questions[0].text, 'ข้อใด, ถูกต้อง?');
  assert.equal(parsed.questions[0].correctIndex, 1);
  assert.equal(parsed.questions[0].timeLimitSec, 25);
  assert.equal(parsed.questions[0].imageUrl, 'https://example.com/a.png');
  assert.equal(parsed.questions[0].videoUrl, 'https://youtu.be/dQw4w9WgXcQ');
});

test('exportQuizToCsv round-trips through parseQuizCsv', () => {
  const csv = exportQuizToCsv(DEFAULT_QUIZ.questions);
  const { questions, errors } = parseQuizCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(questions.length, DEFAULT_QUIZ.questions.length);
  assert.equal(questions[0].text, DEFAULT_QUIZ.questions[0].text);
  assert.equal(questions[0].correctIndex, DEFAULT_QUIZ.questions[0].correctIndex);
});

test('rankPlayers orders by score, correctCount, and assigns ranks', () => {
  const ranked = rankPlayers([
    {
      id: 'p1',
      name: 'บี',
      avatarId: 'cat',
      score: 1200,
      streak: 1,
      bestStreak: 1,
      correctCount: 2,
      answeredCount: 2,
      lastPoints: 600,
      lastCorrect: true,
      lastChoice: 1,
      connected: true,
    },
    {
      id: 'p2',
      name: 'เอ',
      avatarId: 'dog',
      score: 1850,
      streak: 2,
      bestStreak: 2,
      correctCount: 2,
      answeredCount: 2,
      lastPoints: 950,
      lastCorrect: true,
      lastChoice: 1,
      connected: true,
    },
  ]);

  assert.equal(ranked[0].id, 'p2');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].id, 'p1');
  assert.equal(ranked[1].rank, 2);

  const csvOut = exportResultsToCsv(ranked, 'ทดสอบ', 2);
  assert.ok(csvOut.includes('เอ'));
  assert.ok(csvOut.includes('1850'));
});

test('parseVideoEmbed handles YouTube and direct video URLs', () => {
  assert.deepEqual(parseVideoEmbed('https://www.youtube.com/watch?v=abc12345'), {
    type: 'youtube',
    src: 'https://www.youtube.com/embed/abc12345?rel=0',
  });
  assert.deepEqual(parseVideoEmbed('https://youtu.be/xyz98765'), {
    type: 'youtube',
    src: 'https://www.youtube.com/embed/xyz98765?rel=0',
  });
  assert.deepEqual(parseVideoEmbed('/api/media/clip123'), {
    type: 'video',
    src: '/api/media/clip123',
  });
  assert.deepEqual(parseVideoEmbed(''), { type: 'none', src: '' });
});
