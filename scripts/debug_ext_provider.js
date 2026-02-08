const mockRequire = require('mock-require');
(async () => {
  // mock vscode
  mockRequire('vscode', {
    workspace: { getConfiguration: () => ({ get: (_)=> undefined }), onDidChangeConfiguration: ()=> ({ dispose() {} }) },
    languages: { registerHoverProvider: (_selector, provider) => { console.log('registerHoverProvider called'); return { dispose() {} } } },
    window: { activeTextEditor: { selection: { start: 0, end: 1 }}, showInformationMessage: ()=> undefined },
    commands: { registerCommand: ()=>({ dispose() {} }) },
    env: { clipboard: { readText: async ()=> '', writeText: async ()=> {} } },
    MarkdownString: class { constructor(){ this.isTrusted=true; this.supportHtml=true; this.content=''; } appendMarkdown(s){ this.content += s } },
    Hover: class { constructor(m){ this.markdown = m } }
  });
  mockRequire('../src/providers/google', { translateWithGoogle: async ()=> 'QUICK' });
  const ext = mockRequire.reRequire('../src/extension');
  const context = { subscriptions: [] };
  await ext.activate(context);
  console.log('ext.__testHoverProvider exists?', !!ext.__testHoverProvider);
  // call provideHover
  const res = await ext.__testHoverProvider.provideHover({ getText: ()=> 'hello', getWordRangeAtPosition: ()=> null }, {}, { isCancellationRequested: false, onCancellationRequested: ()=>({ dispose() {} }) });
  console.log('provideHover returned', res);
  mockRequire.stop('vscode');
  mockRequire.stop('../src/providers/google');
})();