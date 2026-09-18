'use strict';

const UPDATE_CODES = Object.freeze({
  missingConfig: 'TAXMAN-UPDATE-001',
  unreadableConfig: 'TAXMAN-UPDATE-002',
  network: 'TAXMAN-UPDATE-003',
  invalidFeed: 'TAXMAN-UPDATE-004',
  unknown: 'TAXMAN-UPDATE-099'
});

function describeUpdateError(error, fallback = 'TaxMan could not check for updates.') {
  const rawCode = typeof error?.code === 'string' ? error.code : '';
  const rawMessage = String(error?.message || '');
  const lowerMessage = rawMessage.toLowerCase();
  let code = UPDATE_CODES.unknown;
  let message = fallback;

  if (rawCode === 'ENOENT' && /app-update\.yml/i.test(rawMessage)) {
    code = UPDATE_CODES.missingConfig;
    message = 'TaxMan could not find its update configuration. Reinstall the latest Windows version, then try Help > Check for Updates again.';
  } else if (rawCode === 'EACCES' && /app-update\.yml/i.test(rawMessage)) {
    code = UPDATE_CODES.unreadableConfig;
    message = 'TaxMan could not read its update configuration because access was denied. Close TaxMan and run the latest installer again.';
  } else if (rawCode === 'ERR_UPDATER_INVALID_RELEASE_FEED' || /invalid (?:update )?feed|release feed/i.test(lowerMessage)) {
    code = UPDATE_CODES.invalidFeed;
    message = 'TaxMan received invalid update information. Please try again later or install the latest version manually.';
  } else if (rawCode === 'ERR_NETWORK' || rawCode === 'ECONNRESET' || rawCode === 'ETIMEDOUT' || /network|internet|connect|socket|enotfound|econnrefused|timed out/i.test(lowerMessage)) {
    code = UPDATE_CODES.network;
    message = 'TaxMan could not reach the update service. Check your internet connection and try again.';
  }

  return { code, message: `${message} (${code})`, rawCode, rawMessage };
}

module.exports = { UPDATE_CODES, describeUpdateError };
