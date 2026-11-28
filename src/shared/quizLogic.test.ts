import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignCorrectAnswerOrder,
  calculatePoints,
  computeTeamRebalanceUpdates,
  computeTeamStandings,
  exportQuizToCsv,
  exportResultsToCsv,
  generateRoomCode,
  parseQuizCsv,
  parseVideoEmbed,
  pickBalancedTeam,
  rankPlayers,
  sanitizeSafeMediaUrl,
} from './quizLogic';
import { DEFAULT_QUIZ, SAMPLE_CSV_TEMPLATE } from './defaultQuiz';

test('generateRoomCode creates unique 4-digit codes', () => {
  const existing = new Set<string>(['1234', '5678']);
  const code = generateRoomCode(existing);
  assert.match(code, /^\d{4}$/);
  assert.equal(existing.has(code), false);
});

test('calculatePoints rewards accuracy, speed, streak, and deducts 50 per subsequent correct respondent', () => {
  assert.equal(
    calculatePoints({ isCorrect: false, remainingMs: 15000, totalMs: 20000, streak: 3 }),
    0
  );

  const fastFirst = calculatePoints({
    isCorrect: true,
    remainingMs: 20000,
    totalMs: 20000,
    streak: 1,
    correctOrderIndex: 0,
  });
  const second = calculatePoints({
    isCorrect: true,
    remainingMs: 20000,
    totalMs: 20000,
    streak: 1,
    correctOrderIndex: 1,
  });
  const third = calculatePoints({
    isCorrect: true,
    remainingMs: 20000,
    totalMs: 20000,
    streak: 1,
    correctOrderIndex: 2,
  });
  const slow = calculatePoints({ isCorrect: true, remainingMs: 2000, totalMs: 20000, streak: 1 });
  const streakBonus = calculatePoints({
    isCorrect: true,
    remainingMs: 20000,
    totalMs: 20000,
    streak: 3,
  });
  const floored = calculatePoints({
    isCorrect: true,
    remainingMs: 0,
    totalMs: 20000,
    streak: 1,
    correctOrderIndex: 25,
  });

  assert.equal(fastFirst, 1000);
  assert.equal(second, 950);
  assert.equal(third, 900);
  assert.ok(fastFirst > slow);
  assert.equal(streakBonus, 1100);
  assert.equal(floored, 50);
});

test('assignCorrectAnswerOrder ranks earliest correct respondents starting at 0', () => {
  const order = assignCorrectAnswerOrder([
    { playerId: 'p_c', answeredAtMs: 5000 },
    { playerId: 'p_a', answeredAtMs: 2000 },
    { playerId: 'p_b', answeredAtMs: 3500 },
  ]);
  assert.equal(order.get('p_a'), 0);
  assert.equal(order.get('p_b'), 1);
  assert.equal(order.get('p_c'), 2);
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
      avatarId: 'char_01',
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
      avatarId: 'char_02',
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
  assert.deepEqual(parseVideoEmbed('javascript:alert(1)'), { type: 'none', src: '' });
  assert.deepEqual(parseVideoEmbed('https://youtube.com/watch?v=../../evil'), {
    type: 'video',
    src: 'https://youtube.com/watch?v=../../evil',
  });
});

test('sanitizeSafeMediaUrl blocks javascript: and SVG data URLs while preserving safe assets', () => {
  assert.equal(sanitizeSafeMediaUrl('javascript:alert(1)', 'image'), '');
  assert.equal(
    sanitizeSafeMediaUrl('data:image/svg+xml;base64,PHN2Zz4=', 'image'),
    ''
  );
  assert.equal(
    sanitizeSafeMediaUrl('data:image/webp;base64,UklGRg==', 'image'),
    'data:image/webp;base64,UklGRg=='
  );
  assert.equal(
    sanitizeSafeMediaUrl('/assets/profile/01.webp', 'image'),
    '/assets/profile/01.webp'
  );
  assert.equal(
    sanitizeSafeMediaUrl('https://cdn.example.com/pic.png', 'image'),
    'https://cdn.example.com/pic.png'
  );
});

test('exportResultsToCsv neutralizes spreadsheet formula prefixes', () => {
  const csvOut = exportResultsToCsv(
    [
      {
        id: 'p1',
        name: '=HYPERLINK("http://bad","x")',
        avatarId: 'char_01',
        score: 1000,
        streak: 1,
        bestStreak: 1,
        correctCount: 1,
        answeredCount: 1,
        lastPoints: 1000,
        lastCorrect: true,
        lastChoice: 0,
        rank: 1,
        connected: true,
      },
    ],
    '+SUM(1,2)',
    1
  );
  assert.ok(csvOut.includes("'=HYPERLINK"));
  assert.ok(csvOut.includes("'+SUM(1,2)"));
});

test('pickBalancedTeam and computeTeamRebalanceUpdates keep teams balanced', () => {
  assert.equal(pickBalancedTeam([]), 'red');
  assert.equal(pickBalancedTeam([{ team: 'red' }]), 'blue');
  assert.equal(pickBalancedTeam([{ team: 'red' }, { team: 'blue' }]), 'red');

  const updates = computeTeamRebalanceUpdates([
    { id: 'p1', team: 'red' },
    { id: 'p2', team: 'red' },
    { id: 'p3', team: 'red' },
    { id: 'p4', team: null },
  ]);
  // p4 goes to blue (red=3, blue=1), then p3 moves to blue -> red=2, blue=2
  assert.deepEqual(updates, [
    { id: 'p3', team: 'blue' },
    { id: 'p4', team: 'blue' },
  ]);
});

test('rankPlayers preserves team field and computeTeamStandings sums team scores and MVP', () => {
  const ranked = rankPlayers([
    {
      id: 'p1',
      name: 'แดงหนึ่ง',
      team: 'red',
      avatarId: 'char_01',
      score: 1200,
      streak: 1,
      bestStreak: 1,
      correctCount: 2,
      answeredCount: 3,
      lastPoints: 500,
      lastCorrect: true,
      lastChoice: 0,
      connected: true,
    },
    {
      id: 'p2',
      name: 'น้ำเงินหนึ่ง',
      team: 'blue',
      avatarId: 'char_02',
      score: 1900,
      streak: 2,
      bestStreak: 2,
      correctCount: 2,
      answeredCount: 3,
      lastPoints: 950,
      lastCorrect: true,
      lastChoice: 0,
      connected: true,
    },
    {
      id: 'p3',
      name: 'แดงสอง',
      team: 'red',
      avatarId: 'char_03',
      score: 900,
      streak: 1,
      bestStreak: 1,
      correctCount: 1,
      answeredCount: 3,
      lastPoints: 400,
      lastCorrect: false,
      lastChoice: 1,
      connected: true,
    },
  ]);

  assert.equal(ranked[0].team, 'blue');
  assert.equal(ranked[1].team, 'red');

  const summary = computeTeamStandings(ranked);
  assert.equal(summary.red.totalScore, 2100);
  assert.equal(summary.red.memberCount, 2);
  assert.equal(summary.blue.totalScore, 1900);
  assert.equal(summary.blue.memberCount, 1);
  assert.equal(summary.winner, 'red');
  assert.equal(summary.scoreDiff, 200);
  assert.equal(summary.mvp?.id, 'p2');

  const teamCsv = exportResultsToCsv(ranked, 'ศึกชิงทีม', 3, 'team');
  assert.ok(teamCsv.includes(',ทีม,'));
  assert.ok(teamCsv.includes('ทีมแดง'));
  assert.ok(teamCsv.includes('สรุปคะแนนทีม'));

  const singleCsv = exportResultsToCsv(ranked, 'ศึกเดี่ยว', 3, 'single');
  assert.equal(singleCsv.includes('สรุปคะแนนทีม'), false);
});

