const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.createWriteStream('mocha-output.txt');
const err = fs.createWriteStream('mocha-error.txt');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['mocha', 'out/test/**/*.test.js', '--ui', 'tdd', '--require', 'out/test/setup.js', '--reporter', 'spec', '--timeout', '5000', '--exit'];

console.log('Spawning:', cmd, args.join(' '));
const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

p.stdout.pipe(out);
p.stderr.pipe(err);

p.on('close', code => {
  console.log('Mocha exit code', code);
  out.end(() => {
    const outText = fs.readFileSync('mocha-output.txt', 'utf-8');
    console.log('=== MOCHA STDOUT ===');
    console.log(outText);
    const errText = fs.readFileSync('mocha-error.txt', 'utf-8');
    if (errText) {
      console.log('=== MOCHA STDERR ===');
      console.log(errText);
    }
    process.exit(code);
  });
});