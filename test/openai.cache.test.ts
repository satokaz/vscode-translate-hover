import * as assert from 'assert';
import mockRequire from 'mock-require';

suite('OpenAI system role cache behavior', () => {
    test('network failure does not write cache (undetermined)', async () => {
        // mock OpenAI to throw network error
        const OpenAIMock = function () {
            return { chat: { completions: { create: async () => { throw new Error('network'); } } } };
        };
        mockRequire('openai', OpenAIMock as any);

        const openai = mockRequire.reRequire('../src/providers/openai');
        const model = 'm-net';
        await openai.preloadSystemRoleSupportForModel('k', '', model);

        const entry = openai.getSystemRoleCacheEntry(model, '');
        assert.strictEqual(entry, undefined, 'Cache entry should be undefined on network failure');

        mockRequire.stop('openai');
    });

    test('determinative system-role error caches false', async () => {
        // mock OpenAI to throw determinative error
        const err = { error: { code: 'invalid_request_error', message: 'system role not supported' } };
        const OpenAIMock = function () {
            return { chat: { completions: { create: async () => { throw err; } } } };
        };
        mockRequire('openai', OpenAIMock as any);

        const openai = mockRequire.reRequire('../src/providers/openai');
        const model = 'm-deterministic';
        await openai.preloadSystemRoleSupportForModel('k', '', model);

        const entry = openai.getSystemRoleCacheEntry(model, '');
        assert.ok(entry, 'Cache entry should exist');
        assert.strictEqual(entry?.supportsSystemRole, false, 'supportsSystemRole should be false for determinative errors');

        mockRequire.stop('openai');
    });
});
