/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Word, WidgetTheme, MnemonicResponse } from '../types';
import { Volume2, Sparkles, Check, Eye, HelpCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WidgetCardProps {
  word: Word;
  theme: WidgetTheme;
  currentIndex: number;
  totalWords: number;
  language: 'ru' | 'en';
  onRemembered: () => void;
  onNext: () => void;
  isCustomAdded?: boolean;
}

export default function WidgetCard({
  word,
  theme,
  currentIndex,
  totalWords,
  language,
  onRemembered,
  onNext,
  isCustomAdded = false
}: WidgetCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [aiMnemonic, setAiMnemonic] = useState<MnemonicResponse | null>(null);
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Reset card state when word changes
  useEffect(() => {
    setIsRevealed(false);
    setAiMnemonic(null);
  }, [word]);

  const speakKorean = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    
    // Stop any active talk
    window.speechSynthesis.cancel();
    
    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.85; // Slightly slower for language learners

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const fetchMnemonic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingMnemonic || aiMnemonic) return;

    setLoadingMnemonic(true);
    try {
      const response = await fetch('/api/gemini/mnemonic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: word.word,
          translationRu: word.translationRu,
          translationEn: word.translationEn,
          pronunciationRu: word.pronunciationRu,
          pronunciationEn: word.pronunciationEn,
          lang: language
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch mnemonic');
      }

      const data = await response.json();
      setAiMnemonic(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMnemonic(false);
    }
  };

  const currentTranslation = language === 'ru' ? word.translationRu : word.translationEn;
  const currentPronunciation = language === 'ru' ? word.pronunciationRu : word.pronunciationEn;
  const currentPos = language === 'ru' ? word.partOfSpeechRu : word.partOfSpeech;
  const currentExampleTrans = language === 'ru' ? word.exampleRu : word.exampleEn;

  return (
    <div className="w-full max-w-sm mx-auto select-none">
      {/* Widget Sizing Frame */}
      <div className="text-center mb-2 flex items-center justify-between px-3 text-xs font-mono opacity-80 text-neutral-400">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 shrink-0 text-amber-400" />
          {language === 'ru' ? 'АКТИВНЫЙ ВИДЖЕТ (2х2)' : 'ACTIVE WIDGET (2x2)'}
        </span>
        <span>
          {currentIndex + 1} / {totalWords} {language === 'ru' ? 'слов' : 'words'}
        </span>
      </div>

      {/* Actual 3D Flip Card Widget */}
      <div 
        id="korean-word-widget"
        onClick={() => setIsRevealed(!isRevealed)}
        className="relative h-64 w-full cursor-pointer perspective-1000 group transition-all"
      >
        <div 
          className={`relative w-full h-full duration-500 transform-style-3d ${
            isRevealed ? 'rotate-y-180' : ''
          }`}
          style={{ transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          {/* FRONT CALM CARD (Korean spelling focus to lock mental association) */}
          <div 
            className={`absolute inset-0 w-full h-full p-6 flex flex-col justify-between backface-hidden rounded-2xl overflow-hidden border shadow-xl ${theme.cardBg} ${theme.shadowColor} ${theme.textColor}`}
            style={{
              opacity: isRevealed ? 0 : 1,
              transition: 'opacity 0.25s ease-in-out',
              pointerEvents: isRevealed ? 'none' : 'auto',
              zIndex: isRevealed ? 10 : 20
            }}
          >
            {/* Top Widget Bar */}
            <div className="flex justify-between items-center w-full">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase border border-current ${theme.accentColor}`}>
                {(word.level || 'TOPIK1_EASY').replace('TOPIK1_', '')}
              </span>
              <button 
                id="listen-primary-btn"
                onClick={(e) => speakKorean(word.word, e)}
                className={`p-2 rounded-full transition-all duration-200 hover:scale-115 ${
                  isPlayingAudio ? 'bg-amber-400 text-black' : 'hover:bg-current/15'
                }`}
                title={language === 'ru' ? 'Прослушать озвучку' : 'Listen audio'}
              >
                <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
              </button>
            </div>

            {/* Word Center */}
            <div className="text-center my-auto py-4">
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-center truncate mb-1">
                {word.word}
              </h1>
              <p className="text-xs font-mono opacity-70 tracking-widest mt-2">
                [ {language === 'ru' ? 'КЛИК ДЛЯ ПЕРЕВОДА' : 'CLICK TO REVEAL'} ]
              </p>
            </div>

            {/* Footer Status Indicators (Anti-Larp humbleness) */}
            <div className="flex justify-between items-center text-[10px] font-mono opacity-60">
              <span>{currentPos}</span>
              <span>10 слов: Корейский</span>
            </div>
          </div>

          {/* BACK CARD REVEAL (Translations, speech controls, examples) */}
          <div 
            className={`absolute inset-0 w-full h-full p-5 flex flex-col justify-between backface-hidden rounded-2xl overflow-hidden rotate-y-180 border shadow-xl ${theme.cardBg} ${theme.shadowColor} ${theme.textColor}`}
            style={{
              opacity: isRevealed ? 1 : 0,
              transition: 'opacity 0.25s ease-in-out',
              pointerEvents: isRevealed ? 'auto' : 'none',
              zIndex: isRevealed ? 20 : 10
            }}
          >
            {/* Top controls */}
            <div className="flex justify-between items-center w-full">
              <span className="text-[10px] uppercase font-mono tracking-wide opacity-70">
                {currentPos}
              </span>
              <button 
                id="listen-secondary-btn"
                onClick={(e) => speakKorean(word.word, e)}
                className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                  isPlayingAudio ? 'bg-amber-400 text-black' : 'hover:bg-current/15'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reveal detail */}
            <div className="flex flex-col text-center justify-center my-auto space-y-1 py-1">
              <h2 className="text-xl font-bold tracking-tight">
                {currentTranslation}
              </h2>
              <p className="text-sm font-semibold text-amber-500 font-mono tracking-wide">
                /{currentPronunciation}/
              </p>
              
              {/* Context example */}
              <div className="mt-2 p-2 rounded bg-black/10 text-left border border-current/10">
                <p className="text-xs font-medium leading-relaxed italic line-clamp-2">
                  {word.exampleKr}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5 leading-snug line-clamp-1">
                  {currentExampleTrans}
                </p>
              </div>
            </div>

            {/* Widget interaction row */}
            <div className="flex items-center gap-2 w-full mt-1">
              <button
                id="widget-remember-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemembered();
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border cursor-pointer hover:shadow-md active:scale-95 transition-all text-emerald-100 bg-emerald-600/30 border-emerald-500/50 hover:bg-emerald-600/45`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                {language === 'ru' ? 'Выучил' : 'Learned'}
              </button>
              
              <button
                id="widget-next-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-current/20 hover:border-current/30 hover:bg-current/5 active:scale-95 transition-all"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                {language === 'ru' ? 'Дальше' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Premium AI Helper expandable pill underneath the Widget */}
      <AnimatePresence mode="wait">
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={`mt-3 p-4 rounded-xl border bg-neutral-900/40 border-neutral-800 text-xs shadow-lg leading-relaxed`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                {language === 'ru' ? 'ИИ Ассоциация (Мнемоника)' : 'AI Mnemonic Helper'}
              </span>
              {!aiMnemonic && !loadingMnemonic && (
                <button
                  id="generate-mnemonic-btn"
                  onClick={fetchMnemonic}
                  className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded hover:bg-amber-500/20 active:scale-95 text-[10px] font-mono transition-all"
                >
                  {language === 'ru' ? 'Сгенерировать' : 'Generate'}
                </button>
              )}
            </div>

            {loadingMnemonic && (
              <div className="flex items-center justify-center gap-2 py-4 font-mono text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>{language === 'ru' ? 'ИИ придумывает историю...' : 'Gemini logic crafting story...'}</span>
              </div>
            )}

            {aiMnemonic && (
              <div className="space-y-2 mt-2">
                <div className="bg-black/25 p-2.5 rounded border border-white/5">
                  <p className="font-semibold text-neutral-200">
                    💡 {language === 'ru' ? 'Ассоциативный трюк:' : 'Memory Link:'}
                  </p>
                  <p className="text-neutral-300 mt-1">{aiMnemonic.mnemonicText}</p>
                </div>
                
                <div className="bg-black/15 p-2 rounded">
                  <p className="font-semibold text-neutral-300">
                    🧩 {language === 'ru' ? 'Звуковое созвучие:' : 'Sound Similarity:'}
                  </p>
                  <p className="text-neutral-400 mt-0.5">{aiMnemonic.associationText}</p>
                </div>

                {aiMnemonic.koreanBreakdown && (
                  <p className="text-[11px] text-neutral-400 border-t border-white/5 pt-1.5">
                    ✨ <strong className="text-amber-500/90">{language === 'ru' ? 'Разбор слогов:' : 'Syllables:'}</strong> {aiMnemonic.koreanBreakdown}
                  </p>
                )}

                <p className="text-[11px] text-neutral-400 border-t border-white/5 pt-1.5">
                  🔥 <strong className="text-amber-500/90">{language === 'ru' ? 'Интересный факт:' : 'Fun Fact:'}</strong> {aiMnemonic.funFactText}
                </p>

                {'isDemoFallback' in aiMnemonic && (
                  <div className="text-[9px] text-neutral-500 text-right italic font-mono mt-1">
                    {language === 'ru' ? '*запущено в демо-режиме без API ключа' : '*running in offline demo mode'}
                  </div>
                )}
              </div>
            )}

            {!aiMnemonic && !loadingMnemonic && (
              <p className="text-neutral-400 italic">
                {language === 'ru' 
                  ? 'Нажмите кнопку «Сгенерировать», чтобы получить от Gemini ассоциации и истории для лучшего запоминания.'
                  : 'Click "Generate" to call Gemini and fetch clever mnemonic shortcuts to easily memorize this word.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
