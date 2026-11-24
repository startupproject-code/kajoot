import React, { useState } from 'react';
import { ImageOff, Video } from 'lucide-react';
import { parseVideoEmbed } from '../shared/quizLogic';

interface MediaStageProps {
  imageUrl?: string;
  videoUrl?: string;
  compact?: boolean;
}

export const MediaStage: React.FC<MediaStageProps> = ({
  imageUrl,
  videoUrl,
  compact = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const video = parseVideoEmbed(videoUrl);

  const hasImage = Boolean(imageUrl && imageUrl.trim());
  const hasVideo = video.type !== 'none';

  if (!hasImage && !hasVideo) {
    return null;
  }

  const maxHClass = compact ? 'max-h-24 sm:max-h-36' : 'max-h-72';

  return (
    <div className={`w-full flex flex-col sm:flex-row items-center justify-center gap-3 ${compact ? 'my-1' : 'my-3'}`}>
      {hasImage && (
        <div className="w-full max-w-md rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-700/80 flex items-center justify-center">
          {!imgError ? (
            <img
              src={imageUrl}
              alt="ภาพประกอบคำถาม"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`w-full ${maxHClass} object-contain`}
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
        <div className="w-full max-w-md rounded-2xl overflow-hidden bg-black border border-slate-700/80">
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
