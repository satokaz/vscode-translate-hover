import * as assert from 'assert';
import mockRequire from 'mock-require';

suite('Hover concurrency & cancellation', () => {
    test('cache evicts oldest entries under rapid requests', async () => {
        const constants = require('../src/constants');
        const originalDelay = constants.DEFAULTS.DEBOUNCE_DELAY;
        constants.DEFAULTS.DEBOUNCE_DELAY = 0; // no debounce to exercise cache fast

        // capture provider
        let capturedProvider: any = null;

        mockRequire('vscode', {
            workspace: { getConfiguration: () => ({ get: (_: string) => undefined }) },
            languages: { registerHoverProvider: (_selector: any, provider: any) => { capturedProvider = provider; return { dispose() {} }; } },
            window: { activeTextEditor: { selection: { start: 0, end: 1 }, }, showInformationMessage: () => undefined },
            commands: { registerCommand: () => ({ dispose() {} }) },
            env: { clipboard: { readText: async () => '', writeText: async (_: string) => {} } },
            MarkdownString: class { isTrusted = true; supportHtml = true; appendMarkdown(_: string) {} },
            Hover: class { constructor(public markdown: any) {} }
        } as any);

        // provider that delays and returns unique string per selection
        const providerCalls: Record<string, number> = {};
        mockRequire('../src/providers/google', {
            translateWithGoogle: async (s: string) => {
                providerCalls[s] = (providerCalls[s] || 0) + 1;
                await new Promise(resolve => setTimeout(resolve, 5));
                return `translated:${s}:${providerCalls[s]}`;
            }
        });

        const extension = require('../src/extension');
        const context: any = { subscriptions: [] };
        await extension.activate(context);

        const position = {};
        const token = { isCancellationRequested: false, onCancellationRequested: (_cb: any) => ({ dispose() {} }) };

        // fire many requests to exceed cache max (30)
        const total = 35;
        const docs = new Array(total).fill(0).map((_, i) => ({ getText: (_: any) => `s${i}`, getWordRangeAtPosition: (_: any) => null }));

        await Promise.all(docs.map(d => capturedProvider.provideHover(d, position, token)));

        // Now check if the oldest key s0 was evicted by calling again and seeing if provider is invoked
        // Replace provider with immediate responder that sets a flag when invoked for s0
        let s0Called = false;
        mockRequire.reRequire('../src/providers/google'); // ensure module can be re-required
        mockRequire('../src/providers/google', {
            translateWithGoogle: async (s: string) => {
                if (s === 's0') s0Called = true;
                return `RETRANSLATED:${s}`;
            }
        });

        const r = await capturedProvider.provideHover({ getText: (_: any) => 's0', getWordRangeAtPosition: (_: any) => null }, position, token);

        // If s0 was evicted, provider should have been called and s0Called true
        assert.ok(s0Called, 'Oldest cache entry was not evicted as expected');

        // cleanup / restore
        constants.DEFAULTS.DEBOUNCE_DELAY = originalDelay;
        mockRequire.stop('vscode');
        mockRequire.stop('../src/providers/google');
    });

    test('hover is cancelled when token requests cancellation during debounce/provider', async () => {
        const constants = require('../src/constants');
        const originalDelay = constants.DEFAULTS.DEBOUNCE_DELAY;
        constants.DEFAULTS.DEBOUNCE_DELAY = 50; // some debounce so we can cancel during it

        // capture provider
        let capturedProvider: any = null;

        mockRequire('vscode', {
            workspace: { getConfiguration: () => ({ get: (_: string) => undefined }) },
            languages: { registerHoverProvider: (_selector: any, provider: any) => { capturedProvider = provider; return { dispose() {} }; } },
            window: { activeTextEditor: { selection: { start: 0, end: 1 }, }, showInformationMessage: () => undefined },
            commands: { registerCommand: () => ({ dispose() {} }) },
            env: { clipboard: { readText: async () => '', writeText: async (_: string) => {} } },
            MarkdownString: class { isTrusted = true; supportHtml = true; appendMarkdown(_: string) {} },
            Hover: class { constructor(public markdown: any) {} }
        } as any);

        // provider that delays to simulate long-running translation
        mockRequire('../src/providers/google', {
            translateWithGoogle: async (s: string) => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return `translated:${s}`;
            }
        });

        const extension = require('../src/extension');
        const context: any = { subscriptions: [] };
        await extension.activate(context);

        const position = {};

        // Case A: cancel during debounce
        let cancelledDuringDebounceToken: any = {
            isCancellationRequested: false,
            onCancellationRequested(cb: any) {
                const t = setTimeout(() => { cancelledDuringDebounceToken.isCancellationRequested = true; cb(); }, 10);
                return { dispose() { clearTimeout(t); } };
            }
        };

        const docA = { getText: (_: any) => 'cancA', getWordRangeAtPosition: (_: any) => null };
        const resA = await capturedProvider.provideHover(docA, position, cancelledDuringDebounceToken);
        assert.strictEqual(resA, undefined, 'Hover should be cancelled during debounce');

        // Case B: cancel during provider (after debounce)
        let cancelledDuringProviderToken: any = {
            isCancellationRequested: false,
            onCancellationRequested(cb: any) {
                const t = setTimeout(() => { cancelledDuringProviderToken.isCancellationRequested = true; cb(); }, 60); // fires after debounce, before provider completes
                return { dispose() { clearTimeout(t); } };
            }
        };

        const docB = { getText: (_: any) => 'cancB', getWordRangeAtPosition: (_: any) => null };
        const resB = await capturedProvider.provideHover(docB, position, cancelledDuringProviderToken);
        // According to implementation, provider may be aborted and token.isCancellationRequested will be true -> provideHover returns undefined
        assert.strictEqual(resB, undefined, 'Hover should be cancelled when token requests cancellation during provider');

        // restore
        constants.DEFAULTS.DEBOUNCE_DELAY = originalDelay;
        mockRequire.stop('vscode');
        mockRequire.stop('../src/providers/google');
    });
});
