import * as assert from 'assert';
import mockRequire from 'mock-require';

suite('Hover race & cancellation', () => {
    suiteSetup(function () {
        this.timeout(10000);
    });

    test('only latest hover wins when requests overlap', async function () {
        this.timeout(10000);
        // make debounce delay short
        const constants = require('../src/constants');
        const originalDelay = constants.DEFAULTS.DEBOUNCE_DELAY;
        constants.DEFAULTS.DEBOUNCE_DELAY = 5;

        mockRequire('vscode', {
            workspace: {
                getConfiguration: (_section?: string) => ({ get: (_: string, def: any) => def }),
                onDidChangeConfiguration: (_: any) => ({ dispose() {} })
            },
            languages: { registerHoverProvider: (_selector: any, _provider: any) => ({ dispose() {} }) },
            window: { activeTextEditor: { selection: { start: 0, end: 1 }, }, showInformationMessage: () => undefined },
            commands: { registerCommand: () => ({ dispose() {} }) },
            env: { clipboard: { readText: async () => '', writeText: async (_: string) => {} } }
        ,
            MarkdownString: class { isTrusted = true; supportHtml = true; appendMarkdown(_: string) {} },
            Hover: class { constructor(public markdown: any) {} }
        } as any);

        // mock translateText by stubbing providers directly
        let callCount = 0;
        mockRequire('../src/providers/google', {
            translateWithGoogle: async (s: string) => {
                callCount += 1;
                // delay so overlapping is realistic
                await new Promise(resolve => setTimeout(resolve, 20));
                return `translated:${s}:${callCount}`;
            }
        });
        mockRequire.reRequire('../src/providers/google');

        const extension = mockRequire.reRequire('../src/extension');
        const context: any = { subscriptions: [] };
        await extension.activate(context);

        // simulate document & position & token
        const document = {
            getText: (_: any) => 'first',
            getWordRangeAtPosition: (_: any) => undefined
        };
        const position = {};
        let token1Cancelled = false;
        const token1 = {
            get isCancellationRequested() {
                return token1Cancelled;
            },
            onCancellationRequested: (cb: any) => {
                return {
                    dispose() {}
                };
            }
        };

        const p1 = extension.__testHoverProvider.provideHover(document, position, token1);

        // shortly after, change selection and call again
        const document2 = {
            getText: (_: any) => 'second',
            getWordRangeAtPosition: (_: any) => undefined
        };
        const token2 = {
            isCancellationRequested: false,
            onCancellationRequested: (_cb: any) => ({ dispose() {} })
        };
        // cancel the first token and change the active editor selection so the orchestrator sees a different selection
        token1Cancelled = true;
        const vscodeMock = require('vscode');
        vscodeMock.window.activeTextEditor.selection = { start: 0, end: 2 };

        const p2 = extension.__testHoverProvider.provideHover(document2, position, token2);

        const r2 = await p2;
        const r1 = await Promise.race([
            p1,
            new Promise(resolve => setTimeout(() => resolve('timeout'), 50))
        ]);

        // first should be cancelled (undefined) and second should win
        assert.ok(r1 === undefined || r1 === 'timeout', 'First request should be cancelled or not resolve');
        assert.ok(r2, 'Second request should return a hover');

        // Ensure pending debounce timers are cleared so mocha can exit
        await new Promise(resolve => setTimeout(resolve, 10));

        // restore debounce default
        constants.DEFAULTS.DEBOUNCE_DELAY = originalDelay;

        mockRequire.stop('vscode');
        mockRequire.stop('../src/providers/google');
        try { mockRequire.stop('../src/extension'); } catch {}
    });
});
