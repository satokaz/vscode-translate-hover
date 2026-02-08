import * as assert from 'assert';
import { isSystemRoleError, normalizeReasoningEffort } from '../src/providers/openai';

suite('OpenAI Utils Tests', () => {
	test('normalizeReasoningEffort returns valid values only', () => {
		assert.strictEqual(normalizeReasoningEffort(' low '), 'low');
		assert.strictEqual(normalizeReasoningEffort('medium'), 'medium');
		assert.strictEqual(normalizeReasoningEffort('high'), 'high');
		assert.strictEqual(normalizeReasoningEffort(''), undefined);
		assert.strictEqual(normalizeReasoningEffort('fast'), undefined);
		assert.strictEqual(normalizeReasoningEffort(undefined), undefined);
	});

	test('isSystemRoleError detects relevant error shapes', () => {
		assert.strictEqual(isSystemRoleError({ code: 'invalid_request_error' }), true);
		assert.strictEqual(isSystemRoleError({ message: 'System role not supported' }), true);
		assert.strictEqual(isSystemRoleError({ error: { message: 'unsupported parameter' } }), true);
		assert.strictEqual(isSystemRoleError({ message: 'network error' }), false);
		assert.strictEqual(isSystemRoleError('plain error'), false);
	});
});
