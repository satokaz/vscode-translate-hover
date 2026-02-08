const mockRequire = require('mock-require');
(async () => {
  try {
    // mock axios to return structured data
    const axiosStub = async (cfg) => ({
      data: {
        sentences: [{ trans: 'Hello' }, { trans: ' world' }],
        dict: [{ terms: ['A', 'B'] }]
      }
    });
    mockRequire('axios', axiosStub);
    const google = mockRequire.reRequire('../src/providers/google');
    const res = await google.translateWithGoogle('x', 'ja');
    console.log('debug res1:', res);
    require('fs').writeFileSync('debug-google-result.txt', String(res) + '\n', { flag: 'a' });
    mockRequire.stop('axios');

    // test abort handling
    const axiosStubAbort = (cfg) => new Promise((resolve, reject) => {
      const sig = cfg.signal;
      if (sig && sig.aborted) {
        return reject(new Error('aborted'));
      }
      const onAbort = () => reject(new Error('aborted'));
      sig?.addEventListener('abort', onAbort);
      setTimeout(() => resolve({ data: { sentences: [{ trans: 'x' }] } }), 50);
    });

    mockRequire('axios', axiosStubAbort);
    const google2 = mockRequire.reRequire('../src/providers/google');
    const ac = new AbortController();
    const p = google2.translateWithGoogle('x', 'ja', ac.signal);
    setTimeout(() => { ac.abort(); }, 10);
    const res2 = await p;
    console.log('debug res2:', res2);
    require('fs').writeFileSync('debug-google-result.txt', String(res2) + '\n', { flag: 'a' });
    mockRequire.stop('axios');
  } catch (e) {
    console.error('debug script error:', e && e.stack ? e.stack : e);
  }
})();