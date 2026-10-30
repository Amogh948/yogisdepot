import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let transport: Transporter | null = null;
let loggedSkip = false;

const jobs: Array<() => Promise<void>> = [];
let draining = false;

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST.trim() && fromAddress());
}

function fromAddress(): string {
  const from = env.SMTP_FROM.trim();
  if (from) return from;
  const user = env.SMTP_USER.trim();
  if (user.includes("@")) return `Yogi's Depot <${user}>`;
  return "";
}

function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/** Try a few times. The caller decides whether a final failure should surface. */
export async function sendWithRetry(
  send: () => Promise<void>,
  options?: { attempts?: number; delayMs?: number },
): Promise<void> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const delayMs = options?.delayMs ?? 1000;
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await send();
      return;
    } catch (error) {
      last = error;
      logger.warn("Email send attempt failed", {
        attempt,
        attempts,
        message: error instanceof Error ? error.message : String(error),
      });
      if (attempt < attempts && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw last instanceof Error ? last : new Error("Email send failed");
}

export async function sendEmail(message: OutboundEmail): Promise<"sent" | "skipped"> {
  if (!isSmtpConfigured()) {
    if (!loggedSkip) {
      loggedSkip = true;
      logger.info("SMTP is not configured; order emails are skipped until SMTP_HOST and a From address are set");
    }
    return "skipped";
  }
  await sendWithRetry(async () => {
    await getTransport().sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });
  return "sent";
}

/**
 * In-process queue. This API has no worker service, so mail is handed off the request
 * with setImmediate and retried inside the job. A failed job is logged and does not reject the caller.
 */
export function enqueueEmail(task: () => Promise<void>): void {
  jobs.push(task);
  if (draining) return;
  draining = true;
  setImmediate(() => {
    void drain();
  });
}

async function drain(): Promise<void> {
  while (jobs.length > 0) {
    const task = jobs.shift();
    if (!task) continue;
    try {
      await task();
    } catch (error) {
      logger.error("Email job failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  draining = false;
  if (jobs.length > 0) {
    draining = true;
    setImmediate(() => {
      void drain();
    });
  }
}
