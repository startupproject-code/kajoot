import React, { useEffect, useState } from 'react';
import { ImageOff, Video } from 'lucide-react';
import { parseVideoEmbed } from '../shared/quizLogic';

interface MediaStageProps {
  imageUrl?: string;
  videoUrl?: string;
  compact?: boolean;
  hostFit?: boolean;
  hostExpanded?: boolean;
}

export const MediaStage: React.FC<MediaStageProps> = ({
  imageUrl,
  videoUrl,
  compact = false,
  hostFit = false,
  hostExpanded = false,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);
  const video = parseVideoEmbed(videoUrl);

  const hasImage = Boolean(imageUrl && imageUrl.trim());
  const hasVideo = video.type !== 'none';

  if (!hasImage && !hasVideo) {
    return null;
  }

  const isHostMode = hostExpanded || hostFit;

  const maxHClass = compact
    ? 'max-h-24 sm:max-h-36'
    : hostExpanded
    ? 'max-h-[42vh] h-full'
    : hostFit
    ? 'max-h-[24vh] h-full'
    : 'max-h-72';

  const videoMaxWClass = hostExpanded ? 'max-w-2xl' : 'max-w-md';

  return (
    <div
      className={`w-full ${
        isHostMode ? 'flex-1 min-h-0' : ''
      } flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-300 ${
        compact || hostFit ? 'my-0.5' : hostExpanded ? 'my-1' : 'my-3'
      }`}
    >
      {hasImage && (
        <div
          className={`${
            isHostMode ? 'h-full min-h-0 flex-1' : ''
          } flex items-center justify-center max-w-full transition-all duration-300`}
        >
          {!imgError ? (
            <img
              src={imageUrl}
              alt="ภาพประกอบคำถาม"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`${
                isHostMode ? 'max-h-full w-auto max-w-full' : `w-full ${maxHClass}`
              } object-contain rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-lg transition-all duration-300`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-6 rounded-2xl border border-slate-700/80 bg-slate-900/60 text-slate-400 text-sm">
              <ImageOff className="w-7 h-7 opacity-70" />
              <span>ไม่สามารถโหลดรูปภาพประกอบได้</span>
            </div>
          )}
        </div>
      )}

      {hasVideo && (
        <div
          className={`w-full ${videoMaxWClass} rounded-2xl overflow-hidden bg-black border border-slate-700/80 transition-all duration-300`}
        >
          {video.type === 'youtube' ? (
            <div className="aspect-video w-full">
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
