'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
const versionParts = packageJson.version.split('.').map((part) => Number.parseInt(part, 10) || 0);
const versionCode = versionParts[0] * 10000 + versionParts[1] * 100 + versionParts[2];
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]+"/, `versionName "${packageJson.version}"`);
fs.writeFileSync(gradlePath, gradle, 'utf8');
console.log(`Configured Android version ${packageJson.version} (${versionCode})`);
