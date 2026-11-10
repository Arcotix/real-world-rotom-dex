import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStatsCount, statsLanguage, statsErrorMessage, unavailableStatsMessage, STATS_COPY } from '../src/utils/stats-language.ts';

test('Sharukh matches anywhere in a name, including Android keyboard formatting and mixed case', () => {
  for (const name of ['Sharukh', ' sharukh ', 'Md. sHaRuKh Khan', 'Sharukh-Khan', '(SHARUKH)', 'Sharukh123', 'SharukhKhan', 'Sha\u200Brukh', '\u200fSharukh\u200e']) assert.equal(statsLanguage(name), 'hi', name);
  for (const name of ['', 'Ash Ketchum', 'Shahrukh', 'Misty']) assert.equal(statsLanguage(name), 'en', name);
});

test('Hindi stats use Devanagari digits and translate all interface copy', () => {
  assert.equal(formatStatsCount(13, 'hi'), '१३');
  assert.equal(formatStatsCount(12345, 'hi'), '१२,३४५');
  assert.equal(formatStatsCount(0, 'hi'), '०');
  for (const text of Object.values(STATS_COPY.hi)) {
    assert.match(text, /\p{Script=Devanagari}/u);
    assert.doesNotMatch(text, /[A-Za-z]/);
  }
  for (const error of ['The connection timed out.', 'The saved Pokédex could not be read.', 'Network request failed']) {
    assert.doesNotMatch(statsErrorMessage(error, 'hi'), /[A-Za-z]/);
    assert.equal(statsErrorMessage(error, 'en'), error);
  }
  assert.match(unavailableStatsMessage(1, 'hi'), /^१ सहेजी गई प्रविष्टि/);
  assert.match(unavailableStatsMessage(2, 'hi'), /^२ सहेजी गई प्रविष्टियाँ/);
});
