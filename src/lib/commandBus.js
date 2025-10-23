const EVENT_NAME = "kpi:command-center";

export function emitCommand(id, payload = {}) {
  if (typeof window === "undefined" || !id) {
    return;
  }

  const detail = { id, payload };

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function subscribeCommand(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const listener = (event) => {
    const detail = event?.detail;

    if (!detail || !detail.id) {
      return;
    }

    handler(detail.id, detail.payload ?? {});
  };

  window.addEventListener(EVENT_NAME, listener);

  return () => {
    window.removeEventListener(EVENT_NAME, listener);
  };
}
