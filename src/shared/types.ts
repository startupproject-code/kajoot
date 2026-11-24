export const MAX_PLAYERS_PER_ROOM = 200;

export type AvatarId =
  | 'cat'
  | 'chicken'
  | 'cow'
  | 'deer'
  | 'dog'
  | 'crocodile'
  | 'elephant'
  | 'fox'
  | 'giraffe'
  | 'hippo'
  | 'panda'
  | 'penguin'
  | 'pig'
  | 'polar'
  | 'otter'
  | 'frog'
  | 'lion'
  | 'snake'
  | 'tiger';

export interface AvatarMeta {
  id: AvatarId;
  name: string;
  imagePath: string;
  bgClass: string;
  accentHex: string;
}

export const AVATARS: AvatarMeta[] = [
  { id: 'cat', name: 'น้องแมว', imagePath: '/assets/aistudio/Cat_4ef2f009.png', bgClass: 'bg-amber-100', accentHex: '#F59E0B' },
  { id: 'dog', name: 'น้องหมา', imagePath: '/assets/aistudio/Dog_090d167a.png', bgClass: 'bg-yellow-100', accentHex: '#EAB308' },
  { id: 'panda', name: 'น้องแพนด้า', imagePath: '/assets/aistudio/Panda_66a51023.png', bgClass: 'bg-emerald-100', accentHex: '#10B981' },
  { id: 'fox', name: 'น้องจิ้งจอก', imagePath: '/assets/aistudio/Fox_3b228377.png', bgClass: 'bg-orange-100', accentHex: '#EA580C' },
  { id: 'chicken', name: 'น้องไก่', imagePath: '/assets/aistudio/Chicken_bb74afc6.png', bgClass: 'bg-amber-100', accentHex: '#D97706' },
  { id: 'cow', name: 'น้องวัว', imagePath: '/assets/aistudio/Cow_55e35484.png', bgClass: 'bg-lime-100', accentHex: '#65A30D' },
  { id: 'deer', name: 'น้องกวาง', imagePath: '/assets/aistudio/Deer_7839724b.png', bgClass: 'bg-emerald-100', accentHex: '#059669' },
  { id: 'crocodile', name: 'น้องจระเข้', imagePath: '/assets/aistudio/Crocodile_84f9a948.png', bgClass: 'bg-teal-100', accentHex: '#0D9488' },
  { id: 'elephant', name: 'น้องช้าง', imagePath: '/assets/aistudio/Elephant_51aa857c.png', bgClass: 'bg-amber-100', accentHex: '#F59E0B' },
  { id: 'giraffe', name: 'น้องยีราฟ', imagePath: '/assets/aistudio/Girafft_aecae44c.png', bgClass: 'bg-yellow-100', accentHex: '#CA8A04' },
  { id: 'hippo', name: 'น้องฮิปโป', imagePath: '/assets/aistudio/Hippo_5c6b796a.png', bgClass: 'bg-sky-100', accentHex: '#0284C7' },
  { id: 'penguin', name: 'น้องเพนกวิน', imagePath: '/assets/aistudio/Penguin_5318f8f5.png', bgClass: 'bg-sky-100', accentHex: '#0EA5E9' },
  { id: 'pig', name: 'น้องหมู', imagePath: '/assets/aistudio/Pig_4a4b2a49.png', bgClass: 'bg-pink-100', accentHex: '#EC4899' },
  { id: 'polar', name: 'น้องหมีขาว', imagePath: '/assets/aistudio/Polar_870da263.png', bgClass: 'bg-cyan-100', accentHex: '#06B6D4' },
  { id: 'otter', name: 'น้องนาก', imagePath: '/assets/aistudio/Otter_b4845cc0.png', bgClass: 'bg-sky-100', accentHex: '#0284C7' },
  { id: 'frog', name: 'น้องกบ', imagePath: '/assets/aistudio/Frog_d4d1334a.png', bgClass: 'bg-green-100', accentHex: '#16A34A' },
  { id: 'lion', name: 'น้องสิงโต', imagePath: '/assets/aistudio/Lion_d7cf4d56.png', bgClass: 'bg-amber-100', accentHex: '#D97706' },
  { id: 'snake', name: 'น้องงู', imagePath: '/assets/aistudio/Snake_a97297a1.png', bgClass: 'bg-lime-100', accentHex: '#65A30D' },
  { id: 'tiger', name: 'น้องเสือ', imagePath: '/assets/aistudio/Tiger_de37bd62.png', bgClass: 'bg-orange-100', accentHex: '#EA580C' },
];

export type AnswerIndex = 0 | 1 | 2 | 3;

export interface QuizQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: AnswerIndex;
  timeLimitSec: number;
  imageUrl?: string;
  videoUrl?: string;
}

export interface QuizSet {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export type RoomPhase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'ENDED';

export interface PlayerPublic {
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
  rank: number;
  connected: boolean;
}

export interface PublicQuestionView {
  id: string;
  text: string;
  options: [string, string, string, string];
  timeLimitSec: number;
  imageUrl?: string;
  videoUrl?: string;
  correctIndex?: AnswerIndex;
}

export interface RoomPublicState {
  code: string;
  quizTitle: string;
  phase: RoomPhase;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: PublicQuestionView | null;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  remainingSec: number;
  answeredCount: number;
  totalPlayers: number;
  maxPlayers: number;
  answerCounts: [number, number, number, number];
  players: PlayerPublic[];
  topPlayers: PlayerPublic[];
}

export type ClientMessage =
  | { type: 'host:create'; quiz: QuizSet }
  | { type: 'host:reconnect'; code: string; hostToken: string }
  | { type: 'host:start' }
  | { type: 'host:reveal' }
  | { type: 'host:leaderboard' }
  | { type: 'host:next' }
  | { type: 'host:end' }
  | { type: 'host:restart'; quiz?: QuizSet }
  | { type: 'player:check_room'; code: string }
  | { type: 'player:join'; code: string; name: string; avatarId: AvatarId; playerId?: string }
  | { type: 'player:answer'; choice: AnswerIndex };

export type ServerMessage =
  | { type: 'host:created'; code: string; hostToken: string; state: RoomPublicState }
  | { type: 'room:state'; state: RoomPublicState; yourPlayerId?: string }
  | {
      type: 'room:progress';
      answeredCount: number;
      totalPlayers: number;
      answerCounts: [number, number, number, number];
      remainingSec: number;
    }
  | { type: 'room:tick'; remainingSec: number }
  | {
      type: 'player:room_status';
      code: string;
      exists: boolean;
      quizTitle?: string;
      totalPlayers?: number;
      maxPlayers: number;
      isFull?: boolean;
      phase?: RoomPhase;
      error?: string;
    }
  | { type: 'player:joined'; playerId: string; state: RoomPublicState }
  | { type: 'player:answer_ack'; choice: AnswerIndex }
  | { type: 'error'; message: string };
