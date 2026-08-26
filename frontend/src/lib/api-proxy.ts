import { NextRequest } from "next/server";

const configuredApiBaseUrl = process.env.API_BASE_URL || "http://localhost:13001";
const parsedApiBaseUrl = new URL(configuredApiBaseUrl);

if (!['http:', 'https:'].includes(parsedApiBaseUrl.protocol)) {
  throw new Error("API_BASE_URL must use HTTP or HTTPS");
}

const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, "");

// 从请求中获取token
function getTokenFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get("token")?.value;
  if (token) return token;

  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

// 代理请求到FastAPI后端（返回原始响应，不解析JSON）
export async function proxyToFastAPI(
  request: NextRequest,
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<Response> {
  const token = getTokenFromRequest(request);

  const headers: Record<string, string> = { Accept: "application/json" };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && (method === "POST" || method === "PUT")) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    cache: "no-store",
    signal: AbortSignal.timeout(70_000),
  });
}

export function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null) return fallback;
  const detail = (data as Record<string, unknown>).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>).msg
          : null,
      )
      .filter((message): message is string => typeof message === "string");
    if (messages.length > 0) return messages.join(", ");
  }
  return fallback;
}

export function isPositiveIntegerId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

export {
  API_BASE_URL,
  getTokenFromRequest,
};
