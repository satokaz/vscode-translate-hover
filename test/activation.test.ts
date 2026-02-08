import mockRequire from 'mock-require';
import * as assert from 'assert';

suite('Activation', () => {
	test('registers hover provider in subscriptions', async () => {
		// sentinel disposable returned by mocked registerHoverProvider
		const sentinel = { id: 'hover-sentinel', disposed: false, dispose() { this.disposed = true; } };

		// mock vscode with minimal features used during activation
		mockRequire('vscode', {
			workspace: { getConfiguration: () => ({ get: (_: string) => undefined }) },
			languages: { registerHoverProvider: (_selector: any, _provider: any) => sentinel },
			window: { activeTextEditor: undefined, showInformationMessage: () => undefined },
			commands: { registerCommand: () => ({ dispose() {} }) },
			env: { clipboard: { readText: async () => '', writeText: async () => {} } }
		});

		// require the module after mocking
		const extension = require('../src/extension');

		const context: { subscriptions: any[] } = { subscriptions: [] };

		// call activate and ensure a sentinel disposable appears in subscriptions
		await extension.activate(context);

		const found = context.subscriptions.some(s => s === sentinel);
		assert.ok(found, 'Hover provider disposable was not pushed into context.subscriptions');

		// ensure the disposable can be disposed
		if (found) {
			sentinel.dispose();
			assert.strictEqual((sentinel as any).disposed, true, 'Sentinel dispose() did not set disposed flag');
		}

		// cleanup mock
		mockRequire.stop('vscode');
	});
});
