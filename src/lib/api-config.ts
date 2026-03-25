const configuredApiBase = import.meta.env.VITE_API_URL;

export const API_BASE = configuredApiBase || "http://localhost:4000";

const LOCAL_API_FALLBACKS = [
	"http://localhost:4300",
	"http://localhost:4000",
	"http://localhost:4001",
	"http://localhost:4010",
	"http://localhost:4200",
];

export const API_BASE_CANDIDATES = configuredApiBase
	? [configuredApiBase, ...LOCAL_API_FALLBACKS]
	: LOCAL_API_FALLBACKS;
