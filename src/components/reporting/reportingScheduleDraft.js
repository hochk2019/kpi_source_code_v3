export function createScheduleDraft(entry = null) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const formats = Array.isArray(raw.formats) && raw.formats.length ? raw.formats : ["excel"];
  const deliveryChannels =
    Array.isArray(raw.deliveryChannels) && raw.deliveryChannels.length
      ? raw.deliveryChannels
      : ["email"];
  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients.join(", ")
    : typeof raw.recipientsInput === "string"
      ? raw.recipientsInput
      : "";

  return {
    id: raw.id || "",
    name: raw.name || "",
    frequency: raw.frequency || "weekly",
    dayOfWeek: Number.isFinite(Number(raw.dayOfWeek)) ? Number(raw.dayOfWeek) : 1,
    dayOfMonth: Number.isFinite(Number(raw.dayOfMonth)) ? Number(raw.dayOfMonth) : 1,
    time: raw.time || "08:00",
    recipientsInput: recipients,
    formats,
    deliveryChannels,
    active: raw.active !== false,
  };
}

export function toSchedulePayload(draft) {
  return {
    id: draft.id || undefined,
    name: draft.name,
    frequency: draft.frequency,
    dayOfWeek:
      draft.frequency === "weekly"
        ? Number.isFinite(Number(draft.dayOfWeek))
          ? Number(draft.dayOfWeek)
          : 1
        : null,
    dayOfMonth:
      draft.frequency === "monthly"
        ? Number.isFinite(Number(draft.dayOfMonth))
          ? Number(draft.dayOfMonth)
          : 1
        : null,
    time: draft.time || "08:00",
    recipients: draft.recipientsInput || "",
    formats: Array.isArray(draft.formats) && draft.formats.length ? draft.formats : ["excel"],
    deliveryChannels:
      Array.isArray(draft.deliveryChannels) && draft.deliveryChannels.length
        ? draft.deliveryChannels
        : ["email"],
    active: Boolean(draft.active),
  };
}
