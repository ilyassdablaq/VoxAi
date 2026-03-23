const configuredApiBase = import.meta.env.VITE_API_URL;

export const API_BASE = configuredApiBase || "http://localhost:4000";

export const API_BASE_CANDIDATES = configuredApiBase
	? [configuredApiBase]
	: ["http://localhost:4000", "http://localhost:4001"];
