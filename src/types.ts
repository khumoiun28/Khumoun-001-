/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Word {
  id: string;
  word: string;
  translationRu: string;
  translationEn: string;
  pronunciationRu: string;
  pronunciationEn: string;
  partOfSpeech: string;
  partOfSpeechRu: string;
  exampleKr: string;
  exampleRu: string;
  exampleEn: string;
  level: 'TOPIK1_EASY' | 'TOPIK1_MEDIUM' | 'TOPIK1_HARD';
}

export interface UserProgress {
  streak: number;
  totalExp: number;
  lastActiveDate: string; // ISO yyyy-mm-dd
  learnedWordIds: string[]; // Cumulative history of learned word ids
  dailyWordIds: string[]; // Sub-queue of 10 words for today
  dailyProgressValues: { [wordId: string]: 'new' | 'revealed' | 'remembered' }; // wordId -> current status
  currentWordIndex: number; // Index in dailyWordIds
  theme: string; // current active theme key
  unlockedThemes: string[]; // List of unlocked theme keys
  language: 'ru' | 'en'; // Translation interface language
  isReturnQuestActive: boolean; // True if return quest double exp is active
  simulatedTimeMs: number | null; // Null unless the user is simulating time travel
  wordsGeneratedTodayCount?: number; // Tracker for daily generator limit
  lastGeneratedDate?: string;        // Tracker date (YYYY-MM-DD) for generator limit
}

export interface MnemonicResponse {
  mnemonicText: string;
  associationText: string;
  funFactText: string;
  koreanBreakdown?: string;
}

export interface WidgetTheme {
  id: string;
  nameRu: string;
  nameEn: string;
  bgGradient: string; // CSS class gradient
  textColor: string;  // CSS text color
  cardBg: string;     // Widget container background
  accentColor: string; // Dynamic borders, badges
  shadowColor: string;
  category: 'minimal' | 'playful' | 'cyberpunk' | 'nature' | 'warm';
}
