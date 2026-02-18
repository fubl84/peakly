type ApiCounters = {
  totalRequests: number;
  totalErrors: number;
  perRoute: Record<string, { requests: number; errors: number }>;
};

type ApiRequestContext = {
  requestId: string;
  route: string;
  method: string;
  startedAtMs: number;
  userAgent: string;
  ip: string;
};

type CompleteRequestArgs = {
  ctx: ApiRequestContext;
  status: number;
  userId?: string;
  errorMessage?: string;
};

type GlobalWithObservability = typeof globalThis & {
  __sz_observability_counters?: ApiCounters;
};

function getCounters() {
  const globalObject = globalThis as GlobalWithObservability;
  if (!globalObject.__sz_observability_counters) {
    globalObject.__sz_observability_counters = {
      totalRequests: 0,
      totalErrors: 0,
      perRoute: {},
    };
  }

  return globalObject.__sz_observability_counters;
}

function readHeader(headers: Headers, key: string) {
  return headers.get(key)?.trim() ?? "";
}

function getClientIp(headers: Headers) {
  const forwarded = readHeader(headers, "x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "";
  }

  return readHeader(headers, "x-real-ip");
}

function nextRequestId(headers: Headers) {
  const incoming = readHeader(headers, "x-request-id");
  if (incoming) {
    return incoming;
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function beginApiRequest(request: Request, route: string): ApiRequestContext {
  return {
    requestId: nextRequestId(request.headers),
    route,
    method: request.method,
    startedAtMs: Date.now(),
    userAgent: readHeader(request.headers, "user-agent"),
    ip: getClientIp(request.headers),
  };
}

export function completeApiRequest(args: CompleteRequestArgs) {
  const { ctx, status, userId, errorMessage } = args;
  const counters = getCounters();

  counters.totalRequests += 1;
  if (!counters.perRoute[ctx.route]) {
    counters.perRoute[ctx.route] = { requests: 0, errors: 0 };
  }
  counters.perRoute[ctx.route].requests += 1;

  const isError = status >= 500;
  if (isError) {
    counters.totalErrors += 1;
    counters.perRoute[ctx.route].errors += 1;
  }

  const payload = {
    ts: new Date().toISOString(),
    event: "api_request",
    requestId: ctx.requestId,
    route: ctx.route,
    method: ctx.method,
    status,
    durationMs: Date.now() - ctx.startedAtMs,
    userId: userId ?? null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    errorMessage: errorMessage ?? null,
  };

  if (isError) {
    console.error(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}

export function withRequestIdHeader(response: Response, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export function getObservabilitySnapshot() {
  const counters = getCounters();

  return {
    generatedAt: new Date().toISOString(),
    processUptimeSec: Number(process.uptime().toFixed(2)),
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    api: {
      totalRequests: counters.totalRequests,
      totalErrors: counters.totalErrors,
      perRoute: counters.perRoute,
    },
  };
}
