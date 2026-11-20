// Generates ONLY TC-Input/BugtoTC_Input_<ddmmyyhhmmss>.md
// (no _TC.json, no error_Info details file are written or modified).
//
// Input : test-results/SkypadLogs-Error-report.json   (from `npm run SkypadLogs:errors`)
// Output: TC-Input/BugtoTC_Input_<ts>.md
//
// Usage : node scripts/generate-bug-tc-md-only.js [path/to/report.json]
//
// The "JSON Reference" link in each section points to the matching entry in
// test-results/SkypadLogs-Error-report_TC.json. That file is only READ (if it exists) to find
// the line of each "relatedCorrelationIds"; if it's missing the link has no #L anchor.
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.resolve(process.argv[2] || path.join(repoRoot, 'test-results', 'SkypadLogs-Error-report.json'));
const tcJsonRel = 'test-results/SkypadLogs-Error-report_TC.json';
const tcJsonAbs = path.join(repoRoot, ...tcJsonRel.split('/'));

function timestampDDMMYYHHMMSS(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function getBugs(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.bugs)) return data.bugs;
  if (data && Array.isArray(data.errors)) return data.errors;
  throw new Error('Unsupported JSON structure: expected array root, or {bugs:[...]}, or {errors:[...]}');
}

// Line numbers (1-based) of each "relatedCorrelationIds" in the existing _TC.json, if any.
function readTcLineNumbers() {
  if (!fs.existsSync(tcJsonAbs)) return [];
  const lines = [];
  fs.readFileSync(tcJsonAbs, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (/^\s*"relatedCorrelationIds":/.test(line)) lines.push(i + 1);
    });
  return lines;
}

function main() {
  if (!fs.existsSync(inputPath)) throw new Error(`Cannot find input report at: ${inputPath}`);

  const bugs = getBugs(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
  const tcLines = readTcLineNumbers();
  if (tcLines.length && tcLines.length !== bugs.length) {
    console.warn(`WARNING: _TC.json has ${tcLines.length} entries but report has ${bugs.length}; JSON links may be off.`);
  }

  const sections = bugs.map((bug, idx) => {
    const bugId = `EY-${String(idx + 1).padStart(3, '0')}`;
    const title = String(bug.Cluster ?? bug.bugTitle ?? '');
    const cids = Array.isArray(bug.correlationIds) ? bug.correlationIds : [];
    const anchor = tcLines[idx] ? `#L${tcLines[idx]}` : '';
    return (
      `# ${bugId} - ${title}\n\n` +
      `<a id="${bugId}-CIDS"></a>\n\n` +
      `**JSON Reference**\n\n` +
      `[Open JSON Entry](../${tcJsonRel}${anchor})\n\n` +
      `## Correlation IDs\n\n` +
      (cids.length ? `${cids.map((c) => `- ${c}`).join('\n')}\n` : `No correlation IDs available.\n`) +
      `\n---\n`
    );
  });

  const outPath = path.join(repoRoot, 'TC-Input', `BugtoTC_Input_${timestampDDMMYYHHMMSS()}.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sections.join('\n'), 'utf8');

  console.log(`markdown=${outPath}\nbugsProcessed=${bugs.length}`);
}

main();
