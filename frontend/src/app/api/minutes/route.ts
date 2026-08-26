import { NextRequest, NextResponse } from "next/server";
import { isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

// 获取会议纪要
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
    const response = await proxyToFastAPI(request, `/api/meetings/${meetingId}/summary`);

    if (response.ok) {
      const data = await response.json();
      // 后端返回 {id, meeting_id, content, created_at}
      const minutes = {
        id: data.id,
        meeting_id: data.meeting_id,
        summary: data.content,
        content: data.content,
        key_points: null,
        decisions: null,
        action_items: null,
        created_at: data.created_at
      };
      return NextResponse.json({ success: true, data: minutes });
    }

    // 如果纪要未生成，返回空数据而不是错误
    if (response.status === 404) {
      return NextResponse.json({ success: true, data: null });
    }

    const error = await response.json().catch(() => ({ detail: "获取失败" }));
    return NextResponse.json(
      { success: false, error: error.detail || "获取失败" },
      { status: response.status }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "网络错误" },
      { status: 500 }
    );
  }
}
