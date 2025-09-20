import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Logger {
  private enabled: boolean;
  private logFile: string;
  private logStream: fs.WriteStream | null = null;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `bot-${timestamp}.log`);

    if (this.enabled) {
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    }
  }

  private log(level: string, message: string): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;

    // Console output with colors
    switch (level) {
      case 'INFO':
        console.log('\x1b[36m%s\x1b[0m', logEntry); // Cyan
        break;
      case 'WARN':
        console.log('\x1b[33m%s\x1b[0m', logEntry); // Yellow
        break;
      case 'ERROR':
        console.log('\x1b[31m%s\x1b[0m', logEntry); // Red
        break;
      case 'SUCCESS':
        console.log('\x1b[32m%s\x1b[0m', logEntry); // Green
        break;
      default:
        console.log(logEntry);
    }

    // File output
    if (this.logStream) {
      this.logStream.write(logEntry + '\n');
    }
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warn(message: string): void {
    this.log('WARN', message);
  }

  error(message: string): void {
    this.log('ERROR', message);
  }

  success(message: string): void {
    this.log('SUCCESS', message);
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}