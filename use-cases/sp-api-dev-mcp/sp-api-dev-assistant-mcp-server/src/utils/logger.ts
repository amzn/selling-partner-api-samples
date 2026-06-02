export interface LogEntry {
  timestamp: string;
  level: "INFO" | "ERROR" | "WARN" | "DEBUG";
  message: string;
  data: any;
  pid: number;
}

export class Logger {
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
    process.stderr.write(logLine + "\n");
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
