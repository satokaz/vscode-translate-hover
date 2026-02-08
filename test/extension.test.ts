import * as assert from 'assert';
import { AUTO_DETECT_PAIRS } from '../src/constants';
import { buildGoogleTranslateUrl } from '../src/providers/google';
import { formatTranslationResult } from '../src/utils/format';
import { detectLanguage, isChinese, isJapanese, isKorean, resolveTargetLanguage } from '../src/utils/languageDetector';

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

    test('isJapanese detects Japanese text by ratio', () => {
        assert.strictEqual(isJapanese('\u3042\u3044\u3046abc'), true);
        assert.strictEqual(isJapanese('abcdef'), false);
    });

    test('isChinese detects Chinese text and excludes Japanese-only scripts', () => {
        assert.strictEqual(isChinese('\u4E2D\u6587abc'), true);
        assert.strictEqual(isChinese('\u3042\u3044\u4E2D'), false);
    });

    test('isKorean detects Korean text by ratio', () => {
        assert.strictEqual(isKorean('\uAC00\uB098\uB2E4abc'), true);
        assert.strictEqual(isKorean('abc123'), false);
    });

    test('detectLanguage returns expected language codes', () => {
        assert.strictEqual(detectLanguage('\u3042\u3044\u3046'), 'ja');
        assert.strictEqual(detectLanguage('\u4E2D\u6587\u4E2D'), 'ja');
        assert.strictEqual(detectLanguage('\uAC00\uB098\uB2E4'), 'ko');
        assert.strictEqual(detectLanguage('Hello'), 'en');
    });
});