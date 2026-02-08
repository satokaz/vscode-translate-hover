const { HoverOrchestrator } = require('../src/hover/orchestrator');
(async () => {
  const fakeTranslate = async (s) => {
    console.log('fakeTranslate called for', s);
    await new Promise(r => setTimeout(r, 20));
    return `t:${s}`;
  };

  const orchestrator = new HoverOrchestrator({
    getConfig: () => ({ translationMethod: 'google', targetLanguage: 'en', openaiModel: '', openaiApiKey: '', openaiBaseUrl: '', reasoningEffort: '', languageDetectionMethod: 'regex', enableDebugLogging: false }),
    translateText: fakeTranslate,
    createHover: (text, isCached) => ({ markdown: { content: text } }),
    logger: { debug: (...a) => console.log('[DEBUG]', ...a) }
  });

  const doc1 = { getText: (_)=> 'one', getWordRangeAtPosition: ()=> null };
  const doc2 = { getText: (_)=> 'two', getWordRangeAtPosition: ()=> null };
  const position = {};
  const token = { isCancellationRequested: false, onCancellationRequested: ()=> ({ dispose() {} }) };

  const p1 = orchestrator.provideHover(doc1, position, token);
  await new Promise(r=> setTimeout(r,5));
  const p2 = orchestrator.provideHover(doc2, position, token);

  const [r1, r2] = await Promise.all([p1,p2]);
  console.log('r1', r1);
  console.log('r2', r2);
})();