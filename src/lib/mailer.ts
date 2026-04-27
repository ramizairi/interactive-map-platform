import "server-only";

import nodemailer from "nodemailer";

interface SendPlaceApprovedEmailInput {
  to?: string;
  userName: string;
  placeName: string;
}

export async function sendPlaceApprovedEmail(input: SendPlaceApprovedEmailInput) {
  if (!input.to) {
    return;
  }

  const config = getMailerConfig();

  if (!config.host || !config.auth.user || !config.auth.pass) {
    if (config.softFailure) {
      console.warn("[mailer] Approval email skipped because SMTP configuration is incomplete.");
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: `Your place was approved: ${input.placeName}`,
      text: `Hi ${input.userName},\n\nYour place request "${input.placeName}" has been approved and is now visible on the map.\n\nThank you for contributing.`,
      html: `
        <p>Hi ${escapeHtml(input.userName)},</p>
        <p>Your place request <strong>${escapeHtml(input.placeName)}</strong> has been approved and is now visible on the map.</p>
        <p>Thank you for contributing.</p>
      `,
    });
  } catch (error) {
    if (config.softFailure) {
      console.warn(`[mailer] Approval email failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return;
    }

    throw error;
  }
}

function getMailerConfig() {
  const host = readEnv("MAILER_HOST", "NEXT_PUBLIC_MAILER_HOST");
  const user = readEnv("MAILER_USERNAME", "MAILER_USER", "NEXT_PUBLIC_MAILER_USERNAME");
  const pass = readEnv("MAILER_PASSWORD", "MAILER_PASS", "NEXT_PUBLIC_MAILER_PASSWORD");
  const port = Number(readEnv("MAILER_PORT", "NEXT_PUBLIC_MAILER_PORT_SSL") || 465);
  const secure = parseBoolean(readEnv("MAILER_SECURE"), port === 465);
  const softFailure = parseBoolean(readEnv("MAILER_SOFT_FAILURE", "NEXT_PUBLIC_MAILER_SOFT_FAILURE"), true);
  const from = readEnv("MAILER_FROM") || user;

  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure,
    softFailure,
    from,
    auth: {
      user,
      pass,
    },
  };
}

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
