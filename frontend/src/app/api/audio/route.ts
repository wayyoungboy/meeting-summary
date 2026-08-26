import { NextRequest, NextResponse } from "next/server";
import { isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

// 获取音频文件列表
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
    const response = await proxyToFastAPI(request, `/api/meetings/${meetingId}`);

    if (response.ok) {
      const meeting = await response.json();
      if (meeting.audio_path) {
        const audioFile = {
          id: `${meetingId}_audio`,
          meeting_id: meetingId,
          file_name: meeting.audio_filename || meeting.audio_path || 'audio.mp3',
          file_size: meeting.audio_filesize || 0,
          duration: meeting.duration,
          created_at: meeting.created_at
        };
        return NextResponse.json({ success: true, data: [audioFile] });
      }
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json(
      { success: false, error: "获取失败" },
      { status: response.status }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "后端服务暂时不可用" },
      { status: 502 },
    );
  }
}
