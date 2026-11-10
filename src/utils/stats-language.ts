export type StatsLanguage = 'en' | 'hi';

export function statsLanguage(name: string): StatsLanguage {
  // Use a plain substring check on every runtime. Ignore invisible formatting
  // characters that mobile keyboards and pasted names can insert.
  const visibleName = name.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').toLowerCase();
  return visibleName.includes('sharukh') ? 'hi' : 'en';
}

export function formatStatsCount(count: number, language: StatsLanguage) {
  return language === 'hi'
    ? count.toLocaleString('en-IN').replace(/[0-9]/g, digit => '०१२३४५६७८९'[Number(digit)])
    : count.toLocaleString();
}

export const STATS_COPY = {
  en: {
    title: 'STATS', close: 'Close stats', photo: 'Your profile photo', trainer: 'Trainer',
    profileError: 'Your profile could not be loaded.', profileRetry: 'RETRY PROFILE', profileRetryLabel: 'Retry stats profile',
    profileLoading: 'Loading profile', collectionLoading: 'Loading collection stats', collectionUpdating: 'Updating collection stats',
    collectionRetry: 'RETRY COLLECTION', collectionRetryLabel: 'Retry collection stats',
    total: 'COLLECTED', common: 'COMMON', rare: 'RARE', legendary: 'LEGENDARY', mythical: 'MYTHICAL',
    empty: 'Your first discovery is waiting. Capture a creature to start your collection.',
    stale: 'Showing your last loaded collection.',
    connectionError: 'Your Pokédex could not be loaded. Check the connection to your computer.',
  },
  hi: {
    title: 'आँकड़े', close: 'आँकड़े बंद करें', photo: 'आपकी प्रोफ़ाइल तस्वीर', trainer: 'प्रशिक्षक',
    profileError: 'आपकी प्रोफ़ाइल लोड नहीं हो सकी।', profileRetry: 'प्रोफ़ाइल फिर से लोड करें', profileRetryLabel: 'प्रोफ़ाइल फिर से लोड करें',
    profileLoading: 'प्रोफ़ाइल लोड हो रही है', collectionLoading: 'संग्रह के आँकड़े लोड हो रहे हैं', collectionUpdating: 'संग्रह के आँकड़े अपडेट हो रहे हैं',
    collectionRetry: 'संग्रह फिर से लोड करें', collectionRetryLabel: 'संग्रह फिर से लोड करें',
    total: 'एकत्रित जीव', common: 'सामान्य', rare: 'दुर्लभ', legendary: 'पौराणिक', mythical: 'मिथकीय',
    empty: 'आपकी पहली खोज आपका इंतज़ार कर रही है। अपना संग्रह शुरू करने के लिए किसी जीव की तस्वीर लें।',
    stale: 'आपका पिछली बार लोड किया गया संग्रह दिखाया जा रहा है।',
    connectionError: 'आपका पोकेडेक्स लोड नहीं हो सका। अपने कंप्यूटर से कनेक्शन जाँचें और फिर से कोशिश करें।',
  },
};

export function statsErrorMessage(error: string, language: StatsLanguage) {
  if (language === 'en') return error;
  if (error.includes('timed out')) return 'कनेक्शन का समय समाप्त हो गया। अपना पोकेडेक्स फिर से लोड करें।';
  if (error === 'The saved Pokédex could not be read.') return 'सहेजा गया पोकेडेक्स पढ़ा नहीं जा सका।';
  return STATS_COPY.hi.connectionError;
}

export function unavailableStatsMessage(count: number, language: StatsLanguage) {
  const number = formatStatsCount(count, language);
  if (language === 'hi') return `${number} सहेजी गई ${count === 1 ? 'प्रविष्टि पढ़ी नहीं जा सकी' : 'प्रविष्टियाँ पढ़ी नहीं जा सकीं'}। इन आँकड़ों में केवल उपलब्ध प्रविष्टियाँ शामिल हैं।`;
  return `${number} saved ${count === 1 ? 'entry could' : 'entries could'} not be read. These counts include the available entries.`;
}
