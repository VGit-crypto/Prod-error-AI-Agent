import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

export class MarkdownWriter {
  async writeNewFile(outputDir: string, fileName: string, content: string): Promise<string> {
    const resolvedDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.resolve(process.cwd(), outputDir);

    await mkdir(resolvedDir, { recursive: true });

    const fullPath = path.join(resolvedDir, fileName);

    if (await this.exists(fullPath)) {
      throw new Error(`Refusing to overwrite existing file: ${fullPath}`);
    }

    await writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
