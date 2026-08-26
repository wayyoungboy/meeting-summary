import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, getErrorMessage, getTokenFromRequest, isPositiveIntegerId } from "@/lib/api-proxy";

const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_SIZE_MB || "200") * 1024 * 1024;

// 上传音频文件
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const meetingId = formData.get("meetingId");

    if (!(file instanceof File) || !isPositiveIntegerId(meetingId)) {
      return NextResponse.json(
        { success: false, error: "文件和会议ID是必填项" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { success: false, error: "音频文件过大" },
        { status: 413 },
      );
    }

    // 获取token
    const token = getTokenFromRequest(request);

    // 创建新的FormData发送到FastAPI
    const fd = new FormData();
    fd.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/meetings/${encodeURIComponent(meetingId)}/audio`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
      signal: AbortSignal.timeout(5 * 60_000),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(data, "上传失败") },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("上传音频文件失败:", error);
    return NextResponse.json(
      { success: false, error: "上传服务暂时不可用" },
      { status: 502 }
    );
  }
}
