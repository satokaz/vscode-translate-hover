import mockRequire from 'mock-require';

type ConfigValue = string | boolean | number | undefined;

mockRequire('vscode', {
	workspace: {
		getConfiguration: () => ({
			get: (_key: string) => undefined as ConfigValue
		})
	}
});
