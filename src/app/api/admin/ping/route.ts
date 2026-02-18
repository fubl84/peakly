import { requireAdminApi } from "@/lib/api-access";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const ctx = beginApiRequest(request, "/api/admin/ping");
  const accessError = await requireAdminApi();

  if (accessError) {
    completeApiRequest({ ctx, status: accessError.status });
    return withRequestIdHeader(accessError, ctx.requestId);
  }

  const response = NextResponse.json({ status: "ok", area: "admin" });
  completeApiRequest({ ctx, status: response.status });
  return withRequestIdHeader(response, ctx.requestId);
}
