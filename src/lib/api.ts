/**
 * AgentHive – Typed API Client
 *
 * Centralised fetch wrapper for all FastAPI backend calls.
 * - Base URL from NEXT_PUBLIC_API_URL env variable
 * - 15-second AbortController timeout
 * - Firebase ID token injected as Authorization: Bearer
 * - Single retry on 502/503/504 after 500 ms
 * - RFC 7807 Problem Detail parsing → throws ApiError
 * - 401 clears auth state and redirects to /login
 */

import { auth } from "@/lib/firebase";
import type {
  BiasReport,
  CopilotRequest,
  CopilotResponse,
  GovernanceDashboard,
  HistoryParams,
  PaginatedResponse,
  DecisionRecord,
  UnderwritingRequest,
  UnderwritingResponse,
  ProblemDetail,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// ApiError — wraps RFC 7807 Problem Detail responses
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly instance: string;
  public readonly type: string;

  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.title = problem.title;
    this.detail = problem.detail;
    this.instance = problem.instance ?? "";
    this.type = problem.type ?? "about:blank";
  }

  static fromStatus(status: number, message: string): ApiError {
    return new ApiError({
      type: "about:blank",
      title: "Request Failed",
      status,
      detail: message,
      instance: "",
    });
  }
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const RETRY_STATUSES = new Set([502, 503, 504]);
const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 500;

async function getIdToken(): Promise<string | null> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  attempt = 1
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const token = await getIdToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Retry on gateway errors (once)
    if (RETRY_STATUSES.has(response.status) && attempt === 1) {
      await delay(RETRY_DELAY_MS);
      return apiFetch<T>(path, options, 2);
    }

    // Redirect to login on 401
    if (response.status === 401) {
      await auth.signOut();
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
      throw ApiError.fromStatus(401, "Session expired. Please log in again.");
    }

    // Parse body (always attempt JSON)
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      // Attempt RFC 7807 parsing
      if (
        body &&
        typeof body === "object" &&
        "status" in (body as object) &&
        "title" in (body as object)
      ) {
        throw new ApiError(body as ProblemDetail);
      }
      throw ApiError.fromStatus(response.status, `HTTP ${response.status}`);
    }

    return body as T;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) throw err;

    // AbortController fired → timeout
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError({
        type: "https://agenthive.ai/errors/timeout",
        title: "Request Timed Out",
        status: 408,
        detail:
          "The request to the decisioning engine timed out after 15 seconds. Please try again.",
        instance: path,
      });
    }

    throw ApiError.fromStatus(
      0,
      err instanceof Error ? err.message : "Unknown network error"
    );
  }
}

// ---------------------------------------------------------------------------
// Public API client object
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString();
  return `?${qs}`;
}

export const apiClient = {
  underwriting: {
    decide(payload: UnderwritingRequest): Promise<UnderwritingResponse> {
      return apiFetch<UnderwritingResponse>("/api/underwriting/decision", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    history(params: HistoryParams = {}): Promise<PaginatedResponse<DecisionRecord>> {
      const query = buildQuery(params as Record<string, unknown>);
      return apiFetch<PaginatedResponse<DecisionRecord>>(
        `/api/underwriting/history${query}`
      );
    },
  },

  copilot: {
    explain(payload: CopilotRequest): Promise<CopilotResponse> {
      return apiFetch<CopilotResponse>("/api/copilot/explain", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },

  governance: {
    dashboard(period = "last_30_days"): Promise<GovernanceDashboard> {
      return apiFetch<GovernanceDashboard>(
        `/api/governance/dashboard?period=${encodeURIComponent(period)}`
      );
    },

    biasReport(): Promise<BiasReport> {
      return apiFetch<BiasReport>("/api/governance/bias-report");
    },
  },
} as const;
