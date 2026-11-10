/**
 * Student avatars. The stored value is the avatar `id`; the emoji is only a
 * rendering detail, so the same profile survives a later redesign.
 */
export type AvatarDefinition = {
  id: string;
  emoji: string;
  nameEn: string;
  nameAr: string;
  gradient: string;
};

export const AVATARS: AvatarDefinition[] = [
  {
    id: "fox",
    emoji: "🦊",
    nameEn: "Rimo",
    nameAr: "ريمو",
    gradient: "from-[#FFB86B] to-[#F0763A]",
  },
  {
    id: "panda",
    emoji: "🐼",
    nameEn: "Benda",
    nameAr: "بندا",
    gradient: "from-[#B9C4D8] to-[#7C8CA8]",
  },
  {
    id: "lion",
    emoji: "🦁",
    nameEn: "Leo",
    nameAr: "ليو",
    gradient: "from-[#FFD978] to-[#F0A31C]",
  },
  {
    id: "octopus",
    emoji: "🐙",
    nameEn: "Okta",
    nameAr: "أوكتا",
    gradient: "from-[#B79BFF] to-[#7957E8]",
  },
  {
    id: "unicorn",
    emoji: "🦄",
    nameEn: "Yuni",
    nameAr: "يوني",
    gradient: "from-[#FFC3E7] to-[#C55CE0]",
  },
  {
    id: "frog",
    emoji: "🐸",
    nameEn: "Froggy",
    nameAr: "فروجي",
    gradient: "from-[#9BF0C5] to-[#2FBF8F]",
  },
  {
    id: "owl",
    emoji: "🦉",
    nameEn: "Hoody",
    nameAr: "هودي",
    gradient: "from-[#A5D8FF] to-[#3478F6]",
  },
  {
    id: "tiger",
    emoji: "🐯",
    nameEn: "Tigo",
    nameAr: "تيجو",
    gradient: "from-[#FFCF8A] to-[#E8720C]",
  },
];

export const AVATAR_IDS = AVATARS.map((avatar) => avatar.id);

export function avatarById(id: string | null | undefined): AvatarDefinition | null {
  if (!id) return null;
  return AVATARS.find((avatar) => avatar.id === id) ?? null;
}
