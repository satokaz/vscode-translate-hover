const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const artifactsDir = path.join(__dirname, '..', 'test', 'mocha-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['mocha', 'out/test/**/*.test.js', '--ui', 'tdd', '--require', 'out/test/setup.js', '--reporter', 'json', '--timeout', '5000', '--exit'];

console.log('Spawning:', cmd, args.join(' '));

const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';

p.stdout.on('data', chunk => { stdout += String(chunk); });
p.stderr.on('data', chunk => { stderr += String(chunk); });

p.on('close', code => {
  console.log('Mocha exit code', code);

  // try to parse JSON output from reporter
  try {
    let parsed;
    // Try parsing whole stdout, but tolerate extra logs before JSON.
    let lastErr = null;
    // 1) quick try: whole stdout
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      lastErr = err;
      // 2) brute-force: find a JSON object starting at any '{' and attempt to parse
      const firstBraceIndexes = [];
      for (let i = 0; i < stdout.length; i++) if (stdout[i] === '{') firstBraceIndexes.push(i);
      for (const idx of firstBraceIndexes) {
        try {
          const s = stdout.slice(idx);
          parsed = JSON.parse(s);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!parsed && lastErr) throw lastErr;
    }

    // parsed has tests/passes/failures arrays etc depending on reporter
    fs.writeFileSync(path.join(artifactsDir, 'mocha-details.json'), JSON.stringify(parsed, null, 2));
    fs.writeFileSync(path.join(artifactsDir, 'mocha-result-custom.json'), JSON.stringify({ failures: parsed.failures ? parsed.failures.length : (parsed.stats ? parsed.stats.failures : 0) }, null, 2));
  } catch (err) {
    console.warn('Could not parse mocha json output:', err && err.message);
    fs.writeFileSync(path.join(artifactsDir, 'mocha-output.txt'), stdout);
    fs.writeFileSync(path.join(artifactsDir, 'mocha-error.txt'), stderr);
    fs.writeFileSync(path.join(artifactsDir, 'mocha-result-custom.json'), JSON.stringify({ failures: 1 }, null, 2));
  }

  process.exit(code);
});