import { getCharacterPoses, resolvePlayerPoseImage } from './characterPoses';
import { AvatarId } from './types';

export const PODIUM_STAGE_IMAGE = '/assets/podium/podium-stage.webp';
export const FIREWORKS_DURATION_MS = 5000;

/**
 * Dedicated trophy-holding winner assets rendered directly on pedestal #1.
 * Add additional `<charId>.webp` assets under `/public/assets/podium/winners/`
 * as more full-body champion illustrations are uploaded.
 */
export const PODIUM_WINNER_ASSETS: Partial<Record<AvatarId, string>> = {
  char_12: '/assets/podium/winners/char_12.webp',
};

export interface ResolvedPodiumAsset {
  imagePath: string;
  isFullBodyWinner: boolean;
  label: string;
}

export function resolvePodiumCharacterAsset(
  avatarId: AvatarId,
  place: 1 | 2 | 3
): ResolvedPodiumAsset {
  const customWinnerAsset = place === 1 ? PODIUM_WINNER_ASSETS[avatarId] : undefined;
  if (customWinnerAsset) {
    return {
      imagePath: customWinnerAsset,
      isFullBodyWinner: true,
      label: 'ยืนชูถ้วยผู้ชนะ',
    };
  }

  const poses = getCharacterPoses(avatarId);
  const celebrationPose = poses.find((p) => p.id === 'pose_6');
  if (celebrationPose) {
    return {
      imagePath: celebrationPose.imagePath,
      isFullBodyWinner: false,
      label: celebrationPose.label,
    };
  }

  const fallback = resolvePlayerPoseImage(avatarId);
  return {
    imagePath: fallback.imagePath,
    isFullBodyWinner: false,
    label: fallback.label,
  };
}
