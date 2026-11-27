export const MAX_PLAYERS_PER_ROOM = 200;

export type AvatarId =
  | 'kid_01'
  | 'kid_02'
  | 'kid_03'
  | 'kid_04'
  | 'kid_05'
  | 'kid_06'
  | 'kid_07'
  | 'kid_08'
  | 'kid_09'
  | 'kid_10'
  | 'kid_11'
  | 'kid_12'
  | 'kid_13'
  | 'kid_14'
  | 'kid_15'
  | 'kid_16'
  | 'kid_17'
  | 'kid_18'
  | 'kid_19'
  | 'kid_20'
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
  category: 'character' | 'animal';
}

export const AVATARS: AvatarMeta[] = [
  { id: 'kid_01', name: 'น้องแว่นเสื้อเขียว', imagePath: '/assets/avatars/char_01.png', bgClass: 'bg-emerald-100', accentHex: '#10B981', category: 'character' },
  { id: 'kid_02', name: 'น้องโบว์ชมพู', imagePath: '/assets/avatars/char_02.png', bgClass: 'bg-pink-100', accentHex: '#EC4899', category: 'character' },
  { id: 'kid_03', name: 'น้องฮู้ดส้ม', imagePath: '/assets/avatars/char_03.png', bgClass: 'bg-orange-100', accentHex: '#F97316', category: 'character' },
  { id: 'kid_04', name: 'น้องเสื้อดาวม่วง', imagePath: '/assets/avatars/char_04.png', bgClass: 'bg-purple-100', accentHex: '#A855F7', category: 'character' },
  { id: 'kid_05', name: 'น้องหมวกแก๊ปเขียว', imagePath: '/assets/avatars/char_05.png', bgClass: 'bg-red-100', accentHex: '#EF4444', category: 'character' },
  { id: 'kid_06', name: 'น้องเอี๊ยมยีนส์', imagePath: '/assets/avatars/char_06.png', bgClass: 'bg-sky-100', accentHex: '#0EA5E9', category: 'character' },
  { id: 'kid_07', name: 'น้องผมตั้งเสื้อฟ้า', imagePath: '/assets/avatars/char_07.png', bgClass: 'bg-blue-100', accentHex: '#3B82F6', category: 'character' },
  { id: 'kid_08', name: 'น้องแว่นโปโลฟ้า', imagePath: '/assets/avatars/char_08.png', bgClass: 'bg-cyan-100', accentHex: '#06B6D4', category: 'character' },
  { id: 'kid_09', name: 'น้องผมฟูเสื้อเหลือง', imagePath: '/assets/avatars/char_09.png', bgClass: 'bg-amber-100', accentHex: '#F59E0B', category: 'character' },
  { id: 'kid_10', name: 'น้องเปียชุดแดง', imagePath: '/assets/avatars/char_10.png', bgClass: 'bg-rose-100', accentHex: '#F43F5E', category: 'character' },
  { id: 'kid_11', name: 'น้องหูฟังเท่', imagePath: '/assets/avatars/char_11.png', bgClass: 'bg-slate-200', accentHex: '#64748B', category: 'character' },
  { id: 'kid_12', name: 'น้องไหมพรมเหลือง', imagePath: '/assets/avatars/char_12.png', bgClass: 'bg-yellow-100', accentHex: '#EAB308', category: 'character' },
  { id: 'kid_13', name: 'น้องเสื้อแดงเข้ม', imagePath: '/assets/avatars/char_13.png', bgClass: 'bg-rose-100', accentHex: '#E11D48', category: 'character' },
  { id: 'kid_14', name: 'น้องกระโปรงขาว', imagePath: '/assets/avatars/char_14.png', bgClass: 'bg-pink-100', accentHex: '#EC4899', category: 'character' },
  { id: 'kid_15', name: 'น้องเสื้อกั๊กฟ้า', imagePath: '/assets/avatars/char_15.png', bgClass: 'bg-indigo-100', accentHex: '#6366F1', category: 'character' },
  { id: 'kid_16', name: 'น้องแว่นชุดเขียว', imagePath: '/assets/avatars/char_16.png', bgClass: 'bg-emerald-100', accentHex: '#10B981', category: 'character' },
  { id: 'kid_17', name: 'น้องฮู้ดเหลือง', imagePath: '/assets/avatars/char_17.png', bgClass: 'bg-yellow-100', accentHex: '#F59E0B', category: 'character' },
  { id: 'kid_18', name: 'น้องมัดจุกคู่', imagePath: '/assets/avatars/char_18.png', bgClass: 'bg-violet-100', accentHex: '#8B5CF6', category: 'character' },
  { id: 'kid_19', name: 'น้องหมวกส้ม', imagePath: '/assets/avatars/char_19.png', bgClass: 'bg-orange-100', accentHex: '#EA580C', category: 'character' },
  { id: 'kid_20', name: 'น้องผ้าคาดหัวเหลือง', imagePath: '/assets/avatars/char_20.png', bgClass: 'bg-amber-100', accentHex: '#D97706', category: 'character' },
  { id: 'cat', name: 'น้องแมว', imagePath: '/assets/aistudio/Cat_4ef2f009.png', bgClass: 'bg-amber-100', accentHex: '#F59E0B', category: 'animal' },
  { id: 'dog', name: 'น้องหมา', imagePath: '/assets/aistudio/Dog_090d167a.png', bgClass: 'bg-yellow-100', accentHex: '#EAB308', category: 'animal' },
  { id: 'panda', name: 'น้องแพนด้า', imagePath: '/assets/aistudio/Panda_66a51023.png', bgClass: 'bg-emerald-100', accentHex: '#10B981', category: 'animal' },
  { id: 'fox', name: 'น้องจิ้งจอก', imagePath: '/assets/aistudio/Fox_3b228377.png', bgClass: 'bg-orange-100', accentHex: '#EA580C', category: 'animal' },
  { id: 'chicken', name: 'น้องไก่', imagePath: '/assets/aistudio/Chicken_bb74afc6.png', bgClass: 'bg-amber-100', accentHex: '#D97706', category: 'animal' },
  { id: 'cow', name: 'น้องวัว', imagePath: '/assets/aistudio/Cow_55e35484.png', bgClass: 'bg-lime-100', accentHex: '#65A30D', category: 'animal' },
  { id: 'deer', name: 'น้องกวาง', imagePath: '/assets/aistudio/Deer_7839724b.png', bgClass: 'bg-emerald-100', accentHex: '#059669', category: 'animal' },
  { id: 'crocodile', name: 'น้องจระเข้', imagePath: '/assets/aistudio/Crocodile_84f9a948.png', bgClass: 'bg-teal-100', accentHex: '#0D9488', category: 'animal' },
  { id: 'elephant', name: 'น้องช้าง', imagePath: '/assets/aistudio/Elephant_51aa857c.png', bgClass: 'bg-amber-100', accentHex: '#F59E0B', category: 'animal' },
  { id: 'giraffe', name: 'น้องยีราฟ', imagePath: '/assets/aistudio/Girafft_aecae44c.png', bgClass: 'bg-yellow-100', accentHex: '#CA8A04', category: 'animal' },
  { id: 'hippo', name: 'น้องฮิปโป', imagePath: '/assets/aistudio/Hippo_5c6b796a.png', bgClass: 'bg-sky-100', accentHex: '#0284C7', category: 'animal' },
  { id: 'penguin', name: 'น้องเพนกวิน', imagePath: '/assets/aistudio/Penguin_5318f8f5.png', bgClass: 'bg-sky-100', accentHex: '#0EA5E9', category: 'animal' },
  { id: 'pig', name: 'น้องหมู', imagePath: '/assets/aistudio/Pig_4a4b2a49.png', bgClass: 'bg-pink-100', accentHex: '#EC4899', category: 'animal' },
  { id: 'polar', name: 'น้องหมีขาว', imagePath: '/assets/aistudio/Polar_870da263.png', bgClass: 'bg-cyan-100', accentHex: '#06B6D4', category: 'animal' },
  { id: 'otter', name: 'น้องนาก', imagePath: '/assets/aistudio/Otter_b4845cc0.png', bgClass: 'bg-sky-100', accentHex: '#0284C7', category: 'animal' },
  { id: 'frog', name: 'น้องกบ', imagePath: '/assets/aistudio/Frog_d4d1334a.png', bgClass: 'bg-green-100', accentHex: '#16A34A', category: 'animal' },
  { id: 'lion', name: 'น้องสิงโต', imagePath: '/assets/aistudio/Lion_d7cf4d56.png', bgClass: 'bg-amber-100', accentHex: '#D97706', category: 'animal' },
  { id: 'snake', name: 'น้องงู', imagePath: '/assets/aistudio/Snake_a97297a1.png', bgClass: 'bg-lime-100', accentHex: '#65A30D', category: 'animal' },
  { id: 'tiger', name: 'น้องเสือ', imagePath: '/assets/aistudio/Tiger_de37bd62.png', bgClass: 'bg-orange-100', accentHex: '#EA580C', category: 'animal' },
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
  coverImageUrl?: string;
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
