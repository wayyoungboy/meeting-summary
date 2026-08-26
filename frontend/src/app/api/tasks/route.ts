import { NextRequest, NextResponse } from "next/server";
import { isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

interface FastApiTask {
  id: number;
  meeting_id: number;
  content: string;
  assignee: string | null;
  deadline: string | null;
  pushed: boolean;
  push_time: string | null;
}

// 获取任务列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const meetingId = searchParams.get("meetingId");

  if (meetingId && !isPositiveIntegerId(meetingId)) {
    return NextResponse.json({ success: false, error: "会议ID无效" }, { status: 400 });
  }

  if (meetingId) {
    try {
      const response = await proxyToFastAPI(request, `/api/meetings/${meetingId}/tasks`);

      if (response.ok) {
        const data = (await response.json()) as { tasks?: FastApiTask[] };
        // 后端返回 {meeting_id, tasks: [{id, content, assignee, deadline, pushed}]}
        const tasks = (data.tasks || []).map((task) => ({
          id: String(task.id),
          meeting_id: task.meeting_id,
          title: task.content,
          content: task.content,
          description: null,
          assignee: task.assignee,
          due_date: task.deadline,
          deadline: task.deadline,
          priority: "medium",
          status: task.pushed ? "completed" : "pending",
          pushed: task.pushed,
          push_time: task.push_time,
          external_id: null,
          external_type: null,
          external_url: null,
          created_at: new Date().toISOString()
        }));
        return NextResponse.json({ success: true, data: tasks });
      }

      // 如果任务未生成，返回空数组
      if (response.status === 404) {
        return NextResponse.json({ success: true, data: [] });
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

  return NextResponse.json({ success: true, data: [] });
}
