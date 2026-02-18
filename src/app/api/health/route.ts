import {
  beginApiRequest,
  completeApiRequest,
  getObservabilitySnapshot,
  withRequestIdHeader,
} from "@/lib/observability";
import { NextResponse } from "next/server";

export function GET(request: Request) {
  const ctx = beginApiRequest(request, "/api/health");
  const response = NextResponse.json({
    status: "ok",
    observability: getObservabilitySnapshot(),
  });

  completeApiRequest({ ctx, status: response.status });
  return withRequestIdHeader(response, ctx.requestId);
}
