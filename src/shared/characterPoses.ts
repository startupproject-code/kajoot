import { AvatarId, AVATARS } from './types';

export interface CharacterPoseMeta {
  id: string;
  label: string;
  imagePath: string;
}

export const DEFAULT_POSE_ID = 'default';

export const CHARACTER_POSES: Partial<Record<AvatarId, CharacterPoseMeta[]>> = {
  char_05: [
    {
      id: 'default',
      label: 'ท่าปกติ',
      imagePath: '/assets/aistudio/5_4381ac4c.jpg',
    },
    {
      id: 'pose_1',
      label: 'ตาเหล่แลบลิ้น',
      imagePath: '/assets/aistudio/1.________2ee20ed8.jpg',
    },
    {
      id: 'pose_2',
      label: 'ทำปากจู๋',
      imagePath: '/assets/aistudio/2.________e7d0164b.jpg',
    },
    {
      id: 'pose_3',
      label: 'โกรธกอดอก',
      imagePath: '/assets/aistudio/3.______e9ea8d3d.jpg',
    },
    {
      id: 'pose_4',
      label: 'ขยิบตาจิ้มแก้ม',
      imagePath: '/assets/aistudio/4.__________97506b17.jpg',
    },
    {
      id: 'pose_5',
      label: 'ร้องไห้',
      imagePath: '/assets/aistudio/5._________8f32f908.jpg',
    },
    {
      id: 'pose_6',
      label: 'ส่งหัวใจ',
      imagePath: '/assets/aistudio/6.__________3cee0536.jpg',
    },
  ],
};

export function getCharacterPoses(avatarId: AvatarId): CharacterPoseMeta[] {
  const custom = CHARACTER_POSES[avatarId];
  if (custom && custom.length > 0) {
    return custom;
  }
  const baseMeta = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  return [
    {
      id: DEFAULT_POSE_ID,
      label: 'ท่าปกติ',
      imagePath: baseMeta.imagePath,
    },
  ];
}

export function hasExtraCharacterPoses(avatarId: AvatarId): boolean {
  const custom = CHARACTER_POSES[avatarId];
  return Boolean(custom && custom.length > 1);
}

export function isValidPoseIdFormat(poseId: unknown): poseId is string {
  return (
    typeof poseId === 'string' &&
    poseId.length >= 1 &&
    poseId.length <= 32 &&
    /^[a-zA-Z0-9_\-]+$/.test(poseId)
  );
}

export function isValidPoseForAvatar(avatarId: AvatarId, poseId: unknown): boolean {
  if (!isValidPoseIdFormat(poseId)) return false;
  return getCharacterPoses(avatarId).some((p) => p.id === poseId);
}

export function resolvePlayerPoseImage(
  avatarId: AvatarId,
  poseId?: string | null
): CharacterPoseMeta {
  const poses = getCharacterPoses(avatarId);
  if (poseId) {
    const matched = poses.find((p) => p.id === poseId);
    if (matched) return matched;
  }
  return poses[0];
}
