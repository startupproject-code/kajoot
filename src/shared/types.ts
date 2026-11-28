export const MAX_PLAYERS_PER_ROOM = 100;

export type AvatarId =
  | 'char_01'
  | 'char_02'
  | 'char_03'
  | 'char_04'
  | 'char_05'
  | 'char_06'
  | 'char_07'
  | 'char_08'
  | 'char_09'
  | 'char_10'
  | 'char_11'
  | 'char_12'
  | 'char_13'
  | 'char_14'
  | 'char_15'
  | 'char_16'
  | 'char_17'
  | 'char_18'
  | 'char_19';

export interface AvatarMeta {
  id: AvatarId;
  name: string;
  imagePath: string;
  bgClass: string;
  accentHex: string;
}

export const AVATARS: AvatarMeta[] = [
  { id: 'char_01', name: 'น้องแว่นเสื้อเขียว', imagePath: '/assets/Profile/01_น้องแว่นเสื้อเขียว.webp', bgClass: 'bg-sky-100', accentHex: '#0EA5E9' },
  { id: 'char_02', name: 'น้องโบว์ชมพู', imagePath: '/assets/Profile/02_น้องโบว์ชมพู.webp', bgClass: 'bg-sky-100', accentHex: '#EC4899' },
  { id: 'char_03', name: 'น้องฮู้ดส้ม', imagePath: '/assets/Profile/03_น้องฮู้ดส้ม.webp', bgClass: 'bg-orange-100', accentHex: '#F97316' },
  { id: 'char_04', name: 'น้องเสื้อดาวม่วง', imagePath: '/assets/Profile/04_น้องเสื้อดาวม่วง.webp', bgClass: 'bg-purple-100', accentHex: '#A855F7' },
  { id: 'char_05', name: 'น้องหมวกแก๊ปเขียว', imagePath: '/assets/Profile/05_น้องหมวกแก๊ปเขียว.webp', bgClass: 'bg-emerald-100', accentHex: '#10B981' },
  { id: 'char_06', name: 'น้องเอี๊ยมยีนส์', imagePath: '/assets/Profile/06_น้องเอี๊ยมยีนส์.webp', bgClass: 'bg-pink-100', accentHex: '#EC4899' },
  { id: 'char_07', name: 'น้องผมตั้งเสื้อฟ้า', imagePath: '/assets/Profile/07_น้องผมตั้งเสื้อฟ้า.webp', bgClass: 'bg-blue-100', accentHex: '#3B82F6' },
  { id: 'char_08', name: 'น้องแว่นโปโลฟ้า', imagePath: '/assets/Profile/08_น้องแว่นโปโลฟ้า.webp', bgClass: 'bg-cyan-100', accentHex: '#06B6D4' },
  { id: 'char_09', name: 'น้องเปียชุดแดง', imagePath: '/assets/Profile/09_น้องเปียชุดแดง.webp', bgClass: 'bg-rose-100', accentHex: '#F43F5E' },
  { id: 'char_10', name: 'น้องหูฟังเท่', imagePath: '/assets/Profile/10_น้องหูฟังเท่.webp', bgClass: 'bg-slate-200', accentHex: '#64748B' },
  { id: 'char_11', name: 'น้องไหมพรมเหลือง', imagePath: '/assets/Profile/11_น้องไหมพรมเหลือง.webp', bgClass: 'bg-yellow-100', accentHex: '#EAB308' },
  { id: 'char_12', name: 'น้องเสื้อแดงเข้ม', imagePath: '/assets/Profile/12_น้องเสื้อแดงเข้ม.webp', bgClass: 'bg-sky-100', accentHex: '#E11D48' },
  { id: 'char_13', name: 'น้องกระโปรงขาว', imagePath: '/assets/Profile/13_น้องกระโปรงขาว.webp', bgClass: 'bg-pink-100', accentHex: '#EC4899' },
  { id: 'char_14', name: 'น้องแว่นชุดเขียว', imagePath: '/assets/Profile/14_น้องแว่นชุดเขียว.webp', bgClass: 'bg-emerald-100', accentHex: '#10B981' },
  { id: 'char_15', name: 'น้องฮู้ดเหลือง', imagePath: '/assets/Profile/15_น้องฮู้ดเหลือง.webp', bgClass: 'bg-emerald-100', accentHex: '#F59E0B' },
  { id: 'char_16', name: 'น้องเสื้อฟ้า', imagePath: '/assets/Profile/16_น้องเสื้อฟ้า.webp', bgClass: 'bg-sky-100', accentHex: '#0EA5E9' },
  { id: 'char_17', name: 'น้องมัดจุกคู่', imagePath: '/assets/Profile/17_น้องมัดจุกคู่.webp', bgClass: 'bg-amber-100', accentHex: '#8B5CF6' },
  { id: 'char_18', name: 'น้องหมวกส้ม', imagePath: '/assets/Profile/18_น้องหมวกส้ม.webp', bgClass: 'bg-indigo-100', accentHex: '#EA580C' },
  { id: 'char_19', name: 'น้องผ้าคาดหัวส้ม', imagePath: '/assets/Profile/19_น้องผ้าคาดหัวส้ม.webp', bgClass: 'bg-pink-100', accentHex: '#F97316' },
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

export type RoomPhase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'SHOWCASE' | 'ENDED';

export type RoomMode = 'single' | 'team';

export type TeamId = 'red' | 'blue';

export interface PlayerPublic {
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
  mode?: RoomMode;
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
  | { type: 'host:kick'; playerId: string }
  | { type: 'player:check_room'; code: string }
  | { type: 'player:join'; code: string; name: string; avatarId: AvatarId; poseId?: string; playerId?: string }
  | { type: 'player:pose'; poseId: string }
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
