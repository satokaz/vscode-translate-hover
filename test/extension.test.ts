import * as assert from 'assert';
import { AUTO_DETECT_PAIRS } from '../src/constants';
import { buildGoogleTranslateUrl } from '../src/providers/google';
import { formatTranslationResult } from '../src/utils/format';
import { resolveTargetLanguage } from '../src/utils/languageDetector';

suite('Utils Tests', () => {
    test('formatTranslationResult adds spacing around fullwidth parentheses', () => {
        const input = '（test）and（more）';
        const expected = ' (test) and (more) ';
        assert.strictEqual(formatTranslationResult(input), expected);
    });

    test('resolveTargetLanguage uses detected language when provided', () => {
        const target = resolveTargetLanguage('日本語です', 'auto-ja', AUTO_DETECT_PAIRS, 'ja');
        assert.strictEqual(target, 'en');
    });

    test('resolveTargetLanguage falls back to primary language', () => {
        const target = resolveTargetLanguage('Hello', 'auto-ja', AUTO_DETECT_PAIRS, 'en');
        assert.strictEqual(target, 'ja');
    });

    test('buildGoogleTranslateUrl includes expected parameters', () => {
        const url = buildGoogleTranslateUrl('Hello world', 'ja');
        const parsed = new URL(url);
        const params = parsed.searchParams;

        assert.strictEqual(parsed.origin, 'https://translate.google.com');
        assert.strictEqual(params.get('client'), 'gtx');
        assert.strictEqual(params.get('sl'), 'auto');
        assert.strictEqual(params.get('tl'), 'ja');
        assert.strictEqual(params.get('q'), 'Hello world');
        assert.ok(params.getAll('dt').includes('t'));
        assert.ok(params.getAll('dt').includes('bd'));
    });
});