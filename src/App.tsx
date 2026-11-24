import { useEffect, useState } from 'react';
import { MonitorPlay, QrCode, Smartphone, Users } from 'lucide-react';
import { AVATARS, MAX_PLAYERS_PER_ROOM } from './shared/types';
import { CuteAvatar } from './components/CuteAvatar';
import { ModeratorView } from './components/ModeratorView';
import { PlayerView } from './components/PlayerView';

type AppMode = 'HOME' | 'MODERATOR' | 'PLAYER';

export default function App() {
  const [mode, setMode] = useState<AppMode>('HOME');
  const [joinCodeFromUrl, setJoinCodeFromUrl] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    const modeParam = params.get('mode');
    const autostart = params.get('autostart');

    if (joinParam && /^\d{4}$/.test(joinParam.trim())) {
      setJoinCodeFromUrl(joinParam.trim());
      setMode('PLAYER');
      return;
    }

    if (modeParam === 'host' || autostart === '1') {
      setMode('MODERATOR');
      return;
    }

    if (modeParam === 'play') {
      setMode('PLAYER');
    }
  }, []);

  if (mode === 'MODERATOR') {
    return (
      <ModeratorView
        onBackHome={() => {
          setMode('HOME');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  if (mode === 'PLAYER') {
    return (
      <PlayerView
        initialRoomCode={joinCodeFromUrl}
        onBackHome={() => {
          setJoinCodeFromUrl('');
          setMode('HOME');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Clean 3-zone Top Bar */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-8">
        <a
          href="/"
          className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          QuizArena Live
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#roles" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            เลือกโหมดเล่น
          </a>
          <a href="#characters" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            ตัวละครน่ารัก
          </a>
          <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            ความสามารถ
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setMode('PLAYER')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
          >
            เข้าห้องด้วยรหัส 4 หลัก
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-12">
        {/* Hero & Role Selector */}
        <section id="roles" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-[1.2] text-balance">
              เกมตอบคำถามความรู้ทั่วไป แข่งขันเรียลไทม์ สูงสุด 200 คน
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              สร้างชุดคำถามผ่านหน้าเว็บหรืออัปโหลดไฟล์ CSV ใส่รูปภาพและวิดีโอประกอบได้เต็มที่ พร้อมจับเวลาถอยหลังสุดตื่นเต้นและตารางจัดอันดับถ่ายทอดสดบนหน้าจอผู้เล่นทุกคน
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 font-medium">
              <span>เชื่อมต่อ WebSocket เรียลไทม์</span>
              <span aria-hidden="true">·</span>
              <span>สแกน QR Code หรือรหัส 4 หลัก</span>
              <span aria-hidden="true">·</span>
              <span>สรุปคะแนน CSV หลังจบเกม</span>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Moderator Card */}
            <div className="rounded-3xl bg-slate-900 text-white p-6 flex flex-col justify-between gap-6 shadow-lg">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                  <MonitorPlay className="w-6 h-6 text-indigo-300" />
                </div>
                <h2 className="text-xl font-extrabold">สำหรับ Moderator</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  สร้างหรือนำเข้าคำถามจาก CSV เพิ่มรูปและวิดีโอ เปิดห้องแจก QR Code และควบคุมจังหวะคำถามสด
                </p>
              </div>
              <button
                type="button"
                data-testid="enter-moderator-btn"
                onClick={() => setMode('MODERATOR')}
                className="w-full min-h-[46px] rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition-colors"
              >
                สร้างห้องและจัดการคำถาม
              </button>
            </div>

            {/* Player Card */}
            <div className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between gap-6 shadow-sm">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">สำหรับ Player</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  สแกน QR Code หรือกรอกรหัส 4 หลัก ตั้งชื่อเล่น เลือกน้องตัวละครน่ารัก และแข่งตอบคำถามกับเพื่อน
                </p>
              </div>
              <button
                type="button"
                data-testid="enter-player-btn"
                onClick={() => setMode('PLAYER')}
                className="w-full min-h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors"
              >
                เข้าร่วมเล่นเกม
              </button>
            </div>
          </div>
        </section>

        {/* Cute Characters Showcase */}
        <section id="characters" className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                เลือกน้องตัวละครคู่ใจไปโชว์บนตารางจัดอันดับ
              </h2>
              <p className="text-sm text-slate-500">
                ผู้เล่นทุกคนสามารถเลือกตัวละครน่ารักก่อนเข้าห้องรอคอย เพื่อแสดงตัวตนบนแท่นผู้ชนะหลังจบเกม
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              ทั้งหมด {AVATARS.length} ตัวละคร
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-10 gap-3">
            {AVATARS.map((av) => (
              <div
                key={av.id}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <CuteAvatar avatarId={av.id} size={56} />
                <span className="text-xs font-semibold text-slate-700 truncate max-w-full">
                  {av.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Key Capabilities Strip */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">รองรับสูงสุด {MAX_PLAYERS_PER_ROOM} คนต่อห้อง</h3>
            <p className="text-sm text-slate-600">
              ประมวลผลคะแนนผ่าน WebSocket จากฝั่งเซิร์ฟเวอร์โดยตรง แม่นยำ รวดเร็ว และจัดอันดับสดพร้อมกันทุกเครื่อง
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
            <QrCode className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">เข้าห้องไวด้วย QR Code และรหัส 4 หลัก</h3>
            <p className="text-sm text-slate-600">
              เปิดกล้องมือถือสแกน QR บนหน้าจอโฮสต์หรือเปิดกล้องสแกนในแอปได้ทันที พร้อมรหัสห้อง 4 หลักที่จำง่าย
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
            <MonitorPlay className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">นับถอยหลังสีแดงกระพริบ + เสียง Beep Beep</h3>
            <p className="text-sm text-slate-600">
              เมื่อเหลือเวลา 10 วินาทีสุดท้าย ตัวเลขจะเปลี่ยนเป็นสีแดงกระพริบพร้อมเสียง Beep Beep เร้าใจทุกวินาที
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
