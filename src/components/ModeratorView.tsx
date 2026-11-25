import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  LogIn,
  LogOut,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
  Upload,
  Users,
  Video as VideoIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useFirebase } from '../firebase/FirebaseProvider';
import {
  createFirebaseRoom,
  deleteQuizForUser,
  FirestoreAnswerDoc,
  FirestorePlayerDoc,
  FirestoreRoomDoc,
  hostRevealCurrentQuestion,
  hostStartOrAdvanceQuestion,
  hostTransitionPhase,
  loadAllSavedQuizzes,
  roomDocToPublicState,
  saveQuizForUser,
  subscribeHostRoom,
  syncHostRoomStats,
} from '../firebase/firebaseQuizService';
import { DEFAULT_QUIZ, SAMPLE_CSV_TEMPLATE } from '../shared/defaultQuiz';
import {
  exportQuizToCsv,
  exportResultsToCsv,
  parseQuizCsv,
} from '../shared/quizLogic';
import {
  AnswerIndex,
  MAX_PLAYERS_PER_ROOM,
  QuizQuestion,
  QuizSet,
} from '../shared/types';
import {
  compressImageFileToDataUrl,
  estimateQuizPayloadBytes,
  MAX_FIRESTORE_QUIZ_BYTES,
  MAX_INLINE_VIDEO_BYTES,
  readFileAsDataUrl,
} from '../utils/mediaUpload';
import { soundFx } from '../utils/soundFx';
import { ANSWER_STYLES, AnswerShapeIcon } from './AnswerBadge';
import { CountdownClock } from './CountdownClock';
import { CuteAvatar } from './CuteAvatar';
import { LeaderboardStage } from './LeaderboardStage';
import { MediaStage } from './MediaStage';

interface ModeratorViewProps {
  onBackHome: () => void;
}

const LOCAL_QUIZZES_KEY = 'quizarena_moderator_quizzes_v1';

const COVER_GRADIENTS = [
  'from-indigo-600 via-violet-600 to-purple-700',
  'from-emerald-600 via-teal-600 to-cyan-700',
  'from-amber-500 via-orange-600 to-rose-600',
  'from-sky-600 via-blue-600 to-indigo-700',
  'from-fuchsia-600 via-pink-600 to-rose-700',
];

function cloneDefaultQuiz(): QuizSet {
  return {
    ...DEFAULT_QUIZ,
    questions: DEFAULT_QUIZ.questions.map((q) => ({
      ...q,
      options: [...q.options] as [string, string, string, string],
    })),
  };
}

function loadLocalQuizzes(): QuizSet[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_QUIZZES_KEY);
    if (!raw) return [cloneDefaultQuiz()];
    const parsed = JSON.parse(raw) as QuizSet[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((q) => q && Array.isArray(q.questions) && q.questions.length > 0);
    }
  } catch {
    // ignore invalid local cache
  }
  return [cloneDefaultQuiz()];
}

function createBlankQuestion(index: number): QuizQuestion {
  return {
    id: `q_${Date.now().toString(36)}_${index}`,
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: 20,
  };
}

function createBlankQuizSet(count: number): QuizSet {
  const uidPart = Date.now().toString(36);
  return {
    id: `quiz_${uidPart}`,
    title: `ชุดคำถามใหม่ #${count + 1}`,
    description: 'คำถามความรู้ทั่วไปสำหรับแข่งขันแบบเรียลไทม์',
    questions: [
      {
        id: `q_${uidPart}_1`,
        text: 'คำถามข้อที่ 1',
        options: ['ตัวเลือก A', 'ตัวเลือก B', 'ตัวเลือก C', 'ตัวเลือก D'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
    ],
  };
}

function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ModeratorView: React.FC<ModeratorViewProps> = ({ onBackHome }) => {
  const { user, authReady, signingIn, authError, signInWithGoogle, signOutUser, clearAuthError } =
    useFirebase();

  const [quizSets, setQuizSets] = useState<QuizSet[]>(() => loadLocalQuizzes());
  const [activeQuizId, setActiveQuizId] = useState<string>(() => loadLocalQuizzes()[0]?.id || DEFAULT_QUIZ.id);
  const [panelMode, setPanelMode] = useState<'LIBRARY' | 'EDITOR'>('LIBRARY');

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [csvNotice, setCsvNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState<'image' | 'video' | 'cover' | null>(null);
  const [savingQuiz, setSavingQuiz] = useState(false);

  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [activeLiveQuiz, setActiveLiveQuiz] = useState<QuizSet | null>(null);
  const [roomDoc, setRoomDoc] = useState<FirestoreRoomDoc | null>(null);
  const [playersDocs, setPlayersDocs] = useState<FirestorePlayerDoc[]>([]);
  const [answersDocs, setAnswersDocs] = useState<FirestoreAnswerDoc[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [muted, setMuted] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [launchingRoom, setLaunchingRoom] = useState(false);

  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const lastSoundSecRef = useRef<number | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const loadedSavedForUidRef = useRef<string | null>(null);
  const revealingQuestionRef = useRef<number | null>(null);

  const quiz = useMemo(
    () => quizSets.find((q) => q.id === activeQuizId) ?? quizSets[0] ?? cloneDefaultQuiz(),
    [quizSets, activeQuizId]
  );

  // Save quiz sets to localStorage on change
  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_QUIZZES_KEY, JSON.stringify(quizSets));
    } catch {
      // ignore storage quota errors
    }
  }, [quizSets]);

  // Load Moderator's saved quizzes from Firestore once authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    if (loadedSavedForUidRef.current === user.uid) return;
    loadedSavedForUidRef.current = user.uid;

    void loadAllSavedQuizzes(user.uid)
      .then((savedList) => {
        if (savedList.length === 0) return;
        setQuizSets((prev) => {
          const merged = new Map<string, QuizSet>();
          for (const q of prev) merged.set(q.id, q);
          for (const q of savedList) merged.set(q.id, q);
          return Array.from(merged.values());
        });
      })
      .catch((err) => {
        console.error('Failed to load saved quizzes:', err);
      });
  }, [authReady, user]);

  // Subscribe to Firestore Room, Players, and Answers when room is active & user is authenticated
  useEffect(() => {
    if (!authReady || !user || !activeRoomCode) return;
    const unsub = subscribeHostRoom(activeRoomCode, user.uid, {
      onRoom: (nextRoom) => setRoomDoc(nextRoom),
      onPlayers: (nextPlayers) => setPlayersDocs(nextPlayers),
      onAnswers: (nextAnswers) => setAnswersDocs(nextAnswers),
    });
    return () => unsub();
  }, [authReady, user, activeRoomCode]);

  // Live 250ms countdown clock for QUESTION phase
  useEffect(() => {
    if (!roomDoc || roomDoc.phase !== 'QUESTION') return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [roomDoc?.phase, roomDoc?.currentQuestionIndex, roomDoc?.questionEndsAt]);

  const roomState = useMemo(() => {
    if (!roomDoc) return null;
    const base = roomDocToPublicState(roomDoc, nowMs);
    if (playersDocs.length > 0 || roomDoc.totalPlayers === 0) {
      return {
        ...base,
        totalPlayers: Math.max(base.totalPlayers, playersDocs.length),
      };
    }
    return base;
  }, [roomDoc, nowMs, playersDocs.length]);

  // Sync live players & answer counts to Firestore room doc
  useEffect(() => {
    if (!activeRoomCode || !roomDoc || roomDoc.phase === 'ENDED') return;
    const qIdx = roomDoc.currentQuestionIndex;
    const qAnswers = answersDocs.filter((a) => a.questionIndex === qIdx);
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    for (const a of qAnswers) {
      if ([0, 1, 2, 3].includes(a.choice)) {
        counts[a.choice] += 1;
      }
    }

    const countsChanged =
      counts[0] !== roomDoc.answerCounts[0] ||
      counts[1] !== roomDoc.answerCounts[1] ||
      counts[2] !== roomDoc.answerCounts[2] ||
      counts[3] !== roomDoc.answerCounts[3];
    const playersChanged = playersDocs.length !== roomDoc.totalPlayers;
    const answeredChanged = qAnswers.length !== roomDoc.answeredCount;

    const namesChanged =
      roomDoc.phase === 'LOBBY' &&
      playersDocs.some((p) => {
        const inBoard = roomDoc.leaderboard.find((b) => b.id === p.id);
        return !inBoard || inBoard.name !== p.name || inBoard.avatarId !== p.avatarId;
      });

    if (!countsChanged && !playersChanged && !answeredChanged && !namesChanged) {
      return;
    }

    const timer = window.setTimeout(() => {
      void syncHostRoomStats({
        code: activeRoomCode,
        players: playersDocs,
        answeredCount: roomDoc.phase === 'QUESTION' ? qAnswers.length : roomDoc.answeredCount,
        answerCounts: roomDoc.phase === 'QUESTION' ? counts : roomDoc.answerCounts,
      }).catch((err) => {
        console.error('Failed to sync room stats:', err);
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeRoomCode, roomDoc, playersDocs, answersDocs]);

  // Auto-reveal when countdown reaches 0 OR all players answered
  useEffect(() => {
    if (!activeRoomCode || !activeLiveQuiz || !roomDoc || roomDoc.phase !== 'QUESTION') {
      revealingQuestionRef.current = null;
      return;
    }

    const qIdx = roomDoc.currentQuestionIndex;
    if (revealingQuestionRef.current === qIdx) return;

    const qAnswers = answersDocs.filter((a) => a.questionIndex === qIdx);
    const uniquePlayersAnswered = new Set(qAnswers.map((a) => a.playerUid)).size;
    const allAnswered = playersDocs.length > 0 && uniquePlayersAnswered >= playersDocs.length;
    const expired = Boolean(roomDoc.questionEndsAt && nowMs >= roomDoc.questionEndsAt);

    if (allAnswered || expired) {
      revealingQuestionRef.current = qIdx;
      void hostRevealCurrentQuestion({
        code: activeRoomCode,
        quiz: activeLiveQuiz,
        questionIndex: qIdx,
        questionEndsAt: roomDoc.questionEndsAt,
        players: playersDocs,
        answers: answersDocs,
        targetPhase: 'REVEAL',
      }).catch((err) => {
        revealingQuestionRef.current = null;
        console.error('Auto-reveal failed:', err);
      });
    }
  }, [activeRoomCode, activeLiveQuiz, roomDoc, playersDocs, answersDocs, nowMs]);

  // Generate QR code whenever room code changes
  useEffect(() => {
    if (!roomState?.code) {
      setQrDataUrl('');
      return;
    }
    const joinUrl = `${window.location.origin}/?join=${roomState.code}`;
    QRCode.toDataURL(joinUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [roomState?.code]);

  // Sound effects synced to timer & phase transitions
  useEffect(() => {
    if (!roomState) return;
    const prevPhase = lastPhaseRef.current;
    lastPhaseRef.current = roomState.phase;

    if (roomState.phase === 'QUESTION') {
      if (prevPhase !== 'QUESTION') {
        lastSoundSecRef.current = null;
      }
      if (
        roomState.remainingSec > 0 &&
        roomState.remainingSec !== lastSoundSecRef.current
      ) {
        lastSoundSecRef.current = roomState.remainingSec;
        soundFx.playCountdownTick(roomState.remainingSec);
      }
    } else if (roomState.phase === 'REVEAL' && prevPhase === 'QUESTION') {
      if (lastSoundSecRef.current === 1) {
        soundFx.playTimeUp();
      } else {
        soundFx.playReveal(true);
      }
      lastSoundSecRef.current = null;
    } else if (roomState.phase === 'ENDED' && prevPhase !== 'ENDED') {
      soundFx.playPodiumFanfare();
    }
  }, [roomState]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundFx.setMuted(next);
  };

  const setActiveQuiz = (updater: (prev: QuizSet) => QuizSet) => {
    setQuizSets((prevList) =>
      prevList.map((item) => (item.id === quiz.id ? updater(item) : item))
    );
  };

  const activeQuestion = quiz.questions[selectedIdx] ?? quiz.questions[0];

  const updateQuestion = (patch: Partial<QuizQuestion>) => {
    setActiveQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q, idx) =>
        idx === selectedIdx ? { ...q, ...patch } : q
      ),
    }));
  };

  const updateOption = (optIndex: AnswerIndex, value: string) => {
    if (!activeQuestion) return;
    const nextOpts = [...activeQuestion.options] as [string, string, string, string];
    nextOpts[optIndex] = value;
    updateQuestion({ options: nextOpts });
  };

  const addQuestion = () => {
    const newQ = createBlankQuestion(quiz.questions.length + 1);
    setActiveQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, newQ],
    }));
    setSelectedIdx(quiz.questions.length);
  };

  const deleteQuestion = (idx: number) => {
    if (quiz.questions.length <= 1) return;
    setActiveQuiz((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
    setSelectedIdx((prev) => Math.max(0, Math.min(prev, quiz.questions.length - 2)));
  };

  const handleCreateNewQuizSet = () => {
    const created = createBlankQuizSet(quizSets.length);
    setQuizSets((prev) => [...prev, created]);
    setActiveQuizId(created.id);
    setSelectedIdx(0);
    setCsvNotice(null);
    setPanelMode('EDITOR');
  };

  const handleOpenQuizEditor = (quizId: string) => {
    setActiveQuizId(quizId);
    setSelectedIdx(0);
    setCsvNotice(null);
    setPanelMode('EDITOR');
  };

  const handleDeleteQuizSet = (quizId: string) => {
    if (quizSets.length <= 1) return;
    const remaining = quizSets.filter((q) => q.id !== quizId);
    setQuizSets(remaining);
    if (activeQuizId === quizId && remaining[0]) {
      setActiveQuizId(remaining[0].id);
    }
    if (user) {
      void deleteQuizForUser(user.uid, quizId).catch(() => undefined);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const text = await file.text();
    const result = parseQuizCsv(text);
    if (result.questions.length === 0) {
      setCsvNotice({
        type: 'err',
        text: result.errors[0] || 'ไม่พบคำถามที่ถูกต้องในไฟล์ CSV',
      });
      return;
    }

    const importedTitle = file.name.replace(/\.csv$/i, '') || 'ชุดคำถามนำเข้า CSV';
    if (panelMode === 'LIBRARY') {
      const newQuiz: QuizSet = {
        id: `quiz_${Date.now().toString(36)}`,
        title: importedTitle,
        description: `นำเข้าจากไฟล์ ${file.name}`,
        questions: result.questions,
      };
      setQuizSets((prev) => [...prev, newQuiz]);
      setActiveQuizId(newQuiz.id);
      setSelectedIdx(0);
      setPanelMode('EDITOR');
    } else {
      setActiveQuiz((prev) => ({
        ...prev,
        title: importedTitle || prev.title,
        questions: result.questions,
      }));
      setSelectedIdx(0);
    }

    setCsvNotice({
      type: result.errors.length > 0 ? 'err' : 'ok',
      text:
        result.errors.length > 0
          ? `นำเข้าสำเร็จ ${result.questions.length} ข้อ (มีข้อผิดพลาด ${result.errors.length} แถว: ${result.errors[0]})`
          : `นำเข้าชุดคำถามจาก CSV สำเร็จทั้งหมด ${result.questions.length} ข้อ`,
    });
  };

  const handleMediaFileUpload = async (
    kind: 'image' | 'video' | 'cover',
    file?: File
  ) => {
    if (!file) return;
    setUploadingMedia(kind);
    setCsvNotice(null);
    try {
      if (kind === 'cover') {
        const compressed = await compressImageFileToDataUrl(file);
        setActiveQuiz((prev) => ({ ...prev, coverImageUrl: compressed.dataUrl }));
        const sizeKb = Math.max(1, Math.round(compressed.approxBytes / 1024));
        setCsvNotice({
          type: 'ok',
          text: `อัปโหลดรูปภาพหน้าปกเรียบร้อยแล้ว (ย่อขนาดเหลือ ${sizeKb} KB พร้อมแสดงผลและบันทึกลง Firestore)`,
        });
      } else if (kind === 'image') {
        const compressed = await compressImageFileToDataUrl(file);
        updateQuestion({ imageUrl: compressed.dataUrl });
        const sizeKb = Math.max(1, Math.round(compressed.approxBytes / 1024));
        setCsvNotice({
          type: 'ok',
          text: `อัปโหลดรูปภาพเรียบร้อยแล้ว (ย่อขนาดเหลือ ${sizeKb} KB พร้อมแสดงผลและบันทึกลง Firestore)`,
        });
      } else if (file.size <= MAX_INLINE_VIDEO_BYTES) {
        const videoDataUrl = await readFileAsDataUrl(file);
        updateQuestion({ videoUrl: videoDataUrl });
        setCsvNotice({
          type: 'ok',
          text: 'อัปโหลดวิดีโอขนาดเล็กเรียบร้อยแล้ว',
        });
      } else {
        const localObjectUrl = URL.createObjectURL(file);
        updateQuestion({ videoUrl: localObjectUrl });
        setCsvNotice({
          type: 'ok',
          text: 'โหลดวิดีโอในเครื่องชั่วคราวแล้ว (หากต้องการให้ผู้เล่นทุกเครื่องเห็นวิดีโอด้วย แนะนำวางลิงก์ YouTube หรือ MP4 URL)',
        });
      }
    } catch (err) {
      setCsvNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการประมวลผลไฟล์สื่อ',
      });
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleSaveQuiz = async () => {
    clearAuthError();
    if (estimateQuizPayloadBytes(quiz) > MAX_FIRESTORE_QUIZ_BYTES) {
      setCsvNotice({
        type: 'err',
        text: 'ขนาดรูปภาพรวมในชุดคำถามนี้เกินขีดจำกัด 1 MB ของ Firestore กรุณาลดจำนวนรูปภาพหรือใช้ลิงก์ URL แทนบางข้อ',
      });
      return;
    }

    let authedUser = user;
    if (!authedUser) {
      authedUser = await signInWithGoogle();
    }
    if (!authedUser) return;

    setSavingQuiz(true);
    try {
      const saved = await saveQuizForUser(authedUser.uid, quiz);
      setActiveQuiz(() => saved);
      setCsvNotice({
        type: 'ok',
        text: 'บันทึกชุดคำถามลงฐานข้อมูล Firebase เรียบร้อยแล้ว',
      });
    } catch (err) {
      setCsvNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'ไม่สามารถบันทึกชุดคำถามได้',
      });
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleLaunchRoom = async (quizOverride?: QuizSet) => {
    soundFx.unlock();
    clearAuthError();
    const quizToLaunch = quizOverride ?? quiz;
    const invalidIdx = quizToLaunch.questions.findIndex(
      (q) => !q.text.trim() || q.options.some((o) => !o.trim())
    );
    if (invalidIdx !== -1) {
      setActiveQuizId(quizToLaunch.id);
      setPanelMode('EDITOR');
      setSelectedIdx(invalidIdx);
      setCsvNotice({
        type: 'err',
        text: `กรุณากรอกคำถามและตัวเลือกทั้ง 4 ข้อให้ครบในข้อที่ ${invalidIdx + 1}`,
      });
      return;
    }

    if (estimateQuizPayloadBytes(quizToLaunch) > MAX_FIRESTORE_QUIZ_BYTES) {
      setActiveQuizId(quizToLaunch.id);
      setPanelMode('EDITOR');
      setCsvNotice({
        type: 'err',
        text: 'ขนาดรูปภาพรวมในชุดคำถามนี้เกินขีดจำกัด 1 MB ของ Firestore กรุณาลดจำนวนรูปภาพหรือใช้ลิงก์ URL แทนบางข้อ',
      });
      return;
    }

    setCsvNotice(null);
    setRoomError(null);
    setLaunchingRoom(true);

    try {
      let authedUser = user;
      if (!authedUser) {
        authedUser = await signInWithGoogle();
      }
      if (!authedUser) {
        setLaunchingRoom(false);
        return;
      }

      const { code, quiz: cleanQuiz } = await createFirebaseRoom(authedUser.uid, quizToLaunch);
      void saveQuizForUser(authedUser.uid, cleanQuiz).catch(() => undefined);

      setPlayersDocs([]);
      setAnswersDocs([]);
      setRoomDoc(null);
      setActiveLiveQuiz(cleanQuiz);
      setActiveRoomCode(code);
    } catch (err) {
      setRoomError(
        err instanceof Error ? err.message : 'ไม่สามารถสร้างห้องแข่งขันบน Firebase ได้'
      );
    } finally {
      setLaunchingRoom(false);
    }
  };

  const copyJoinLink = async () => {
    if (!roomState) return;
    const url = `${window.location.origin}/?join=${roomState.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  // =========================================================================
  // LIVE HOST STAGE (LOBBY / QUESTION / REVEAL / LEADERBOARD / ENDED)
  // =========================================================================
  if (activeRoomCode && roomState && activeLiveQuiz) {
    const joinUrl = `${window.location.origin}/?join=${roomState.code}`;
    const q = roomState.currentQuestion;
    const totalVotes = roomState.answerCounts.reduce((acc, v) => acc + v, 0);

    const isQuestionOrReveal = roomState.phase === 'QUESTION' || roomState.phase === 'REVEAL';

    return (
      <div
        className={`${
          isQuestionOrReveal ? 'min-h-[100dvh] md:h-[100dvh] md:overflow-hidden' : 'min-h-[100dvh]'
        } bg-slate-900 text-slate-100 flex flex-col`}
      >
        {/* Top Broadcast Bar */}
        <header className="shrink-0 border-b border-slate-800 bg-slate-950/70 px-4 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => {
                setActiveRoomCode(null);
                setRoomDoc(null);
                setActiveLiveQuiz(null);
                setPlayersDocs([]);
                setAnswersDocs([]);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับชุดคำถาม</span>
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg text-white truncate">
                {roomState.quizTitle}
              </h1>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>รหัสห้อง {roomState.code}</span>
                <span aria-hidden="true">·</span>
                <span>
                  ผู้เล่น {roomState.totalPlayers}/{MAX_PLAYERS_PER_ROOM} คน
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียงเอฟเฟกต์'}
              className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span className="hidden sm:inline">{muted ? 'ปิดเสียง' : 'เสียงเปิดอยู่'}</span>
            </button>
          </div>
        </header>

        {roomError && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl bg-red-950 border border-red-500 px-4 py-3 text-sm text-red-200">
            {roomError}
          </div>
        )}

        {/* PHASE: LOBBY */}
        {roomState.phase === 'LOBBY' && (
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <section className="lg:col-span-5 rounded-3xl bg-slate-800/80 border border-slate-700 p-6 sm:p-7 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-indigo-300">
                  สแกน QR Code หรือกรอกรหัสห้อง 4 หลักเพื่อเข้าร่วม
                </p>
                <div
                  data-testid="host-room-code"
                  className="font-mono tabular-nums text-6xl sm:text-7xl font-extrabold tracking-widest text-white py-2"
                >
                  {roomState.code}
                </div>
              </div>

              <div className="flex justify-center">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-lg">
                    <img
                      src={qrDataUrl}
                      alt={`QR Code สำหรับเข้าห้อง ${roomState.code}`}
                      className="w-52 h-52 sm:w-56 sm:h-56"
                    />
                  </div>
                ) : (
                  <div className="w-52 h-52 rounded-2xl bg-slate-700 animate-pulse" />
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs text-slate-400 text-center break-all">{joinUrl}</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={copyJoinLink}
                    className="min-h-[44px] rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="host-start-game"
                    onClick={() => {
                      soundFx.unlock();
                      void hostStartOrAdvanceQuestion({
                        code: activeRoomCode,
                        quiz: activeLiveQuiz,
                        questionIndex: 0,
                        players: playersDocs,
                      });
                    }}
                    className="min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>เริ่มเกมเลย!</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="lg:col-span-7 rounded-3xl bg-slate-800/60 border border-slate-700 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-xl font-bold text-white">ผู้เล่นในห้องรอคอย</h2>
                </div>
                <span
                  data-testid="host-player-count"
                  className="font-mono tabular-nums text-sm font-bold text-indigo-300"
                >
                  {roomState.totalPlayers} / {MAX_PLAYERS_PER_ROOM} คน
                </span>
              </div>

              {roomState.players.length === 0 ? (
                <div className="py-16 text-center space-y-2 border border-dashed border-slate-700 rounded-2xl">
                  <p className="text-slate-300 font-semibold">กำลังรอผู้เล่นเข้าร่วมห้อง...</p>
                  <p className="text-sm text-slate-400">
                    ผู้เล่นสามารถเปิดกล้องมือถือสแกน QR Code หรือกรอกรหัส {roomState.code} เพื่อเลือกตัวละครและเข้าเล่น
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[440px] overflow-y-auto pr-1">
                  {roomState.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-700"
                    >
                      <CuteAvatar avatarId={p.avatarId} size={38} />
                      <span className="font-semibold text-sm text-white truncate">
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        )}

        {/* PHASE: QUESTION & REVEAL */}
        {(roomState.phase === 'QUESTION' || roomState.phase === 'REVEAL') && q && (
          <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col justify-between gap-3">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-indigo-300">
                  คำถามข้อที่ {roomState.currentQuestionIndex + 1} จาก {roomState.totalQuestions}
                </div>
                <div className="text-sm text-slate-300 font-mono tabular-nums">
                  ส่งคำตอบแล้ว {roomState.answeredCount} / {roomState.totalPlayers} คน
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CountdownClock remainingSec={roomState.remainingSec} size="lg" />
              </div>
            </div>

            <div
              className={`flex-1 min-h-0 grid gap-3 items-stretch ${
                roomState.phase === 'REVEAL' ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1'
              }`}
            >
              <div
                className={`${
                  roomState.phase === 'REVEAL' ? 'md:col-span-7' : ''
                } min-h-0 rounded-2xl sm:rounded-3xl bg-slate-800/80 border border-slate-700 px-5 py-3.5 flex flex-col items-center justify-center text-center gap-2 overflow-hidden`}
              >
                <h2 className="shrink-0 text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-snug text-balance">
                  {q.text}
                </h2>
                <MediaStage imageUrl={q.imageUrl} videoUrl={q.videoUrl} hostFit={true} />
              </div>

              {roomState.phase === 'REVEAL' && (
                <div className="md:col-span-5 min-h-0 rounded-2xl sm:rounded-3xl bg-slate-800/70 border border-slate-700 p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-200 shrink-0">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span>สถิติการตอบของผู้เล่นในข้อนี้</span>
                  </div>
                  <div className="flex-1 min-h-[120px] grid grid-cols-4 gap-3 items-end">
                    {([0, 1, 2, 3] as AnswerIndex[]).map((idx) => {
                      const count = roomState.answerCounts[idx];
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      const isCorrect = q.correctIndex === idx;
                      const style = ANSWER_STYLES[idx];
                      return (
                        <div key={idx} className="flex flex-col items-center h-full justify-end gap-1.5">
                          <span className="font-mono tabular-nums text-xs font-bold text-slate-200">
                            {count} ({pct}%)
                          </span>
                          <div className="w-full max-w-[64px] flex-1 min-h-[56px] max-h-32 bg-slate-900 rounded-t-lg flex items-end overflow-hidden">
                            <div
                              className={`w-full ${style.barClass} ${
                                count === 0 ? 'opacity-25' : isCorrect ? 'opacity-100' : 'opacity-50'
                              } transition-all duration-300`}
                              style={{ height: count === 0 ? '4px' : `${Math.max(14, pct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
                            {style.letter}
                            {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {([0, 1, 2, 3] as AnswerIndex[]).map((idx) => {
                const style = ANSWER_STYLES[idx];
                const isReveal = roomState.phase === 'REVEAL';
                const isCorrect = q.correctIndex === idx;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition-all ${style.bgClass} ${
                      isReveal
                        ? isCorrect
                          ? 'ring-4 ring-emerald-300 shadow-xl'
                          : 'opacity-40'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                        <AnswerShapeIcon index={idx} className="w-4 h-4" />
                      </span>
                      <span className="font-bold text-sm sm:text-base lg:text-lg leading-snug line-clamp-2">
                        {style.letter}. {q.options[idx]}
                      </span>
                    </div>
                    {isReveal && isCorrect && (
                      <span className="inline-flex items-center gap-1 bg-white text-emerald-700 font-extrabold text-xs px-2.5 py-1 rounded-lg shrink-0">
                        <Check className="w-4 h-4" />
                        คำตอบที่ถูก
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (roomState.phase === 'QUESTION') {
                    void hostRevealCurrentQuestion({
                      code: activeRoomCode,
                      quiz: activeLiveQuiz,
                      questionIndex: roomState.currentQuestionIndex,
                      questionEndsAt: roomState.questionEndsAt,
                      players: playersDocs,
                      answers: answersDocs,
                      targetPhase: 'ENDED',
                    });
                  } else {
                    void hostTransitionPhase({
                      code: activeRoomCode,
                      phase: 'ENDED',
                      quiz: activeLiveQuiz,
                      currentQuestionIndex: roomState.currentQuestionIndex,
                      players: playersDocs,
                    });
                  }
                }}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
              >
                จบเกมและสรุปผล
              </button>

              {roomState.phase === 'QUESTION' ? (
                <button
                  type="button"
                  data-testid="host-reveal-btn"
                  onClick={() => {
                    revealingQuestionRef.current = roomState.currentQuestionIndex;
                    void hostRevealCurrentQuestion({
                      code: activeRoomCode,
                      quiz: activeLiveQuiz,
                      questionIndex: roomState.currentQuestionIndex,
                      questionEndsAt: roomState.questionEndsAt,
                      players: playersDocs,
                      answers: answersDocs,
                      targetPhase: 'REVEAL',
                    });
                  }}
                  className="min-h-[44px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <span>เฉลยคำตอบทันที</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="host-leaderboard-btn"
                  onClick={() => {
                    const nextPhase =
                      roomState.currentQuestionIndex >= roomState.totalQuestions - 1
                        ? 'ENDED'
                        : 'LEADERBOARD';
                    void hostTransitionPhase({
                      code: activeRoomCode,
                      phase: nextPhase,
                      quiz: activeLiveQuiz,
                      currentQuestionIndex: roomState.currentQuestionIndex,
                      players: playersDocs,
                    });
                  }}
                  className="min-h-[44px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>
                    {roomState.currentQuestionIndex >= roomState.totalQuestions - 1
                      ? 'สรุปผลผู้ชนะทั้งหมด'
                      : 'แสดงตารางจัดอันดับสด'}
                  </span>
                </button>
              )}
            </div>
          </main>
        )}

        {/* PHASE: LEADERBOARD */}
        {roomState.phase === 'LEADERBOARD' && (
          <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white">
                  อันดับคะแนนหลังจบข้อที่ {roomState.currentQuestionIndex + 1}
                </h2>
                <p className="text-sm text-slate-400">
                  ถ่ายทอดสดไปยังหน้าจอผู้เล่นทุกคนแบบเรียลไทม์ผ่าน Firebase
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  data-testid="host-end-game-btn"
                  onClick={() =>
                    void hostTransitionPhase({
                      code: activeRoomCode,
                      phase: 'ENDED',
                      quiz: activeLiveQuiz,
                      currentQuestionIndex: roomState.currentQuestionIndex,
                      players: playersDocs,
                    })
                  }
                  className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm"
                >
                  จบเกมและสรุปผล
                </button>
                <button
                  type="button"
                  data-testid="host-next-question-btn"
                  onClick={() =>
                    void hostStartOrAdvanceQuestion({
                      code: activeRoomCode,
                      quiz: activeLiveQuiz,
                      questionIndex: roomState.currentQuestionIndex + 1,
                      players: playersDocs,
                    })
                  }
                  className="min-h-[44px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm inline-flex items-center gap-2 shrink-0"
                >
                  <span>ข้อถัดไป</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <LeaderboardStage
              players={roomState.players}
              totalQuestions={roomState.currentQuestionIndex + 1}
              darkSurface={true}
            />
          </main>
        )}

        {/* PHASE: ENDED */}
        {roomState.phase === 'ENDED' && (
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  สรุปผลการแข่งขันทั้งหมด
                </h2>
                <p className="text-sm text-slate-400">
                  {roomState.quizTitle} · ผู้เล่นทั้งหมด {roomState.totalPlayers} คน
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const csv = exportResultsToCsv(
                      roomState.players,
                      roomState.quizTitle,
                      roomState.totalQuestions
                    );
                    downloadTextFile(`quiz-results-${roomState.code}.csv`, csv);
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>ส่งออกผลคะแนน (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLaunchRoom(activeLiveQuiz)}
                  className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>เปิดห้องรอบใหม่</span>
                </button>
              </div>
            </div>

            <LeaderboardStage
              players={roomState.players}
              totalQuestions={roomState.totalQuestions}
              isFinal={true}
              darkSurface={true}
            />
          </main>
        )}
      </div>
    );
  }

  // Hidden shared CSV file input used in both Library and Editor headers
  const csvFileInput = (
    <input
      ref={csvInputRef}
      type="file"
      accept=".csv,text/csv"
      onChange={handleCsvImport}
      className="hidden"
      aria-label="อัปโหลดไฟล์คำถาม CSV"
    />
  );

  // =========================================================================
  // MODERATOR LEVEL 1: QUIZ COVER GALLERY (หน้าปกชุดคำถามแต่ละชุด)
  // =========================================================================
  if (panelMode === 'LIBRARY') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {csvFileInput}

        {/* Header with buttons firmly aligned to the top-right */}
        <header className="border-b border-slate-200 bg-white px-4 sm:px-8 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[38px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>หน้าแรก</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 truncate">
                คลังชุดคำถามสำหรับ Moderator
              </h1>
              <p className="text-xs text-slate-500 truncate">
                คลิกที่หน้าปกชุดคำถามเพื่อสร้าง แก้ไขคำถาม หรือเปิดห้องแข่งขัน (สูงสุด 200 คน/ห้อง)
              </p>
            </div>
          </div>

          <div className="w-full lg:w-auto lg:ml-auto flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 lg:shrink-0">
            {authReady && !user && (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={signingIn}
                className="min-h-[38px] px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>{signingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ Google'}</span>
              </button>
            )}
            {user && (
              <div className="min-h-[38px] flex items-center gap-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <span className="truncate max-w-[120px]">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  title="ออกจากระบบ"
                  className="text-slate-500 hover:text-rose-600"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => downloadTextFile('quiz-template.csv', '\uFEFF' + SAMPLE_CSV_TEMPLATE)}
              className="min-h-[38px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>ตัวอย่าง CSV</span>
            </button>
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="min-h-[38px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>นำเข้าไฟล์ CSV</span>
            </button>
            <button
              type="button"
              data-testid="create-new-quiz-btn"
              onClick={handleCreateNewQuizSet}
              className="min-h-[38px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างชุดคำถามใหม่</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-7 space-y-6">
          {(roomError || authError) && (
            <div
              role="alert"
              className="rounded-xl px-4 py-3 text-sm font-medium border bg-red-50 border-red-200 text-red-800"
            >
              {roomError || authError}
            </div>
          )}
          {csvNotice && (
            <div
              role="status"
              className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                csvNotice.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {csvNotice.text}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">
              ชุดคำถามของคุณ ({quizSets.length} ชุด)
            </h2>
            <span className="text-xs text-slate-500">
              กดที่หน้าปกเพื่อเข้าไปสร้างหรือแก้ไขคำถามแต่ละข้อ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizSets.map((item, idx) => {
              const coverImg =
                item.coverImageUrl?.trim() ||
                item.questions.find((q) => Boolean(q.imageUrl?.trim()))?.imageUrl;
              const gradient = COVER_GRADIENTS[idx % COVER_GRADIENTS.length];
              const totalSec = item.questions.reduce((acc, q) => acc + (q.timeLimitSec || 20), 0);
              const totalMin = Math.max(1, Math.ceil(totalSec / 60));

              return (
                <article
                  key={item.id}
                  data-testid={`quiz-cover-card-${item.id}`}
                  className="group rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col"
                >
                  {/* Clickable Cover Image / Banner */}
                  <button
                    type="button"
                    onClick={() => handleOpenQuizEditor(item.id)}
                    className="relative w-full aspect-[16/9] text-left overflow-hidden focus:outline-none"
                  >
                    {coverImg ? (
                      <>
                        <img
                          src={coverImg}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                      </>
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${gradient} p-5 flex flex-col justify-between relative`}>
                        <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10" />
                        <div className="absolute right-8 top-4 w-12 h-12 rounded-2xl rotate-12 bg-white/10" />
                      </div>
                    )}

                    {/* Cover Overlay Badges & Title */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-sm text-white text-xs font-bold inline-flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-300" />
                        <span>{item.questions.length} ข้อ</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-sm text-white text-xs font-semibold inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-300" />
                        <span>~{totalMin} นาที</span>
                      </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <h3 className="font-extrabold text-lg leading-snug line-clamp-2 drop-shadow-sm">
                        {item.title}
                      </h3>
                    </div>
                  </button>

                  {/* Card Details + Quick Actions */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {item.description || 'คลิกที่หน้าปกเพื่อเพิ่มหรือแก้ไขคำถาม รูปภาพ และวิดีโอประกอบ'}
                    </p>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        data-testid={`open-quiz-editor-${item.id}`}
                        onClick={() => handleOpenQuizEditor(item.id)}
                        className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                        <span>สร้าง/แก้ไขคำถาม</span>
                      </button>

                      <button
                        type="button"
                        data-testid={idx === 0 ? 'host-launch-room' : `host-launch-room-${item.id}`}
                        onClick={() => void handleLaunchRoom(item)}
                        disabled={launchingRoom || signingIn}
                        className="flex-1 min-h-[40px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{launchingRoom ? 'กำลังเปิด...' : 'เปิดห้องแข่ง'}</span>
                      </button>

                      {quizSets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteQuizSet(item.id)}
                          aria-label={`ลบชุดคำถาม ${item.title}`}
                          className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Create New Quiz Cover Card */}
            <button
              type="button"
              onClick={handleCreateNewQuizSet}
              className="min-h-[260px] rounded-3xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="font-extrabold text-base text-slate-900">
                  สร้างชุดคำถามใหม่
                </div>
                <div className="text-xs text-slate-500">
                  สร้างชุดคำถามใหม่ตั้งแต่ต้น ใส่รูปภาพและวิดีโอได้ไม่จำกัด
                </div>
              </div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // MODERATOR LEVEL 2: QUIZ BUILDER & CSV MANAGER (เมื่อกดเข้าหน้าปกชุดคำถาม)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {csvFileInput}

      {/* Top Header with buttons firmly aligned to the top-right */}
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            data-testid="back-to-library-btn"
            onClick={() => {
              setPanelMode('LIBRARY');
              setCsvNotice(null);
            }}
            className="min-h-[38px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับไปที่คลัง</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              {quiz.title || 'แก้ไขชุดคำถาม'}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              แก้ไขคำถาม ตัวเลือก รูปภาพ/วิดีโอ หรืออัปโหลด CSV ({quiz.questions.length} ข้อ)
            </p>
          </div>
        </div>

        <div className="w-full lg:w-auto lg:ml-auto flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 lg:shrink-0">
          {authReady && !user && (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={signingIn}
              className="min-h-[38px] px-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{signingIn ? 'กำลังเข้าสู่ระบบ...' : 'Google'}</span>
            </button>
          )}
          {user && (
            <div className="min-h-[38px] flex items-center gap-1.5 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="truncate max-w-[100px]">
                {user.displayName || user.email}
              </span>
              <button
                type="button"
                onClick={() => void signOutUser()}
                title="ออกจากระบบ"
                className="text-slate-500 hover:text-rose-600"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="min-h-[38px] px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>นำเข้า CSV</span>
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile('quiz-template.csv', '\uFEFF' + SAMPLE_CSV_TEMPLATE)}
            className="min-h-[38px] px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>ตัวอย่าง CSV</span>
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile('quiz-questions.csv', exportQuizToCsv(quiz.questions))}
            className="min-h-[38px] px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSaveQuiz()}
            disabled={savingQuiz}
            className="min-h-[38px] px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-indigo-600" />
            <span>{savingQuiz ? 'กำลังบันทึก...' : 'บันทึก'}</span>
          </button>
          <button
            type="button"
            data-testid="host-launch-room"
            onClick={() => void handleLaunchRoom()}
            disabled={launchingRoom || signingIn}
            className="min-h-[38px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{launchingRoom ? 'กำลังเปิดห้อง...' : 'เปิดห้องแข่งขัน'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
        {(roomError || authError) && (
          <div
            role="alert"
            className="rounded-xl px-4 py-3 text-sm font-medium border bg-red-50 border-red-200 text-red-800"
          >
            {roomError || authError}
          </div>
        )}
        {csvNotice && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-sm font-medium border ${
              csvNotice.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {csvNotice.text}
          </div>
        )}

        {/* Quiz Title, Description & Cover Image Card */}
        <section className="rounded-2xl bg-white border border-slate-200 p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-4">
            <label htmlFor="quiz-title" className="block text-xs font-bold text-slate-600 mb-1.5">
              ชื่อชุดคำถาม
            </label>
            <input
              id="quiz-title"
              type="text"
              maxLength={120}
              value={quiz.title}
              onChange={(e) => setActiveQuiz((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ศึกชิงเจ้าความรู้ทั่วไป"
            />
          </div>
          <div className="lg:col-span-4">
            <label htmlFor="quiz-desc" className="block text-xs font-bold text-slate-600 mb-1.5">
              คำอธิบายสั้นๆ
            </label>
            <input
              id="quiz-desc"
              type="text"
              maxLength={300}
              value={quiz.description}
              onChange={(e) => setActiveQuiz((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="รายละเอียดเพิ่มเติมสำหรับชุดคำถาม"
            />
          </div>
          <div className="lg:col-span-4">
            <span className="block text-xs font-bold text-slate-600 mb-1.5">
              ภาพหน้าปกชุดคำถาม (ไม่เกิน 500KB)
            </span>
            <div className="flex items-center gap-2.5">
              <div className="w-20 h-[42px] rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center shrink-0">
                {quiz.coverImageUrl?.trim() ? (
                  <img
                    src={quiz.coverImageUrl}
                    alt="ภาพหน้าปกชุดคำถาม"
                    data-testid="quiz-cover-preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="w-4 h-4 text-white/85" />
                )}
              </div>
              <label className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">
                  {uploadingMedia === 'cover'
                    ? 'กำลังย่อรูป...'
                    : quiz.coverImageUrl?.trim()
                    ? 'เปลี่ยนรูปหน้าปก'
                    : 'อัปโหลดรูปหน้าปก'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  data-testid="upload-cover-input"
                  className="hidden"
                  onChange={(e) => {
                    void handleMediaFileUpload('cover', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {quiz.coverImageUrl?.trim() && (
                <button
                  type="button"
                  data-testid="remove-cover-btn"
                  onClick={() => setActiveQuiz((prev) => ({ ...prev, coverImageUrl: '' }))}
                  aria-label="ลบภาพหน้าปกชุดคำถาม"
                  className="min-h-[42px] px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold whitespace-nowrap shrink-0"
                >
                  ลบรูป
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Question List Sidebar */}
          <aside className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-base">
                รายการคำถาม ({quiz.questions.length} ข้อ)
              </h2>
              <button
                type="button"
                onClick={addQuestion}
                className="min-h-[36px] px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มข้อ</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {quiz.questions.map((item, idx) => {
                const active = idx === selectedIdx;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
                      active
                        ? 'bg-indigo-50 border-indigo-300'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className="flex-1 text-left min-w-0 py-1"
                    >
                      <div className="text-xs font-bold text-indigo-700">
                        ข้อที่ {idx + 1} · {item.timeLimitSec} วิ
                      </div>
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {item.text.trim() || '(ยังไม่ได้กรอกคำถาม)'}
                      </div>
                    </button>
                    {quiz.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteQuestion(idx)}
                        aria-label={`ลบคำถามข้อที่ ${idx + 1}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Question Editor */}
          {activeQuestion && (
            <section className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-slate-900">
                  แก้ไขคำถามข้อที่ {selectedIdx + 1}
                </h2>
                <div className="flex items-center gap-2">
                  <label htmlFor="q-time-limit" className="text-xs font-bold text-slate-600">
                    เวลาตอบคำถาม:
                  </label>
                  <select
                    id="q-time-limit"
                    value={activeQuestion.timeLimitSec}
                    onChange={(e) => updateQuestion({ timeLimitSec: Number(e.target.value) })}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={10}>10 วินาที</option>
                    <option value={15}>15 วินาที</option>
                    <option value={20}>20 วินาที</option>
                    <option value={30}>30 วินาที</option>
                    <option value={45}>45 วินาที</option>
                    <option value={60}>60 วินาที</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="q-text" className="block text-xs font-bold text-slate-600 mb-1.5">
                  ข้อความคำถาม
                </label>
                <textarea
                  id="q-text"
                  rows={2}
                  maxLength={500}
                  value={activeQuestion.text}
                  onChange={(e) => updateQuestion({ text: e.target.value })}
                  placeholder="พิมพ์คำถามความรู้ทั่วไปที่นี่..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 font-semibold text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Image & Video Media Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="q-image-url" className="block text-xs font-bold text-slate-600">
                    รูปภาพประกอบ (URL หรืออัปโหลดไฟล์ ย่ออัตโนมัติไม่เกิน 500KB)
                  </label>
                  <div className="flex gap-2">
                    {activeQuestion.imageUrl?.startsWith('data:image/') ? (
                      <div className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-medium flex items-center justify-between gap-2">
                        <span className="truncate">
                          อัปโหลดรูป Base64 แล้ว (
                          {Math.max(1, Math.round((activeQuestion.imageUrl.length * 0.75) / 1024))} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuestion({ imageUrl: '' })}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 whitespace-nowrap shrink-0"
                        >
                          ลบรูป
                        </button>
                      </div>
                    ) : (
                      <input
                        id="q-image-url"
                        type="text"
                        value={activeQuestion.imageUrl || ''}
                        onChange={(e) => updateQuestion({ imageUrl: e.target.value })}
                        placeholder="https://... หรืออัปโหลดรูป"
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                    <label className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                      <ImageIcon className="w-4 h-4" />
                      <span>{uploadingMedia === 'image' ? 'กำลังย่อรูป...' : 'อัปโหลด'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        data-testid="upload-image-input"
                        className="hidden"
                        onChange={(e) => {
                          void handleMediaFileUpload('image', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="q-video-url" className="block text-xs font-bold text-slate-600">
                    วิดีโอประกอบ (YouTube / MP4 URL หรืออัปโหลด)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="q-video-url"
                      type="text"
                      value={activeQuestion.videoUrl || ''}
                      onChange={(e) => updateQuestion({ videoUrl: e.target.value })}
                      placeholder="https://youtube.com/... หรือไฟล์ MP4"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <label className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                      <VideoIcon className="w-4 h-4" />
                      <span>{uploadingMedia === 'video' ? 'กำลังอัปโหลด' : 'อัปโหลด'}</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          void handleMediaFileUpload('video', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {(activeQuestion.imageUrl || activeQuestion.videoUrl) && (
                <div className="rounded-2xl bg-slate-900 p-3">
                  <MediaStage
                    imageUrl={activeQuestion.imageUrl}
                    videoUrl={activeQuestion.videoUrl}
                    compact={true}
                  />
                </div>
              )}

              {/* 4 Answer Choices + Correct Answer Toggle */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    ตัวเลือกคำตอบ 4 ข้อ (คลิกปุ่ม "คำตอบที่ถูก" เพื่อกำหนดเฉลย)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([0, 1, 2, 3] as AnswerIndex[]).map((optIdx) => {
                    const style = ANSWER_STYLES[optIdx];
                    const isCorrect = activeQuestion.correctIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`rounded-2xl border p-3 space-y-2 transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${style.bgClass}`}
                          >
                            <AnswerShapeIcon index={optIdx} className="w-3.5 h-3.5" />
                            <span>ตัวเลือก {style.letter}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuestion({ correctIndex: optIdx })}
                            aria-pressed={isCorrect}
                            className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isCorrect ? 'คำตอบที่ถูก' : 'ตั้งเป็นเฉลย'}</span>
                          </button>
                        </div>

                        <input
                          type="text"
                          maxLength={200}
                          value={activeQuestion.options[optIdx]}
                          onChange={(e) => updateOption(optIdx, e.target.value)}
                          aria-label={`ตัวเลือก ${style.letter}`}
                          placeholder={`กรอกคำตอบ ${style.letter}`}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
