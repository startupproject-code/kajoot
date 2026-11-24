import React, { useState } from 'react';
import { AvatarId, AVATARS } from '../shared/types';

interface CuteAvatarProps {
  avatarId: AvatarId;
  size?: number;
  className?: string;
}

export const CuteAvatar: React.FC<CuteAvatarProps> = ({
  avatarId,
  size = 48,
  className = '',
}) => {
  const meta = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl shrink-0 select-none overflow-hidden ${meta.bgClass} ${className}`}
      style={{ width: size, height: size }}
      aria-label={meta.name}
      title={meta.name}
    >
      {!imgFailed ? (
        <img
          src={meta.imagePath}
          alt={meta.name}
          draggable={false}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-bold text-slate-700 text-sm">
          {meta.name.slice(0, 2)}
        </span>
      )}
    </div>
  );
};
