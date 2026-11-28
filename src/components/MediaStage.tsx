import React, { useEffect, useState } from 'react';
import { ImageOff, Video } from 'lucide-react';
import { parseVideoEmbed, sanitizeSafeMediaUrl } from '../shared/quizLogic';

interface MediaStageProps {
  imageUrl?: string;
  videoUrl?: string;
  compact?: boolean;
  hostFit?: boolean;
  hostPhase?: 'QUESTION' | 'REVEAL';
  align?: 'center' | 'left';
}

export const MediaStage: React.FC<MediaStageProps> = ({
  imageUrl,
  videoUrl,
  compact = false,
  hostFit = false,
  hostPhase,
  align = 'center',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);
  const safeImageUrl = sanitizeSafeMediaUrl(imageUrl, 'image');
  const video = parseVideoEmbed(videoUrl);

  const hasImage = Boolean(safeImageUrl);
  const hasVideo = video.type !== 'none';

  if (!hasImage && !hasVideo) {
    return null;
  }

  const isHostQuestion = hostPhase === 'QUESTION';
  const isHostReveal = hostPhase === 'REVEAL';

  const maxHClass = compact
    ? 'max-h-24 sm:max-h-36'
    : isHostQuestion
    ? 'max-h-52 sm:max-h-64 md:max-h-[34vh] lg:max-h-[36vh]'
    : isHostReveal || hostFit
    ? 'max-h-28 sm:max-h-36 md:max-h-[22vh]'
    : 'max-h-72';

  const containerWidthClass = isHostQuestion
    ? hasImage && hasVideo
      ? 'max-w-xl'
      : 'max-w-2xl lg:max-w-3xl'
    : isHostReveal
    ? 'max-w-sm md:max-w-md'
    : 'max-w-md';

  const justifyClass =
    align === 'left' ? 'justify-center md:justify-start' : 'justify-center';

  return (
    <div
      className={`w-full min-h-0 flex flex-col sm:flex-row items-center ${justifyClass} gap-3 transition-all duration-300 ${
        compact || hostFit || hostPhase ? 'my-1' : 'my-3'
      }`}
    >
      {hasImage && (
        <div
          className={`w-full ${containerWidthClass} rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-700/80 flex items-center justify-center transition-all duration-300`}
        >
          {!imgError ? (
            <img
              src={safeImageUrl}
              alt="ภาพประกอบคำถาม"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`w-full ${maxHClass} object-contain transition-all duration-300`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-slate-400 text-sm">
              <ImageOff className="w-7 h-7 opacity-70" />
              <span>ไม่สามารถโหลดรูปภาพประกอบได้</span>
            </div>
          )}
        </div>
      )}

      {hasVideo && (
        <div
          className={`w-full ${containerWidthClass} rounded-2xl overflow-hidden bg-black border border-slate-700/80 transition-all duration-300`}
        >
          {video.type === 'youtube' ? (
            <div
              className={`aspect-video w-full mx-auto ${
                isHostQuestion
                  ? 'max-h-[34vh]'
                  : isHostReveal
                  ? 'max-h-[22vh]'
                  : ''
              }`}
            >
              <iframe
                src={video.src}
                title="วิดีโอประกอบคำถาม"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="relative">
              <video
                src={video.src}
                controls
                playsInline
                className={`w-full ${maxHClass} bg-black`}
              >
                <track kind="captions" />
              </video>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 text-xs text-slate-300">
                <Video className="w-3.5 h-3.5 text-indigo-400" />
                <span>วิดีโอประกอบคำถาม</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
