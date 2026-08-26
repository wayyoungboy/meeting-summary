import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

// 获取单个会议
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isPositiveIntegerId(id)) {
    return NextResponse.json({ success: false, error: "会议ID无效" }, { status: 400 });
  }

  try {
    const response = await proxyToFastAPI(request, `/api/meetings/${id}`);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        data: {
          id: String(data.id),
          title: data.title,
          meeting_date: data.meeting_date,
          duration: data.duration,
          status: data.status,
          audio_path: data.audio_path,
          audio_filename: data.audio_filename,
          audio_filesize: data.audio_filesize,
          created_at: data.created_at,
        }
      });
    }

    const error: unknown = await response.json().catch(() => null);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "获取失败") },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}

// 删除会议
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isPositiveIntegerId(id)) {
    return NextResponse.json({ success: false, error: "会议ID无效" }, { status: 400 });
  }

  try {
    const response = await proxyToFastAPI(request, `/api/meetings/${id}`, "DELETE");

    if (response.ok) {
      return NextResponse.json({ success: true });
    }

    const error: unknown = await response.json().catch(() => null);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "删除失败") },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}
