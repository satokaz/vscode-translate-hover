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
        // ensure no prior provider mock interferes
        try { mockRequire.stop('../src/providers/google'); } catch (e) {}
        mockRequire('axios', axiosStub);

        const google = mockRequire.reRequire('../src/providers/google');
        console.log('DEBUG google.translateWithGoogle type:', typeof google.translateWithGoogle);
        const res = await google.translateWithGoogle('x', 'ja');
        console.log('DEBUG google translate result:', res);
        assert.ok(res.includes('Hello world'));
        assert.ok(res.includes('A'));

        mockRequire.stop('axios');
        try { mockRequire.stop('../src/providers/google'); } catch (e) {}

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
        try { mockRequire.stop('../src/providers/google'); } catch (e) {}
        mockRequire('axios', axiosStub);

        const google = mockRequire.reRequire('../src/providers/google');
        const ac = new AbortController();
        const p = google.translateWithGoogle('x', 'ja', ac.signal);
        setTimeout(() => ac.abort(), 10);
        const res = await p;
        assert.strictEqual(res, 'Translation cancelled');

        mockRequire.stop('axios');
        try { mockRequire.stop('../src/providers/google'); } catch (e) {}

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

        const openaiProvider = mockRequire.reRequire('../src/providers/openai');
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
