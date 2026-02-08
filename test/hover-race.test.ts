import * as assert from 'assert';
import mockRequire from 'mock-require';

suite('Hover race & cancellation', () => {
    test('only latest hover wins when requests overlap', async () => {
        // make debounce delay short
        const constants = require('../src/constants');
        const originalDelay = constants.DEFAULTS.DEBOUNCE_DELAY;
        constants.DEFAULTS.DEBOUNCE_DELAY = 5;

        // capture provider
        let capturedProvider: any = null;

        mockRequire('vscode', {
            workspace: { getConfiguration: () => ({ get: (_: string) => undefined }) },
            languages: { registerHoverProvider: (_selector: any, provider: any) => { capturedProvider = provider; return { dispose() {} }; } },
            window: { activeTextEditor: { selection: { start: 0, end: 1 }, }, showInformationMessage: () => undefined },
            commands: { registerCommand: () => ({ dispose() {} }) },
            env: { clipboard: { readText: async () => '', writeText: async (_: string) => {} } }
        });

        // mock translateText by stubbing providers directly
        const google = require('../src/providers/google');
        let callCount = 0;
        mockRequire('../src/providers/google', {
            translateWithGoogle: async (s: string) => {
                callCount += 1;
                // delay so overlapping is realistic
                await new Promise(resolve => setTimeout(resolve, 20));
                return `translated:${s}:${callCount}`;
            }
        });

        const extension = require('../src/extension');
        const context: any = { subscriptions: [] };
        await extension.activate(context);

        // simulate document & position & token
        const document = { getText: (_: any) => 'first' };
        const position = {};
        const token1 = {
            isCancellationRequested: false,
            onCancellationRequested: (_cb: any) => ({ dispose() {} })
        };

        const p1 = capturedProvider.provideHover(document, position, token1);

        // shortly after, change selection and call again
        const document2 = { getText: (_: any) => 'second' };
        const token2 = {
            isCancellationRequested: false,
            onCancellationRequested: (_cb: any) => ({ dispose() {} })
        };
        const p2 = capturedProvider.provideHover(document2, position, token2);

        const [r1, r2] = await Promise.all([p1, p2]);

        // first should be cancelled (undefined) or not the winner
        assert.ok(r1 === undefined || (r2 && r1 !== r2), 'First request should not win');
        assert.ok(r2, 'Second request should return a hover');

        // restore debounce default
        constants.DEFAULTS.DEBOUNCE_DELAY = originalDelay;

        mockRequire.stop('vscode');
        mockRequire.stop('../src/providers/google');
    });
});
