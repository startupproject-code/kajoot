import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Upload,
  Users,
  Video as VideoIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
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
  RoomPublicState,
  ServerMessage,
} from '../shared/types';
import { soundFx } from '../utils/soundFx';
import { useQuizSocket } from '../utils/useQuizSocket';
import { ANSWER_STYLES, AnswerShapeIcon } from './AnswerBadge';
import { CountdownClock } from './CountdownClock';
import { CuteAvatar } from './CuteAvatar';
import { LeaderboardStage } from './LeaderboardStage';
import { MediaStage } from './MediaStage';

interface ModeratorViewProps {
  onBackHome: () => void;
}

function createBlankQuestion(index: number): QuizQuestion {
  return {
    id: `q-${Date.now().toString(36)}-${index}`,
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: 20,
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
  const [quiz, setQuiz] = useState<QuizSet>(() => ({
    ...DEFAULT_QUIZ,
    questions: DEFAULT_QUIZ.questions.map((q) => ({ ...q, options: [...q.options] as [string, string, string, string] })),
  }));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [csvNotice, setCsvNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState<'image' | 'video' | null>(null);

  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [muted, setMuted] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const lastSoundSecRef = useRef<number | null>(null);
  const lastPhaseRef = useRef<string | null>(null);

  const handleServerMsg = (msg: ServerMessage) => {
    if (msg.type === 'error') {
      setWsError(msg.message);
      return;
    }
    setWsError(null);

    if (msg.type === 'host:created') {
      setHostToken(msg.hostToken);
      setRoomState(msg.state);
      return;
    }

    if (msg.type === 'room:state') {
      setRoomState(msg.state);
      return;
    }

    if (msg.type === 'room:progress') {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              answeredCount: msg.answeredCount,
              totalPlayers: msg.totalPlayers,
              answerCounts: msg.answerCounts,
              remainingSec: msg.remainingSec,
            }
          : prev
      );
      return;
    }

    if (msg.type === 'room:tick') {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              remainingSec: msg.remainingSec,
            }
          : prev
      );
    }
  };

  const { connected, send } = useQuizSocket(handleServerMsg);

  // Reconnect host session automatically if socket dropped while room was open
  useEffect(() => {
    if (connected && roomState?.code && hostToken) {
      send({ type: 'host:reconnect', code: roomState.code, hostToken });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

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

  const activeQuestion = quiz.questions[selectedIdx] ?? quiz.questions[0];

  const updateQuestion = (patch: Partial<QuizQuestion>) => {
    setQuiz((prev) => ({
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
    setQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, newQ],
    }));
    setSelectedIdx(quiz.questions.length);
  };

  const deleteQuestion = (idx: number) => {
    if (quiz.questions.length <= 1) return;
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
    setSelectedIdx((prev) => Math.max(0, Math.min(prev, quiz.questions.length - 2)));
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

    setQuiz((prev) => ({
      ...prev,
      title: file.name.replace(/\.csv$/i, '') || prev.title,
      questions: result.questions,
    }));
    setSelectedIdx(0);
    setCsvNotice({
      type: result.errors.length > 0 ? 'err' : 'ok',
      text:
        result.errors.length > 0
          ? `นำเข้าสำเร็จ ${result.questions.length} ข้อ (มีข้อผิดพลาด ${result.errors.length} แถว: ${result.errors[0]})`
          : `นำเข้าชุดคำถามจาก CSV สำเร็จทั้งหมด ${result.questions.length} ข้อ`,
    });
  };

  const handleMediaFileUpload = async (
    kind: 'image' | 'video',
    file?: File
  ) => {
    if (!file) return;
    setUploadingMedia(kind);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });

      const resp = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        setCsvNotice({ type: 'err', text: data.error || 'อัปโหลดไฟล์สื่อไม่สำเร็จ' });
        return;
      }
      if (kind === 'image') {
        updateQuestion({ imageUrl: data.url });
      } else {
        updateQuestion({ videoUrl: data.url });
      }
    } catch {
      setCsvNotice({ type: 'err', text: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์สื่อ' });
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleLaunchRoom = () => {
    soundFx.unlock();
    const invalidIdx = quiz.questions.findIndex(
      (q) => !q.text.trim() || q.options.some((o) => !o.trim())
    );
    if (invalidIdx !== -1) {
      setSelectedIdx(invalidIdx);
      setCsvNotice({
        type: 'err',
        text: `กรุณากรอกคำถามและตัวเลือกทั้ง 4 ข้อให้ครบในข้อที่ ${invalidIdx + 1}`,
      });
      return;
    }
    setCsvNotice(null);
    send({ type: 'host:create', quiz });
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
  if (roomState) {
    const joinUrl = `${window.location.origin}/?join=${roomState.code}`;
    const q = roomState.currentQuestion;
    const totalVotes = roomState.answerCounts.reduce((acc, v) => acc + v, 0);

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {/* Top Broadcast Bar */}
        <header className="border-b border-slate-800 bg-slate-950/70 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => {
                setRoomState(null);
                setHostToken(null);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับตัวแก้ไข</span>
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

          <div className="flex items-center gap-2.5 shrink-0">
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

        {wsError && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl bg-red-950 border border-red-500 px-4 py-3 text-sm text-red-200">
            {wsError}
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
                      send({ type: 'host:start' });
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
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 flex flex-col justify-between gap-6">
            {/* Stage HUD */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
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

            {/* Question Card + Media */}
            <div className="rounded-3xl bg-slate-800/80 border border-slate-700 p-6 sm:p-8 text-center space-y-4">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-snug text-balance">
                {q.text}
              </h2>
              <MediaStage imageUrl={q.imageUrl} videoUrl={q.videoUrl} />
            </div>

            {/* Answer Distribution on Reveal */}
            {roomState.phase === 'REVEAL' && (
              <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>สถิติการตอบของผู้เล่นในข้อนี้</span>
                </div>
                <div className="grid grid-cols-4 gap-3 items-end h-28">
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
                        <div className="w-full max-w-[68px] bg-slate-900 rounded-t-lg h-16 flex items-end overflow-hidden">
                          <div
                            className={`w-full ${style.barClass} ${
                              count === 0 ? 'opacity-25' : isCorrect ? 'opacity-100' : 'opacity-50'
                            } transition-all duration-300`}
                            style={{ height: count === 0 ? '4px' : `${Math.max(14, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                          {style.letter}
                          {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4 Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {([0, 1, 2, 3] as AnswerIndex[]).map((idx) => {
                const style = ANSWER_STYLES[idx];
                const isReveal = roomState.phase === 'REVEAL';
                const isCorrect = q.correctIndex === idx;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl px-5 py-4 flex items-center justify-between gap-3 transition-all ${style.bgClass} ${
                      isReveal
                        ? isCorrect
                          ? 'ring-4 ring-emerald-300 shadow-xl'
                          : 'opacity-40'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                        <AnswerShapeIcon index={idx} className="w-5 h-5" />
                      </span>
                      <span className="font-bold text-lg sm:text-xl leading-snug">
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

            {/* Host Flow Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => send({ type: 'host:end' })}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
              >
                จบเกมและสรุปผล
              </button>

              {roomState.phase === 'QUESTION' ? (
                <button
                  type="button"
                  data-testid="host-reveal-btn"
                  onClick={() => send({ type: 'host:reveal' })}
                  className="min-h-[44px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <span>เฉลยคำตอบทันที</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="host-leaderboard-btn"
                  onClick={() => send({ type: 'host:leaderboard' })}
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
                  ถ่ายทอดสดไปยังหน้าจอผู้เล่นทุกคนแบบเรียลไทม์
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  data-testid="host-end-game-btn"
                  onClick={() => send({ type: 'host:end' })}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm"
                >
                  จบเกมและสรุปผล
                </button>
                <button
                  type="button"
                  data-testid="host-next-question-btn"
                  onClick={() => send({ type: 'host:next' })}
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
                  onClick={() => send({ type: 'host:restart', quiz })}
                  className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>เล่นรอบใหม่อีกครั้ง</span>
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

  // =========================================================================
  // MODERATOR QUIZ BUILDER & CSV MANAGER
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>หน้าแรก</span>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
              จัดการชุดคำถามสำหรับ Moderator
            </h1>
            <p className="text-xs text-slate-500">
              สร้างคำถาม เพิ่มรูปภาพ/วิดีโอ หรืออัปโหลดไฟล์ CSV ได้ทันที (รองรับสูงสุด 200 คน/ห้อง)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvImport}
            className="hidden"
            aria-label="อัปโหลดไฟล์คำถาม CSV"
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>นำเข้าไฟล์ CSV</span>
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile('quiz-template.csv', '\uFEFF' + SAMPLE_CSV_TEMPLATE)}
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>ตัวอย่าง CSV</span>
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile('quiz-questions.csv', exportQuizToCsv(quiz.questions))}
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            type="button"
            data-testid="host-launch-room"
            onClick={handleLaunchRoom}
            disabled={!connected}
            className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>เปิดห้องแข่งขัน</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
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

        {/* Quiz Title Card */}
        <section className="rounded-2xl bg-white border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="quiz-title" className="block text-xs font-bold text-slate-600 mb-1.5">
              ชื่อชุดคำถาม
            </label>
            <input
              id="quiz-title"
              type="text"
              value={quiz.title}
              onChange={(e) => setQuiz((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ศึกชิงเจ้าความรู้ทั่วไป"
            />
          </div>
          <div>
            <label htmlFor="quiz-desc" className="block text-xs font-bold text-slate-600 mb-1.5">
              คำอธิบายสั้นๆ
            </label>
            <input
              id="quiz-desc"
              type="text"
              value={quiz.description}
              onChange={(e) => setQuiz((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="รายละเอียดเพิ่มเติมสำหรับชุดคำถาม"
            />
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
                    รูปภาพประกอบ (URL หรืออัปโหลดไฟล์)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="q-image-url"
                      type="text"
                      value={activeQuestion.imageUrl || ''}
                      onChange={(e) => updateQuestion({ imageUrl: e.target.value })}
                      placeholder="https://... หรืออัปโหลดรูป"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <label className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                      <ImageIcon className="w-4 h-4" />
                      <span>{uploadingMedia === 'image' ? 'กำลังอัปโหลด' : 'อัปโหลด'}</span>
                      <input
                        type="file"
                        accept="image/*"
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
