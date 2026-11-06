export class LoggerService {
  info(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`[TC-GEN] ${message}`);
  }

  warn(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[TC-GEN] ${message}`);
  }

  error(message: string, err?: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[TC-GEN] ${message}`);
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
}
