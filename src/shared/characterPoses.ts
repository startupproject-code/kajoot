import { AvatarId, AVATARS } from './types';

export interface CharacterPoseMeta {
  id: string;
  label: string;
  imagePath: string;
}

export const DEFAULT_POSE_ID = 'default';

function buildStandardPoses(
  defaultFile: string,
  poseFiles: readonly [string, string, string, string, string, string]
): CharacterPoseMeta[] {
  const asset = (file: string) => `/assets/aistudio/${file}`;
  return [
    { id: DEFAULT_POSE_ID, label: 'ท่าปกติ', imagePath: asset(defaultFile) },
    { id: 'pose_1', label: 'ตาเหล่แลบลิ้น', imagePath: asset(poseFiles[0]) },
    { id: 'pose_2', label: 'ทำปากจู๋', imagePath: asset(poseFiles[1]) },
    { id: 'pose_3', label: 'โกรธกอดอก', imagePath: asset(poseFiles[2]) },
    { id: 'pose_4', label: 'ขยิบตาจิ้มแก้ม', imagePath: asset(poseFiles[3]) },
    { id: 'pose_5', label: 'ร้องไห้', imagePath: asset(poseFiles[4]) },
    { id: 'pose_6', label: 'ส่งหัวใจ', imagePath: asset(poseFiles[5]) },
  ];
}

export const CHARACTER_POSES: Partial<Record<AvatarId, CharacterPoseMeta[]>> = {
  char_01: buildStandardPoses('1_d7a74ebc.webp', [
    '1.________96e97382.webp',
    '2.________8a0ee786.webp',
    '3.______d1ce5686.webp',
    '4.__________2d660e68.webp',
    '5._________3419ca25.webp',
    '6.__________b500c2c1.webp',
  ]),
  char_02: buildStandardPoses('2_0db288ca.webp', [
    '1.________d4b31d17.webp',
    '2.________23368b53.webp',
    '3.______506f922e.webp',
    '4.__________b8990766.webp',
    '5._________5f0f52e0.webp',
    '6.__________bf7d8f86.webp',
  ]),
  char_03: buildStandardPoses('3_43852fcc.webp', [
    '1.________d6893cfb.webp',
    '2.________7b2f9a49.webp',
    '3.______381dc192.webp',
    '4.__________ddaa8a36.webp',
    '5._________3fd78f7b.webp',
    '6.__________cbf1f23b.webp',
  ]),
  char_04: buildStandardPoses('4_ea160a01.webp', [
    '1.________49649935.webp',
    '2.________7079b4d0.webp',
    '3.______25386012.webp',
    '4.__________51ecde20.webp',
    '5._________7eefad21.webp',
    '6.__________619e62c6.webp',
  ]),
  char_05: buildStandardPoses('5_4381ac4c.webp', [
    '1.________2ee20ed8.webp',
    '2.________e7d0164b.webp',
    '3.______e9ea8d3d.webp',
    '4.__________97506b17.webp',
    '5._________8f32f908.webp',
    '6.__________3cee0536.webp',
  ]),
  char_06: buildStandardPoses('6_feb3a696.webp', [
    '1.________d02ed67b.webp',
    '2.________548dcda4.webp',
    '3.______b0343c61.webp',
    '4.__________2c66f5dd.webp',
    '5._________841a7631.webp',
    '6.__________a1bfed9e.webp',
  ]),
  char_07: buildStandardPoses('7_65e65de4.webp', [
    '1.________3c4301e6.webp',
    '2.________b7076f05.webp',
    '3.______9061f5db.webp',
    '4.__________7407f0d6.webp',
    '5._________a22524f8.webp',
    '6.__________64849bb6.webp',
  ]),
  char_08: buildStandardPoses('8_f6576340.webp', [
    '1.________113d0c86.webp',
    '2.________7c4ca148.webp',
    '3.______706df045.webp',
    '4.__________48686f0b.webp',
    '5._________67d7bc13.webp',
    '6.__________ad996298.webp',
  ]),
  char_10: buildStandardPoses('10_20cce168.webp', [
    '1.________049ee519.webp',
    '2.________ccce7d6e.webp',
    '3.______c4812d4f.webp',
    '4.__________316abaea.webp',
    '5._________ba75d86c.webp',
    '6.__________53cd53f8.webp',
  ]),
  char_11: buildStandardPoses('11_def2bfdc.webp', [
    '1.________521818aa.webp',
    '2.________cd20711b.webp',
    '3.______d9b75ae3.webp',
    '4.__________af36587c.webp',
    '5._________3febf71f.webp',
    '6.__________1cd01e55.webp',
  ]),
  char_12: buildStandardPoses('12_19d1dc9a.webp', [
    '1.________b2279002.webp',
    '2.________e6f9a044.webp',
    '3.______1a19a760.webp',
    '4.__________f294cecc.webp',
    '5._________baadcbb7.webp',
    '6.__________a8253416.webp',
  ]),
  char_13: buildStandardPoses('13_8c7ac19c.webp', [
    '1.________c27febfb.webp',
    '2.________d828f5eb.webp',
    '3.______861b6b13.webp',
    '4.__________57dbd265.webp',
    '5._________0b59ff33.webp',
    '6.__________0357190e.webp',
  ]),
  char_14: buildStandardPoses('14_7a8344ae.webp', [
    '1.________3b8e15a1.webp',
    '2.________4119ec82.webp',
    '3.______7fe3161c.webp',
    '4.__________28876ded.webp',
    '5._________df48c8ad.webp',
    '6.__________6eab71fb.webp',
  ]),
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
