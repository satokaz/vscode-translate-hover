const fs = require('fs');
const path = require('path');

const artifactsDir = path.join(__dirname, '..', 'test', 'mocha-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const files = [
  'mocha-output.txt',
  'mocha-error.txt',
  'mocha-details.json',
  'mocha-result-custom.json',
  'mocha-result.json'
];

files.forEach(f => {
  const src = path.join(__dirname, '..', f);
  const dst = path.join(artifactsDir, f);
  if (fs.existsSync(src)) {
    try {
      fs.renameSync(src, dst);
      console.log(`Moved ${f} -> ${dst}`);
    } catch (err) {
      console.error(`Failed to move ${f}:`, err);
    }
  }
});

console.log('Done.');