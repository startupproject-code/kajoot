import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AvatarId, AVATARS } from '../shared/types';

interface AvatarCarouselProps {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
}

type CategoryFilter = 'all' | 'character' | 'animal';

const ITEM_WIDTH = 128; // px (w-32)
const ITEM_GAP = 14; // px

export const AvatarCarousel: React.FC<AvatarCarouselProps> = ({ value, onChange }) => {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRafRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);

  const visibleAvatars = useMemo(() => {
    if (filter === 'all') return AVATARS;
    return AVATARS.filter((a) => a.category === filter);
  }, [filter]);

  const activeIndex = Math.max(
    0,
    visibleAvatars.findIndex((a) => a.id === value)
  );
  const activeMeta = visibleAvatars[activeIndex] ?? AVATARS.find((a) => a.id === value) ?? AVATARS[0];

  const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current;
    const item = itemRefs.current[index];
    if (!scroller || !item) return;

    programmaticScrollRef.current = true;
    const targetLeft =
      item.offsetLeft + item.offsetWidth / 2 - scroller.clientWidth / 2;
    scroller.scrollTo({ left: targetLeft, behavior });
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 320);
  };

  useEffect(() => {
    scrollToIndex(activeIndex, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleFilterChange = (nextFilter: CategoryFilter) => {
    setFilter(nextFilter);
    const nextList =
      nextFilter === 'all' ? AVATARS : AVATARS.filter((a) => a.category === nextFilter);
    if (nextList.length > 0 && !nextList.some((a) => a.id === value)) {
      onChange(nextList[0].id);
    }
  };

  const handleScroll = () => {
    if (programmaticScrollRef.current) return;
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Infinity;

      itemRefs.current.forEach((el, idx) => {
        if (!el) return;
        const itemCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(itemCenter - centerX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });

      const found = visibleAvatars[closestIdx];
      if (found && found.id !== value) {
        onChange(found.id);
      }
    });
  };

  const stepBy = (delta: number) => {
    const nextIdx = Math.max(0, Math.min(visibleAvatars.length - 1, activeIndex + delta));
    const nextMeta = visibleAvatars[nextIdx];
    if (nextMeta) {
      onChange(nextMeta.id);
      scrollToIndex(nextIdx, 'smooth');
    }
  };

  const charCount = AVATARS.filter((a) => a.category === 'character').length;
  const animalCount = AVATARS.filter((a) => a.category === 'animal').length;

  return (
    <div className="w-full space-y-2.5" data-testid="avatar-carousel">
      {/* Segmented Category Filter */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto inline-flex">
        <button
          type="button"
          onClick={() => handleFilterChange('all')}
          className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            filter === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          ทั้งหมด ({AVATARS.length})
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('character')}
          className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            filter === 'character'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          ตัวละครใหม่ ({charCount})
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('animal')}
          className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            filter === 'animal'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          น้องสัตว์ ({animalCount})
        </button>
      </div>

      <div className="relative rounded-2xl bg-slate-900 py-4 overflow-hidden border border-slate-800 shadow-inner">
        {/* Center selector indicator line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 left-1/2 -translate-x-1/2 w-[136px] rounded-2xl border-2 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.28)] z-10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-amber-400 z-20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-amber-400 z-20"
        />

        {/* Subtle side fade scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-slate-900 via-slate-900/75 to-transparent z-10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-slate-900 via-slate-900/75 to-transparent z-10"
        />

        {/* Left / Right navigation buttons */}
        <button
          type="button"
          onClick={() => stepBy(-1)}
          disabled={activeIndex === 0}
          aria-label="เลื่อนไปตัวละครก่อนหน้า"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 min-w-[44px] min-h-[44px] rounded-full bg-slate-800/90 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center border border-slate-600 shadow-lg transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => stepBy(1)}
          disabled={activeIndex >= visibleAvatars.length - 1}
          aria-label="เลื่อนไปตัวละครถัดไป"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 min-w-[44px] min-h-[44px] rounded-full bg-slate-800/90 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center border border-slate-600 shadow-lg transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Horizontal scroll strip */}
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          role="listbox"
          aria-label="เลือกตัวละครด้วยการเลื่อนซ้ายหรือขวา"
          className="flex items-center overflow-x-auto snap-x snap-mandatory no-scrollbar py-1"
          style={{
            gap: `${ITEM_GAP}px`,
            paddingLeft: `calc(50% - ${ITEM_WIDTH / 2}px)`,
            paddingRight: `calc(50% - ${ITEM_WIDTH / 2}px)`,
          }}
        >
          {visibleAvatars.map((av, idx) => {
            const isActive = av.id === value;
            const isCharacter = av.category === 'character';
            return (
              <button
                key={av.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={isActive}
                aria-label={av.name}
                onClick={() => {
                  onChange(av.id);
                  scrollToIndex(idx, 'smooth');
                }}
                className={`snap-center shrink-0 w-[128px] h-[128px] rounded-2xl overflow-hidden transition-all duration-200 focus:outline-none ${
                  isCharacter ? av.bgClass : 'bg-slate-800'
                } ${
                  isActive
                    ? 'scale-100 opacity-100 shadow-xl'
                    : 'scale-[0.86] opacity-55 hover:opacity-80'
                }`}
              >
                <img
                  src={av.imagePath}
                  alt={av.name}
                  draggable={false}
                  className={`w-full h-full ${isCharacter ? 'object-contain p-1.5' : 'object-cover'}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Avatar Caption */}
      <div className="flex items-center justify-between px-1 text-sm">
        <span className="font-bold text-slate-900" data-testid="selected-avatar-name">
          {activeMeta.name}
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          เลื่อนซ้าย-ขวาเพื่อเลือก · {activeIndex + 1} / {visibleAvatars.length}
        </span>
      </div>
    </div>
  );
};
