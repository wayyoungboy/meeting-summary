"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon, Plus, Clock, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  duration: number | null;
  status: string;
  created_at: string;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await fetch("/api/meetings", { credentials: "include" });
      const result = await response.json();
      if (result.success) {
        setMeetings(result.data);
      }
    } catch (error) {
      console.error("获取会议列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async () => {
    if (!title || !meetingDate) return;

    setCreating(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          meetingDate: meetingDate.toISOString(),
        }),
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        setOpen(false);
        setTitle("");
        setDescription("");
        setMeetingDate(undefined);
        fetchMeetings();
      }
    } catch (error) {
      console.error("创建会议失败:", error);
    } finally {
      setCreating(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm("确定要删除这个会议吗？")) return;
    
    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        fetchMeetings();
      }
    } catch (error) {
      console.error("删除会议失败:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "待处理", variant: "secondary" },
      processing: { label: "处理中", variant: "default" },
      completed: { label: "已完成", variant: "outline" },
      failed: { label: "失败", variant: "destructive" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">会议管理</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">管理您的所有会议记录</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新建会议
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>创建新会议</DialogTitle>
                <DialogDescription>填写会议信息以创建新的会议记录</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">会议标题 *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入会议标题"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">会议描述</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="输入会议描述（可选）"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>会议日期 *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !meetingDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {meetingDate ? format(meetingDate, "PPP", { locale: zhCN }) : "选择日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={meetingDate}
                        onSelect={setMeetingDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button onClick={createMeeting} disabled={creating || !title || !meetingDate}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    "创建"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-center rounded-lg bg-blue-100 p-3 mr-4">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">总会议数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{meetings.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-center rounded-lg bg-green-100 p-3 mr-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">已完成</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {meetings.filter((m) => m.status === "completed").length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-center rounded-lg bg-yellow-100 p-3 mr-4">
                <Loader2 className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">处理中</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {meetings.filter((m) => m.status === "processing").length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-center rounded-lg bg-gray-100 p-3 mr-4">
                <AlertCircle className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">待处理</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {meetings.filter((m) => m.status === "pending").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meeting List */}
        <Card>
          <CardHeader>
            <CardTitle>会议列表</CardTitle>
            <CardDescription>点击会议查看详情、上传音频、生成纪要</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">暂无会议记录</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">点击右上角“新建会议”开始使用</p>
              </div>
            ) : (
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <Link
                      href={`/meeting/${meeting.id}`}
                      className="flex-1"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{meeting.title}</h3>
                        {getStatusBadge(meeting.status)}
                      </div>
                      {meeting.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                          {meeting.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>
                          {format(new Date(meeting.meeting_date), "PPP", { locale: zhCN })}
                        </span>
                        {meeting.duration && (
                          <span>{formatDuration(meeting.duration)}</span>
                        )}
                        <span>创建于 {format(new Date(meeting.created_at), "PP", { locale: zhCN })}</span>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.preventDefault();
                        deleteMeeting(meeting.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      </div>
    </AuthGuard>
  );
}
