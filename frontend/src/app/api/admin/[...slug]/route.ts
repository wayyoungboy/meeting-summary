import { NextRequest, NextResponse } from "next/server";
import { proxyToFastAPI } from "@/lib/api-proxy";

function buildAdminEndpoint(slug: string[]): string | null {
  if (slug.length === 0 || slug.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    return null;
  }
  return `/api/admin/${slug.map(encodeURIComponent).join("/")}`;
}

async function forwardAdminRequest(
  request: NextRequest,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
) {
  try {
    const body = method === "POST" || method === "PUT" ? await request.json() : undefined;
    const response = await proxyToFastAPI(request, endpoint, method, body);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: "后端服务暂时不可用" }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = buildAdminEndpoint(slug);
  if (!endpoint) return NextResponse.json({ error: "无效的管理接口" }, { status: 400 });
  return forwardAdminRequest(request, endpoint, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = buildAdminEndpoint(slug);
  if (!endpoint) return NextResponse.json({ error: "无效的管理接口" }, { status: 400 });
  return forwardAdminRequest(request, endpoint, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = buildAdminEndpoint(slug);
  if (!endpoint) return NextResponse.json({ error: "无效的管理接口" }, { status: 400 });
  return forwardAdminRequest(request, endpoint, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = buildAdminEndpoint(slug);
  if (!endpoint) return NextResponse.json({ error: "无效的管理接口" }, { status: 400 });
  return forwardAdminRequest(request, endpoint, "DELETE");
}
