const Mocha = require('mocha');
const glob = require('glob');
const fs = require('fs');

async function run() {
  const mocha = new Mocha({ ui: 'tdd', timeout: 5000 });
  const files = glob.sync('out/test/**/*.test.js');
  console.log('Found test files:', files);
  files.forEach(f => mocha.addFile(f));

  // require test setup explicitly
  try {
    require('./../out/test/setup.js');
    console.log('Loaded test setup');
  } catch (e) {
    console.warn('Could not load test setup:', e && e.message);
  }

  const results = [];

  const runner = mocha.run()
    .on('test', (test) => console.log('START', test.fullTitle()))
    .on('pass', (test) => console.log('PASS', test.fullTitle()))
    .on('fail', (test, err) => {
      console.log('FAIL', test.fullTitle(), err && err.stack ? err.stack : String(err));
      results.push({ title: test.fullTitle(), err: err && err.stack ? err.stack : String(err) });
    })
    .on('end', function() {
      console.log('RUNNER end. failures:', this.failures);
      const out = { failures: results };
      fs.writeFileSync('mocha-details.json', JSON.stringify(out, null, 2));
      fs.writeFileSync('mocha-result-custom.json', JSON.stringify({ failures: this.failures }, null, 2));
      process.exit(this.failures ? 1 : 0);
    });
}

run().catch(err => { console.error(err); process.exit(2); });