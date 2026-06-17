const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

let currentVersion = packageJson.version;

// Parse version: m.n.p (ignore any pre-release tags)
const parts = currentVersion.split('-')[0].split('.');
if (parts.length !== 3) {
  // If no valid format is found, fallback to 0.0.1
  currentVersion = '0.0.0';
  parts[0] = '0';
  parts[1] = '0';
  parts[2] = '0';
}

let m = parseInt(parts[0], 10);
let n = parseInt(parts[1], 10);
let p = parseInt(parts[2], 10);

if (isNaN(m)) m = 0;
if (isNaN(n)) n = 0;
if (isNaN(p)) p = 0;

// Increment logic
p += 1;

if (p > 9) {
  p = 0;
  n += 1;
}

if (n > 9) {
  n = 0;
  m += 1;
}

const newVersion = `${m}.${n}.${p}`;
packageJson.version = newVersion;

// Add build time
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const hh = String(now.getHours()).padStart(2, '0');
const mins = String(now.getMinutes()).padStart(2, '0');
const buildTime = `build ${yyyy}-${mm}-${dd}-${hh}${mins}`;
packageJson.buildTime = buildTime;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

console.log(`Bumped version from ${currentVersion} to ${newVersion} (${buildTime})`);
