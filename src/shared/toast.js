import { toast as sonnerToast } from "sonner";



const DEFAULT_DURATION = 4500;

const PUNCTUATION_END_REGEX = /[.!?…]$/;

const SPACE_BEFORE_PUNCTUATION = /\s+([,.;!?])/g;

const MISSING_SPACE_AFTER_COMMA = /([,;])(?!\s|$)/g;

const MISSING_SPACE_AFTER_END = /([.!?])(?!\s|$)/g;



const PREFIXES = {

  info: "ℹ️",

  success: "✅",

  error: "❌",

  warning: "⚠️"

};



const FALLBACK_MESSAGES = {

  info: "Thông báo từ hệ thống.",

  success: "Thao tác đã hoàn tất.",

  error: "Đã xảy ra lỗi, vui lòng thử lại.",

  warning: "Vui lòng kiểm tra lại thông tin."

};



const normalizeText = (value = "") => {

  const normalized = `${value}`.normalize("NFC").trim();

  if (!normalized) {

    return "";

  }



  let formatted = normalized.replace(/\s+/g, " ");

  formatted = formatted.replace(SPACE_BEFORE_PUNCTUATION, "$1");

  formatted = formatted.replace(MISSING_SPACE_AFTER_COMMA, "$1 ");

  formatted = formatted.replace(MISSING_SPACE_AFTER_END, "$1 ");

  formatted = formatted.replace(/\s+/g, " ").trim();



  if (!PUNCTUATION_END_REGEX.test(formatted)) {

    formatted = `${formatted}.`;

  }



  return formatted;

};



const resolveDescription = (description) => {

  if (typeof description !== "string") {

    return description;

  }



  return normalizeText(description);

};



const buildMessage = (kind, message, prefixEnabled = true) => {

  const formatted = normalizeText(

    message && `${message}`.trim().length > 0

      ? message

      : FALLBACK_MESSAGES[kind] ?? FALLBACK_MESSAGES.info

  );



  if (!prefixEnabled) {

    return formatted;

  }



  const prefix = PREFIXES[kind] ?? PREFIXES.info;

  return prefix ? `${prefix} ${formatted}` : formatted;

};



const withTone = (kind, handler) => (message, options = {}) => {

  const { prefix = true, description, ...restOptions } = options;

  const finalOptions = {

    duration: DEFAULT_DURATION,

    ...restOptions

  };



  const resolvedDescription = resolveDescription(description);

  if (resolvedDescription) {

    finalOptions.description = prefix

      ? `${PREFIXES[kind] ?? PREFIXES.info} ${resolvedDescription}`

      : resolvedDescription;

  }



  return handler(buildMessage(kind, message, prefix), finalOptions);

};



const toast = Object.assign(

  withTone("info", (msg, opts) => sonnerToast(msg, opts)),

  {

    success: withTone("success", (msg, opts) => sonnerToast.success(msg, opts)),

    error: withTone("error", (msg, opts) => sonnerToast.error(msg, opts)),

    warning: withTone("warning", (msg, opts) => sonnerToast.warning(msg, opts)),

    info: withTone(

      "info",

      (msg, opts) => (sonnerToast.info ? sonnerToast.info(msg, opts) : sonnerToast(msg, opts))

    ),

    promise: (...args) => sonnerToast.promise?.(...args),

    custom: (...args) => sonnerToast.custom?.(...args),

    dismiss: (...args) => sonnerToast.dismiss(...args)

  }

);



export { toast };

