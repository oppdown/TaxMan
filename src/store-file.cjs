'use strict';

const fs = require('node:fs/promises');

async function readValidatedStore(filePath, normalizeStore, validateStore) {
  const raw = await fs.readFile(filePath, 'utf8');
  const store = normalizeStore(JSON.parse(raw));
  const errors = validateStore(store);
  if (errors.length) throw new Error(errors.join('\n'));
  return store;
}

async function loadStoreFromFiles({ currentPath, fallbackPaths, normalizeStore, validateStore, migrate }) {
  try {
    return await readValidatedStore(currentPath, normalizeStore, validateStore);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  for (const fallbackPath of fallbackPaths) {
    try {
      const store = await readValidatedStore(fallbackPath, normalizeStore, validateStore);
      if (migrate) await migrate(store, fallbackPath);
      return store;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return null;
}

module.exports = { loadStoreFromFiles };
