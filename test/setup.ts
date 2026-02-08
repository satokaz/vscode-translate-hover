import mockRequire from 'mock-require';

type ConfigValue = string | boolean | number | undefined;

mockRequire('vscode', {
	workspace: {
		getConfiguration: () => ({
			get: (_key: string, defaultValue?: ConfigValue) => (typeof defaultValue === 'undefined' ? undefined : defaultValue) as ConfigValue
		}),
		onDidChangeConfiguration: (_cb: any) => ({ dispose() {} })
	},
	window: {
		createOutputChannel: (_name: string) => ({
			appendLine: (msg: string) => { console.log(msg); },
			show: () => { /* no-op */ },
			dispose: () => { /* no-op */ },
			clear: () => { /* no-op */ }
		}),
		// default activeTextEditor used when tests don't override it
		activeTextEditor: {
			selection: {
				isReversed: false,
				isSingleLine: true,
				anchor: { line: 0, character: 0 },
				active: { line: 0, character: 0 },
				end: { line: 0, character: 0 }
			},
			document: {
				getText: (_range?: any) => ''
			}
		},
		showInformationMessage: () => undefined
	},
	env: {
		clipboard: {
			readText: async () => '',
			writeText: async (_t: string) => undefined
		}
	},
	MarkdownString: class {
		isTrusted = true;
		supportHtml = true;
		content = '';
		appendMarkdown(s: string) {
			this.content += s;
		}
	},
	Hover: class {
		constructor(public markdown: any) {}
	}
});

// initialize logger for tests so debug/info/error lines are printed to stdout
const testLogger = require('../src/utils/logger');
if (testLogger && typeof testLogger.initializeLogger === 'function') {
	testLogger.initializeLogger('Test');
	testLogger.setDebugEnabled(true);
}

