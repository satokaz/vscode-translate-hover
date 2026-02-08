import * as assert from 'assert';
import { HoverOrchestrator } from '../src/hover/orchestrator';

suite('HoverOrchestrator Cache Eviction', () => {
    test('evicts oldest entry under load', async () => {
        const calls: Record<string, number> = {};
        const fakeTranslate = async (s: string) => {
            calls[s] = (calls[s] || 0) + 1;
            // small delay so processing simulates work
            await new Promise(r => setTimeout(r, 1));
            return `t:${s}`;
        };

        const orchestrator = new HoverOrchestrator({
            getConfig: () => ({ translationMethod: 'google', targetLanguage: 'en', openaiModel: '', openaiApiKey: '', openaiBaseUrl: '', reasoningEffort: '', languageDetectionMethod: 'regex', enableDebugLogging: false }),
            translateText: fakeTranslate as any,
            createHover: (text: string, isCached: boolean) => ({ markdown: { content: text } } as any),
            logger: undefined
        });

        const position = {} as any;
        const token = { isCancellationRequested: false, onCancellationRequested: (_: any) => ({ dispose() {} }) } as any;

        // fill cache with CACHE_MAX_ENTRIES + 1 items
        const total = 31; // cache capacity is 30
        for (let i = 0; i < total; i++) {
            const doc = { getText: (_: any) => `k${i}`, getWordRangeAtPosition: (_: any) => null } as any;
            await orchestrator.provideHover(doc, position, token);
        }

        // at this point, k0 should have been evicted; calling k0 again should trigger translate
        // reset call count for k0 to detect new call
        calls['k0'] = calls['k0'] || 0;

        const doc0 = { getText: (_: any) => 'k0', getWordRangeAtPosition: (_: any) => null } as any;
        await orchestrator.provideHover(doc0, position, token);

        assert.ok(calls['k0'] >= 2, 'Expected translate to be called again for evicted entry k0');
    });
});
