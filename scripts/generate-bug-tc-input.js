const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { baseSeverity } = require('./Error_Impact_Scoring');

function timestampDDMMYYHHMMSS(date = new Date()) {
  const pad2 = (n) => String(n).padStart(2, '0');
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yy = String(date.getFullYear()).slice(-2);
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${dd}${mm}${yy}${hh}${min}${ss}`;
}

function getBugsContainer(data) {
  if (Array.isArray(data)) return { container: data, set: (v) => v };
  if (data && Array.isArray(data.bugs)) return { container: data.bugs, set: (v) => ({ ...data, bugs: v }) };
  if (data && Array.isArray(data.errors)) return { container: data.errors, set: (v) => ({ ...data, errors: v }) };
  throw new Error('Unsupported JSON structure: expected array root, or {bugs:[...]}, or {errors:[...]}');
}

// Load SkypadLogs.json tolerantly (JSON array, else one object per line with optional leading comma).
function loadLogRecords(logPath) {
  const raw = fs.readFileSync(logPath, 'utf8').trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to line-by-line
  }
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    let t = line.trim();
    if (t.startsWith(',')) t = t.slice(1).trim();
    if (!t.startsWith('{') || !t.endsWith('}')) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // ignore invalid lines
    }
  }
  return out;
}

// Total occurrences of an error = every log record with level "error" and the same
// context + url (correlation ids are ignored, repeated ids still count).
// Mirrors the grouping in analyze-skypad-errors.ts, so the counts across all errors
// add up to totals.errorOccurrences in SkypadLogs-Error-report.json.
// Returns { count(bug), records(bug) } where records = [{ correlationId, message }] per occurrence.
function buildOccurrenceIndex(logPath) {
  const groups = new Map();
  if (!logPath || !fs.existsSync(logPath)) return { count: () => null, records: () => [] };
  const keyOf = (context, url, errorText) =>
    context && url ? `${context}|||${url}` : `${context}|||${url}|||${errorText}`;
  for (const rec of loadLogRecords(logPath)) {
    if (!rec || String(rec.level ?? '').toLowerCase() !== 'error') continue;
    const context = String(rec.context ?? '').trim();
    const url = String(rec.http?.url ?? '').trim();
    const errorText = String(rec.error ?? '').trim() || String(rec.message ?? '').trim() || '[unknown error]';
    const key = keyOf(context, url, errorText);
    const list = groups.get(key) ?? [];
    list.push({
      correlationId: String(rec.correlationId || rec['x-correlation-id'] || '').trim(),
      message: String(rec.message ?? '').replace(/\s+/g, ' ').trim(),
    });
    groups.set(key, list);
  }
  const lookup = (bug) =>
    groups.get(
      keyOf(
        String(bug.context ?? '').trim(),
        String(bug.url ?? '').trim(),
        String(bug.error ?? '').trim() || String(bug.message ?? '').trim() || '[unknown error]',
      ),
    ) ?? [];
  return { count: (bug) => lookup(bug).length, records: lookup };
}

// Rule matching against logs-failure-categories.json: categories are tried in order and the
// FIRST category with a matching regex wins (case-insensitive, against message + error text).
function buildCategoryMatcher(kbPath) {
  if (!kbPath || !fs.existsSync(kbPath)) return () => null;
  const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
  const rules = (kb.categories ?? []).map((c) => ({
    group: c.group ?? c.id,
    regexes: (c.match?.anyRegex ?? []).map((r) => new RegExp(r, 'i')),
  }));
  return (bug) => {
    const haystack = `${bug.message ?? ''}\n${bug.error ?? ''}`;
    for (const rule of rules) {
      if (rule.regexes.some((re) => re.test(haystack))) return rule.group;
    }
    return 'Uncategorized';
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');

  // Input file produced by `npm run SkypadLogs:errors`.
  // Repo-root SkypadLogs-Error-report.json should NOT be created/used.
  const inputPath = path.join(repoRoot, 'test-results', 'SkypadLogs-Error-report.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Cannot find SkypadLogs-Error-report.json at: ${inputPath}`);
  }

  const ts = timestampDDMMYYHHMMSS(new Date());
  const mdRelPath = path.posix.join('TC-Input', `BugtoTC_Input_${ts}.md`);
  const mdAbsPath = path.join(repoRoot, ...mdRelPath.split('/'));

  const outDirAbs = path.dirname(mdAbsPath);
  fs.mkdirSync(outDirAbs, { recursive: true });

  const raw = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(raw);
  // Deep copy: all _TC.json transformations operate on this copy only.
  const { container: bugs, set } = getBugsContainer(structuredClone(data));
  // Build the .md with a placeholder for the _TC.json line number (digits don't change line count),
  // then locate each "## Correlation IDs" line so the _TC.json can link straight to it.
  const mdSections = bugs.map((bug, idx) => {
    const bugId = `EY-${String(idx + 1).padStart(3, '0')}`;
    const bugTitle = String(bug.Cluster ?? bug.bugTitle ?? '');
    const cids = Array.isArray(bug.correlationIds) ? bug.correlationIds : [];
    return (
      `# ${bugId} - ${bugTitle}\n\n` +
      `<a id="${bugId}-CIDS"></a>\n\n` +
      `**JSON Reference**\n\n` +
      `[Open JSON Entry](../test-results/SkypadLogs-Error-report_TC.json#L@@TCLINE@@)\n\n` +
      `## Correlation IDs\n\n` +
      (cids.length ? `${cids.map((c) => `- ${c}`).join('\n')}\n` : `No correlation IDs available.\n`) +
      `\n---\n`
    );
  });
  const mdTemplate = mdSections.join('\n');
  const mdCidLineNos = [];
  mdTemplate.split('\n').forEach((line, i) => {
    if (line === '## Correlation IDs') mdCidLineNos.push(i + 1);
  });
  if (mdCidLineNos.length !== bugs.length) {
    throw new Error(`Expected ${bugs.length} Correlation IDs headings, found ${mdCidLineNos.length}`);
  }
  // file:// URI so VS Code makes it Ctrl+Click-able from JSON (plain relative paths are not linkified).
  const mdFileUri = pathToFileURL(mdAbsPath).href;

  // ---- Linked _TC.json (built from the ORIGINAL data, before the in-place rewrite below) ----
  const tcRelPath = 'test-results/SkypadLogs-Error-report_TC.json';
  const tcAbsPath = path.join(repoRoot, ...tcRelPath.split('/'));
  const occurrenceIndex = buildOccurrenceIndex(data?.source?.logPath);
  const countOccurrences = occurrenceIndex.count;
  const matchCategory = buildCategoryMatcher(data?.source?.kbPath);

  // ---- Error details .md (test-results/error_Info/error_details_<ts>.md) ----
  // One section per error: cluster, totalErrorOccurrences, then "correlationId : message" per occurrence.
  const detailsRelPath = path.posix.join('test-results', 'error_Info', `error_details_${ts}.md`);
  const detailsAbsPath = path.join(repoRoot, ...detailsRelPath.split('/'));
  fs.mkdirSync(path.dirname(detailsAbsPath), { recursive: true });
  const detailsSections = bugs.map((bug, idx) => {
    const bugId = `EY-${String(idx + 1).padStart(3, '0')}`;
    const cluster = String(bug.Cluster ?? bug.bugTitle ?? '');
    const recs = occurrenceIndex.records(bug);
    return (
      `# ${bugId}\n\n` +
      `**Cluster:** ${cluster}\n\n` +
      `**Context:** ${String(bug.context ?? '')}\n\n` +
      `**URL:** ${String(bug.url ?? '')}\n\n` +
      `**totalErrorOccurrences:** ${recs.length}\n\n` +
      `## Correlation IDs and error messages\n\n` +
      (recs.length
        ? `${recs.map((r, i) => `${i + 1}. ${r.correlationId || '(no correlationId)'} : ${r.message}`).join('\n')}\n`
        : `No occurrences found.\n`) +
      `\n---\n`
    );
  });
  const detailsMd = detailsSections.join('\n');
  const detailsLineNos = [];
  detailsMd.split('\n').forEach((line, i) => {
    if (line.startsWith('# EY-')) detailsLineNos.push(i + 1);
  });
  // NOTE: written to disk further below, AFTER SkypadLogs-Error-report_TC.json is final.
  const detailsFileUri = pathToFileURL(detailsAbsPath).href;

  const tcEntries = bugs.map((bug, idx) => {
    const bugId = `EY-${String(idx + 1).padStart(3, '0')}`;
    const link = `${mdFileUri}#L${mdCidLineNos[idx]}`;
    const entry = { id: bugId };
    let placed = false;
    for (const [k, v] of Object.entries(bug)) {
      if (
        k === 'correlationIds' || k === 'bugId' || k === 'relatedCIDs' ||
        k === 'totalErrorOccurrences' || k === 'totalErrorOccurrencesDetails' || k === 'category_id' ||
        k === 'severity'
      ) continue;
      if ((k === 'Cluster' || k === 'bugTitle') && !placed) {
        entry.relatedCorrelationIds = link;
        placed = true;
      }
      entry[k] = v;
      if (k === 'level') {
        const total = countOccurrences(bug);
        if (total !== null) {
          entry.totalErrorOccurrences = total;
          // Impact scoring (see Error_Impact_Scoring.js): severity from occurrence count.
          const severity = baseSeverity(total);
          if (severity) entry.severity = severity;
          // file:// URI -> Ctrl+Click in VS Code opens the details .md at this error's section.
          entry.totalErrorOccurrencesDetails = `${detailsFileUri}#L${detailsLineNos[idx]}`;
        }
        const categoryId = matchCategory(bug);
        if (categoryId !== null) entry.category_id = categoryId;
      }
      if (k === 'url' && !placed) {
        entry.relatedCorrelationIds = link;
        placed = true;
      }
    }
    if (!placed) entry.relatedCorrelationIds = link;
    return entry;
  });
  const occurrenceSum = tcEntries.reduce((s, e) => s + (e.totalErrorOccurrences ?? 0), 0);
  const expectedTotal = data?.totals?.errorOccurrences;
  if (typeof expectedTotal === 'number' && occurrenceSum !== expectedTotal) {
    console.warn(`WARNING: sum of totalErrorOccurrences (${occurrenceSum}) != totals.errorOccurrences (${expectedTotal})`);
  }
  let tcData = set(tcEntries);
  if (tcData && !Array.isArray(tcData)) {
    delete tcData.totals;
    // Top-level (outside "errors"), placed right before the errors list.
    const { errors, ...rest } = tcData;
    tcData = { ...rest, sumOfTotalErrorOccurrences: occurrenceSum, ...(errors ? { errors } : {}) };
  }
  fs.writeFileSync(tcAbsPath, JSON.stringify(tcData, null, 2), 'utf8');

  // Read back to find the line of each relatedCorrelationIds entry.
  const tcLineNos = [];
  fs.readFileSync(tcAbsPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (/^\s*"relatedCorrelationIds":/.test(line)) tcLineNos.push(i + 1);
    });
  if (tcLineNos.length !== bugs.length) {
    throw new Error(`Expected ${bugs.length} relatedCorrelationIds lines, found ${tcLineNos.length}`);
  }

  let tcIdx = 0;
  fs.writeFileSync(mdAbsPath, mdTemplate.replace(/@@TCLINE@@/g, () => String(tcLineNos[tcIdx++])), 'utf8');

  // error_Info details .md is created last, after the _TC.json (and its severity/links) is complete.
  fs.writeFileSync(detailsAbsPath, detailsMd, 'utf8');

  // NOTE: SkypadLogs-Error-report.json is intentionally NOT rewritten here.

  // Cleanup legacy repo-root file if it exists (should not be created going forward).
  const legacyRoot = path.join(repoRoot, 'SkypadLogs-Error-report.json');
  if (fs.existsSync(legacyRoot)) {
    try {
      fs.unlinkSync(legacyRoot);
    } catch {
      // ignore
    }
  }

  process.stdout.write(
    [
      `timestamp=${ts}`,
      `markdown=${mdAbsPath}`,
      `tcJson=${tcAbsPath}`,
      `errorDetails=${detailsAbsPath}`,
      `bugsProcessed=${bugs.length}`,
    ].join('\n') + '\n',
  );
}

main();
