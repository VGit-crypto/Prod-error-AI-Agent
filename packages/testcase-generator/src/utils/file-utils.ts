import { readdir, stat, access, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listMarkdownFilesNewestFirst(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const mdFiles = entries
    .filter(f => f.toLowerCase().endsWith('.md'))
    .map(f => path.join(dir, f));

  const withTimes = await Promise.all(
    mdFiles.map(async p => {
      const s = await stat(p);
      return { p, t: s.mtimeMs };
    })
  );

  return withTimes
    .sort((a, b) => b.t - a.t)
    .map(x => x.p);
}
