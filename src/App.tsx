/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Word, UserProgress, WidgetTheme } from './types';
import { KOREAN_WORDS, THEMES } from './data/words';
import WidgetCard from './components/WidgetCard';
import Dashboard from './components/Dashboard';
import { 
  Sparkles, Flame, Award, ChevronLeft, ChevronRight, BookOpen, 
  RotateCcw, ShieldAlert, CheckCircle, Languages, LayoutGrid, Coffee, Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_PROGRESS: UserProgress = {
  streak: 0,
  totalExp: 0,
  lastActiveDate: '',
  learnedWordIds: [],
  dailyWordIds: [],
  dailyProgressValues: {},
  currentWordIndex: 0,
  theme: 'cosmic-indigo',
  unlockedThemes: ['cosmic-indigo', 'minimal-gray', 'emerald-garden'],
  language: 'ru',
  isReturnQuestActive: false,
  simulatedTimeMs: null
};

export const getLvlTitle = (lvl: number, lang: 'ru' | 'en') => {
  if (lvl === 1) return lang === 'ru' ? 'Новичок (초보자)' : 'Initiate (초보자)';
  if (lvl === 2) return lang === 'ru' ? 'Оруженосец Слов (수련생)' : 'Word Squire (수련생)';
  if (lvl === 3) return lang === 'ru' ? 'Адепт Корейского (학도)' : 'Adept Disciple (학도)';
  if (lvl === 4) return lang === 'ru' ? 'Речевой Ремесленник (다재다능)' : 'Speech Artisan (다재다능)';
  return lang === 'ru' ? 'Магистр Хангыля (마스터)' : 'Hangul Master (마스터)';
};

export default function App() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [showLevelUp, setShowLevelUp] = useState<number | null>(null);
  const [showQuestCelebration, setShowQuestCelebration] = useState(false);

  // 1. Initialize words database and load user progress on mount
  useEffect(() => {
    // Standard words
    let initialWords = [...KOREAN_WORDS];
    
    // Load custom words from localStorage if any
    const localCustom = localStorage.getItem('korean_custom_added_words');
    if (localCustom) {
      try {
        const parsedCustom: Word[] = JSON.parse(localCustom);
        initialWords = [...initialWords, ...parsedCustom];
      } catch (err) {
        console.error('Error parsing custom words:', err);
      }
    }
    setWords(initialWords);

    // Load progress
    const savedProgress = localStorage.getItem('korean_words_progress_v2');
    if (savedProgress) {
      try {
        const parsed: UserProgress = JSON.parse(savedProgress);
        setProgress(parsed);
      } catch (err) {
        console.error('Error loading progress:', err);
        setProgress(DEFAULT_PROGRESS);
      }
    } else {
      // First boot: set today
      const todayStr = getTodayString();
      const fresh: UserProgress = {
        ...DEFAULT_PROGRESS,
        lastActiveDate: todayStr
      };
      // Populate 10 words
      populateDailyWords(fresh, initialWords);
      setProgress(fresh);
      saveProgressData(fresh);
    }
  }, []);

  // Utility to get YYYY-MM-DD
  const getTodayString = (simulatedTimeMs?: number | null) => {
    const d = simulatedTimeMs ? new Date(simulatedTimeMs) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDayDiff = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const saveProgressData = (updated: UserProgress) => {
    localStorage.setItem('korean_words_progress_v2', JSON.stringify(updated));
  };

  // Populate 10 words based on learned words index
  const populateDailyWords = (currentProgress: UserProgress, currentWordsList: Word[]) => {
    // Find unlearned words
    const unlearned = currentWordsList.filter(
      (w) => !currentProgress.learnedWordIds.includes(w.id)
    );

    let selected: Word[] = [];
    if (unlearned.length >= 10) {
      selected = unlearned.slice(0, 10);
    } else {
      // Mix unlearned with some already learned to always make 10 words
      selected = [...unlearned];
      const learned = currentWordsList.filter((w) =>
        currentProgress.learnedWordIds.includes(w.id)
      );
      // Shuffle learned
      const shuffledLearned = [...learned].sort(() => 0.5 - Math.random());
      const needed = 10 - selected.length;
      selected = [...selected, ...shuffledLearned.slice(0, needed)];
    }

    // Capture IDs
    currentProgress.dailyWordIds = selected.slice(0, 10).map((w) => w.id);
    currentProgress.currentWordIndex = 0;
    
    // Reset daily checkboxes
    const dailyProg: { [id: string]: 'new' | 'revealed' | 'remembered' } = {};
    selected.forEach((w) => {
      dailyProg[w.id] = 'new';
    });
    currentProgress.dailyProgressValues = dailyProg;
  };

  // 2. Logic Check upon app wakeup to review streaks or Return Quest triggers
  useEffect(() => {
    if (!progress || words.length === 0) return;

    const todayStr = getTodayString(progress.simulatedTimeMs);
    const lastActive = progress.lastActiveDate;

    if (lastActive && lastActive !== todayStr) {
      const updated = { ...progress };
      const diffDays = getDayDiff(lastActive, todayStr);

      if (diffDays >= 3) {
        // Edge Case 2: Absence mitigation! Trigger Return Quest!
        updated.isReturnQuestActive = true;
        updated.streak = Math.max(1, updated.streak); // Warm safety net: keep or restore at least 1-day streak
        setShowQuestCelebration(true);
      } else if (diffDays === 1) {
        // Friendly consecutive check
        updated.streak += 1;
      } else if (diffDays > 1) {
        // Broke streak (but less than 3 days absence, so no Return Quest)
        updated.streak = 1;
      }

      updated.lastActiveDate = todayStr;
      populateDailyWords(updated, words);
      setProgress(updated);
      saveProgressData(updated);
    }
  }, [progress?.simulatedTimeMs, words]);

  if (!progress) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-6 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-mono tracking-wide text-neutral-400">
          이해하는 중... Инициализация словаря...
        </p>
      </div>
    );
  }

  // Active theme
  const currentTheme = THEMES.find((t) => t.id === progress.theme) || THEMES[0];

  // Map active word
  const activeWordId = progress.dailyWordIds[progress.currentWordIndex];
  const activeWord = words.find((w) => w.id === activeWordId);

  // Calculate daily completed ratio
  const completedWordsCount = progress.dailyWordIds.filter(
    (id) => progress.dailyProgressValues[id] === 'remembered'
  ).length;

  const isDailyCompleted = completedWordsCount >= 10;

  // Handle learning action
  const handleWordLearned = () => {
    if (!activeWord || !progress) return;

    const updated = { ...progress };
    const wordId = activeWord.id;

    // Mark as remembered
    updated.dailyProgressValues[wordId] = 'remembered';

    // Add to lifetime learned set
    if (!updated.learnedWordIds.includes(wordId)) {
      updated.learnedWordIds.push(wordId);
    }

    // Award EXP (RPG mechanic): 15 base EXP or 30 double EXP in Return Quest!
    const earnedExp = updated.isReturnQuestActive ? 30 : 15;
    
    // Check level-up before award
    const oldLevel = Math.floor(Math.sqrt(updated.totalExp / 100)) + 1;
    updated.totalExp += earnedExp;
    const newLevel = Math.floor(Math.sqrt(updated.totalExp / 100)) + 1;

    if (newLevel > oldLevel) {
      setShowLevelUp(newLevel);
    }

    // Select next unlearned index
    moveToNextUnlearned(updated);
  };

  const moveToNextUnlearned = (currentProgress: UserProgress) => {
    const ids = currentProgress.dailyWordIds;
    let nextIdx = (currentProgress.currentWordIndex + 1) % 10;
    let cycleCount = 0;

    // Loop around to find the next word that hasn't been learned yet
    while (
      currentProgress.dailyProgressValues[ids[nextIdx]] === 'remembered' &&
      cycleCount < 10
    ) {
      nextIdx = (nextIdx + 1) % 10;
      cycleCount++;
    }

    currentProgress.currentWordIndex = nextIdx;
    setProgress(currentProgress);
    saveProgressData(currentProgress);
  };

  const handleNextWordSkip = () => {
    if (!progress) return;
    const updated = { ...progress };
    updated.currentWordIndex = (updated.currentWordIndex + 1) % 10;
    setProgress(updated);
    saveProgressData(updated);
  };

  const handlePrevWordSkip = () => {
    if (!progress) return;
    const updated = { ...progress };
    updated.currentWordIndex = (updated.currentWordIndex - 1 + 10) % 10;
    setProgress(updated);
    saveProgressData(updated);
  };

  // Settings: Sourced Theme callback
  const handleThemeSelect = (themeId: string) => {
    if (!progress) return;
    const updated = { ...progress, theme: themeId };
    setProgress(updated);
    saveProgressData(updated);
  };

  const handleLanguageChange = (lang: 'ru' | 'en') => {
    if (!progress) return;
    const updated = { ...progress, language: lang };
    setProgress(updated);
    saveProgressData(updated);
  };

  // Edge case 2: Time Travel Simulation callback
  const handleSimulateAbsence = () => {
    if (!progress) return;
    const fakePastTime = Date.now() - 4 * 24 * 60 * 60 * 1000; // 4 days ago
    
    const updated = {
      ...progress,
      simulatedTimeMs: Date.now(),
      // Rewind last active date by 4 days so on next evaluation we detect a gap!
      lastActiveDate: getTodayString(fakePastTime)
    };
    setProgress(updated);
    saveProgressData(updated);
    
    // Reload/Force triggering check
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  const handleResetProgress = () => {
    localStorage.removeItem('korean_words_progress_v2');
    localStorage.removeItem('korean_custom_added_words');
    window.location.reload();
  };

  // Add custom generated vocabulary lists
  const handleCustomWordsAdded = (newWords: Word[]) => {
    if (!progress) return;
    
    // Save in file state
    const updatedWordsList = [...words, ...newWords];
    setWords(updatedWordsList);

    // Persistent localStorage
    const savedCustom = localStorage.getItem('korean_custom_added_words');
    let customArr: Word[] = [];
    if (savedCustom) {
      try { customArr = JSON.parse(savedCustom); } catch(e){}
    }
    customArr = [...customArr, ...newWords];
    localStorage.setItem('korean_custom_added_words', JSON.stringify(customArr));
  };

  const handleWordsGeneratedCountUpdate = (count: number) => {
    if (!progress) return;
    const todayStr = getTodayString(progress.simulatedTimeMs);
    const updatedProg = {
      ...progress,
      lastGeneratedDate: todayStr,
      wordsGeneratedTodayCount: (progress.lastGeneratedDate === todayStr ? (progress.wordsGeneratedTodayCount || 0) : 0) + count
    };
    setProgress(updatedProg);
    saveProgressData(updatedProg);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b ${currentTheme.bgGradient} text-white font-sans transition-all duration-500`}>
      {/* Immersive Outer Ambient Page */}
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8 pb-16">
        
        {/* Navigation / Logo header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <LayoutGrid className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight text-white flex items-center gap-1.5 leading-none">
                  10 {progress.language === 'ru' ? 'слов: Корейский' : 'Words: Korean'}
                  <span className="text-[10px] bg-amber-500 text-slate-900 border border-amber-300 font-mono px-1.5 py-0.2 rounded font-bold uppercase tracking-widest leading-none">
                    Widget
                  </span>
                </h1>
                <p className="text-[11px] text-neutral-400 font-medium mt-1">
                  {progress.language === 'ru' 
                    ? 'Микро-обучение корейскому без когнитивного давления' 
                    : 'Interactive smartphone microlearning simulator'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto font-mono text-xs">
            <div className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/10 font-bold">
              <Flame className="w-3.5 h-3.5" />
              {progress.streak} {progress.language === 'ru' ? 'Стрик' : 'Streak'}
            </div>
            <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/10 font-bold">
              <Award className="w-3.5 h-3.5" />
              {progress.totalExp} XP
            </div>
          </div>
        </header>

        {/* ACTIVE PORTAL: INTERACTIVE MAIN WIDGET VIEWPORT */}
        <section className="flex flex-col items-center justify-center py-4 relative">
          
          {/* RETURN QUEST ALERT OVERLAY */}
          <AnimatePresence>
            {showQuestCelebration && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="w-full max-w-sm bg-gradient-to-r from-rose-900 to-indigo-950 border border-rose-500/40 p-4 rounded-xl shadow-2xl mb-5 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                    {progress.language === 'ru' ? 'КВЕСТ ВОЗВРАЩЕНИЯ АКТИВИРОВАН!' : 'RETURN QUEST ENGAGED!'}
                  </h3>
                </div>
                <p className="text-[11px] text-neutral-200 leading-relaxed">
                  {progress.language === 'ru'
                    ? 'Мы заметили, что вы отсутствовали более 3 дней. Вместо накопления долгов, воспользуйтесь двойным опытом (EXP x2) на сегодняшние 10 слов!'
                    : 'We missed you! Instead of force-feeding past lessons, you just study today’s 10 words with a double EXP multiplier!'}
                </p>
                <button
                  id="claim-quest-btn"
                  onClick={() => {
                    setShowQuestCelebration(false);
                    if (progress) {
                      const updated = { ...progress, isReturnQuestActive: true };
                      setProgress(updated);
                      saveProgressData(updated);
                    }
                  }}
                  className="mt-1 w-full bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold py-1.5 rounded cursor-pointer transition-all uppercase tracking-wider"
                >
                  {progress.language === 'ru' ? 'Принять вызов!' : 'Accept Quest x2!'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SUCCESS SCREEN: TODAY'S PLAN IS FULLY MASTERED */}
          {isDailyCompleted ? (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-neutral-900/80 border border-emerald-500/30 p-6 rounded-3xl text-center shadow-xl space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20">
                <CheckCircle className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h2 className="text-xl font-bold font-display tracking-tight text-white">
                  {progress.language === 'ru' ? '🎉 План на сегодня выполнен!' : '🎉 Daily Plan Mastered!'}
                </h2>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  {progress.language === 'ru'
                    ? 'Вы успешно выучили 10 корейских слов сегодня. Ваш мозг получил необходимую дозу дофамина без перегрузок. Спите спокойно!'
                    : 'You studied all 10 words today. Your brain has formed active micro-associations in a stress-free environment.'}
                </p>
              </div>

              {progress.isReturnQuestActive && (
                <div className="bg-rose-950/40 p-2.5 rounded border border-rose-500/20 text-rose-300 text-[11px] font-mono whitespace-pre-wrap">
                  🌟 {progress.language === 'ru' ? 'Квест закрыт: Опыт х2 успешно зачислен!' : 'Quest Cleared: Double EXP successfully claimed!'}
                </div>
              )}

              <div className="bg-black/20 p-3 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 flex justify-between items-center font-mono">
                <span>{progress.language === 'ru' ? 'Следующие 10 слов:' : 'Next refresh:'}</span>
                <span className="font-bold text-amber-400">{progress.language === 'ru' ? 'Завтра' : 'Tomorrow'}</span>
              </div>

              <div className="flex gap-2">
                <button
                  id="reset-daily-loop-btn"
                  onClick={() => {
                    const updated = { ...progress };
                    updated.isReturnQuestActive = false;
                    populateDailyWords(updated, words);
                    setProgress(updated);
                    saveProgressData(updated);
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white text-xs py-2 px-3 rounded-lg font-semibold cursor-pointer transition-all flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {progress.language === 'ru' ? 'Повторить круг' : 'Cycle Again'}
                </button>
              </div>
            </motion.div>
          ) : (
            /* REGULAR WIDGET AND CARD VIEW */
            <div className="w-full max-w-sm space-y-4">
              {activeWord ? (
                <WidgetCard
                  word={activeWord}
                  theme={currentTheme}
                  currentIndex={progress.currentWordIndex}
                  totalWords={progress.dailyWordIds.length}
                  language={progress.language}
                  onRemembered={handleWordLearned}
                  onNext={handleNextWordSkip}
                />
              ) : (
                <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-xl">
                  <p className="text-xs text-neutral-400 italic">
                    {progress.language === 'ru' 
                      ? 'Нет активных слов в сегодняшнем списке. Добавьте новые слова в библиотеку.' 
                      : 'No active words for today inside database. Trigger reset or seed custom cards.'}
                  </p>
                </div>
              )}

              {/* CARD MANUAL STEPPING CONTROL CHEVRONS UNDERNEATH */}
              <div className="flex items-center justify-between w-full px-2 text-neutral-400">
                <button
                  id="left-word-cycle-btn"
                  onClick={handlePrevWordSkip}
                  className="p-1 px-3 bg-neutral-900/60 border border-neutral-800 hover:text-white rounded-lg cursor-pointer transition-all flex items-center text-xs gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {progress.language === 'ru' ? 'Назад' : 'Prev'}
                </button>
                <div className="flex gap-1.5">
                  {progress.dailyWordIds.map((id, index) => {
                    const status = progress.dailyProgressValues[id];
                    let dotColor = 'bg-neutral-700'; // unlearned
                    if (status === 'remembered') dotColor = 'bg-emerald-500'; // complete
                    if (index === progress.currentWordIndex) dotColor = 'bg-amber-400 scale-125 ring-2 ring-amber-400/20'; // current
                    
                    return (
                      <div 
                        key={id}
                        className={`w-2.5 h-2.5 rounded-full ${dotColor} transition-all duration-300`}
                        title={`Syllable #${index + 1}`}
                      />
                    );
                  })}
                </div>
                <button
                  id="right-word-cycle-btn"
                  onClick={handleNextWordSkip}
                  className="p-1 px-3 bg-neutral-900/60 border border-neutral-800 hover:text-white rounded-lg cursor-pointer transition-all flex items-center text-xs gap-1"
                >
                  {progress.language === 'ru' ? 'Дальше' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* AUXILIARY DASHBOARD PORTLET */}
        <section className="mt-4">
          <Dashboard
            progress={progress}
            words={words}
            themes={THEMES}
            language={progress.language}
            onLanguageChange={handleLanguageChange}
            onThemeSelect={handleThemeSelect}
            onCustomWordsAdded={handleCustomWordsAdded}
            onWordsGeneratedCountUpdate={handleWordsGeneratedCountUpdate}
            onSimulateAbsence={handleSimulateAbsence}
            onResetProgress={handleResetProgress}
          />
        </section>

        {/* FOOTER */}
        <footer className="text-center text-[10px] font-mono text-neutral-500 pt-5 border-t border-neutral-900 leading-relaxed">
          <p>«Каждый день по десять слов: Корейский» © 2026. Microdoing learning framework.</p>
          <p className="mt-1">{progress.language === 'ru' ? 'Работает на базе Gemini-3.5-flash по стандартам AI Studio' : 'Powered server-side by Gemini-3.5-flash'}</p>
        </footer>

      </div>

      {/* LEVEL EXP CELEBRATION MODAL OVERLAY */}
      <AnimatePresence>
        {showLevelUp !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-neutral-900 border border-amber-400 p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              {/* Sparks particles */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 animate-pulse" />
              <div className="my-4 text-4xl text-amber-400 flex justify-center">
                🏆
              </div>
              <h2 className="text-2xl font-bold font-display tracking-tight text-white">
                {progress.language === 'ru' ? 'УРОВЕНЬ ПОВЫШЕН!' : 'LEVEL UP!'}
              </h2>
              <p className="text-sm font-mono text-amber-400 font-bold mt-1">
                {progress.language === 'ru' ? `Достигнут Уровень ${showLevelUp}` : `Reached Level ${showLevelUp}`}
              </p>
              
              <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
                {progress.language === 'ru' 
                  ? `Поздравляем! Ваш упорный труд конвертировался в EXP. Вы разблокировали новое звание и звание: "${getLvlTitle(showLevelUp, 'ru')}"!` 
                  : `Incredible! Your steady microlearning loops pay off. Title claimed: "${getLvlTitle(showLevelUp, 'en')}"!`}
              </p>

              <button
                id="close-levelup-modal-btn"
                onClick={() => setShowLevelUp(null)}
                className="mt-5 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
              >
                {progress.language === 'ru' ? 'Отлично!' : 'Awesome!'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
