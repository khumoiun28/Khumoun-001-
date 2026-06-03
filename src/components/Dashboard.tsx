/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Word, UserProgress, WidgetTheme } from '../types';
import { 
  Flame, Award, Search, Plus, Calendar, Compass, RefreshCw, 
  Settings, Clock, Sparkles, PlusCircle, CheckCircle, Languages, Loader2, Play
} from 'lucide-react';

interface DashboardProps {
  progress: UserProgress;
  words: Word[];
  themes: WidgetTheme[];
  language: 'ru' | 'en';
  onLanguageChange: (lang: 'ru' | 'en') => void;
  onThemeSelect: (themeId: string) => void;
  onCustomWordsAdded: (newWords: Word[]) => void;
  onWordsGeneratedCountUpdate: (count: number) => void;
  onSimulateAbsence: () => void;
  onResetProgress: () => void;
}

export default function Dashboard({
  progress,
  words,
  themes,
  language,
  onLanguageChange,
  onThemeSelect,
  onCustomWordsAdded,
  onWordsGeneratedCountUpdate,
  onSimulateAbsence,
  onResetProgress
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'themes' | 'settings'>('library');
  const [lexiconQuery, setLexiconQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [sessionGeneratedWords, setSessionGeneratedWords] = useState<Word[]>([]);

  // Calculate student metrics
  const wordsLearnedCount = progress.learnedWordIds.filter(id => words.some(w => w.id === id)).length;
  const currentLvl = Math.floor(Math.sqrt(progress.totalExp / 100)) + 1;
  const nextLvlExp = currentLvl * currentLvl * 100;
  const prevLvlExp = (currentLvl - 1) * (currentLvl - 1) * 100;
  const lvlProgressPct = Math.min(
    100,
    Math.max(0, ((progress.totalExp - prevLvlExp) / (nextLvlExp - prevLvlExp)) * 100)
  );

  const getLvlTitle = (lvl: number) => {
    if (lvl === 1) return language === 'ru' ? 'Новичок (초보자)' : 'Initiate (초보자)';
    if (lvl === 2) return language === 'ru' ? 'Оруженосец Слов (수련생)' : 'Word Squire (수련생)';
    if (lvl === 3) return language === 'ru' ? 'Студент Профи (학도)' : 'Student Pro (학도)';
    if (lvl === 4) return language === 'ru' ? 'Речевой Ремесленник (다재다능)' : 'Speech Artisan (다재다능)';
    return language === 'ru' ? 'Студент Гроссмейстер (마스터)' : 'Student Grandmaster (마스터)';
  };

  const getTodayString = () => {
    const d = progress.simulatedTimeMs ? new Date(progress.simulatedTimeMs) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayString();
  const todayGeneratedCount = progress.lastGeneratedDate === todayStr ? (progress.wordsGeneratedTodayCount || 0) : 0;
  const dailyLimit = currentLvl >= 5 ? 25 : (currentLvl >= 3 ? 20 : 10);
  const remainingBudget = Math.max(0, dailyLimit - todayGeneratedCount);

  const handleGenerateBatchWords = async () => {
    if (remainingBudget <= 0) return;

    setIsGenerating(true);
    setGenerationError('');
    
    // Generate 10 words, or the remaining budget limit
    const countToGenerate = Math.min(10, remainingBudget);

    try {
      const response = await fetch('/api/gemini/generate-words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          count: countToGenerate,
          exclude: words.map(w => w.word),
          lang: language
        })
      });

      if (!response.ok) {
        throw new Error('Generate words API error');
      }

      const newWords: Word[] = await response.json();
      if (!Array.isArray(newWords) || newWords.length === 0) {
        throw new Error('No words returned from API');
      }

      // Add to vocabulary database state and save to local storage
      onCustomWordsAdded(newWords);
      // Track counts for the daily limits remaining
      onWordsGeneratedCountUpdate(newWords.length);

      // Set session generated for nice success check display
      setSessionGeneratedWords(prev => [...prev, ...newWords]);
    } catch (err: any) {
      console.error(err);
      setGenerationError(
        language === 'ru' 
          ? 'Не удалось сгенерировать слова. Пожалуйста, проверьте соединение.' 
          : 'Failed to generate words. Please check your connection.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter dictionary words based on search
  const filteredWords = words.filter(w => {
    const term = lexiconQuery.toLowerCase();
    const trans = language === 'ru' ? w.translationRu : w.translationEn;
    return (
      w.word.toLowerCase().includes(term) ||
      trans.toLowerCase().includes(term) ||
      w.pronunciationRu.toLowerCase().includes(term) ||
      w.pronunciationEn.toLowerCase().includes(term)
    );
  });

  return (
    <div id="student-control-dashboard" className="w-full bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 md:p-6 shadow-2xl backdrop-blur-lg">
      
      {/* Top Banner stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {/* Streak */}
        <div className="bg-neutral-950/40 p-3.5 rounded-xl border border-rose-500/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 animate-pulse">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
              {language === 'ru' ? 'Активность' : 'Streak'}
            </p>
            <p className="text-lg font-bold font-display text-white">
              {progress.streak} {language === 'ru' ? 'дн.' : 'days'}
            </p>
          </div>
        </div>

        {/* EXP Progress / Level */}
        <div className="bg-neutral-950/40 p-3.5 rounded-xl border border-amber-500/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <Award className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
              {language === 'ru' ? 'Опыт EXP' : 'Total EXP'}
            </p>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-white leading-tight">
                {progress.totalExp} XP
              </span>
              <span className="text-xs font-mono text-amber-500 font-semibold">
                Lvl {currentLvl}
              </span>
            </div>
            {/* Progress Bar of Level */}
            <div className="w-full bg-neutral-800 h-1 rounded-full mt-1 overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${lvlProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Words Learned */}
        <div className="bg-neutral-950/40 p-3.5 rounded-xl border border-emerald-500/10 flex items-center gap-3 col-span-1">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
              {language === 'ru' ? 'Выучено слов' : 'Vocabulary'}
            </p>
            <p className="text-lg font-bold text-white">
              {wordsLearnedCount} {language === 'ru' ? 'из' : 'of'} {words.length}
            </p>
          </div>
        </div>

        {/* Level Title */}
        <div className="bg-neutral-950/40 p-3.5 rounded-xl border border-indigo-500/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
              {language === 'ru' ? 'Ранг студента' : 'Rank Title'}
            </p>
            <p className="text-xs font-semibold text-indigo-300 truncate max-w-[130px]" title={getLvlTitle(currentLvl)}>
              {getLvlTitle(currentLvl)}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation tabs for Dashboard */}
      <div className="flex border-b border-neutral-800/80 mb-5 justify-between sm:justify-start gap-1">
        <button
          id="tab-library-btn"
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 hover:text-white transition-all cursor-pointer ${
            activeTab === 'library' 
              ? 'border-amber-500 text-white font-semibold' 
              : 'border-transparent text-neutral-400'
          }`}
        >
          📚 {language === 'ru' ? 'Библиотека слов' : 'Dictionary'}
        </button>
        <button
          id="tab-themes-btn"
          onClick={() => setActiveTab('themes')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 hover:text-white transition-all cursor-pointer ${
            activeTab === 'themes' 
              ? 'border-amber-500 text-white font-semibold' 
              : 'border-transparent text-neutral-400'
          }`}
        >
          🎨 {language === 'ru' ? 'Стили виджета' : 'Widget Styling'}
        </button>
        <button
          id="tab-settings-btn"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 hover:text-white transition-all cursor-pointer ${
            activeTab === 'settings' 
              ? 'border-amber-500 text-white font-semibold' 
              : 'border-transparent text-neutral-400'
          }`}
        >
          ⚙️ {language === 'ru' ? 'Симулятор & Опции' : 'Simulation & Config'}
        </button>
      </div>

      {/* TAB CONTENT: LIBRARY & CUSTOM ADD */}
      {activeTab === 'library' && (
        <div id="tab-library-content" className="space-y-5">
          {/* AI List Generator block */}
          <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/15 relative overflow-hidden">
            {/* Background glowing orb */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  {language === 'ru' ? 'Генератор слов с ИИ Gemini' : 'AI Word Generator via Gemini'}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-lg leading-relaxed">
                  {language === 'ru' 
                    ? 'Генерируйте уникальные, профессионально подобранные корейские слова с переводами, транскрипцией и примерами использования!' 
                    : 'Generate fresh high-quality Korean vocabulary words with Cyrillic/English transcription and natural examples!'}
                </p>
              </div>

              {/* Limit status panel */}
              <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800 shrink-0 text-center min-w-[170px]">
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mb-1">
                  {language === 'ru' ? 'Ваш Ранг' : 'Active Rank'}
                </div>
                <div className="text-xs font-bold font-display text-amber-400">
                  {getLvlTitle(currentLvl)}
                </div>
                
                {/* Visual mini bar */}
                <div className="mt-2 w-full bg-neutral-900 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (todayGeneratedCount / dailyLimit) * 100)}%` }}
                  />
                </div>

                <div className="text-[10px] font-mono text-neutral-400 mt-1.5">
                  {language === 'ru' ? 'Сгенерировано:' : 'Generated:'} <span className="text-white font-bold">{todayGeneratedCount}</span> / {dailyLimit}
                </div>
              </div>
            </div>

            {/* Rank explanation strip */}
            <div className="mt-4 p-2 bg-neutral-950/30 rounded-lg text-[10px] text-neutral-400 border border-neutral-900 flex justify-between gap-2 max-w-full overflow-x-auto whitespace-nowrap">
              <span>🔰 {language === 'ru' ? 'Лимиты:' : 'Limits:'}</span>
              <span>🐣 {language === 'ru' ? 'Ученики: 10/день' : 'Initiates: 10/day'}</span>
              <span>⚡ {language === 'ru' ? 'Профи: 20/день' : 'Pro: 20/day'}</span>
              <span>🏆 {language === 'ru' ? 'Гроссмейстеры: 25/день' : 'Grandmasters: 25/day'}</span>
            </div>

            {/* CTA controls */}
            <div className="mt-4 flex flex-col gap-2">
              {remainingBudget > 0 ? (
                <button
                  id="generate-bulk-words-btn"
                  onClick={handleGenerateBatchWords}
                  disabled={isGenerating}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 px-4 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>
                        {language === 'ru' 
                          ? 'Колдуем: составляем персональные слова...' 
                          : 'Composing custom vocabulary list...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>
                        {language === 'ru' 
                          ? `Сгенерировать ${Math.min(10, remainingBudget)} слов` 
                          : `Generate ${Math.min(10, remainingBudget)} words`}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-center text-xs text-red-300">
                  🔒 {language === 'ru' 
                    ? 'Дневной лимит исчерпан. Повышайте уровень, чтобы открыть лимиты 20 или 25 слов!' 
                    : 'Daily limit reached. Level up to expand daily generation pool and unlock 20 or 25 limits!'}
                </div>
              )}

              {generationError && (
                <p className="text-red-400 text-[11px] mt-1 font-mono text-center">⚠️ {generationError}</p>
              )}
            </div>

            {/* List of session newly generated words */}
            {sessionGeneratedWords.length > 0 && (
              <div className="mt-5 border-t border-neutral-800 pt-4">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  {language === 'ru' 
                    ? `Успешно добавлены новые слова (${sessionGeneratedWords.length}):` 
                    : `Sourced new vocabulary words (${sessionGeneratedWords.length}):`}
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {sessionGeneratedWords.map((item, idx) => (
                    <div key={item.id} className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-850 flex justify-between items-center text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-white font-display text-sm mr-1">{item.word}</span>
                        <span className="text-neutral-400 font-mono text-[10px]">
                          /{language === 'ru' ? item.pronunciationRu : item.pronunciationEn}/
                        </span>
                        <p className="text-neutral-300 truncate text-[11px] mt-0.5">
                          {language === 'ru' ? item.translationRu : item.translationEn}
                        </p>
                      </div>
                      <span className="text-[9px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 uppercase">
                        {language === 'ru' ? item.partOfSpeechRu : item.partOfSpeech}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dictionary Directory Search */}
          <div>
            <div className="flex items-center gap-2 mb-3 bg-neutral-950/50 px-3 py-2 rounded-lg border border-neutral-800">
              <Search className="w-4 h-4 text-neutral-500 shrink-0" />
              <input
                id="lexicon-search-input"
                type="text"
                value={lexiconQuery}
                onChange={(e) => setLexiconQuery(e.target.value)}
                placeholder={language === 'ru' ? 'Поиск в базе по корейскому, русскому или произношению...' : 'Search database by hangul, english, or pronunciation...'}
                className="bg-transparent text-xs text-neutral-200 outline-none w-full font-sans"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-neutral-900">
              {filteredWords.map((w) => {
                const isLearned = progress.learnedWordIds.includes(w.id);
                const isCustom = w.id.startsWith('custom');
                return (
                  <div key={w.id} className="pt-2 flex items-center justify-between group">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white tracking-wide">{w.word}</span>
                        <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded font-mono">
                          {language === 'ru' ? w.partOfSpeechRu : w.partOfSpeech}
                        </span>
                        {isCustom && (
                          <span className="text-[9px] bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 px-1.5 rounded font-mono">
                            AI
                          </span>
                        )}
                        {isLearned && (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/10 font-mono">
                            ✓ {language === 'ru' ? 'Глиф' : 'OK'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 leading-tight">
                        {language === 'ru' ? w.translationRu : w.translationEn} • <span className="font-mono text-[11px] text-neutral-500">/{language === 'ru' ? w.pronunciationRu : w.pronunciationEn}/</span>
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {(w.level || 'TOPIK1_EASY').replace('TOPIK1_', '')}
                    </span>
                  </div>
                );
              })}

              {filteredWords.length === 0 && (
                <div className="text-center py-6 text-xs text-neutral-500 italic">
                  {language === 'ru' ? 'Ничего не найдено по этому критерию.' : 'No matched words found.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: THEMES STUDIO */}
      {activeTab === 'themes' && (
        <div id="tab-themes-content" className="space-y-4">
          <p className="text-xs text-neutral-400">
            {language === 'ru' 
              ? 'Выберите тему оформления для интерактивного виджета. Смена цвета раз в два часа или при кликах борется с «баннерной слепотой» (banner blindness) мозга!' 
              : 'Unlock and select colors for your smart homescreen widget. Keeping the appearance changing prevents your brain from filtering out the learning card!'}
          </p>

          <div className="grid grid-cols-2 gap-3" id="theme-grid-selector">
            {themes.map((t) => {
              const isSelected = progress.theme === t.id;
              return (
                <div 
                  key={t.id}
                  onClick={() => onThemeSelect(t.id)}
                  className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                    t.bgGradient + ' bg-gradient-to-br'
                  } ${
                    isSelected ? 'border-amber-400 scale-[1.02] shadow-lg' : 'border-transparent opacity-75 hover:opacity-95 hover:scale-[1.01]'
                  }`}
                >
                  <p className={`text-sm font-bold font-display ${t.textColor}`}>
                    {language === 'ru' ? t.nameRu : t.nameEn}
                  </p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-[8px] uppercase tracking-wider font-mono opacity-80 px-2 py-0.5 rounded bg-black/30 text-white">
                      {t.category}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-amber-300 font-semibold flex items-center gap-0.5 bg-black/40 px-2 py-0.5 rounded">
                        ✓ {language === 'ru' ? 'Актив' : 'Active'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SETTINGS & ABSENCE TIME TRAVEL SIMULATOR */}
      {activeTab === 'settings' && (
        <div id="tab-settings-content" className="space-y-4 font-sans">
          
          {/* Return Quest Test Harness */}
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/15">
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Clock className="w-4 h-4 text-rose-400 animate-pulse" />
              {language === 'ru' ? 'Тестирование: Квест Возвращения!' : 'Return Quest Harness (Absence)'}
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {language === 'ru' 
                ? 'Как ведет себя приложение, если не заходить 3 дня? Требовать учить 30 слов вредно, поэтому мы даем Квест Возвращения (те же 10 слов, но x2 EXP!).'
                : 'Usually gaps create negative guilt, causing students to drop courses. We offer a return quest: still just 10 words, but with double EXP reward!'}
            </p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              <button
                id="simulate-absence-btn"
                onClick={onSimulateAbsence}
                className="bg-rose-600/30 border border-rose-500/40 hover:bg-rose-600/50 text-rose-200 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                {language === 'ru' ? 'Имитировать 3 дня отсутствия' : 'Simulate 3 Days Absence'}
              </button>
            </div>
            
            {progress.isReturnQuestActive && (
              <div className="mt-3 text-xs bg-rose-500/10 border border-rose-500/25 p-2 rounded text-rose-300 font-semibold font-mono tracking-wide">
                🔥 {language === 'ru' ? 'СТАТУС: КВЕСТ ВОЗВРАЩЕНИЯ АКТИВИРОВАН (EXP x2 ПАКЕТ)!' : 'STATUS: RETURN QUEST LOGGED (EXP x2 PAC!)'}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-800/80 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Language Controls */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                🌐 {language === 'ru' ? 'Язык перевода' : 'Target Lang Translation'}
              </label>
              <div className="flex gap-1.5">
                <button
                  id="lang-ru-btn"
                  onClick={() => onLanguageChange('ru')}
                  className={`flex-1 py-1.5 rounded text-xs font-medium cursor-pointer transition-all ${
                    language === 'ru' 
                      ? 'bg-amber-400 text-black font-semibold' 
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  Русский (RU)
                </button>
                <button
                  id="lang-en-btn"
                  onClick={() => onLanguageChange('en')}
                  className={`flex-1 py-1.5 rounded text-xs font-medium cursor-pointer transition-all ${
                    language === 'en' 
                      ? 'bg-amber-400 text-black font-semibold' 
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>

            {/* Reset Stats */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                🗑️ {language === 'ru' ? 'Управление прогрессом' : 'Applet Reset'}
              </label>
              <button
                id="reset-progress-btn"
                onClick={() => {
                  if (confirm(language === 'ru' ? 'Вы уверены, что хотите полностью стереть историю обучения и EXP?' : 'Are you sure you want to hard reset all stats?')) {
                    onResetProgress();
                  }
                }}
                className="w-full py-1.5 border border-red-500/20 hover:border-red-500 bg-red-950/20 text-red-400 hover:text-white rounded text-xs font-semibold cursor-pointer transition-all"
              >
                {language === 'ru' ? 'Сбросить весь прогресс' : 'Wipe all user records'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
