import React from 'react';
import { Clock } from 'lucide-react';

interface CountdownClockProps {
  remainingSec: number;
  size?: 'md' | 'lg';
}

export const CountdownClock: React.FC<CountdownClockProps> = ({
  remainingSec,
  size = 'lg',
}) => {
  const displaySec = Math.max(0, Math.round(remainingSec));
  const isTimeUp = displaySec === 0;
  const isUrgent = remainingSec <= 10;

  if (size === 'md') {
    return (
      <div
        data-testid="countdown-timer"
        data-urgent={isUrgent ? 'true' : 'false'}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono tabular-nums font-bold transition-colors ${
          isUrgent
            ? 'bg-red-600/20 border-2 border-red-500 text-red-500'
            : 'bg-slate-800 border border-slate-700 text-slate-100'
        }`}
      >
        <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-indigo-400'}`} />
        <span
          className={`text-2xl leading-none ${
            isTimeUp
              ? 'text-red-500'
              : isUrgent
              ? 'text-red-500 animate-urgent-blink'
              : 'text-white'
          }`}
        >
          {displaySec}
        </span>
        <span className="text-xs font-sans font-medium opacity-80">
          {isTimeUp ? 'หมดเวลา' : 'วินาที'}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="countdown-timer"
      data-urgent={isUrgent ? 'true' : 'false'}
      className={`inline-flex flex-col items-center justify-center min-w-[104px] px-5 py-2.5 rounded-2xl border-2 transition-colors ${
        isUrgent
          ? 'bg-red-950/60 border-red-500 shadow-lg shadow-red-600/20'
          : 'bg-slate-800/90 border-slate-700'
      }`}
    >
      <span
        className={`font-mono tabular-nums text-4xl sm:text-5xl font-extrabold leading-none ${
          isTimeUp
            ? 'text-red-500'
            : isUrgent
            ? 'text-red-500 animate-urgent-blink'
            : 'text-white'
        }`}
      >
        {displaySec}
      </span>
      <span
        className={`mt-1 text-xs font-medium ${
          isUrgent ? 'text-red-300' : 'text-slate-400'
        }`}
      >
        {isTimeUp ? 'หมดเวลา' : isUrgent ? 'ใกล้หมดเวลา!' : 'วินาที'}
      </span>
    </div>
  );
};
