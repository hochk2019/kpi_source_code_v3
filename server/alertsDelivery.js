import process from "node:process";

import nodemailer from "nodemailer";

const DEFAULT_SEVERITY = "info";

const SEVERITY_MAP = new Map([
  ["emergency", "error"],

  ["alert", "error"],

  ["critical", "error"],

  ["fatal", "error"],

  ["severe", "error"],

  ["err", "error"],

  ["error", "error"],

  ["warn", "warning"],

  ["warning", "warning"],

  ["caution", "warning"],

  ["notice", "info"],

  ["info", "info"],

  ["information", "info"],

  ["debug", "info"],

  ["success", "success"],

  ["ok", "success"],

  ["passed", "success"],
]);

const SEVERITY_COLORS = Object.freeze({
  error: "D83B01",

  warning: "FFAA44",

  success: "107C10",

  info: "2B88D8",
});

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = `${value}`.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseRecipients(value) {
  if (!value) {
    return [];
  }

  const text = Array.isArray(value) ? value.join(",") : `${value}`;

  return Array.from(
    new Set(
      text

        .split(/[;,\n]/u)

        .map((part) => part.trim().toLowerCase())

        .filter(Boolean),
    ),
  );
}

function pickFirstConfig(env, variants) {
  for (const key of variants) {
    if (env[key] && `${env[key]}`.trim()) {
      return `${env[key]}`.trim();
    }
  }

  return "";
}

export function resolveSeverity(input) {
  if (input === undefined || input === null) {
    return DEFAULT_SEVERITY;
  }

  const normalized = `${input}`.trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_SEVERITY;
  }

  return (
    SEVERITY_MAP.get(normalized) || (SEVERITY_COLORS[normalized] ? normalized : DEFAULT_SEVERITY)
  );
}

export function buildPlainText(payload = {}) {
  const severity = resolveSeverity(payload.severity);

  const lines = [];

  const title = payload.title ? `${payload.title}`.trim() : "";

  const heading = title
    ? `[${severity.toUpperCase()}] ${title}`
    : `[${severity.toUpperCase()}] Cảnh báo hệ thống KPI`;

  lines.push(heading);

  if (payload.message) {
    lines.push(`${payload.message}`.trim());
  }

  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : null;

  if (summary) {
    const parts = [];

    if (Number.isFinite(summary.outstanding)) {
      parts.push(`Tồn đọng: ${summary.outstanding}`);
    }

    if (Number.isFinite(summary.totalTracked)) {
      parts.push(`Theo dõi: ${summary.totalTracked}`);
    }

    if (summary.lastEvaluatedAt) {
      parts.push(`Đánh giá: ${summary.lastEvaluatedAt}`);
    }

    if (parts.length > 0) {
      lines.push("");

      lines.push(parts.join(" | "));
    }
  }

  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];

  if (alerts.length > 0) {
    lines.push("");

    lines.push("Chi tiết tờ khai:");

    for (const alert of alerts) {
      const code = `${alert?.so_tk || alert?.key || alert?.mst || "Không xác định"}`.trim();

      const company = `${alert?.company || ""}`.trim();

      const missing =
        Array.isArray(alert?.missing) && alert.missing.length > 0
          ? ` thiếu ${alert.missing.join(", ")}`
          : "";

      const baseLine = company ? `- ${code} - ${company}${missing}` : `- ${code}${missing}`;

      lines.push(baseLine.trim());

      if (alert?.team || alert?.staff) {
        const team = `${alert?.team || "Chưa có tổ"}`.trim();

        const staff = `${alert?.staff || "Chưa có nhân viên"}`.trim();

        lines.push(`  • Phân công: ${team} / ${staff}`);
      }
    }
  }

  const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : null;

  if (meta) {
    const entries = Object.entries(meta).filter(
      ([, value]) => value !== undefined && value !== null && `${value}`.trim(),
    );

    if (entries.length > 0) {
      lines.push("");

      lines.push("Thông tin thêm:");

      for (const [key, value] of entries) {
        lines.push(`- ${key}: ${value}`);
      }
    }
  }

  return lines

    .join("\n")

    .replace(/\n{3,}/g, "\n\n")

    .trim();
}

function escapeTeamsMarkdown(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function normalizeTeamsText(input) {
  if (!input) {
    return "";
  }

  const text = Array.isArray(input) ? input.join("\n") : `${input}`;

  return text

    .replace(/\r\n/g, "\n")

    .split("\n")

    .map((line) => {
      if (!line.trim()) {
        return "";
      }

      const trimmed = line.trimEnd();

      if (/^[•·]/u.test(trimmed)) {
        return `- ${trimmed.replace(/^[•·]\s*/u, "")}`;
      }

      return trimmed;
    })

    .map((line) => escapeTeamsMarkdown(line))

    .join("\n")

    .replace(/\n{3,}/g, "\n\n");
}

function resolveSubjectPrefix(env, prefix) {
  return pickFirstConfig(env, [`${prefix}_EMAIL_SUBJECT_PREFIX`, `${prefix}_SUBJECT_PREFIX`]);
}

export function getEmailConfig(env = process.env) {
  const prefixes = ["ECUS_ALERT", "KPI_ALERT"];

  for (const prefix of prefixes) {
    const host = pickFirstConfig(env, [`${prefix}_EMAIL_HOST`, `${prefix}_SMTP_HOST`]);

    const from = pickFirstConfig(env, [`${prefix}_EMAIL_FROM`, `${prefix}_FROM`]);

    const toRaw = pickFirstConfig(env, [`${prefix}_EMAIL_TO`, `${prefix}_TO`]);

    if (!host || !from || !toRaw) {
      continue;
    }

    const to = parseRecipients(toRaw);

    if (to.length === 0) {
      continue;
    }

    const port = parseNumber(pickFirstConfig(env, [`${prefix}_EMAIL_PORT`, `${prefix}_SMTP_PORT`]));

    const secure = parseBoolean(
      pickFirstConfig(env, [`${prefix}_EMAIL_SECURE`, `${prefix}_SMTP_SECURE`]),
      port === 465,
    );

    const user = pickFirstConfig(env, [`${prefix}_EMAIL_USER`, `${prefix}_SMTP_USER`]);

    const pass = pickFirstConfig(env, [
      `${prefix}_EMAIL_PASS`,
      `${prefix}_SMTP_PASS`,
      `${prefix}_EMAIL_PASSWORD`,
    ]);

    const cc = parseRecipients(pickFirstConfig(env, [`${prefix}_EMAIL_CC`, `${prefix}_CC`]));

    const bcc = parseRecipients(pickFirstConfig(env, [`${prefix}_EMAIL_BCC`, `${prefix}_BCC`]));

    const replyTo = pickFirstConfig(env, [`${prefix}_EMAIL_REPLY_TO`, `${prefix}_REPLY_TO`]);

    const subjectPrefix = resolveSubjectPrefix(env, prefix);

    const transport = {
      host,

      port: port ?? 587,

      secure,
    };

    if (user || pass) {
      transport.auth = { user, pass };
    }

    return {
      transport,

      defaults: {
        from,

        to,

        cc,

        bcc,

        replyTo: replyTo || undefined,

        subjectPrefix: subjectPrefix || undefined,
      },

      source: prefix,
    };
  }

  return null;
}

export function getTeamsConfig(env = process.env) {
  const prefixes = ["ECUS_ALERT", "KPI_ALERT"];

  for (const prefix of prefixes) {
    const webhook = pickFirstConfig(env, [`${prefix}_TEAMS_WEBHOOK`, `${prefix}_WEBHOOK`]);

    if (!webhook) {
      continue;
    }

    const mentions = parseRecipients(
      pickFirstConfig(env, [`${prefix}_TEAMS_MENTIONS`, `${prefix}_MENTIONS`]),
    );

    const channel = pickFirstConfig(env, [`${prefix}_TEAMS_CHANNEL`, `${prefix}_CHANNEL`]);

    return {
      webhook,

      mentions,

      channel: channel || undefined,

      source: prefix,
    };
  }

  return null;
}

function formatEmailRecipients(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return undefined;
  }

  if (list.length === 1) {
    return list[0];
  }

  return list.join(", ");
}

function buildEmailSubject(event, config) {
  const severity = resolveSeverity(event?.severity);

  const subjectBase = event?.title ? `${event.title}`.trim() : "Cảnh báo hệ thống KPI";

  const prefix = config?.defaults?.subjectPrefix ? `${config.defaults.subjectPrefix} ` : "";

  return `${prefix}[${severity.toUpperCase()}] ${subjectBase}`.trim();
}

function convertPlainToHtml(text) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${escapeTeamsMarkdown(line)}</p>` : "<br>"))
    .join("");
}

export async function sendEmail(event, env = process.env) {
  const config = getEmailConfig(env);

  if (!config) {
    return { ok: false, reason: "missing-config" };
  }

  const transporter = nodemailer.createTransport(config.transport);

  const plain = buildPlainText(event);

  const message = {
    from: config.defaults.from,

    to: formatEmailRecipients(config.defaults.to),

    subject: buildEmailSubject(event, config),

    text: plain,

    html: convertPlainToHtml(plain),
  };

  const cc = formatEmailRecipients(config.defaults.cc);

  const bcc = formatEmailRecipients(config.defaults.bcc);

  if (cc) {
    message.cc = cc;
  }

  if (bcc) {
    message.bcc = bcc;
  }

  if (config.defaults.replyTo) {
    message.replyTo = config.defaults.replyTo;
  }

  const result = await transporter.sendMail(message);

  return { ok: true, result };
}

function buildTeamsCard(event, config) {
  const severity = resolveSeverity(event?.severity);

  const plain = buildPlainText(event);

  const text = normalizeTeamsText(plain);

  const card = {
    "@type": "MessageCard",

    "@context": "http://schema.org/extensions",

    themeColor: SEVERITY_COLORS[severity] || SEVERITY_COLORS.info,

    summary: event?.title || "Cảnh báo hệ thống KPI",

    title: event?.title || "Cảnh báo hệ thống KPI",

    text,
  };

  const facts = [];

  if (event?.summary && typeof event.summary === "object") {
    if (Number.isFinite(event.summary.outstanding)) {
      facts.push({ name: "Tồn đọng", value: `${event.summary.outstanding}` });
    }

    if (Number.isFinite(event.summary.totalTracked)) {
      facts.push({ name: "Theo dõi", value: `${event.summary.totalTracked}` });
    }

    if (event.summary.lastEvaluatedAt) {
      facts.push({ name: "Đánh giá", value: `${event.summary.lastEvaluatedAt}` });
    }
  }

  if (facts.length > 0) {
    card.sections = [
      {
        activityTitle: event?.title || "Cảnh báo hệ thống KPI",

        facts,

        markdown: true,
      },
    ];
  }

  if (event?.link) {
    card.potentialAction = [
      {
        "@type": "OpenUri",

        name: "Xem chi tiết",

        targets: [
          { os: "default", uri: event.link },

          { os: "windows", uri: event.link },

          { os: "android", uri: event.link },

          { os: "iOS", uri: event.link },
        ],
      },
    ];
  }

  if (config?.mentions?.length) {
    card.text =
      `${card.text}\n\n${config.mentions.map((mention) => `@${mention}`).join(" ")}`.trim();
  }

  return card;
}

export async function sendTeams(event, env = process.env, fetchImpl = globalThis.fetch) {
  const config = getTeamsConfig(env);

  if (!config || typeof fetchImpl !== "function") {
    return { ok: false, reason: "missing-config" };
  }

  const card = buildTeamsCard(event, config);

  const response = await fetchImpl(config.webhook, {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(card),
  });

  if (response && typeof response.ok === "boolean") {
    return { ok: response.ok, status: response.status ?? null };
  }

  return { ok: true };
}

export const __internal = Object.freeze({
  parseRecipients,

  parseBoolean,

  parseNumber,

  buildEmailSubject,

  buildTeamsCard,

  convertPlainToHtml,
});
