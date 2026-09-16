'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'mobile-dist');

async function main() {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(path.join(output, 'assets'), { recursive: true });
  for (const file of ['index.html', 'renderer.js', 'styles.css', 'web-bridge.js', 'manifest.webmanifest', 'service-worker.js']) await fs.copyFile(path.join(root, 'src', file), path.join(output, file));
  await fs.copyFile(path.join(root, 'src', 'assets', 'taxman-icon.png'), path.join(output, 'assets', 'taxman-icon.png'));
  await fs.copyFile(path.join(root, 'src', 'assets', 'jsQR.js'), path.join(output, 'assets', 'jsQR.js'));
  console.log(`Prepared mobile web build at ${output}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
