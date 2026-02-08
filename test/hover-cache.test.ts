import * as assert from 'assert';
import mockRequire from 'mock-require';

suite('Hover cache E2E', () => {
    test('cached hover is returned immediately without debounce', async () => {
        const constants = require('../src/constants');
        const originalDelay = constants.DEFAULTS.DEBOUNCE_DELAY;
        constants.DEFAULTS.DEBOUNCE_DELAY = 5;

        // mock vscode with simple MarkdownString and Hover
        mockRequire('vscode', {
            workspace: { getConfiguration: () => ({ get: (_: string) => undefined }) },
            languages: { registerHoverProvider: (_selector: any, provider: any) => { capturedProvider = provider; return { dispose() {} }; } },
            window: { activeTextEditor: { selection: { start: 0, end: 1 }, }, showInformationMessage: () => undefined },
            commands: { registerCommand: () => ({ dispose() {} }) },
            env: { clipboard: { readText: async () => '', writeText: async (_: string) => {} } },
            MarkdownString: class {
                isTrusted = true; supportHtml = true; content = '';
                appendMarkdown(s: string) { this.content += s; }
            },
            Hover: class { constructor(public markdown: any) {} }
        } as any);

        // capture provider
        let capturedProvider: any = null;

        // mock google provider to return immediately
        mockRequire('../src/providers/google', {
            translateWithGoogle: async (_: string) => 'QUICK'
        });

        const extension = require('../src/extension');
        const context: any = { subscriptions: [] };
        await extension.activate(context);

        // first call populates cache
        const doc1 = { getText: (_: any) => 'hello', getWordRangeAtPosition: (_: any) => null };
        const position = {};
        const token = { isCancellationRequested: false, onCancellationRequested: (_: any) => ({ dispose() {} }) };

        const r1 = await capturedProvider.provideHover(doc1, position, token);
        assert.ok(r1, 'First hover did not return a hover');

        // second call with same selection should return cached hover synchronously
        const doc2 = { getText: (_: any) => 'hello', getWordRangeAtPosition: (_: any) => null };
        const r2 = await capturedProvider.provideHover(doc2, position, token);
        assert.ok(r2, 'Cached hover not returned');

        // check that the markdown contains the "キャッシュ" marker
        const markdownContent = r2.markdown.content || '';
        assert.ok(markdownContent.includes('キャッシュ') || markdownContent.includes('✨'), 'Cached marker missing in hover content');

        // restore
        constants.DEFAULTS.DEBOUNCE_DELAY = originalDelay;
        mockRequire.stop('vscode');
        mockRequire.stop('../src/providers/google');
    });
});
