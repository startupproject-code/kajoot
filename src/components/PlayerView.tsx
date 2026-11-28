import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Flame,
  LogIn,
  LogOut,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  checkFirebaseRoom,
  FirestorePlayerDoc,
  FirestoreRoomDoc,
  getOrCreateGuestPlayerId,
  getSyncedServerNowMs,
  joinFirebaseRoom,
  markPlayerDisconnected,
  roomDocToPublicState,
  sendPlayerHeartbeat,
  subscribePlayerRoom,
  submitFirebaseAnswer,
  updateFirebasePlayerPose,
} from '../firebase/firebaseQuizService';
import {
  DEFAULT_POSE_ID,
  getCharacterPoses,
  hasExtraCharacterPoses,
} from '../shared/characterPoses';
import {
  AnswerIndex,
  AvatarId,
  AVATARS,
  MAX_PLAYERS_PER_ROOM,
  RoomMode,
  RoomPhase,
} from '../shared/types';
import {
  PLAYER_BACKGROUND_DISCONNECT_MS,
  PLAYER_HEARTBEAT_INTERVAL_MS,
  PLAYER_HEARTBEAT_JITTER_MS,
} from '../utils/playerPresenceLogic';
import { computeNextCountdownTickDelayMs } from '../utils/questionTimerSync';
import { soundFx } from '../utils/soundFx';
import { ANSWER_STYLES, AnswerShapeIcon } from './AnswerBadge';
import { AvatarPicker } from './AvatarPicker';
import { CountdownClock } from './CountdownClock';
import { CuteAvatar } from './CuteAvatar';
import { LeaderboardStage } from './LeaderboardStage';
import { MediaStage } from './MediaStage';
import { QrScannerModal } from './QrScannerModal';
import { TeamBadge, TeamBattleBoard } from './TeamBattleBoard';

interface PlayerViewProps {
  initialRoomCode?: string;
  onBackHome: () => void;
}

type JoinStep = 'ENTER_CODE' | 'SETUP_PROFILE' | 'IN_ROOM';

const POSE_UPDATE_COOLDOWN_MS = 3000;

export const PlayerView: React.FC<PlayerViewProps> = ({
  initialRoomCode = '',
  onBackHome,
}) => {
  const [guestPlayerId] = useState(() => getOrCreateGuestPlayerId());
  const [step, setStep] = useState<JoinStep>('ENTER_CODE');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [verifiedHostUid, setVerifiedHostUid] = useState('');
  const [verifiedQuizTitle, setVerifiedQuizTitle] = useState('');
  const [verifiedRoomMode, setVerifiedRoomMode] = useState<RoomMode>('single');
  const [playerName, setPlayerName] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId>('char_01');
  const [poseId, setPoseId] = useState<string>(DEFAULT_POSE_ID);
  const [updatingPose, setUpdatingPose] = useState(false);
  const [poseCooldownRemainingMs, setPoseCooldownRemainingMs] = useState(0);

  const [roomDoc, setRoomDoc] = useState<FirestoreRoomDoc | null>(null);
  const [selfPlayerDoc, setSelfPlayerDoc] = useState<FirestorePlayerDoc | null>(null);
  const [nowMs, setNowMs] = useState(() => getSyncedServerNowMs());
  const [selectedChoice, setSelectedChoice] = useState<AnswerIndex | null>(null);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const autoCheckedRef = useRef(false);
  const hadJoinedSelfRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  const activeSessionRef = useRef<{ code: string; uid: string; phase?: RoomPhase } | null>(null);
  const lastDisconnectSentAtRef = useRef(0);
  const lastPoseWriteAtRef = useRef(0);
  const poseCooldownUntilRef = useRef(0);
  const lastSoundSecRef = useRef<number | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const lastQuestionIdxRef = useRef<number>(-1);
  const submittedChoicesRef = useRef<Map<number, AnswerIndex>>(new Map());

  const verifyAndProceedToProfile = async (codeToCheck: string) => {
    setCheckingRoom(true);
    setErrorMsg(null);
    try {
      const res = await checkFirebaseRoom(codeToCheck);
      if (!res.exists || res.isFull || !res.hostUid) {
        setErrorMsg(res.error || 'ไม่สามารถเข้าห้องนี้ได้');
        return;
      }
      setRoomCode(res.code);
      setVerifiedHostUid(res.hostUid);
      setVerifiedQuizTitle(res.quizTitle || 'เกมตอบคำถามความรู้ทั่วไป');
      setVerifiedRoomMode(res.mode === 'team' ? 'team' : 'single');
      setStep('SETUP_PROFILE');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบห้องแข่งขันได้ กรุณาลองใหม่'
      );
    } finally {
      setCheckingRoom(false);
    }
  };

  // Auto-check room immediately when opened via QR link ?join=XXXX (No login required!)
  useEffect(() => {
    if (
      !autoCheckedRef.current &&
      /^\d{4}$/.test(initialRoomCode.trim()) &&
      step === 'ENTER_CODE'
    ) {
      autoCheckedRef.current = true;
      void verifyAndProceedToProfile(initialRoomCode.trim());
    }
  }, [initialRoomCode, step]);

  // Subscribe to Firestore Room + Self Player Document while IN_ROOM
  useEffect(() => {
    if (step !== 'IN_ROOM' || !roomCode) return;

    const unsub = subscribePlayerRoom(roomCode, guestPlayerId, {
      onRoom: (nextRoom) => {
        if (nextRoom.currentQuestionIndex !== lastQuestionIdxRef.current) {
          lastQuestionIdxRef.current = nextRoom.currentQuestionIndex;
          const prevChoice = submittedChoicesRef.current.get(nextRoom.currentQuestionIndex);
          setSelectedChoice(prevChoice ?? null);
        }
        setRoomDoc(nextRoom);
      },
      onPlayerSelf: (nextSelf) => {
        if (nextSelf) {
          hadJoinedSelfRef.current = true;
          setSelfPlayerDoc(nextSelf);
          if (nextSelf.poseId) {
            setPoseId(nextSelf.poseId);
          }
        } else if (hadJoinedSelfRef.current) {
          hadJoinedSelfRef.current = false;
          setSelfPlayerDoc(null);
          setRoomDoc(null);
          setStep('ENTER_CODE');
          if (!intentionalLeaveRef.current) {
            setErrorMsg('คุณหลุดการเชื่อมต่อ ออกจากหน้าแอพ หรือถูกนำออกจากห้องแข่งขัน');
          }
        } else {
          setSelfPlayerDoc(null);
        }
      },
      onMissing: () => {
        hadJoinedSelfRef.current = false;
        setErrorMsg('ห้องแข่งขันนี้ถูกปิดแล้ว');
        setStep('ENTER_CODE');
        setRoomDoc(null);
      },
    });

    return () => unsub();
  }, [step, roomCode, guestPlayerId]);

  // Keep latest session + ended/showcase state in refs without restarting heartbeat effect across phase changes
  const isActiveRoomSession =
    step === 'IN_ROOM' &&
    Boolean(roomCode) &&
    roomDoc?.phase !== 'ENDED' &&
    roomDoc?.phase !== 'SHOWCASE';
  const isRoomEndedRef = useRef(false);
  isRoomEndedRef.current = roomDoc?.phase === 'ENDED' || roomDoc?.phase === 'SHOWCASE';

  // Player presence heartbeat + immediate disconnect signal on page close / app switch / unmount
  useEffect(() => {
    if (!isActiveRoomSession) {
      activeSessionRef.current = null;
      return;
    }

    activeSessionRef.current = {
      code: roomCode,
      uid: guestPlayerId,
    };

    const sendHeartbeatNow = () => {
      const session = activeSessionRef.current;
      if (!session || isRoomEndedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void sendPlayerHeartbeat({ code: session.code, uid: session.uid }).catch(() => undefined);
    };

    const emitDisconnectOnce = () => {
      const session = activeSessionRef.current;
      if (!session || isRoomEndedRef.current) return;
      const now = Date.now();
      if (now - lastDisconnectSentAtRef.current < 400) return;
      lastDisconnectSentAtRef.current = now;
      void markPlayerDisconnected({
        code: session.code,
        uid: session.uid,
        useKeepalive: true,
      });
    };

    let heartbeatTimer: number | null = null;
    let backgroundTimer: number | null = null;
    const jitterMs = Math.floor(Math.random() * PLAYER_HEARTBEAT_JITTER_MS);

    const startTimer = window.setTimeout(() => {
      sendHeartbeatNow();
      heartbeatTimer = window.setInterval(() => {
        sendHeartbeatNow();
      }, PLAYER_HEARTBEAT_INTERVAL_MS);
    }, jitterMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (backgroundTimer !== null) {
          window.clearTimeout(backgroundTimer);
        }
        backgroundTimer = window.setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            emitDisconnectOnce();
          }
        }, PLAYER_BACKGROUND_DISCONNECT_MS);
      } else {
        if (backgroundTimer !== null) {
          window.clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        sendHeartbeatNow();
      }
    };

    const handlePageExit = () => {
      emitDisconnectOnce();
    };

    const handleOnline = () => {
      sendHeartbeatNow();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearTimeout(startTimer);
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      if (backgroundTimer !== null) window.clearTimeout(backgroundTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      window.removeEventListener('online', handleOnline);

      if (hadJoinedSelfRef.current && !intentionalLeaveRef.current && !isRoomEndedRef.current) {
        emitDisconnectOnce();
      }
      activeSessionRef.current = null;
    };
  }, [isActiveRoomSession, roomCode, guestPlayerId]);

  // Server-synced boundary-aligned countdown clock during QUESTION phase
  useEffect(() => {
    if (!roomDoc || roomDoc.phase !== 'QUESTION' || !roomDoc.questionEndsAt) return;
    let cancelled = false;
    let timeoutId: number | null = null;
    const endsAt = roomDoc.questionEndsAt;
    const timeLimitSec = roomDoc.currentQuestion?.timeLimitSec ?? 180;

    const scheduleNextTick = () => {
      if (cancelled) return;
      const syncedNow = getSyncedServerNowMs();
      setNowMs(syncedNow);
      const delayMs = computeNextCountdownTickDelayMs(endsAt, syncedNow, timeLimitSec);
      if (delayMs === null) return;
      timeoutId = window.setTimeout(scheduleNextTick, delayMs);
    };

    scheduleNextTick();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [
    roomDoc?.phase,
    roomDoc?.currentQuestionIndex,
    roomDoc?.questionEndsAt,
    roomDoc?.currentQuestion?.timeLimitSec,
  ]);

  // 3s pose change cooldown ticker to prevent spamming Firestore writes
  const isPoseCooldownActive = poseCooldownRemainingMs > 0;
  useEffect(() => {
    if (!isPoseCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, poseCooldownUntilRef.current - Date.now());
      setPoseCooldownRemainingMs(remaining);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPoseCooldownActive]);

  const roomState = useMemo(() => {
    if (!roomDoc) return null;
    return roomDocToPublicState(roomDoc, nowMs);
  }, [roomDoc, nowMs]);

  // Countdown beep-beep & reveal audio
  useEffect(() => {
    if (!roomState || step !== 'IN_ROOM') return;
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
      const me =
        selfPlayerDoc ?? roomState.players.find((p) => p.id === guestPlayerId);
      soundFx.playReveal(me?.lastCorrect ?? false);
      lastSoundSecRef.current = null;
    } else if (roomState.phase === 'ENDED' && prevPhase !== 'ENDED') {
      soundFx.playPodiumFanfare();
    }
  }, [roomState, step, selfPlayerDoc, guestPlayerId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundFx.setMuted(next);
  };

  const handleCheckRoom = async (codeToCheck: string) => {
    soundFx.unlock();
    const cleaned = codeToCheck.replace(/\D/g, '').slice(0, 4);
    setRoomCode(cleaned);
    if (cleaned.length !== 4) {
      setErrorMsg('กรุณากรอกรหัสห้องตัวเลข 4 หลัก');
      return;
    }
    await verifyAndProceedToProfile(cleaned);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.unlock();
    const cleanName = playerName.trim();
    if (!cleanName) {
      setErrorMsg('กรุณาตั้งชื่อผู้เล่นของคุณก่อนเข้าห้องรอคอย');
      return;
    }

    setErrorMsg(null);
    setJoiningRoom(true);
    try {
      hadJoinedSelfRef.current = false;
      intentionalLeaveRef.current = false;
      await joinFirebaseRoom({
        code: roomCode,
        hostUid: verifiedHostUid,
        uid: guestPlayerId,
        name: cleanName,
        avatarId,
        poseId,
      });
      setStep('IN_ROOM');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'ไม่สามารถเข้าห้องแข่งขันได้ กรุณาลองใหม่'
      );
    } finally {
      setJoiningRoom(false);
    }
  };

  const handlePoseChange = async (nextPoseId: string) => {
    const activeAvatar = selfPlayerDoc?.avatarId ?? avatarId;
    const currentPose = selfPlayerDoc?.poseId ?? poseId;
    if (nextPoseId === currentPose) return;

    const now = Date.now();
    if (updatingPose || now - lastPoseWriteAtRef.current < POSE_UPDATE_COOLDOWN_MS) {
      return;
    }

    lastPoseWriteAtRef.current = now;
    poseCooldownUntilRef.current = now + POSE_UPDATE_COOLDOWN_MS;
    setPoseCooldownRemainingMs(POSE_UPDATE_COOLDOWN_MS);
    setPoseId(nextPoseId);

    if (!roomDoc?.code) return;
    setUpdatingPose(true);
    try {
      await updateFirebasePlayerPose({
        code: roomDoc.code,
        uid: guestPlayerId,
        avatarId: activeAvatar,
        poseId: nextPoseId,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนท่าทางตัวละครได้'
      );
    } finally {
      setUpdatingPose(false);
    }
  };

  const handleAnswer = (choice: AnswerIndex) => {
    if (!roomState || roomState.phase !== 'QUESTION' || selectedChoice !== null) {
      return;
    }
    soundFx.unlock();
    soundFx.playAnswerLock();
    const qIdx = roomState.currentQuestionIndex;
    submittedChoicesRef.current.set(qIdx, choice);
    setSelectedChoice(choice);

    const hostUid = roomDoc?.hostUid || verifiedHostUid;
    void submitFirebaseAnswer({
      code: roomState.code,
      hostUid,
      playerUid: guestPlayerId,
      questionIndex: qIdx,
      choice,
    }).catch((err) => {
      submittedChoicesRef.current.delete(qIdx);
      setSelectedChoice(null);
      setErrorMsg(err instanceof Error ? err.message : 'ส่งคำตอบไม่สำเร็จ');
    });
  };

  const handleLeaveRoom = () => {
    intentionalLeaveRef.current = true;
    const session = activeSessionRef.current;
    activeSessionRef.current = null;
    if (session && session.phase !== 'ENDED' && session.phase !== 'SHOWCASE') {
      void markPlayerDisconnected({
        code: session.code,
        uid: session.uid,
        useKeepalive: true,
      });
    }
    onBackHome();
  };

  // =========================================================================
  // STEP 1: ENTER 4-DIGIT ROOM CODE OR SCAN QR (NO SIGN-IN REQUIRED)
  // =========================================================================
  if (step === 'ENTER_CODE') {
    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col">
        <header className="px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>หน้าแรก</span>
          </button>
          <span className="text-sm font-bold text-slate-600">โหมดผู้เล่น (Player)</span>
        </header>

        <main className="flex-1 flex items-start md:items-center justify-center px-4 pt-4 pb-6 sm:pt-7 md:py-8">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 sm:p-7 shadow-sm space-y-5">
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900">
                เข้าร่วมห้องแข่งขัน
              </h1>
              <p className="text-sm text-slate-500">
                กรอกรหัสห้อง 4 หลัก หรือสแกน QR Code จากหน้าจอ Moderator ได้ทันทีโดยไม่ต้องล็อกอิน
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium"
              >
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCheckRoom(roomCode);
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="room-code-input"
                  className="block text-xs font-bold text-slate-600 mb-1.5"
                >
                  รหัสห้อง 4 หลัก
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  placeholder="เช่น 4829"
                  className="w-full text-center font-mono tabular-nums text-4xl font-extrabold tracking-[0.35em] py-4 px-4 rounded-2xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none text-slate-900"
                />
              </div>

              <button
                type="submit"
                data-testid="player-check-room-btn"
                disabled={checkingRoom}
                className="w-full min-h-[48px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base inline-flex items-center justify-center gap-2 transition-colors"
              >
                <LogIn className="w-5 h-5" />
                <span>{checkingRoom ? 'กำลังตรวจสอบห้อง...' : 'เข้าสู่ห้อง'}</span>
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink mx-3 text-xs font-medium text-slate-400">หรือ</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="w-full min-h-[48px] rounded-2xl border-2 border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Camera className="w-5 h-5 text-indigo-600" />
              <span>เปิดกล้องสแกน QR Code</span>
            </button>
          </div>
        </main>

        <QrScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => void handleCheckRoom(code)}
        />
      </div>
    );
  }

  // =========================================================================
  // STEP 2: SETUP PLAYER NAME & PICK CUTE CHARACTER AVATAR
  // =========================================================================
  if (step === 'SETUP_PROFILE') {
    const selectedAvatarMeta = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];

    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col">
        <header className="px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => {
              setStep('ENTER_CODE');
              setErrorMsg(null);
            }}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>เปลี่ยนรหัสห้อง</span>
          </button>
          <span className="font-mono tabular-nums text-sm font-bold text-indigo-600">
            ห้อง {roomCode}
          </span>
        </header>

        <main className="flex-1 flex items-start md:items-center justify-center px-3 pt-4 pb-6 sm:px-6 sm:pt-7 md:py-8">
          <form
            onSubmit={handleJoinSubmit}
            className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 p-5 sm:p-7 shadow-sm space-y-5"
          >
            <div className="text-center space-y-1">
              <div className="text-xs font-bold text-emerald-600">
                เข้าห้อง {roomCode} สำเร็จ · {verifiedQuizTitle}
              </div>
              {verifiedRoomMode === 'team' && (
                <div className="inline-flex items-center gap-1 rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                  <Swords className="w-3.5 h-3.5" />
                  <span>โหมด Team Battle (ระบบจะจัดทีมแดง/น้ำเงินให้อัตโนมัติ)</span>
                </div>
              )}
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                ตั้งชื่อและเลือกตัวละครของคุณ
              </h1>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 font-medium"
              >
                {errorMsg}
              </div>
            )}

            {/* Name Input */}
            <div>
              <label
                htmlFor="player-name-input"
                className="block text-xs font-bold text-slate-600 mb-1.5"
              >
                ชื่อเล่นผู้เล่น ({selectedAvatarMeta.name})
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={24}
                value={playerName}
                onChange={(e) => {
                  setErrorMsg(null);
                  setPlayerName(e.target.value);
                }}
                placeholder="พิมพ์ชื่อเล่นของคุณ..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 4-Column Vertically Scrollable Avatar Picker */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-600 text-center">
                เลือกตัวละครของคุณ ({AVATARS.length} แบบ · เลื่อนขึ้น-ลงได้)
              </span>
              <AvatarPicker
                value={avatarId}
                onChange={(nextId) => {
                  setAvatarId(nextId);
                  setPoseId(DEFAULT_POSE_ID);
                }}
              />
            </div>

            <button
              type="submit"
              disabled={joiningRoom}
              data-testid="player-enter-lobby-btn"
              className="w-full min-h-[48px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-base shadow-sm transition-colors"
            >
              {joiningRoom ? 'กำลังเข้าสู่ห้อง...' : 'เข้าสู่หน้าจอรอคอย'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  // =========================================================================
  // STEP 3: IN-ROOM LIVE GAMEPLAY
  // =========================================================================
  if (!roomState) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-300">กำลังเชื่อมต่อห้องแข่งขัน Firebase...</p>
        </div>
      </div>
    );
  }

  const me =
    selfPlayerDoc ??
    roomState.players.find((p) => p.id === guestPlayerId);
  const q = roomState.currentQuestion;
  const isQuestionPhase = roomState.phase === 'QUESTION' && Boolean(q);

  return (
    <div
      className={`${
        isQuestionPhase ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
      } bg-slate-900 text-slate-100 flex flex-col`}
    >
      {/* Compact Player Top Bar */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-950/75 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {me && (
            <CuteAvatar
              avatarId={me.avatarId}
              poseId={me.poseId || poseId}
              size={36}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-sm text-white truncate">
                {me?.name || playerName}
              </span>
              {roomState.mode === 'team' && me?.team && (
                <TeamBadge team={me.team} compact />
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              ห้อง {roomState.code} · {me ? `${me.score.toLocaleString()} คะแนน` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {roomState.phase === 'QUESTION' && (
            <CountdownClock remainingSec={roomState.remainingSec} size="md" />
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          {roomState.phase !== 'ENDED' && roomState.phase !== 'SHOWCASE' && (
            <button
              type="button"
              data-testid="player-leave-room-btn"
              onClick={handleLeaveRoom}
              aria-label="ออกจากห้อง"
              title="ออกจากห้องแข่งขัน"
              className="min-h-[40px] px-2.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">ออกจากห้อง</span>
            </button>
          )}
        </div>
      </header>

      {/* LOBBY WAITING SCREEN — TOP-ALIGNED ON MOBILE WITH POSE SELECTOR */}
      {roomState.phase === 'LOBBY' && (() => {
        const lobbyAvatarId = me?.avatarId || avatarId;
        const lobbyPoseId = me?.poseId || poseId;
        const availablePoses = getCharacterPoses(lobbyAvatarId);
        const canChooseExtraPoses = hasExtraCharacterPoses(lobbyAvatarId);

        return (
          <main
            data-testid="player-lobby-stage"
            className="flex-1 max-w-2xl w-full mx-auto px-4 pt-4 pb-6 sm:pt-6 flex flex-col items-center justify-start text-center space-y-4"
          >
            <div className="rounded-3xl bg-slate-800/80 border border-slate-700 p-5 sm:p-7 w-full space-y-4">
              <div className="flex justify-center">
                <CuteAvatar
                  avatarId={lobbyAvatarId}
                  poseId={lobbyPoseId}
                  size={120}
                  className="ring-4 ring-indigo-500 shadow-xl"
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold text-indigo-300">
                  เข้าห้อง {roomState.code} เรียบร้อยแล้ว!
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  สวัสดี {me?.name || playerName}
                </h1>
                {roomState.mode === 'team' && (
                  <div className="pt-1 flex justify-center">
                    {me?.team ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-1.5 text-sm font-bold text-slate-200">
                        <span>คุณอยู่</span>
                        <TeamBadge team={me.team} />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-amber-300">
                        กำลังจัดทีม Team Battle แบบสมดุล...
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm text-slate-300">
                  กรุณารอ Moderator กดเริ่มเกม... เตรียมนิ้วให้พร้อม!
                </p>
              </div>

              <div className="pt-1 space-y-1.5 text-left">
                <label
                  htmlFor="player-pose-select"
                  className="block text-xs font-bold text-slate-300"
                >
                  เลือกท่าทางตัวละคร
                </label>
                <select
                  id="player-pose-select"
                  data-testid="player-pose-select"
                  data-cooldown={isPoseCooldownActive ? 'true' : 'false'}
                  value={lobbyPoseId}
                  disabled={!canChooseExtraPoses || updatingPose || isPoseCooldownActive}
                  onChange={(e) => void handlePoseChange(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-65 disabled:cursor-not-allowed"
                >
                  {availablePoses.map((pose) => (
                    <option key={pose.id} value={pose.id}>
                      {pose.label}
                    </option>
                  ))}
                </select>
                <div className="min-h-[18px]">
                  {!canChooseExtraPoses ? (
                    <p className="text-xs text-slate-400">
                      ตัวละครนี้แสดงท่าปกติ
                    </p>
                  ) : isPoseCooldownActive ? (
                    <p
                      data-testid="player-pose-cooldown-hint"
                      className="text-xs text-indigo-300 tabular-nums"
                    >
                      รอ {(poseCooldownRemainingMs / 1000).toFixed(1)} วินาที ก่อนเปลี่ยนท่าทางอีกครั้ง
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700/80 flex items-center justify-center gap-2 text-sm text-slate-300 font-mono tabular-nums">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>
                  ผู้เล่นในห้อง {roomState.totalPlayers} / {MAX_PLAYERS_PER_ROOM} คน
                </span>
              </div>
            </div>
          </main>
        );
      })()}

      {/* ACTIVE QUESTION PAD — FITS 100dvh MOBILE SCREEN WITHOUT SCROLLING */}
      {isQuestionPhase && q && (
        <main
          data-testid="player-question-stage"
          className="flex-1 min-h-0 max-w-4xl w-full mx-auto px-3 sm:px-5 py-3 flex flex-col gap-2.5 overflow-hidden"
        >
          <div className="shrink-0 rounded-2xl bg-slate-800/85 border border-slate-700 px-3.5 py-2.5 sm:p-4 text-center space-y-1">
            <div className="text-[11px] sm:text-xs font-bold text-indigo-300">
              ข้อที่ {roomState.currentQuestionIndex + 1} / {roomState.totalQuestions}
            </div>
            <h2 className="text-base sm:text-xl font-extrabold text-white leading-snug text-balance line-clamp-3">
              {q.text}
            </h2>
            <MediaStage imageUrl={q.imageUrl} videoUrl={q.videoUrl} compact={true} />
          </div>

          {selectedChoice !== null ? (
            <div
              data-testid="player-answer-locked"
              className="flex-1 min-h-0 flex flex-col items-center justify-center text-center rounded-3xl bg-slate-800/70 border border-slate-700 p-6 space-y-3"
            >
              <CheckCircle2 className="w-12 h-12 text-indigo-400" />
              <div className="text-lg sm:text-xl font-extrabold text-white">
                ส่งคำตอบตัวเลือก {ANSWER_STYLES[selectedChoice].letter} แล้ว!
              </div>
              <p className="text-sm text-slate-300">
                รอลุ้นคำตอบที่ถูกต้องพร้อมเพื่อนๆ เมื่อหมดเวลา...
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 grid-rows-4 sm:grid-rows-2 gap-2.5">
              {([0, 1, 2, 3] as AnswerIndex[]).map((idx) => {
                const style = ANSWER_STYLES[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    data-testid={`player-option-${idx}`}
                    onClick={() => handleAnswer(idx)}
                    className={`h-full min-h-[48px] rounded-2xl px-4 py-2 flex items-center gap-3 text-left shadow-md transition-transform overflow-hidden ${style.bgClass} ${style.hoverClass}`}
                  >
                    <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                      <AnswerShapeIcon index={idx} className="w-4 h-4 sm:w-5 sm:h-5" />
                    </span>
                    <span className="font-bold text-sm sm:text-lg leading-tight line-clamp-2">
                      {style.letter}. {q.options[idx]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* QUESTION REVEAL FEEDBACK */}
      {roomState.phase === 'REVEAL' && q && (
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center text-center space-y-6">
          <div
            data-testid="player-reveal-card"
            className={`w-full rounded-3xl border p-7 space-y-4 ${
              me?.lastCorrect
                ? 'bg-emerald-950/60 border-emerald-500'
                : 'bg-rose-950/50 border-rose-500'
            }`}
          >
            <div className="flex justify-center">
              {me?.lastCorrect ? (
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
              ) : (
                <XCircle className="w-14 h-14 text-rose-400" />
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {me?.lastCorrect ? 'เยี่ยมมาก! ตอบถูกต้อง' : 'เสียดาย! ยังไม่ถูกในข้อนี้'}
            </h2>
            {me?.lastCorrect ? (
              <div className="font-mono tabular-nums text-2xl font-extrabold text-emerald-300">
                +{me.lastPoints.toLocaleString()} คะแนน
              </div>
            ) : (
              q.correctIndex !== undefined && (
                <div className="text-sm text-slate-200">
                  คำตอบที่ถูกคือ:{' '}
                  <span className="font-bold text-white">
                    {ANSWER_STYLES[q.correctIndex].letter}. {q.options[q.correctIndex]}
                  </span>
                </div>
              )
            )}

            {me && (
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-slate-200">
                {roomState.mode === 'team' && me.team && (
                  <TeamBadge team={me.team} />
                )}
                <div>
                  อันดับปัจจุบัน:{' '}
                  <span className="font-mono tabular-nums font-bold text-white">
                    #{me.rank}
                  </span>
                </div>
                <div>
                  คะแนนรวม:{' '}
                  <span className="font-mono tabular-nums font-bold text-white">
                    {me.score.toLocaleString()}
                  </span>
                </div>
                {me.streak >= 2 && (
                  <div className="inline-flex items-center gap-1 text-amber-300 font-bold">
                    <Flame className="w-4 h-4" />
                    <span>{me.streak} ต่อเนื่อง</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-400">
            รอ Moderator แสดงตารางจัดอันดับสด...
          </p>
        </main>
      )}

      {/* LIVE BROADCAST LEADERBOARD */}
      {roomState.phase === 'LEADERBOARD' && (
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-extrabold text-white">
              ตารางจัดอันดับสดหลังข้อที่ {roomState.currentQuestionIndex + 1}
            </h2>
            {me && (
              <p className="text-sm text-indigo-300 font-semibold">
                คุณอยู่อันดับ #{me.rank} จาก {roomState.totalPlayers} คน ({me.score.toLocaleString()} คะแนน)
              </p>
            )}
          </div>

          {roomState.mode === 'team' && (
            <TeamBattleBoard
              players={roomState.players}
              myTeam={me?.team ?? null}
              compact={true}
            />
          )}

          <LeaderboardStage
            players={roomState.players}
            totalQuestions={roomState.currentQuestionIndex + 1}
            mode={roomState.mode}
            highlightPlayerId={guestPlayerId}
            darkSurface={true}
          />
        </main>
      )}

      {/* AWARD SHOWCASE SUSPENSE WAIT (MODERATOR ANNOUNCES 3 -> 2 -> 1 ON MAIN SCREEN) */}
      {roomState.phase === 'SHOWCASE' && (
        <main
          data-testid="player-showcase-wait"
          className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center text-center"
        >
          <div className="w-full rounded-3xl bg-slate-800/80 border border-amber-400/35 p-7 sm:p-10 shadow-2xl space-y-5">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center animate-pulse">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            {me && (
              <div className="flex flex-col items-center gap-2">
                <CuteAvatar
                  avatarId={me.avatarId}
                  poseId={me.poseId || poseId}
                  size={84}
                  className="ring-4 ring-amber-400/70 shadow-lg"
                />
                {roomState.mode === 'team' && me.team && (
                  <TeamBadge team={me.team} />
                )}
              </div>
            )}
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                อยู่ระหว่างประกาศผลรางวัล
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                {roomState.mode === 'team'
                  ? 'รอติดตามการประกาศอันดับผู้ชนะและสรุปผลทีมบนหน้าจอหลักพร้อมกัน...'
                  : 'รอติดตามการประกาศอันดับผู้ชนะบนหน้าจอหลักพร้อมกัน...'}
              </p>
            </div>
          </div>
        </main>
      )}

      {/* GAME ENDED: PODIUM + PERSONAL SUMMARY + LIVE LEADERBOARD */}
      {roomState.phase === 'ENDED' && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
          {me && (
            <section
              data-testid="player-final-summary"
              className="rounded-3xl bg-indigo-950/60 border border-indigo-500/60 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <CuteAvatar avatarId={me.avatarId} size={64} className="ring-4 ring-indigo-400" />
                <div>
                  <div className="text-xs font-bold text-indigo-300">สรุปผลงานของคุณ</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-extrabold text-white">{me.name}</h2>
                    {roomState.mode === 'team' && me.team && <TeamBadge team={me.team} />}
                  </div>
                  <div className="text-sm text-slate-300">
                    ตอบถูก {me.correctCount}/{roomState.totalQuestions} ข้อ · ต่อเนื่องสูงสุด {me.bestStreak} ข้อ
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-center">
                <div>
                  <div className="text-xs text-slate-400">อันดับ</div>
                  <div className="font-mono tabular-nums text-3xl font-extrabold text-amber-400 flex items-center gap-1">
                    <Trophy className="w-5 h-5" />
                    <span>#{me.rank}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">คะแนนรวม</div>
                  <div className="font-mono tabular-nums text-3xl font-extrabold text-white">
                    {me.score.toLocaleString()}
                  </div>
                </div>
              </div>
            </section>
          )}

          {roomState.mode === 'team' && (
            <TeamBattleBoard
              players={roomState.players}
              showWinner={true}
              showMvp={true}
              myTeam={me?.team ?? null}
            />
          )}

          <LeaderboardStage
            players={roomState.players}
            totalQuestions={roomState.totalQuestions}
            mode={roomState.mode}
            highlightPlayerId={guestPlayerId}
            isFinal={true}
            fireworksBurstKey={1}
            darkSurface={true}
          />

          <div className="flex justify-center pt-2 pb-6">
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[44px] px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับหน้าแรก / เข้าร่วมห้องใหม่</span>
            </button>
          </div>
        </main>
      )}
    </div>
  );
};
