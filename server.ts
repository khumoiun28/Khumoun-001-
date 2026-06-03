/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Helper to safely fetch the GoogleGenAI instance without throwing on import/startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY is not defined or is placeholder. Please configure it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// 1. API: Check environment status
app.get('/api/status', (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  res.json({
    status: 'ok',
    hasGeminiKey: hasKey,
    time: new Date().toISOString()
  });
});

// 2. API: Generate smart Korean word mnemonic & association
app.post('/api/gemini/mnemonic', async (req, res) => {
  const { word, translationRu, translationEn, pronunciationRu, pronunciationEn, lang = 'ru' } = req.body;

  if (!word) {
    return res.status(400).json({ error: 'Word is required' });
  }

  try {
    const ai = getGeminiClient();
    const systemPrompt = `You are a highly creative linguist and Korean tutor who helps students overcome learning cognitive friction.
Your goal is to design incredibly catchy mneumotechnical associations (mnemonics) to memorize a Korean word easily. 
You must respond strictly with valid JSON.`;

    const userPrompt = `Develop a learning card aid for the Korean word: "${word}" (Pronounced in Cyrillic as "${pronunciationRu || ''}", in Latin as "${pronunciationEn || ''}").
Meaning: in Russian - "${translationRu}", in English - "${translationEn}".

Provide:
1. A mnemonic trick/story connecting the sound of the word to its meaning. (Write in ${lang === 'ru' ? 'Russian' : 'English'}). Keep it funny and highly memorable.
2. A brief association explanation or sound-similarity bridge.
3. A cultural fun fact or real-life etymological trivia about this word.
4. A short breakdown of how the word or syllables are built (if applicable).

Strict JSON output format:
{
  "mnemonicText": "Mnemonic story here...",
  "associationText": "Sound-similarity clue or bridge...",
  "funFactText": "Interesting cultural context or trivia...",
  "koreanBreakdown": "Syllable breakdown or explanation..."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mnemonicText: { type: Type.STRING },
            associationText: { type: Type.STRING },
            funFactText: { type: Type.STRING },
            koreanBreakdown: { type: Type.STRING }
          },
          required: ['mnemonicText', 'associationText', 'funFactText']
        }
      }
    });

    const textOutput = response.text || '{}';
    res.json(JSON.parse(textOutput));
  } catch (error: any) {
    console.error('Gemini error generating mnemonic:', error);
    // Sophisticated, contextual fallback values so the offline/unkeyed experience is flawless and informative
    const isRu = lang === 'ru';
    res.json({
      mnemonicText: isRu 
        ? `[Режим без ключа] Чтобы запомнить «${word}» (${translationRu}), представьте созвучную ассоциацию. Например, свяжите произношение "${pronunciationRu}" в забавной жизненной ситуации!`
        : `[Keyless mode] To memorize "${word}" (${translationEn}), create a sound connection. link the sound "${pronunciationEn}" with a visual story!`,
      associationText: isRu
        ? `Звучание: ${pronunciationRu} ⇄ ${translationRu}`
        : `Sound: ${pronunciationEn} ⇄ ${translationEn}`,
      funFactText: isRu
        ? `В корейской культуре слова имеют разные степени вежливости. Используйте этот нюанс при общении!`
        : `Korean vocabulary has diverse speech levels ranging from casual talk to formal honorific styles!`,
      koreanBreakdown: `Syllable: ${word}`,
      isDemoFallback: true
    });
  }
});

// 3. API: Dynamic custom card generator matching user direct queries (allows student to search any word)
app.post('/api/gemini/define', async (req, res) => {
  const { query, lang = 'ru' } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const ai = getGeminiClient();
    const systemPrompt = `You are a professional Korean-Russian-English language assistant. Translate and parse the query into a high-quality flashcard format. 
If the input query is Korean, translate it. If it is in Russian or English, find the closest Korean equivalent.
You must respond strictly with valid JSON.`;

    const userPrompt = `Translate the language query "${query}" and build a structured bilingual Korean flashcard data block.
Translate to both Russian and English, calculate phonetic transcriptions for Cyrillic and English readers, assign part of speech, and craft a clear Korean example sentence matching the level, with Russian and English translations.

Strict JSON output format:
{
  "word": "Korean word spelling",
  "translationRu": "Translation in Russian",
  "translationEn": "Translation in English",
  "pronunciationRu": "Cyrillic phonetic transcription (capitalized syllable emphasis like Ан-нён)",
  "pronunciationEn": "English romanticized phonetic representation",
  "partOfSpeech": "noun / verb / adjective / phrase",
  "partOfSpeechRu": "сущ. / глагол / прил. / фраза",
  "exampleKr": "A short, simple Korean example sentence",
  "exampleRu": "Russian translation of the example",
  "exampleEn": "English translation of the example",
  "level": "TOPIK1_EASY"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            translationRu: { type: Type.STRING },
            translationEn: { type: Type.STRING },
            pronunciationRu: { type: Type.STRING },
            pronunciationEn: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            partOfSpeechRu: { type: Type.STRING },
            exampleKr: { type: Type.STRING },
            exampleRu: { type: Type.STRING },
            exampleEn: { type: Type.STRING },
            level: { type: Type.STRING }
          },
          required: ['word', 'translationRu', 'translationEn', 'pronunciationRu', 'pronunciationEn', 'partOfSpeech', 'exampleKr']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    parsed.id = `custom-${Date.now()}`;
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini custom define error:', error);
    // Highly relevant smart fallback for a default customized word in case the API key is not yet set
    res.json({
      id: `custom-fallback-${Date.now()}`,
      word: query.match(/[\uac00-\ud7af]/) ? query : '커피',
      translationRu: 'Кофе',
      translationEn: 'Coffee',
      pronunciationRu: 'Кхопхи',
      pronunciationEn: 'Keopi',
      partOfSpeech: 'noun',
      partOfSpeechRu: 'сущ.',
      exampleKr: '저는 매일 아침 따뜻한 커피를 마십니다.',
      exampleRu: 'Я пью теплый кофе каждое утро.',
      exampleEn: 'I drink hot coffee every morning.',
      level: 'TOPIK1_EASY',
      isDemoFallback: true
    });
  }
});

// 4. API: Generate standard list of Korean words (10, 20 or 25)
app.post('/api/gemini/generate-words', async (req, res) => {
  const { count = 10, exclude = [], lang = 'ru' } = req.body;
  const excludeList: string[] = Array.isArray(exclude) ? exclude : [];

  try {
    const ai = getGeminiClient();
    const systemPrompt = `You are a professional Korean language educator. Your task is to generate a list of exactly ${count} useful Korean vocabulary words suitable for beginners and intermediate learners.
Ensure every word is unique, spelled in correct Hangul, and has relevant translations, Cyrillic & English phonetics, parts of speech, and illustrative examples.
Do NOT generate any words from the following list (duplicates are strictly forbidden): ${excludeList.slice(0, 100).join(', ')}.
You must respond strictly with a valid JSON array of objects.`;

    const userPrompt = `Generate exactly ${count} Korean words in a JSON array of word objects.
Make sure the words are different, useful, and not in the excluded list.
Each object must contain:
1. "word" - Hangul spelling.
2. "translationRu" - Clear translation in Russian.
3. "translationEn" - Clear translation in English.
4. "pronunciationRu" - Cyrillic phonetic transcription with capitalized syllable emphasis like 'Ан-нён'.
5. "pronunciationEn" - English romanized pronunciation.
6. "partOfSpeech" - noun/verb/adjective etc.
7. "partOfSpeechRu" - сущ./глагол/прил. etc.
8. "exampleKr" - Simple Korean example sentence using this word.
9. "exampleRu" - Russian translation of the example sentence.
10. "exampleEn" - English translation of the example sentence.
11. "level" - 'TOPIK1_EASY', 'TOPIK1_MEDIUM', or 'TOPIK1_HARD'.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              translationRu: { type: Type.STRING },
              translationEn: { type: Type.STRING },
              pronunciationRu: { type: Type.STRING },
              pronunciationEn: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              partOfSpeechRu: { type: Type.STRING },
              exampleKr: { type: Type.STRING },
              exampleRu: { type: Type.STRING },
              exampleEn: { type: Type.STRING },
              level: { type: Type.STRING }
            },
            required: ['word', 'translationRu', 'translationEn', 'pronunciationRu', 'pronunciationEn', 'partOfSpeech', 'exampleKr']
          }
        }
      }
    });

    const parsedArray = JSON.parse(response.text || '[]');
    if (Array.isArray(parsedArray)) {
      const formatted = parsedArray.map((item: any, idx: number) => ({
        ...item,
        id: `custom-gen-${Date.now()}-${idx}`
      }));
      return res.json(formatted);
    }
    throw new Error('Response is not an array of words');
  } catch (error: any) {
    console.error('Gemini list generation error:', error);
    
    // High quality fallback array of 25 interesting words to support offline/no-key usage perfectly:
    const baseFallback = [
      { word: '사과', translationRu: 'Яблоко', translationEn: 'Apple', pronunciationRu: 'Са-гва', pronunciationEn: 'Sagwa', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '스 요리사가 사과를 자릅니다.', exampleRu: 'Повар режет яблоко.', exampleEn: 'The chef cuts the apple.', level: 'TOPIK1_EASY' },
      { word: '하늘', translationRu: 'Небо', translationEn: 'Sky', pronunciationRu: 'Ха-ныль', pronunciationEn: 'Haneul', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '오늘 하늘은 구름 한 점 없이 맑습니다.', exampleRu: 'Сегодня небо ясное, без единого облака.', exampleEn: 'Today sky is clear without a single cloud.', level: 'TOPIK1_EASY' },
      { word: '물', translationRu: 'Вода', translationEn: 'Water', pronunciationRu: 'Муль', pronunciationEn: 'Mul', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '시원한 물 한 잔만 주세요.', exampleRu: 'Дайте мне, пожалуйста, стакан прохладной воды.', exampleEn: 'Please give me a glass of cold water.', level: 'TOPIK1_EASY' },
      { word: '나무', translationRu: 'Дерево', translationEn: 'Tree', pronunciationRu: 'На-му', pronunciationEn: 'Namu', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '집 앞마당에 큰 대나무가 있습니다.', exampleRu: 'Во дворе дома растет большой бамбук.', exampleEn: 'There is a large bamboo tree in the front yard.', level: 'TOPIK1_EASY' },
      { word: '바다', translationRu: 'Море', translationEn: 'Sea', pronunciationRu: 'Па-да', pronunciationEn: 'Bada', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '파도 소리가 들리는 푸른 바다입니다.', exampleRu: 'Синее море с шумом волн.', exampleEn: 'It is a blue sea where you can hear waves.', level: 'TOPIK1_EASY' },
      { word: '친구', translationRu: 'Друг', translationEn: 'Friend', pronunciationRu: 'Чхин-гу', pronunciationEn: 'Chingu', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '내 가장 친한 친구는 친절합니다.', exampleRu: 'Мой лучший друг очень добрый.', exampleEn: 'My best friend is friendly.', level: 'TOPIK1_EASY' },
      { word: '노래', translationRu: 'Песня', translationEn: 'Song', pronunciationRu: 'Но-рэ', pronunciationEn: 'Norae', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '그들은 신나는 노래를 듣고 즐거워합니다.', exampleRu: 'Они веселятся, слушая зажигательную песню.', exampleEn: 'They feel happy listening to an exciting song.', level: 'TOPIK1_EASY' },
      { word: '책', translationRu: 'Книга', translationEn: 'Book', pronunciationRu: 'Чхэк', pronunciationEn: 'Chaek', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '이 책을 끝까지 다 읽었습니다.', exampleRu: 'Я прочитал эту книгу до конца.', exampleEn: 'I finished reading this book to the end.', level: 'TOPIK1_EASY' },
      { word: '집', translationRu: 'Дом', translationEn: 'House', pronunciationRu: 'Чип', pronunciationEn: 'Jip', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '포근하고 포근한 우리 집입니다.', exampleRu: 'Наш теплый и уютный дом.', exampleEn: 'It is our warm and cozy house.', level: 'TOPIK1_EASY' },
      { word: '구름', translationRu: 'Облако', translationEn: 'Cloud', pronunciationRu: 'Ку-рым', pronunciationEn: 'Gureum', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '하늘에 하얀 구름이 아주 예쁘게 떠있습니다.', exampleRu: 'В небе очень красиво плывут белые облака.', exampleEn: 'White clouds are beautifully floating in the sky.', level: 'TOPIK1_EASY' },
      { word: '바람', translationRu: 'Ветер', translationEn: 'Wind', pronunciationRu: 'Па-рам', pronunciationEn: 'Baram', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '가을 바람이 불어 나뭇잎이 흔들립니다.', exampleRu: 'Дует осенний ветер, колыша листья.', exampleEn: 'The autumn wind blows and the leaves shake.', level: 'TOPIK1_EASY' },
      { word: '꽃', translationRu: 'Цветок', translationEn: 'Flower', pronunciationRu: 'Ккот', pronunciationEn: 'Kkot', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '길가에 아름다운 꽃이 피었습니다.', exampleRu: 'На обочине дороги расцвели прекрасные цветы.', exampleEn: 'Columns of beautiful flowers bloomed along the road.', level: 'TOPIK1_EASY' },
      { word: '여름', translationRu: 'Лето', translationEn: 'Summer', pronunciationRu: 'Ё-рым', pronunciationEn: 'Yeoreum', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '매우 덥지만 즐거운 여름 방학입니다.', exampleRu: 'Очень жаркие, но веселые летние каникулы.', exampleEn: 'It is a very hot but fun summer vacation.', level: 'TOPIK1_EASY' },
      { word: '봄', translationRu: 'Весна', translationEn: 'Spring', pronunciationRu: 'Пом', pronunciationEn: 'Bom', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '봄이 오면 산과 들에 꽃이 핍니다.', exampleRu: 'С приходом весны расцветают горы и поля.', exampleEn: 'When spring comes, flowers bloom on mountains.', level: 'TOPIK1_EASY' },
      { word: '음악', translationRu: 'Музыка', translationEn: 'Music', pronunciationRu: 'Ы-мак', pronunciationEn: 'Eumak', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '부드러운 클래식 음악을 감상합니다.', exampleRu: 'Наслаждаюсь нежной классической музыкой.', exampleEn: 'I enjoy soft classical music.', level: 'TOPIK1_EASY' },
      { word: '행복', translationRu: 'Счастье', translationEn: 'Happiness', pronunciationRu: 'Хэн-бок', pronunciationEn: 'Haengbok', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '가족과 마주할 때 진정한 행복을 느낍니다.', exampleRu: 'Я чувствую истинное счастье, когда нахожусь с семьей.', exampleEn: 'I feel true happiness when with my family.', level: 'TOPIK1_EASY' },
      { word: '사랑', translationRu: 'Любовь', translationEn: 'Love', pronunciationRu: 'Са-ран', pronunciationEn: 'Sarang', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '서로에 대한 사랑과 존중이 중요합니다.', exampleRu: 'Любовь и уважение друг к другу очень важны.', exampleEn: 'Love and respect for each other are important.', level: 'TOPIK1_EASY' },
      { word: '시간', translationRu: 'Время', translationEn: 'Time', pronunciationRu: 'Си-ган', pronunciationEn: 'Sigan', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '시간이 참 흐르고 빨리 지나갑니다.', exampleRu: 'Время действительно течет и летит очень быстро.', exampleEn: 'Time passes and goes by really quickly.', level: 'TOPIK1_EASY' },
      { word: '마음', translationRu: 'Душа / Сердце', translationEn: 'Heart / Mind', pronunciationRu: 'Ма-ым', pronunciationEn: 'Maeum', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '그의 따뜻한 마음씨에 온기가 전해집니다.', exampleRu: 'Его доброе сердце передает душевное тепло.', exampleEn: 'His warm heart conveys tenderness.', level: 'TOPIK1_EASY' },
      { word: '생각', translationRu: 'Мысль', translationEn: 'Thought', pronunciationRu: 'Сэн-гак', pronunciationEn: 'Saenggak', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '좋은 생각이 갑자기 번뜩 떠올랐습니다.', exampleRu: 'Мне вдруг пришла в голову отличная мысль.', exampleEn: 'A great thought suddenly flashed into my mind.', level: 'TOPIK1_EASY' },
      { word: '오늘', translationRu: 'Сегодня', translationEn: 'Today', pronunciationRu: 'О-ныль', pronunciationEn: 'Oneul', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '오늘 우리는 즐거운 날을 보냈습니다.', exampleRu: 'Сегодня мы отлично провели день.', exampleEn: 'Today we had a pleasurable day.', level: 'TOPIK1_EASY' },
      { word: '기쁨', translationRu: 'Радость', translationEn: 'Joy', pronunciationRu: 'Ки-ппым', pronunciationEn: 'Gippeum', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '시험 합격 소식에 기쁨을 감추질 못합니다.', exampleRu: 'Не могу скрыть радость от вести о сдаче экзамена.', exampleEn: 'Cannot hide joy from passing the exam search.', level: 'TOPIK1_EASY' },
      { word: '별', translationRu: 'Звезда', translationEn: 'Star', pronunciationRu: 'Пёль', pronunciationEn: 'Byeol', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '밤하늘에 수많은 별이 반짝입니다.', exampleRu: 'В ночном небе сверкают бесчисленные звезды.', exampleEn: 'Countless stars are sparkling in the night sky.', level: 'TOPIK1_EASY' },
      { word: '달', translationRu: 'Луна', translationEn: 'Moon', pronunciationRu: 'Таль', pronunciationEn: 'Dal', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '어두운 바다에 뜬 보름달이 밝습니다.', exampleRu: 'Полная луна над темным морем светит ярко.', exampleEn: 'The full moon that rose over the dark sea is bright.', level: 'TOPIK1_EASY' },
      { word: '꿈', translationRu: 'Мечта / Сон', translationEn: 'Dream', pronunciationRu: 'Ккум', pronunciationEn: 'Kkum', partOfSpeech: 'noun', partOfSpeechRu: 'сущ.', exampleKr: '저는 꿈을 이루기 위해 열심히 노력합니다.', exampleRu: 'Я упорно тружусь, чтобы осуществить свою мечту.', exampleEn: 'I work hard to achieve my dream.', level: 'TOPIK1_EASY' }
    ];

    // Filter out words that are in exclude list
    const filteredFallback = baseFallback.filter(w => !excludeList.includes(w.word));
    // If we have fewer than count words left, just use the fallback list as is
    const chosenList = filteredFallback.length >= count ? filteredFallback.slice(0, count) : baseFallback.slice(0, count);

    const formatted = chosenList.map((item, idx) => ({
      ...item,
      id: `custom-gen-fallback-${Date.now()}-${idx}`
    }));

    res.json(formatted);
  }
});

async function startServer() {
  // Vite Integration for lightning fast build execution or static service
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[10 Words: Korean Widget] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
