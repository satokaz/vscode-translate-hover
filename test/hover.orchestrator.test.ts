import * as assert from 'assert';
import { HoverOrchestrator } from '../src/hover/orchestrator';
import type * as vscode from 'vscode';

suite('HoverOrchestrator', () => {
    test('debounce and sequencing: only latest request wins', async () => {
        const constants = require('../src/constants');
        const originalDelay = constants.DEFAULTS.DEBOUNCE_DELAY;
        constants.DEFAULTS.DEBOUNCE_DELAY = 5;
        let translateCalls: string[] = [];

        const fakeTranslate = async (s: string) => {
            translateCalls.push(s);
            // simulate slow translate
            await new Promise(r => setTimeout(r, 20));
            return `t:${s}`;
        };

        const orchestrator = new HoverOrchestrator({
            getConfig: () => ({ translationMethod: 'google', targetLanguage: 'en', openaiModel: '', openaiApiKey: '', openaiBaseUrl: '', reasoningEffort: '', languageDetectionMethod: 'regex', enableDebugLogging: false }),
            translateText: fakeTranslate as any,
            createHover: (text: string, isCached: boolean) => ({ markdown: { content: text } } as any),
            logger: undefined
        });

        // fake document & editor
        const doc1 = { getText: (_: any) => 'one', getWordRangeAtPosition: (_: any) => null } as any;
        const doc2 = { getText: (_: any) => 'two', getWordRangeAtPosition: (_: any) => null } as any;
        const position = {} as any;

        // token with cancellation subscription that does nothing
        const token = { isCancellationRequested: false, onCancellationRequested: (_: any) => ({ dispose() {} }) } as any;

        const p1 = orchestrator.provideHover(doc1, position as any, token);
        // shortly after, trigger second
        await new Promise(r => setTimeout(r, 5));
        const p2 = orchestrator.provideHover(doc2, position as any, token);

        const [r1, r2] = await Promise.all([p1, p2]);

        // r2 should be the translation result, r1 either undefined or different
        const r2Any = r2 as any;
        assert.ok(r2Any && r2Any.markdown.content.includes('t:two'));
        if (r1) {
            const r1Any = r1 as any;
            assert.notStrictEqual(r1Any.markdown.content, r2Any.markdown.content);
        }
        // restore debounce
        constants.DEFAULTS.DEBOUNCE_DELAY = originalDelay;
    });

    test('cancellation during debounce returns undefined', async () => {
        const fakeTranslate = async (s: string) => {
            await new Promise(r => setTimeout(r, 20));
            return `t:${s}`;
        };

        const orchestrator = new HoverOrchestrator({
            getConfig: () => ({ translationMethod: 'google', targetLanguage: 'en', openaiModel: '', openaiApiKey: '', openaiBaseUrl: '', reasoningEffort: '', languageDetectionMethod: 'regex', enableDebugLogging: false }),
            translateText: fakeTranslate as any,
            createHover: (text: string, isCached: boolean) => ({ markdown: { content: text } } as any),
            logger: undefined
        });

        const doc = { getText: (_: any) => 'cancelme', getWordRangeAtPosition: (_: any) => null } as any;
        const position = {} as any;

        let called = false;
        const token = {
            isCancellationRequested: false,
            onCancellationRequested(cb: any) {
                called = true;
                // call callback right away to simulate cancellation
                cb();
                return { dispose() {} };
            }
        } as any;

        const r = await orchestrator.provideHover(doc, position as any, token);
        assert.strictEqual(r, undefined);
        assert.ok(called, 'token.onCancellationRequested should have been called');
    });
});
