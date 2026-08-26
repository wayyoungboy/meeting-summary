import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, proxyToFastAPI } from "@/lib/api-proxy";

// 推送任务到钉钉
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { taskIds } = body;

  if (
    !Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 100 ||
    taskIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    return NextResponse.json(
      { success: false, error: "请选择要推送的任务" },
      { status: 400 }
    );
  }

  try {
    const response = await proxyToFastAPI(
      request,
      "/api/tasks/push",
      "POST",
      { task_ids: taskIds },
    );
    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(data, "推送失败") },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}
