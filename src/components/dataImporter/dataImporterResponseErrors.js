export async function extractDataImporterErrorMessage(response, fallbackMessage) {
  if (!response || typeof response !== "object") {
    return fallbackMessage;
  }

  try {
    const data = await response.clone().json();

    if (data?.error && typeof data.error === "string") {
      return data.error;
    }

    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  } catch {
    try {
      const text = await response.clone().text();

      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch {
      // Ignore response parsing fallbacks and return the original fallback message below.
    }
  }

  if (Number.isInteger(response?.status) && response.status >= 400) {
    return `HTTP ${response.status}`;
  }

  return fallbackMessage;
}
