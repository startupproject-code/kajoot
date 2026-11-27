import React, { useState } from 'react';
import { QrCode, Timer, Trophy } from 'lucide-react';
import connectImg from '../assets/images/howto_connect_qr_1795602860373.jpg';
import answerImg from '../assets/images/howto_answer_quiz_1795602859934.jpg';
import winnerImg from '../assets/images/howto_score_winner_1795602859188.jpg';

interface HowToPlaySectionProps {
  onJoinPlayer: () => void;
}

interface GuideStep {
  num: string;
  title: string;
  summary: string;
  tips: string[];
  image: string;
  imageAlt: string;
  fallbackGradient: string;
  FallbackIcon: React.ComponentType<{ className?: string }>;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    num: '01',
    title: 'สแกนเข้าห้อง ไม่ต้องล็อกอิน',
    summary:
      'เปิดกล้องมือถือสแกน QR Code จากหน้าจอโฮสต์ หรือกดกรอกรหัสห้อง 4 หลักบนเว็บก็เข้าได้ทันที',
    tips: [
      'ไม่ต้องสมัครสมาชิกหรือล็อกอินให้ยุ่งยาก',
      'ตั้งชื่อเล่น แล้วเลือกน้องสัตว์คู่ใจได้เลย',
    ],
    image: connectImg,
    imageAlt: 'ผู้เล่นสแกน QR Code บนหน้าจอใหญ่เพื่อเลือกตัวละครและเข้าห้องเกม',
    fallbackGradient: 'from-indigo-500 to-violet-600',
    FallbackIcon: QrCode,
  },
  {
    num: '02',
    title: 'อ่านไว จิ้มคำตอบให้ทันเวลา',
    summary:
      'พอโฮสต์เริ่มข้อใหม่ ดูคำถาม รูปภาพ หรือคลิปวิดีโอบนจอ แล้วแตะเลือกคำตอบจาก 4 ปุ่มสีให้ทันเวลา',
    tips: [
      'จิ้มเลือกปุ๊บ ระบบจะล็อกคำตอบทันที (เปลี่ยนใจไม่ได้นะ)',
      'เหลือ 10 วินาทีสุดท้าย ตัวเลขจะกระพริบสีแดงพร้อมเสียง Beep เตือน',
    ],
    image: answerImg,
    imageAlt: 'มือแตะเลือกคำตอบ 1 ใน 4 ปุ่มสีบนหน้าจอมือถือพร้อมนาฬิกาจับเวลา',
    fallbackGradient: 'from-sky-500 to-indigo-600',
    FallbackIcon: Timer,
  },
  {
    num: '03',
    title: 'ถูก + ไว + ต่อเนื่อง = แชมป์!',
    summary:
      'ทุกข้อที่ตอบถูกได้แต้มฐานพร้อมโบนัสความไว และถ้าตอบถูกติดกันหลายข้อก็ยิ่งได้โบนัสทวีคูณ',
    tips: [
      'ตอบถูก 500 + โบนัสไวสูงสุด 500 + สตรีคสูงสุด 250 = เต็ม 1,250 แต้ม/ข้อ',
      'จบเกมใครคะแนนรวมสูงสุด Top 3 ได้ขึ้นแท่นแชมป์โชว์ทุกหน้าจอ!',
    ],
    image: winnerImg,
    imageAlt: 'ถ้วยรางวัลผู้ชนะบนแท่นรับรางวัลพร้อมสายฟ้าความไวและไฟคอมโบสตรีค',
    fallbackGradient: 'from-amber-500 to-orange-600',
    FallbackIcon: Trophy,
  },
];

export const HowToPlaySection: React.FC<HowToPlaySectionProps> = ({ onJoinPlayer }) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <section
      id="how-to-play"
      aria-labelledby="how-to-play-heading"
      className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 space-y-8 scroll-mt-6"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2
            id="how-to-play-heading"
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-balance"
          >
            วิธีการเล่น QuizArena Live
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            เล่นง่ายๆ แค่ 3 ขั้นตอน ไม่ต้องโหลดแอป สแกนแล้วแข่งตอบคำถามกับเพื่อนแบบเรียลไทม์ได้เลย
          </p>
        </div>
        <button
          type="button"
          onClick={onJoinPlayer}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          พร้อมแล้ว เข้าห้องเล่นเลย
        </button>
      </div>

      {/* 3 Illustrated Step Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {GUIDE_STEPS.map((step) => {
          const isBroken = Boolean(failedImages[step.num]);
          const FallbackIcon = step.FallbackIcon;
          return (
            <article key={step.num} className="flex flex-col gap-4">
              {/* Step Illustration (4:3) */}
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
                {!isBroken ? (
                  <img
                    src={step.image}
                    alt={step.imageAlt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [step.num]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${step.fallbackGradient} flex flex-col items-center justify-center gap-2 text-white p-6 text-center`}
                  >
                    <FallbackIcon className="w-10 h-10" />
                    <span className="font-bold text-sm">{step.title}</span>
                  </div>
                )}
              </div>

              {/* Clean Editorial Numbering & Casual Explanation */}
              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  <span className="text-indigo-600 tabular-nums mr-1.5">{step.num}.</span>
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.summary}</p>
                <ul className="space-y-1.5 pt-1 text-xs sm:text-sm text-slate-700">
                  {step.tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold shrink-0" aria-hidden="true">
                        –
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      {/* Concise Scoring & Winner Rules Breakdown */}
      <div className="border-t border-slate-200 pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            คิดคะแนนยังไง และตัดสินผู้ชนะตรงไหน?
          </h3>
          <span className="text-xs sm:text-sm text-slate-500">
            ตอบผิดหรือหมดเวลา = 0 คะแนน และสตรีคต่อเนื่องจะเริ่มนับใหม่
          </span>
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="space-y-1">
            <dt className="text-xs font-semibold text-slate-500">ตอบถูกพื้นฐาน</dt>
            <dd className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
              500 แต้ม
            </dd>
            <p className="text-xs text-slate-600">ตอบถูกปุ๊บ รับไปเลยขั้นต่ำข้อละ 500</p>
          </div>

          <div className="space-y-1">
            <dt className="text-xs font-semibold text-slate-500">โบนัสความไว</dt>
            <dd className="text-xl sm:text-2xl font-extrabold text-indigo-600 tabular-nums">
              +0 ถึง +500
            </dd>
            <p className="text-xs text-slate-600">ยิ่งกดตอบเร็วหลังเริ่มข้อ ยิ่งบวกเพิ่มเยอะ</p>
          </div>

          <div className="space-y-1">
            <dt className="text-xs font-semibold text-slate-500">โบนัสถูกติดกัน (Streak)</dt>
            <dd className="text-xl sm:text-2xl font-extrabold text-amber-600 tabular-nums">
              สูงสุด +250
            </dd>
            <p className="text-xs text-slate-600">ถูกติดกันตั้งแต่ข้อ 2 ขึ้นไป บวกเพิ่มข้อละ +50</p>
          </div>

          <div className="space-y-1">
            <dt className="text-xs font-semibold text-slate-500">เงื่อนไขผู้ชนะ</dt>
            <dd className="text-xl sm:text-2xl font-extrabold text-emerald-600 tabular-nums">
              แต้มรวมสูงสุด
            </dd>
            <p className="text-xs text-slate-600">
              คะแนนเท่ากัน ดูจำนวนข้อถูกและสตรีคสูงสุดตามลำดับ
            </p>
          </div>
        </dl>
      </div>
    </section>
  );
};
