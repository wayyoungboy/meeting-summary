import { NextRequest, NextResponse } from "next/server";
import { proxyToFastAPI } from "@/lib/api-proxy";

interface FastApiMeeting {
  id: number;
  title: string;
  meeting_date: string;
  duration: number | null;
  status: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const response = await proxyToFastAPI(request, "/api/meetings");

    if (response.ok) {
      const data = (await response.json()) as { items?: FastApiMeeting[] };
      const meetings = data.items?.map((m) => ({
        id: String(m.id),
        title: m.title,
        description: null,
        meeting_date: m.meeting_date,
        duration: m.duration,
        status: m.status,
        created_at: m.created_at,
      })) || [];
      return NextResponse.json({ success: true, data: meetings });
    }

    const errorData = await response.json().catch(() => ({ detail: "获取会议列表失败" }));
    return NextResponse.json(
      { success: false, error: errorData.detail || "获取会议列表失败" },
      { status: response.status }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "网络错误" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await proxyToFastAPI(
    request,
    "/api/meetings",
    "POST",
    {
      title: body.title,
      meeting_date: body.meetingDate ? new Date(body.meetingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      participants: body.description ? [body.description] : []
    }
  );

  if (response.ok) {
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data: {
        id: String(data.id),
        title: data.title,
        meeting_date: data.meeting_date,
        status: data.status,
      }
    });
  }

  const error = await response.json();
  return NextResponse.json(
    { success: false, error: error.detail || "创建失败" },
    { status: response.status }
  );
}
