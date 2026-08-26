"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { CalendarIcon, Plus, FileAudio, Clock, Users, CheckCircle2, AlertCircle, Loader2, ArrowRight, Mic, FileText, Bell } from "lucide-react";
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

function HomePageContent() {
  const router = useRouter();
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
      if (!response.ok) {
        console.error("获取会议列表失败:", response.status);
        return;
      }
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
        // 跳转到会议详情页
        router.push(`/meeting/${result.data.id}`);
      }
    } catch (error) {
      console.error("创建会议失败:", error);
    } finally {
      setCreating(false);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              智能会议助手
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              语音转写 · 智能纪要 · 任务推送
            </p>
          </div>
          
          <div className="flex justify-center gap-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="secondary" className="gap-2">
                  <Plus className="h-5 w-5" />
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
            
            <Link href="/meetings">
              <Button size="lg" variant="outline" className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20">
                查看所有会议
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            核心功能
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <Mic className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <CardTitle>语音转写</CardTitle>
                <CardDescription>
                  上传会议音频，自动转写为文字记录
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                    <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <CardTitle>智能纪要</CardTitle>
                <CardDescription>
                  AI 自动生成会议摘要、关键点和待办事项
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <Bell className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <CardTitle>任务推送</CardTitle>
                <CardDescription>
                  自动提取待办任务，支持导出到外部系统
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center justify-center rounded-lg bg-blue-100 p-3 mr-4">
                  <Users className="h-6 w-6 text-blue-600" />
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
                  <Clock className="h-6 w-6 text-yellow-600" />
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
                <div className="flex items-center justify-center rounded-lg bg-purple-100 p-3 mr-4">
                  <FileAudio className="h-6 w-6 text-purple-600" />
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
        </section>

        {/* Recent Meetings */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">最近会议</h2>
            <Link href="/meetings">
              <Button variant="ghost" className="gap-2">
                查看全部
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">暂无会议记录</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">点击上方“新建会议”开始使用</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.slice(0, 5).map((meeting) => (
                    <Link
                      key={meeting.id}
                      href={`/meeting/${meeting.id}`}
                      className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
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
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          创建于 {format(new Date(meeting.created_at), "PP", { locale: zhCN })}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 dark:text-gray-400">
          <p>会议智能助手 · 让会议更高效</p>
        </div>
      </footer>
      </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomePageContent />
    </AuthGuard>
  );
}
