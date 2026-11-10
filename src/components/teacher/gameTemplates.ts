import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Gauge, Languages, Sparkles } from "lucide-react";

/** Game types a teacher can hand to a class. */
export type GameType = "quiz" | "sprint" | "situations" | "daily";

export type DraftTemplateQuestion = {
  promptAr: string;
  promptEn: string;
  phraseEn: string;
  options: { textAr: string; textEn: string; emoji: string }[];
  correctIndex: number;
};

export type GameTemplate = {
  id: GameType;
  titleKey: "games.type.quiz" | "games.type.sprint" | "games.type.situations" | "games.type.daily";
  icon: LucideIcon;
  titleAr: string;
  titleEn: string;
  questions: DraftTemplateQuestion[];
};

const q = (
  promptAr: string,
  promptEn: string,
  phraseEn: string,
  choices: [string, string][],
  correctIndex = 0,
): DraftTemplateQuestion => ({
  promptAr,
  promptEn,
  phraseEn,
  options: choices.map(([textAr, textEn]) => ({ textAr, textEn, emoji: "" })),
  correctIndex,
});

/**
 * Ready-made question sets so a teacher can pick a game, adjust the wording
 * and publish it to one class without starting from a blank page.
 */
export const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: "quiz",
    titleKey: "games.type.quiz",
    icon: Sparkles,
    titleAr: "اختبار الصف",
    titleEn: "Class quiz",
    questions: [],
  },
  {
    id: "sprint",
    titleKey: "games.type.sprint",
    icon: Gauge,
    titleAr: "تحدي السرعة",
    titleEn: "Speed sprint",
    questions: [
      q("اختر المعنى الصحيح بسرعة", "Choose the correct meaning, fast", "achieve", [
        ["يحقق", "achieve"],
        ["يؤجل", "postpone"],
        ["ينسى", "forget"],
      ]),
      q("اختر المعنى الصحيح بسرعة", "Choose the correct meaning, fast", "borrow", [
        ["يستعير", "borrow"],
        ["يقرض", "lend"],
        ["يبيع", "sell"],
      ]),
      q("اختر المعنى الصحيح بسرعة", "Choose the correct meaning, fast", "ancient", [
        ["قديم جدًا", "very old"],
        ["حديث", "modern"],
        ["خطير", "dangerous"],
      ]),
    ],
  },
  {
    id: "situations",
    titleKey: "games.type.situations",
    icon: Languages,
    titleAr: "مواقف من الحياة",
    titleEn: "Real-life situations",
    questions: [
      q(
        "صديقك يقول: I feel under the weather. ماذا يعني؟",
        "Your friend says: I feel under the weather. What does it mean?",
        "I feel under the weather.",
        [
          ["مريض قليلًا", "a little ill"],
          ["سعيد جدًا", "very happy"],
          ["متأخر عن المدرسة", "late for school"],
        ],
      ),
      q(
        "زميلك يقول: Can I give you a hand? ما الذي يعرضه؟",
        "Your classmate says: Can I give you a hand? What is he offering?",
        "Can I give you a hand?",
        [
          ["المساعدة", "help"],
          ["الوداع", "saying goodbye"],
          ["الاعتذار", "an apology"],
        ],
      ),
      q(
        "المعلم قال: Let's wrap up. ماذا يريد؟",
        "The teacher says: Let's wrap up. What does she want?",
        "Let's wrap up.",
        [
          ["إنهاء الحصة", "to finish the lesson"],
          ["بدء الاختبار", "to start the test"],
          ["تكرار الدرس", "to repeat the lesson"],
        ],
      ),
    ],
  },
  {
    id: "daily",
    titleKey: "games.type.daily",
    icon: CalendarCheck,
    titleAr: "تحدي اليوم",
    titleEn: "Daily challenge",
    questions: [
      q("كلمة اليوم: curious — ما معناها؟", "Word of the day: curious — what does it mean?", "curious", [
        ["فضولي", "curious"],
        ["غاضب", "angry"],
        ["خجول", "shy"],
      ]),
      q("كلمة اليوم: improve — ما معناها؟", "Word of the day: improve — what does it mean?", "improve", [
        ["يحسّن", "improve"],
        ["يؤجل", "postpone"],
        ["يكسر", "break"],
      ]),
      q("كلمة اليوم: reliable — ما معناها؟", "Word of the day: reliable — what does it mean?", "reliable", [
        ["موثوق", "reliable"],
        ["سريع", "fast"],
        ["غالٍ", "expensive"],
      ]),
    ],
  },
];

/** Dictionary key of a stored game type (older rows fall back to a plain quiz). */
export function typeKey(type: GameType | undefined) {
  return `games.type.${type ?? "quiz"}` as
    | "games.type.quiz"
    | "games.type.sprint"
    | "games.type.situations"
    | "games.type.daily";
}
