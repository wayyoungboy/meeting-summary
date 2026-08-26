import { NextRequest, NextResponse } from "next/server";
import { isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

interface TranscriptSegment {
  speaker: string | null;
  content: string;
  start_time: number | null;
  end_time: number | null;
  sequence: number | null;
}

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
      const data = (await response.json()) as {
        meeting_id?: number;
        segments?: TranscriptSegment[];
      };
      // 后端返回 {meeting_id, segments: [{speaker, content, start_time, end_time, sequence}]}
      const segments = data.segments || [];
      const transcript = {
        id: data.meeting_id?.toString() || meetingId,
        meeting_id: data.meeting_id,
        segments: segments,
        content: segments.map((segment) => `${segment.speaker || "未知"}: ${segment.content}`).join('\n'),
        duration: segments.length > 0 ? segments[segments.length - 1].end_time : 0,
        created_at: new Date().toISOString()
      };
      return NextResponse.json({ success: true, data: transcript });
    }

    // 如果转写未完成，返回空数据
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
