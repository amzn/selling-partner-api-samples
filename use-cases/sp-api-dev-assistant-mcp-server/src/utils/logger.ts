import { createWriteStream, existsSync, mkdirSync, WriteStream } from "fs";
import { join } from "path";

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "ERROR" | "WARN" | "DEBUG";
  message: string;
  data: any;
  pid: number;
}

//This class is for local debugging and will NOT be released.
export class Logger {
  private logStream: WriteStream;
  private logPath: string;

  constructor(logFile: string = "dev-mcp.log") {
    const logsDir = join(process.cwd(), "logs");

    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    this.logPath = join(logsDir, logFile);
    this.logStream = createWriteStream(this.logPath, { flags: "a" });

    this.log("INFO", "Logger initialized", {
      logPath: this.logPath,
      cwd: process.cwd(),
    });
  }

  private log(
    level: LogEntry["level"],
    message: string,
    data: any = null,
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid,
    };

    const logLine = JSON.stringify(logEntry);
    this.logStream.write(logLine + "\n");
  }

  info(message: string, data?: any): void {
    this.log("INFO", message, data);
  }

  error(message: string, data?: any): void {
    this.log("ERROR", message, data);
  }

  warn(message: string, data?: any): void {
    this.log("WARN", message, data);
  }

  debug(message: string, data?: any): void {
    this.log("DEBUG", message, data);
  }
}

export const logger = new Logger();
