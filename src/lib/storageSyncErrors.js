const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /network\s?error/i,
  /network\srequest\sfailed/i,
  /\boffline\b/i,
  /econnrefused/i,
  /enotfound/i,
  /etimedout/i,
  /fetch failed/i,
  /socket hang up/i,
];

const HTTP_STATUS_PATTERN = /http\s+(\d{3})/i;

const DEFAULT_SYNC_ERROR_MESSAGE =
  "Không thể kết nối máy chủ đồng bộ. Dữ liệu sẽ được giữ cục bộ và tự thử lại.";

const DEFAULT_SYNC_ERROR_HINT = "Kiểm tra mạng/VPN nội bộ rồi thử lại.";
const AUTH_ERROR_HINT = "Vui lòng đăng nhập lại để tiếp tục đồng bộ.";
const STORAGE_LIMIT_HINT = "Giảm kích thước dữ liệu hoặc liên hệ quản trị viên để nâng giới hạn.";

function toErrorInstance(value) {
  return value instanceof Error ? value : null;
}

function readMessageChain(error) {
  const messages = [];
  let cursor = toErrorInstance(error);
  let guard = 0;
  while (cursor && guard < 5) {
    if (typeof cursor.message === "string" && cursor.message.trim()) {
      messages.push(cursor.message.trim());
    }
    cursor = toErrorInstance(cursor.cause);
    guard += 1;
  }
  return messages;
}

function extractStatus(error, fallbackMessage) {
  const directStatus = Number.isInteger(error?.status) ? error.status : null;
  if (directStatus !== null) {
    return directStatus;
  }
  const message = typeof fallbackMessage === "string" ? fallbackMessage : "";
  const matched = message.match(HTTP_STATUS_PATTERN);
  const parsed = matched ? Number.parseInt(matched[1], 10) : Number.NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

function isNetworkMessage(message) {
  if (typeof message !== "string" || !message.trim()) {
    return false;
  }
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function isRetryableHttpStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

export function createSyncError({
  code,
  message,
  status = null,
  retryable = true,
  hint = "",
  cause,
} = {}) {
  const resolvedMessage =
    typeof message === "string" && message.trim() ? message.trim() : DEFAULT_SYNC_ERROR_MESSAGE;
  const error = new Error(resolvedMessage, {
    cause: toErrorInstance(cause) ?? undefined,
  });
  error.code = typeof code === "string" && code.trim() ? code.trim() : "sync_unknown";
  error.status = Number.isInteger(status) ? status : null;
  error.retryable = Boolean(retryable);
  error.hint = typeof hint === "string" ? hint.trim() : "";
  return error;
}

export function normalizeSyncError(error, options = {}) {
  const storageLimitMessage =
    typeof options.storageLimitMessage === "string" && options.storageLimitMessage.trim()
      ? options.storageLimitMessage.trim()
      : "Dung lượng dữ liệu vượt quá giới hạn máy chủ đồng bộ.";

  const defaultMessage =
    typeof options.defaultMessage === "string" && options.defaultMessage.trim()
      ? options.defaultMessage.trim()
      : DEFAULT_SYNC_ERROR_MESSAGE;

  const explicitMessage =
    typeof error?.message === "string" && error.message.trim() ? error.message.trim() : "";
  const status = extractStatus(error, explicitMessage);
  const chainMessages = readMessageChain(error);
  const chainText = chainMessages.join(" | ");
  const explicitCode = typeof error?.code === "string" ? error.code.trim() : "";
  const explicitRetryable = typeof error?.retryable === "boolean" ? error.retryable : null;
  const explicitHint = typeof error?.hint === "string" ? error.hint.trim() : "";

  if (status === 413) {
    return {
      code: "payload_too_large",
      status,
      message: storageLimitMessage,
      retryable: false,
      hint: explicitHint || STORAGE_LIMIT_HINT,
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: "auth_required",
      status,
      message: "Phiên đăng nhập đã hết hạn hoặc không đủ quyền đồng bộ.",
      retryable: false,
      hint: explicitHint || AUTH_ERROR_HINT,
    };
  }

  if (explicitCode) {
    return {
      code: explicitCode,
      status,
      message: explicitMessage || defaultMessage,
      retryable: explicitRetryable ?? (status ? isRetryableHttpStatus(status) : true),
      hint: explicitHint || (isNetworkMessage(chainText) ? DEFAULT_SYNC_ERROR_HINT : ""),
    };
  }

  if (status !== null) {
    const retryable = isRetryableHttpStatus(status);
    return {
      code: retryable ? "http_retryable" : "http_non_retryable",
      status,
      message: explicitMessage || defaultMessage,
      retryable,
      hint: explicitHint || (retryable ? DEFAULT_SYNC_ERROR_HINT : ""),
    };
  }

  if (isNetworkMessage(chainText || explicitMessage)) {
    return {
      code: "network_unreachable",
      status: null,
      message: defaultMessage,
      retryable: true,
      hint: explicitHint || DEFAULT_SYNC_ERROR_HINT,
    };
  }

  return {
    code: "sync_unknown",
    status: null,
    message: explicitMessage || defaultMessage,
    retryable: explicitRetryable ?? true,
    hint: explicitHint || "",
  };
}
