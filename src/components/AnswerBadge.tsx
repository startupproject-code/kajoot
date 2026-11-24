import React from 'react';
import { AnswerIndex } from '../shared/types';

export const ANSWER_STYLES: Record<
  AnswerIndex,
  {
    letter: string;
    bgClass: string;
    hoverClass: string;
    barClass: string;
    ringClass: string;
    label: string;
  }
> = {
  0: {
    letter: 'A',
    bgClass: 'bg-rose-600 text-white',
    hoverClass: 'hover:bg-rose-700 active:scale-[0.98]',
    barClass: 'bg-rose-500',
    ringClass: 'ring-rose-300',
    label: 'ตัวเลือก A',
  },
  1: {
    letter: 'B',
    bgClass: 'bg-blue-600 text-white',
    hoverClass: 'hover:bg-blue-700 active:scale-[0.98]',
    barClass: 'bg-blue-500',
    ringClass: 'ring-blue-300',
    label: 'ตัวเลือก B',
  },
  2: {
    letter: 'C',
    bgClass: 'bg-amber-600 text-white',
    hoverClass: 'hover:bg-amber-700 active:scale-[0.98]',
    barClass: 'bg-amber-500',
    ringClass: 'ring-amber-300',
    label: 'ตัวเลือก C',
  },
  3: {
    letter: 'D',
    bgClass: 'bg-emerald-600 text-white',
    hoverClass: 'hover:bg-emerald-700 active:scale-[0.98]',
    barClass: 'bg-emerald-500',
    ringClass: 'ring-emerald-300',
    label: 'ตัวเลือก D',
  },
};

export const AnswerShapeIcon: React.FC<{ index: AnswerIndex; className?: string }> = ({
  index,
  className = 'w-5 h-5',
}) => {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 4L21 19H3L12 4Z" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 2L22 12L12 22L2 12L12 2Z" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
};
