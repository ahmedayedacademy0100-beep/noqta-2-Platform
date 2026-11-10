/**
 * Built-in English practice content for the student games hub.
 *
 * This is *content* (curated phrases and their meanings), not student data:
 * scores are computed from what the student actually answers in the session and
 * are never presented as recorded progress.
 */
export type Phrase = { en: string; ar: string };

export type Situation = {
  id: string;
  emoji: string;
  titleEn: string;
  titleAr: string;
  blurbEn: string;
  blurbAr: string;
  phrases: Phrase[];
};

export type GameOption = { emoji?: string; textAr: string; textEn: string };

export type GameQuestion = {
  promptEn: string;
  promptAr: string;
  phraseEn?: string;
  options: GameOption[];
  correctIndex: number;
};

export const SITUATIONS: Situation[] = [
  {
    id: "restaurant",
    emoji: "🍽️",
    titleEn: "At the restaurant",
    titleAr: "في المطعم",
    blurbEn: "Order food and ask for the bill.",
    blurbAr: "اطلب الأكل واطلب الحساب.",
    phrases: [
      { en: "A table for two, please", ar: "طاولة لشخصين، من فضلك" },
      { en: "Can I see the menu?", ar: "ممكن أشوف المنيو؟" },
      { en: "I'd like to order", ar: "عايز أطلب" },
      { en: "The bill, please", ar: "الحساب من فضلك" },
    ],
  },
  {
    id: "airport",
    emoji: "✈️",
    titleEn: "At the airport",
    titleAr: "في المطار",
    blurbEn: "Check in and find your gate.",
    blurbAr: "اعمل تسجيل الوصول واعرف بوابتك.",
    phrases: [
      { en: "Here is my passport", ar: "اتفضل جواز سفري" },
      { en: "Where is the gate?", ar: "فين البوابة؟" },
      { en: "I have one suitcase", ar: "معايا شنطة واحدة" },
      { en: "What time is boarding?", ar: "الركوب الساعة كام؟" },
    ],
  },
  {
    id: "work",
    emoji: "💼",
    titleEn: "At work",
    titleAr: "في الشغل",
    blurbEn: "Introduce yourself and ask a colleague.",
    blurbAr: "عرّف نفسك واسأل زميلك.",
    phrases: [
      { en: "Nice to meet you", ar: "تشرفنا بمعرفتك" },
      { en: "Can you help me, please?", ar: "ممكن تساعدني، لو سمحت؟" },
      { en: "I will send the report", ar: "هبعت التقرير" },
      { en: "See you tomorrow", ar: "أشوفك بكرة" },
    ],
  },
  {
    id: "doctor",
    emoji: "🩺",
    titleEn: "At the doctor",
    titleAr: "عند الدكتور",
    blurbEn: "Describe how you feel.",
    blurbAr: "اشرح إحساسك وإيه اللي وجعك.",
    phrases: [
      { en: "I have a headache", ar: "عندي صداع" },
      { en: "It hurts here", ar: "بيوجعني هنا" },
      { en: "I need some medicine", ar: "محتاج دوا" },
      { en: "Thank you, doctor", ar: "شكراً يا دكتور" },
    ],
  },
  {
    id: "shopping",
    emoji: "🛒",
    titleEn: "Shopping",
    titleAr: "في التسوق",
    blurbEn: "Ask about price and size.",
    blurbAr: "اسأل عن السعر والمقاس.",
    phrases: [
      { en: "How much is this?", ar: "ده بكام؟" },
      { en: "Do you have a bigger size?", ar: "عندك مقاس أكبر؟" },
      { en: "I'll take it", ar: "هاخده" },
      { en: "Can I pay by card?", ar: "ممكن أدفع بالكارت؟" },
    ],
  },
  {
    id: "travel",
    emoji: "🧳",
    titleEn: "Travelling",
    titleAr: "في السفر",
    blurbEn: "Ask for directions and a taxi.",
    blurbAr: "اسأل عن الطريق والتاكسي.",
    phrases: [
      { en: "Where is the hotel?", ar: "الفندق فين؟" },
      { en: "How far is it?", ar: "بيعده قد إيه؟" },
      { en: "I need a taxi", ar: "محتاج تاكسي" },
      { en: "Have a nice trip", ar: "رحلة سعيدة" },
    ],
  },
];

const ALL_PHRASES: Phrase[] = SITUATIONS.flatMap((situation) => situation.phrases);

function buildOptions(
  phrase: Phrase,
  seed: number,
  bank: Phrase[] = ALL_PHRASES,
): { options: GameOption[]; correctIndex: number } {
  const source = bank.length >= 3 ? bank : ALL_PHRASES;
  const taken = new Set([phrase.ar]);
  const distractors: Phrase[] = [];
  for (let step = 1; distractors.length < 2 && step < source.length; step += 1) {
    const candidate = source[(source.indexOf(phrase) + seed * step + 2) % source.length];
    if (!candidate || taken.has(candidate.ar)) continue;
    taken.add(candidate.ar);
    distractors.push(candidate);
  }
  const pool = [phrase, ...distractors];
  const shift = seed % pool.length;
  const rotated = [...pool.slice(shift), ...pool.slice(0, shift)];
  return {
    options: rotated.map((item) => ({ textAr: item.ar, textEn: item.en })),
    correctIndex: rotated.indexOf(phrase),
  };
}

/** Translation quiz built from a situation's own phrases. */
export function buildSituationQuiz(
  situation: Situation,
  pool: Phrase[] = ALL_PHRASES,
): GameQuestion[] {
  const bank = [...situation.phrases, ...pool].filter(
    (item, index, all) => all.findIndex((other) => other.en === item.en) === index,
  );
  return situation.phrases.map((phrase, index) => {
    const { options, correctIndex } = buildOptions(phrase, index + 1, bank);
    return {
      promptEn: situation.titleAr,
      promptAr: "معنى الجملة دي إيه؟",
      phraseEn: phrase.en,
      options,
      correctIndex,
    };
  });
}

/** A stable five-question set per calendar day, so everyone shares today's set. */
export function buildDailyChallenge(dayKey: string, custom?: Phrase[]): GameQuestion[] {
  const seed = dayKey.split("-").reduce((acc, part) => acc + Number(part), 0);
  const bank = custom && custom.length >= 3 ? [...custom] : [...ALL_PHRASES];
  const target = Math.min(5, bank.length);
  const picked: Phrase[] = [];
  for (let index = 0; picked.length < target && index < bank.length; index += 1) {
    picked.push(bank[(seed * 3 + index * 5) % bank.length]);
  }
  return picked.map((phrase, index) => {
    const { options, correctIndex } = buildOptions(phrase, seed + index + 1, bank);
    return {
      promptEn: "Daily challenge",
      promptAr: "معنى الجملة دي إيه؟",
      phraseEn: phrase.en,
      options,
      correctIndex,
    };
  });
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
