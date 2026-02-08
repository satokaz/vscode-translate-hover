import * as assert from 'assert';
import { updateCache } from '../src/extension';

suite('LRU Cache Tests', () => {
    test('evicts oldest entry when capacity exceeded', () => {
        const cache = new Map<string, any>();
        const cap = 30; // matches extension CACHE_MAX_ENTRIES

        // fill cache with cap entries
        for (let i = 1; i <= cap; i++) {
            updateCache(cache, `key${i}`, { selection: `key${i}`, result: `r${i}`, method: 'google', targetLanguage: 'en' });
        }
        assert.strictEqual(cache.size, cap);

        // add one more entry - should evict the oldest (key1)
        updateCache(cache, 'key31', { selection: 'key31', result: 'r31', method: 'google', targetLanguage: 'en' });
        assert.strictEqual(cache.size, cap);
        assert.ok(!cache.has('key1'), 'oldest entry was not evicted');
        assert.ok(cache.has('key31'));
    });
});
