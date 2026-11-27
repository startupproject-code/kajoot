import React, { useEffect, useState } from 'react';
import { resolvePlayerPoseImage } from '../shared/characterPoses';
import { AvatarId, AVATARS } from '../shared/types';

interface CuteAvatarProps {
  avatarId: AvatarId;
  poseId?: string;
  size?: number;
  className?: string;
  lazy?: boolean;
}

export const CuteAvatar: React.FC<CuteAvatarProps> = ({
  avatarId,
  poseId,
  size = 48,
  className = '',
  lazy = false,
}) => {
  const meta = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const poseMeta = resolvePlayerPoseImage(avatarId, poseId);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [poseMeta.imagePath]);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl shrink-0 select-none overflow-hidden ${meta.bgClass} ${className}`}
      style={{ width: size, height: size }}
      aria-label={meta.name}
      title={`${meta.name}${poseMeta.id !== 'default' ? ` · ${poseMeta.label}` : ''}`}
    >
      {!imgFailed ? (
        <img
          src={poseMeta.imagePath}
          alt={`${meta.name}${poseMeta.id !== 'default' ? ` (${poseMeta.label})` : ''}`}
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
          draggable={false}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <span className="font-bold text-slate-700 text-sm">
          {meta.name.slice(0, 2)}
        </span>
      )}
    </div>
  );
};
