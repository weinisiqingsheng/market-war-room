export type JevErrorCode =
  | "REAL_PROVIDER_DISABLED"
  | "INVALID_PROVIDER_REQUEST"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "PROVIDER_OVERLOADED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "RETRY_EXHAUSTED"
  | "RESPONSE_INVALID"
  | "BUDGET_EXCEEDED";

export class JevAdapterError extends Error {
  readonly code: JevErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    code: JevErrorCode,
    message: string,
    options: { retryable?: boolean; status?: number | null } = {},
  ) {
    super(message);
    this.name = "JevAdapterError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
  }
}

export function shouldRetryJevStatus(status: number): boolean {
  return status === 429 || status === 529;
}

export function classifyJevError(status: number): JevAdapterError {
  if (status === 401)
    return new JevAdapterError("INVALID_CREDENTIALS", "Jev credentials were rejected.", { status });
  if (status === 422)
    return new JevAdapterError("INVALID_PROVIDER_REQUEST", "Jev rejected the request shape.", {
      status,
    });
  if (status === 429)
    return new JevAdapterError("RATE_LIMITED", "Jev rate limit reached.", {
      retryable: true,
      status,
    });
  if (status === 529)
    return new JevAdapterError("PROVIDER_OVERLOADED", "Jev is temporarily overloaded.", {
      retryable: true,
      status,
    });
  return new JevAdapterError("PROVIDER_UNAVAILABLE", "Jev provider is unavailable.", {
    retryable: status >= 500,
    status,
  });
}
