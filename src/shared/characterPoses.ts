import { AvatarId, AVATARS } from './types';

export interface CharacterPoseMeta {
  id: string;
  label: string;
  imagePath: string;
}

export const DEFAULT_POSE_ID = 'default';

function buildStandardPoses(
  defaultImagePath: string,
  characterFolderName: string
): CharacterPoseMeta[] {
  const action = (file: string) => `/assets/actions/${characterFolderName}/${file}`;
  return [
    { id: DEFAULT_POSE_ID, label: 'ท่าปกติ', imagePath: defaultImagePath },
    { id: 'pose_1', label: 'ตาเหล่แลบลิ้น', imagePath: action('1_ตาเหล่.webp') },
    { id: 'pose_2', label: 'ทำปากจู๋', imagePath: action('2_ปากจู๋.webp') },
    { id: 'pose_3', label: 'โกรธกอดอก', imagePath: action('3_โกรธ.webp') },
    { id: 'pose_4', label: 'ขยิบตาจิ้มแก้ม', imagePath: action('4_จิ้มแก้ม.webp') },
    { id: 'pose_5', label: 'ร้องไห้', imagePath: action('5_ร้องไห้.webp') },
    { id: 'pose_6', label: 'ส่งหัวใจ', imagePath: action('6_ส่งหัวใจ.webp') },
  ];
}

export const CHARACTER_POSES: Partial<Record<AvatarId, CharacterPoseMeta[]>> = Object.fromEntries(
  AVATARS.map((av) => [av.id, buildStandardPoses(av.imagePath, av.name)])
) as Partial<Record<AvatarId, CharacterPoseMeta[]>>;

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
