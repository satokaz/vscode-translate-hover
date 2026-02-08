const mockRequire = require('mock-require');
(async () => {
  let capturedProvider = null;
  mockRequire('vscode', {
    workspace: { getConfiguration: () => ({ get: (_)=> undefined }) , onDidChangeConfiguration: ()=>({dispose(){}}) },
    languages: { registerHoverProvider: (_selector, provider) => { capturedProvider = provider; return { dispose() {} }; } },
    window: { activeTextEditor: { selection: { start: 0, end:1 }, }, showInformationMessage: ()=>undefined },
    commands: { registerCommand: ()=>({dispose(){}}) },
    env: { clipboard: { readText: async ()=>'', writeText: async ()=>{} } },
    MarkdownString: class{appendMarkdown(s){}} , Hover: class{constructor(m){this.markdown=m}}
  });

  const extension = require('../src/extension');
  const context = { subscriptions: [] };
  try {
    await extension.activate(context);
    console.log('DEBUG activation:', { capturedProviderExists: !!capturedProvider, subscriptionsLength: context.subscriptions.length });
  } catch (e) {
    console.error('Activation error:', e && e.stack ? e.stack : e);
  } finally {
    mockRequire.stop('vscode');
  }
})();