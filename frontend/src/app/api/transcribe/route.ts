import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

// 获取转写结果
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const meetingId = searchParams.get("meetingId");

  if (!isPositiveIntegerId(meetingId)) {
    return NextResponse.json(
      { success: false, error: "会议ID是必填项" },
      { status: 400 }
    );
  }

  try {
    const response = await proxyToFastAPI(request, `/api/meetings/${meetingId}/transcript`);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ success: true, data });
    }

    const error: unknown = await response.json().catch(() => null);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "获取转写结果失败") },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}

// 触发语音转写
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { meetingId } = body;

  if (!isPositiveIntegerId(meetingId)) {
    return NextResponse.json(
      { success: false, error: "会议ID是必填项" },
      { status: 400 }
    );
  }

  try {
    const response = await proxyToFastAPI(
      request,
      `/api/meetings/${meetingId}/transcribe`,
      "POST",
    );

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, error: data.detail || "启动转写失败" },
      { status: response.status }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "网络错误" },
      { status: 500 }
    );
  }
}
