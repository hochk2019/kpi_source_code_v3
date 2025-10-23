import nodemailer from "nodemailer";

const VALID_SEVERITIES = new Set(["info", "warning", "critical"]);

const TEAMS_THEME_COLORS = Object.freeze({
  info: "2D89EF",

  warning: "F1C232",

  critical: "D83B01",
});

function parseList(value) {
  if (!value) return [];

  const text = String(value).trim();

  if (!text) return [];

  return text

    .split(/[,;\n]/u)

    .map((item) => item.trim())

    .filter((item) => item.length > 3);
}

function toBoolean(value, fallback = false) {
  if (value === null || value === undefined) return fallback;

  const str = String(value).trim().toLowerCase();

  if (!str) return fallback;

  if (["1", "true", "yes", "y", "on", "enable", "enabled"].includes(str)) return true;

  if (["0", "false", "no", "n", "off", "disable", "disabled"].includes(str)) return false;

  return fallback;
}

function toInteger(value, fallback) {
  const num = Number.parseInt(value, 10);

  if (Number.isFinite(num)) return num;

  return fallback;
}

function resolveSeverity(input, fallback = "warning") {
  const severity = String(input || "").toLowerCase();

  if (VALID_SEVERITIES.has(severity)) {
    return severity;
  }

  if (VALID_SEVERITIES.has(fallback)) {
    return fallback;
  }

  return "warning";
}

function buildPlainText({ text, issues = [], facts = [], link }) {
  const lines = [];

  const normalizedText = typeof text === "string" ? text.trim() : "";

  if (normalizedText) {
    lines.push(normalizedText);
  }

  const normalizedIssues = Array.isArray(issues) ? issues.filter(Boolean) : [];

  if (normalizedIssues.length) {
    if (lines.length) lines.push("");

    lines.push("Các cảnh báo:");

    for (const issue of normalizedIssues) {
      lines.push(`- ${issue}`);
    }
  }

  const normalizedFacts = Array.isArray(facts)
    ? facts.filter((fact) => fact && fact.name && fact.value)
    : [];

  if (normalizedFacts.length) {
    if (lines.length) lines.push("");

    lines.push("Thông tin hệ thống:");

    for (const fact of normalizedFacts) {
      lines.push(`- ${fact.name}: ${fact.value}`);
    }
  }

  if (link) {
    if (lines.length) lines.push("");

    lines.push(`Xem chi tiết: ${link}`);
  }

  return lines.join("\n");
}

function buildHtml({ html, text, issues = [], facts = [], link }) {
  if (html && typeof html === "string") {
    return html;
  }

  const plain = buildPlainText({ text, issues, facts, link });

  const escaped = plain

    .replace(/&/gu, "&amp;")

    .replace(/</gu, "&lt;")

    .replace(/>/gu, "&gt;")

    .split("\n")

    .map((line) => `<p>${line || "&nbsp;"}</p>`)

    .join("");

  return `<!doctype html><html><body>${escaped}</body></html>`;
}

function normalizeTeamsText({ teamsText, text, issues = [], facts = [], link }) {
  if (teamsText && typeof teamsText === "string") {
    return teamsText.trim();
  }

  const sections = [];

  const normalizedText = typeof text === "string" ? text.trim() : "";

  if (normalizedText) {
    sections.push(normalizedText);
  }

  const normalizedIssues = Array.isArray(issues) ? issues.filter(Boolean) : [];

  if (normalizedIssues.length) {
    sections.push("\n**Các cảnh báo**");

    for (const issue of normalizedIssues) {
      sections.push(`- ${issue}`);
    }
  }

  const normalizedFacts = Array.isArray(facts)
    ? facts.filter((fact) => fact && fact.name && fact.value)
    : [];

  if (normalizedFacts.length) {
    sections.push("\n**Thông tin hệ thống**");

    for (const fact of normalizedFacts) {
      sections.push(`- ${fact.name}: ${fact.value}`);
    }
  }

  if (link) {
    sections.push(`\n[Chi tiết](${link})`);
  }

  return sections.join("\n");
}

function getEmailConfig() {
  const to = parseList(process.env.ECUS_ALERT_EMAIL_TO || process.env.KPI_ALERT_EMAIL_TO);

  const from = (process.env.ECUS_ALERT_EMAIL_FROM || process.env.KPI_ALERT_EMAIL_FROM || "").trim();

  const host = (process.env.ECUS_ALERT_SMTP_HOST || process.env.KPI_ALERT_SMTP_HOST || "").trim();

  const user = (process.env.ECUS_ALERT_SMTP_USER || process.env.KPI_ALERT_SMTP_USER || "").trim();

  const pass = process.env.ECUS_ALERT_SMTP_PASSWORD || process.env.KPI_ALERT_SMTP_PASSWORD || "";

  const port = toInteger(process.env.ECUS_ALERT_SMTP_PORT || process.env.KPI_ALERT_SMTP_PORT, 587);

  const secure = toBoolean(
    process.env.ECUS_ALERT_SMTP_SECURE || process.env.KPI_ALERT_SMTP_SECURE,

    port === 465,
  );

  const cc = parseList(process.env.ECUS_ALERT_EMAIL_CC || process.env.KPI_ALERT_EMAIL_CC);

  const bcc = parseList(process.env.ECUS_ALERT_EMAIL_BCC || process.env.KPI_ALERT_EMAIL_BCC);

  const enabled = Boolean(to.length && from && host);

  return {
    enabled,

    to,

    cc,

    bcc,

    from,

    host,

    port,

    secure,

    user,

    pass,
  };
}

function getTeamsConfig() {
  const webhook =
    (
      process.env.ECUS_ALERT_TEAMS_WEBHOOK_URL ||
      process.env.KPI_ALERT_TEAMS_WEBHOOK_URL ||
      ""
    ).trim() ||
    (process.env.ECUS_ALERT_TEAMS_WEBHOOK || process.env.KPI_ALERT_TEAMS_WEBHOOK || "").trim();

  if (!webhook) {
    return { enabled: false, webhook: "" };
  }

  return { enabled: true, webhook };
}

async function sendEmail(config, payload) {
  const { subject, text, html, issues, facts, link } = payload;

  const transporter = nodemailer.createTransport({
    host: config.host,

    port: config.port,

    secure: config.secure,

    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });

  const message = {
    from: config.from,

    to: config.to,

    subject,

    text: text || buildPlainText({ text, issues, facts, link }),

    html: buildHtml({ html, text, issues, facts, link }),

    headers: {
      "X-KPI-Alert": "ecus-monitor",

      "X-KPI-Alert-Severity": payload.severity,
    },
  };

  if (config.cc.length) {
    message.cc = config.cc;
  }

  if (config.bcc.length) {
    message.bcc = config.bcc;
  }

  await transporter.sendMail(message);
}

async function sendTeams(config, payload) {
  const severity = resolveSeverity(payload.severity);

  const bodyText = normalizeTeamsText({
    teamsText: payload.teamsText,

    text: payload.text,

    issues: payload.issues,

    facts: payload.facts,

    link: payload.link,
  });

  const facts = Array.isArray(payload.facts)
    ? payload.facts.filter((fact) => fact && fact.name && fact.value)
    : [];

  const sections = [];

  if (facts.length) {
    sections.push({
      facts: facts.map((fact) => ({ name: fact.name, value: fact.value })),

      markdown: true,
    });
  }

  if (payload.issues?.length) {
    sections.push({
      title: "Các cảnh báo",

      text: payload.issues.map((issue) => `- ${issue}`).join("\n"),

      markdown: true,
    });
  }

  const card = {
    "@type": "MessageCard",

    "@context": "http://schema.org/extensions",

    summary: payload.subject,

    themeColor: TEAMS_THEME_COLORS[severity] || TEAMS_THEME_COLORS.warning,

    title: payload.subject,

    text: bodyText,

    sections,
  };

  if (payload.link) {
    card.potentialAction = [
      {
        "@type": "OpenUri",

        name: "Mở dashboard",

        targets: [
          {
            os: "default",

            uri: payload.link,
          },
        ],
      },
    ];
  }

  const response = await fetch(config.webhook, {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    throw new Error(`Teams webhook trả về trạng thái ${response.status}: ${detail}`);
  }
}

export function hasAlertTargets() {
  const email = getEmailConfig();

  const teams = getTeamsConfig();

  return email.enabled || teams.enabled;
}

export async function deliverAlertNotification(payload) {
  const severity = resolveSeverity(payload.severity);

  const emailConfig = getEmailConfig();

  const teamsConfig = getTeamsConfig();

  const results = { successes: [], failures: [] };

  const tasks = [];

  if (emailConfig.enabled) {
    tasks.push(
      sendEmail(emailConfig, { ...payload, severity }).then(
        () => {
          results.successes.push("email");
        },

        (error) => {
          results.failures.push({ target: "email", error });
        },
      ),
    );
  }

  if (teamsConfig.enabled) {
    tasks.push(
      sendTeams(teamsConfig, { ...payload, severity }).then(
        () => {
          results.successes.push("teams");
        },

        (error) => {
          results.failures.push({ target: "teams", error });
        },
      ),
    );
  }

  if (!tasks.length) {
    return { ...results, attempted: false };
  }

  await Promise.all(tasks);

  return { ...results, attempted: true };
}
