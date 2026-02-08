const mockRequire = require('mock-require');
(async () => {
  console.log('Starting debug');
  const OpenAIMockNetwork = function () {
    return { chat: { completions: { create: async () => { throw new Error('network'); } } } };
  };
  mockRequire('openai', OpenAIMockNetwork);
  const openai = mockRequire.reRequire('../src/providers/openai');
  const model = 'm-net';
  try {
    await openai.preloadSystemRoleSupportForModel('k', '', model);
    const entry = openai.getSystemRoleCacheEntry(model, '');
    console.log('Entry after network failure:', entry);
  } catch (e) {
    console.error('Error during preload (network):', e);
  }

  mockRequire.stop('openai');

  const err = { error: { code: 'invalid_request_error', message: 'system role not supported' } };
  const OpenAIMockDeterministic = function () { return { chat: { completions: { create: async () => { throw err; } } } } };
  mockRequire('openai', OpenAIMockDeterministic);
  const openai2 = mockRequire.reRequire('../src/providers/openai');
  const model2 = 'm-deterministic';
  try {
    await openai2.preloadSystemRoleSupportForModel('k', '', model2);
    const entry2 = openai2.getSystemRoleCacheEntry(model2, '');
    console.log('Entry after determinative error:', entry2);
  } catch (e) {
    console.error('Error during preload (determinative):', e);
  }

  mockRequire.stop('openai');
})();
