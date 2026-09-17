'use strict';

const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12]
]);

function normalizeText(value) {
  return String(value || '').replace(/\r/g, '').split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}

function parseDateToken(token) {
  const value = String(token || '').trim();
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return validDate(year, Number(numeric[1]), Number(numeric[2]));
  }
  const named = value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS.get(named[1].toLowerCase());
    return month ? validDate(Number(named[3]), month, Number(named[2])) : '';
  }
  const compact = value.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);
  if (compact) {
    const year = compact[3].length === 2 ? 2000 + Number(compact[3]) : Number(compact[3]);
    return validDate(year, Number(compact[1]), Number(compact[2]));
  }
  return '';
}

function dateMatchesInLine(line, allowCompact = false) {
  const matches = [];
  for (const match of line.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g)) matches.push({ token: match[0], index: match.index });
  for (const match of line.matchAll(/\b[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4}\b/gi)) matches.push({ token: match[0], index: match.index });
  if (allowCompact || /(?:due|date|payment|statement|invoice|bill)/i.test(line)) {
    for (const match of line.matchAll(/\b\d{6,8}\b/g)) matches.push({ token: match[0], index: match.index });
  }
  return matches.map((match) => ({ ...match, date: parseDateToken(match.token) })).filter((match) => match.date);
}

function dateScore(line, index) {
  const lower = line.toLowerCase();
  const before = lower.slice(Math.max(0, index - 45), index);
  const dueLabel = /due\s*date|(?:total\s+)?(?:current\s+)?bill\s+due|(?:total\s+)?amount\s+due|balance\s+due|payment\s+due|due\s+by|pay(?:ment)?\s+by/;
  const priorPayment = /previous\s+payment|last\s+payment|prior\s+payment|payment\s+(?:received|posted|made)|paid\s+on/;
  let score = 0;
  if (dueLabel.test(before)) score += 1000;
  else if (dueLabel.test(lower)) score += 500;
  if (priorPayment.test(lower) && !dueLabel.test(before)) score -= 1000;
  if (/statement\s+date|invoice\s+date|bill\s+date|issue\s+date|service\s+period|billing\s+period/.test(lower)) score -= 250;
  return score;
}

function extractDate(lines) {
  const dueContextLines = lines.map((line, index) => ({ line, index })).filter(({ line }) => /due\s*date|(?:total\s+)?(?:current\s+)?bill\s+due|(?:total\s+)?amount\s+due|balance\s+due|payment\s+due|due\s+by|pay(?:ment)?\s+by/i.test(line));
  const candidates = lines.flatMap((line, lineIndex) => {
    const dueNearby = dueContextLines.some(({ index }) => lineIndex > index && lineIndex <= index + 2);
    return dateMatchesInLine(line, dueNearby).map((match) => ({ ...match, line, lineIndex, score: dateScore(line, match.index) }));
  });
  for (const { index } of dueContextLines) {
    const nearby = candidates.filter((candidate) => candidate.lineIndex >= index && candidate.lineIndex <= index + 2 && candidate.score >= 500).sort((a, b) => a.lineIndex - b.lineIndex || a.index - b.index);
    if (nearby[0]) return nearby[0].date;
  }
  const usable = candidates.filter((candidate) => candidate.score > -500);
  return usable.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex || a.index - b.index)[0]?.date || '';
}

function amountsIn(line) {
  return [...line.matchAll(/(?:\$\s*)?\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/g)].map((match) => Math.round(Number(match[0].replace(/[$,\s]/g, '')) * 100)).filter((amount) => Number.isInteger(amount) && amount > 0);
}

function extractAmount(lines) {
  const labeled = lines.flatMap((line, lineIndex) => amountsIn(line).map((amount) => {
    const lower = line.toLowerCase();
    let score = 0;
    if (/total\s+(?:current\s+)?bill\s+due|total\s+amount\s+due|grand\s+total/.test(lower)) score += 500;
    else if (/amount\s+due|balance\s+due|payment\s+due|due\s+today/.test(lower)) score += 300;
    if (/previous\s+amount\s+due|previous\s+payment|thank\s+you\s+for\s+your\s+payment|paid\s+on/.test(lower)) score -= 500;
    if (/tax|adjustment|subtotal/.test(lower)) score -= 100;
    return { amount, score, lineIndex };
  })).filter((candidate) => candidate.score > 0);
  if (labeled.length) return labeled.sort((a, b) => b.score - a.score || b.lineIndex - a.lineIndex || b.amount - a.amount)[0].amount;
  const candidates = lines.flatMap(amountsIn);
  return candidates.length ? Math.max(...candidates) : 0;
}

function normalizedName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const COMPANY_STOP_WORDS = new Set(['and', 'at', 'co', 'company', 'corp', 'corporation', 'inc', 'incorporated', 'llc', 'limited', 'the']);
const VENDOR_NOISE = /^(?:account|address|amount|balance|bill|billing|customer|date|description|due|invoice|number|page|payment|phone|previous|receipt|remit|service|statement|subtotal|tax|thank|total|www)$/i;

function meaningfulNameTokens(value) {
  return normalizedName(value).split(' ').filter((token) => token.length > 1 && !COMPANY_STOP_WORDS.has(token));
}

function nameTokenMatches(expected, actual) {
  if (expected === actual) return true;
  if (expected.length >= 5 && actual.length >= 5 && (expected.startsWith(actual.slice(0, 4)) || actual.startsWith(expected.slice(0, 4)))) return true;
  if (expected.length >= 4 && actual.length >= 4) {
    let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
    for (let row = 1; row <= expected.length; row += 1) {
      const current = [row];
      for (let column = 1; column <= actual.length; column += 1) current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (expected[row - 1] === actual[column - 1] ? 0 : 1));
      previous = current;
    }
    if (previous[actual.length] <= 1) return true;
  }
  return false;
}

function companyAppearsInLine(companyName, line) {
  const expected = meaningfulNameTokens(companyName);
  const actual = meaningfulNameTokens(line);
  if (!expected.length || !actual.length) return false;
  if (normalizedName(line).includes(normalizedName(companyName))) return true;
  const matches = expected.filter((token) => actual.some((candidate) => nameTokenMatches(token, candidate))).length;
  return matches === expected.length || (expected.length >= 2 && matches >= 2);
}

function extractVendor(lines, companies = []) {
  const companyMatch = companies.find((company) => {
    return lines.some((line) => companyAppearsInLine(company.name, line));
  });
  if (companyMatch) return { vendor: companyMatch.name, companyId: companyMatch.id };
  // Unknown OCR text is deliberately not promoted into a company suggestion.
  // A bad suggestion is more harmful than leaving the field for the user.
  return { vendor: '', companyId: '' };
}

function extractCompanyAddress(lines) {
  const addressLine = lines.find((line) => /P[.\s]*[O0][.\s]*BOX\s+\d+/i.test(line) && /\b[A-Za-z]{2}\s+\d{5}(?:-\d{4})?\b/.test(line));
  if (!addressLine) return null;
  const match = addressLine.match(/(P[.\s]*[O0][.\s]*BOX\s+\d+)\s*,?\s*([A-Za-z .'-]+?)\s*,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)/i);
  if (!match) return null;
  return { mailingAddress1: match[1].replace(/^P[.\s]*[O0][.\s]*BOX/i, 'P.O. BOX').replace(/\s+/g, ' ').trim(), mailingAddress2: '', mailingCity: match[2].trim(), mailingState: match[3].toUpperCase(), mailingPostalCode: match[4] };
}

function extractCategoryId(lines, categories = []) {
  const text = lines.join(' ').toLowerCase();
  const hints = [
    [/electric|power|water|gas|utility|internet|wifi|mobile|phone|telecom/, ['utility', 'utilities', 'internet', 'phone']],
    [/insurance/, ['insurance']],
    [/software|subscription|app\b/, ['software', 'subscription']],
    [/advertis|marketing/, ['advertising']],
    [/bank|finance|fee|interest/, ['banking', 'financial']],
    [/office|stationery|printer|paper/, ['office']],
    [/travel|hotel|airline|fuel|gas station|mileage/, ['travel', 'vehicle']]
  ];
  for (const [pattern, names] of hints) {
    if (!pattern.test(text)) continue;
    const category = categories.find((item) => names.some((name) => normalizedName(item.name).includes(name)));
    if (category) return category.id;
  }
  return '';
}

function extractBillFields(text, store = {}) {
  const lines = normalizeText(text);
  const { vendor, companyId } = extractVendor(lines, store.companies || []);
  return {
    date: extractDate(lines),
    companyId,
    vendor,
    categoryId: extractCategoryId(lines, store.categories || []),
    description: '',
    amountCents: extractAmount(lines),
    companyAddress: extractCompanyAddress(lines),
    text: lines.join('\n')
  };
}

module.exports = { extractBillFields };
