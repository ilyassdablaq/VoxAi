const DEFAULT_API_BASE = import.meta.env.PROD
	? "https://voxai-production-1cd4.up.railway.app"
	: "http://localhost:4000";

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, "");
}

const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_URL || DEFAULT_API_BASE);

export { API_BASE };
export const API_BASE_CANDIDATES = [API_BASE];
