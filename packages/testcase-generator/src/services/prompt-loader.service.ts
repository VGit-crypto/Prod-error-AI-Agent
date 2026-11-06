import { readFile } from 'node:fs/promises';
import path from 'node:path';

export class PromptLoaderService {
  async loadPromptTemplate(templatePath: string): Promise<string> {
    const resolved = path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(process.cwd(), templatePath);

    return readFile(resolved, 'utf-8');
  }
}
