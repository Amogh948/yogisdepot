import { env } from "../config/env";

type LogLevel = "info" | "warn" | "error" | "debug";

function serialize(extra?: unknown): string {
  if (extra === undefined) {
    return "";
  }
  if (extra instanceof Error) {
    return ` ${extra.message}`;
  }
  if (typeof extra === "string") {
    return ` ${extra}`;
  }
  try {
    return ` ${JSON.stringify(extra)}`;
  } catch {
    return ` ${String(extra)}`;
  }
}

function write(level: LogLevel, message: string, extra?: unknown): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${serialize(extra)}`;

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (env.NODE_ENV === "test" && level === "debug") {
    return;
  }
  console.log(line);
}

export const logger = {
  info: (message: string, extra?: unknown) => write("info", message, extra),
  warn: (message: string, extra?: unknown) => write("warn", message, extra),
  error: (message: string, extra?: unknown) => write("error", message, extra),
  debug: (message: string, extra?: unknown) => write("debug", message, extra),
};
