// Error impact scoring.
//
// Reads test-results/SkypadLogs-Error-report_TC.json and adds a `severity` to every error,
// based on how often the error occurred (`totalErrorOccurrences`):
//
//   Occurrences   Base severity
//   100 or more   Critical
//   25 to 99      High
//   5 to 24       Medium
//   1 to 4        Low
//
// Usage: node scripts/Error_Impact_Scoring.js [path-to-_TC.json]
// Run it AFTER scripts/generate-bug-tc-input.js (which rewrites the _TC.json from scratch).

const fs = require('fs');
const path = require('path');

const SEVERITY_BANDS = [
  { min: 100, severity: 'Critical' },
  { min: 25, severity: 'High' },
  { min: 5, severity: 'Medium' },
  { min: 1, severity: 'Low' },
];

function baseSeverity(occurrences) {
  const n = Number(occurrences);
  if (!Number.isFinite(n) || n < 1) return null;
  return SEVERITY_BANDS.find((b) => n >= b.min).severity;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repoRoot, 'test-results', 'SkypadLogs-Error-report_TC.json');

  if (!fs.existsSync(filePath)) throw new Error(`Cannot find file: ${filePath}`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const errors = Array.isArray(data) ? data : data.errors;
  if (!Array.isArray(errors)) throw new Error('Unsupported JSON structure: expected array root or {errors:[...]}');

  const scored = errors.map((err) => {
    const severity = baseSeverity(err.totalErrorOccurrences);
    const out = {};
    for (const [k, v] of Object.entries(err)) {
      if (k === 'severity') continue; // re-scored below, keeps the script idempotent
      out[k] = v;
      if (k === 'totalErrorOccurrences' && severity) out.severity = severity;
    }
    if (severity && !('severity' in out)) out.severity = severity;
    return out;
  });

  const result = Array.isArray(data) ? scored : { ...data, errors: scored };
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');

  for (const e of scored) {
    process.stdout.write(`${e.id}\t${e.totalErrorOccurrences}\t${e.severity ?? 'n/a'}\n`);
  }
}

module.exports = { baseSeverity };

// Also usable as a standalone CLI; generate-bug-tc-input.js imports baseSeverity instead.
if (require.main === module) main();
