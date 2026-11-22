// Site settings.
// AI_ENDPOINT: URL of the assistant Worker (worker/). Empty = the assistant button is hidden.
// Set HKOC_AI_ENDPOINT when building to override (e.g. for local testing).
export const AI_ENDPOINT = process.env.HKOC_AI_ENDPOINT ?? '';
