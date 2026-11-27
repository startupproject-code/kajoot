import React from 'react';
import { Check } from 'lucide-react';
import { AvatarId, AVATARS } from '../shared/types';

interface AvatarPickerProps {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, onChange }) => {
  const activeIndex = Math.max(
    0,
    AVATARS.findIndex((a) => a.id === value)
  );
  const activeMeta = AVATARS[activeIndex] ?? AVATARS[0];

  return (
    <div className="w-full space-y-2.5" data-testid="avatar-picker">
      {/* Outer rounded frame matching wireframe */}
      <div className="rounded-3xl border-2 border-slate-200 bg-slate-50/80 p-3 sm:p-4 shadow-inner">
        <div
          role="radiogroup"
          aria-label="เลือกตัวละครของคุณ"
          data-testid="avatar-grid-scroller"
          className="grid grid-cols-4 gap-2.5 sm:gap-3.5 max-h-[236px] sm:max-h-[296px] overflow-y-scroll pr-2.5 sm:pr-3 py-1 px-0.5 avatar-grid-scrollbar"
        >
          {AVATARS.map((av) => {
            const isActive = av.id === value;
            return (
              <button
                key={av.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={av.name}
                data-testid={`avatar-option-${av.id}`}
                onClick={() => onChange(av.id)}
                className={`group relative aspect-square min-h-[44px] min-w-[44px] w-full rounded-2xl overflow-hidden transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'border-[3px] border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50 shadow-md scale-[1.02]'
                    : 'border-2 border-slate-200 bg-white hover:border-indigo-300 hover:scale-[1.02]'
                }`}
              >
                <img
                  src={av.imagePath}
                  alt={av.name}
                  draggable={false}
                  className="w-full h-full object-cover object-top"
                />
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Avatar Caption */}
      <div className="flex items-center justify-between px-1 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={activeMeta.imagePath}
            alt=""
            aria-hidden="true"
            className="w-6 h-6 rounded-lg object-cover object-top border border-slate-200 shrink-0"
          />
          <span className="font-bold text-slate-900 truncate" data-testid="selected-avatar-name">
            {activeMeta.name}
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
          {activeIndex + 1} / {AVATARS.length}
        </span>
      </div>
    </div>
  );
};
