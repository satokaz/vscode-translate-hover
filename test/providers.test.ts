import * as assert from 'assert';
import mockRequire from 'mock-require';

suite('Provider tests', () => {
    test('Google translate parses sentences and dict', async () => {
        // mock axios to return structured data
        const axiosStub = async (cfg: any) => ({
            data: {
                sentences: [{ trans: 'Hello' }, { trans: ' world' }],
                dict: [{ terms: ['A', 'B'] }]
            }
        });
        mockRequire('axios', axiosStub);

        const google = require('../src/providers/google');
        const res = await google.translateWithGoogle('x', 'ja');
        assert.ok(res.includes('Hello world'));
        assert.ok(res.includes('A'));

        mockRequire.stop('axios');
    });

    test('Google translate handles abort via AbortSignal', async () => {
        // axios that waits and listens for abort
        const axiosStub = (cfg: any) => new Promise((resolve, reject) => {
            const sig: AbortSignal | undefined = cfg.signal;
            if (sig && sig.aborted) {
                return reject(new Error('aborted'));
            }
            const onAbort = () => reject(new Error('aborted'));
            sig?.addEventListener('abort', onAbort);
            setTimeout(() => resolve({ data: { sentences: [{ trans: 'x' }] } }), 50);
        });
        mockRequire('axios', axiosStub);

        const google = require('../src/providers/google');
        const ac = new AbortController();
        const p = google.translateWithGoogle('x', 'ja', ac.signal);
        setTimeout(() => ac.abort(), 10);
        const res = await p;
        assert.strictEqual(res, 'Translation cancelled');

        mockRequire.stop('axios');
    });

    test('OpenAI translate returns content and handles abort', async () => {
        // mock OpenAI client
        const createStub = (params: any, opts: any) => {
            return new Promise((resolve, reject) => {
                const sig = opts?.signal;
                if (sig && sig.aborted) return reject(new Error('aborted'));
                const onAbort = () => reject(new Error('aborted'));
                sig?.addEventListener('abort', onAbort);
                setTimeout(() => resolve({ choices: [{ message: { content: 'translated' } }] }), 10);
            });
        };

        const OpenAIMock = function () {
            return { chat: { completions: { create: createStub } } };
        };

        mockRequire('openai', OpenAIMock);

        const openaiProvider = require('../src/providers/openai');
        const config = { openaiApiKey: 'k', openaiBaseUrl: '', openaiModel: 'm', translationMethod: 'openai', reasoningEffort: '' };

        // normal translate
        const res = await openaiProvider.translateWithOpenAI('hello', config, 'en');
        assert.strictEqual(res, 'translated');

        // abort
        const ac = new AbortController();
        const p = openaiProvider.translateWithOpenAI('hello', config, 'en', ac.signal);
        setTimeout(() => ac.abort(), 1);
        const res2 = await p;
        assert.strictEqual(res2, 'Translation cancelled');

        mockRequire.stop('openai');
    });
});
