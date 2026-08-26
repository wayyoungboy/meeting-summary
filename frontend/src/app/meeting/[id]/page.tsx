"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileAudio,
  Upload,
  FileText,
  ListTodo,
  Clock,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  Copy,
  Send,
  ArrowLeft,
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Navbar } from "@/components/navbar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  audio_path: string | null;
  audio_filename: string | null;
  duration: number | null;
  status: string;
  created_at: string;
}

interface AudioFile {
  id: string;
  file_name: string;
  file_size: number;
  duration: number | null;
  created_at: string;
}

interface TranscriptSegment {
  speaker: string;
  content: string;
  start_time: number;
  end_time: number;
  sequence: number;
}

interface Transcript {
  id: string;
  content: string;
  duration: number | null;
  created_at: string;
  segments?: TranscriptSegment[];
}

interface MeetingMinute {
  id: string;
  summary: string;
  key_points: string | null;
  decisions: string | null;
  action_items: string | null;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  external_id: string | null;
  external_type: string | null;
  external_url: string | null;
  created_at: string;
}

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [minutes, setMinutes] = useState<MeetingMinute | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dingtalkConfigured, setDingtalkConfigured] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pushingTaskId, setPushingTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchMeetingData();
    fetchConfig();
    // These functions use meetingId and are intentionally refreshed with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // 轮询转写状态
  useEffect(() => {
    if (meeting?.status === "transcribing") {
      const interval = setInterval(() => {
        updateMeetingStatus();
      }, 3000); // 每3秒轮询一次
      return () => clearInterval(interval);
    }
    // updateMeetingStatus only reads the stable meetingId for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.status]);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/config/dingtalk-status");
      const result = await response.json();
      if (result.success) {
        setDingtalkConfigured(result.data.configured);
      }
    } catch (error) {
      console.error("获取配置失败:", error);
    }
  };

  const fetchMeetingData = async () => {
    setLoading(true);
    try {
      // 获取会议信息
      const meetingRes = await fetch(`/api/meetings/${meetingId}`, { credentials: "include" });
      const meetingResult = await meetingRes.json();
      if (meetingResult.success) {
        setMeeting(meetingResult.data);
      }

      // 获取音频文件列表
      const audioRes = await fetch(`/api/audio?meetingId=${meetingId}`, { credentials: "include" });
      const audioResult = await audioRes.json();
      if (audioResult.success) {
        setAudioFiles(audioResult.data || []);
      }

      // 获取转写文本
      const transcriptRes = await fetch(`/api/transcripts?meetingId=${meetingId}`, { credentials: "include" });
      const transcriptResult = await transcriptRes.json();
      if (transcriptResult.success && transcriptResult.data) {
        setTranscript(transcriptResult.data);
      }

      // 获取会议纪要
      const minutesRes = await fetch(`/api/minutes?meetingId=${meetingId}`, { credentials: "include" });
      const minutesResult = await minutesRes.json();
      if (minutesResult.success && minutesResult.data) {
        setMinutes(minutesResult.data);
      }

      // 获取任务列表
      const tasksRes = await fetch(`/api/tasks?meetingId=${meetingId}`, { credentials: "include" });
      const tasksResult = await tasksRes.json();
      if (tasksResult.success) {
        // 后端返回 {meeting_id, tasks} 格式
        const tasksData = tasksResult.data;
        setTasks(tasksData?.tasks || tasksData || []);
      }
    } catch (error) {
      console.error("获取会议数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 仅更新会议状态（上传音频后使用）
  const updateMeetingStatus = async () => {
    try {
      const meetingRes = await fetch(`/api/meetings/${meetingId}`, { credentials: "include" });
      const meetingResult = await meetingRes.json();
      if (meetingResult.success) {
        setMeeting(meetingResult.data);

        // 如果转写完成，获取转写结果
        if (meetingResult.data.status === "completed") {
          const transcriptRes = await fetch(`/api/transcripts?meetingId=${meetingId}`, { credentials: "include" });
          const transcriptResult = await transcriptRes.json();
          if (transcriptResult.success && transcriptResult.data) {
            setTranscript(transcriptResult.data);
          }
        }
      }

      const audioRes = await fetch(`/api/audio?meetingId=${meetingId}`, { credentials: "include" });
      const audioResult = await audioRes.json();
      if (audioResult.success) {
        setAudioFiles(audioResult.data || []);
      }
    } catch (error) {
      console.error("更新会议状态失败:", error);
    }
  };

  // 仅更新转写和任务（生成纪要后使用）
  const updateMinutesAndTasks = async () => {
    try {
      const minutesRes = await fetch(`/api/minutes?meetingId=${meetingId}`, { credentials: "include" });
      const minutesResult = await minutesRes.json();
      if (minutesResult.success && minutesResult.data) {
        setMinutes(minutesResult.data);
      }

      const tasksRes = await fetch(`/api/tasks?meetingId=${meetingId}`, { credentials: "include" });
      const tasksResult = await tasksRes.json();
      if (tasksResult.success) {
        const tasksData = tasksResult.data;
        setTasks(tasksData?.tasks || tasksData || []);
      }
    } catch (error) {
      console.error("更新纪要和任务失败:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("meetingId", meetingId);

      const response = await fetch("/api/audio/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        toast.success("音频上传成功");
        updateMeetingStatus();
      } else {
        toast.error(result.error || "上传失败");
      }
    } catch (error) {
      console.error("上传音频失败:", error);
      toast.error("上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!meeting) {
      toast.error("会议信息未加载");
      return;
    }

    if (!meeting.audio_path && audioFiles.length === 0) {
      toast.error("请先上传音频文件");
      return;
    }

    setTranscribing(true);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        toast.success(result.data?.message || "转写任务已启动");
        updateMeetingStatus();
      } else {
        toast.error(result.error || "转写失败");
      }
    } catch (error) {
      console.error("语音转写失败:", error);
      toast.error("转写失败");
    } finally {
      setTranscribing(false);
    }
  };

  const handleGenerateMinutes = async () => {
    if (!transcript) {
      toast.error("请先进行语音转写");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/minutes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("会议纪要生成成功");
        updateMinutesAndTasks();
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      console.error("生成会议纪要失败:", error);
      toast.error("生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handlePushTask = async (taskId: string) => {
    if (!dingtalkConfigured) {
      toast.error("请先在系统设置中配置钉钉 Webhook 地址");
      return;
    }

    setPushingTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [parseInt(taskId)] }),
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        toast.success("任务已推送到钉钉");
      } else {
        toast.error(result.error || "推送失败");
      }
    } catch (error) {
      console.error("推送任务失败:", error);
      toast.error("推送失败");
    } finally {
      setPushingTaskId(null);
    }
  };

  const handleDeleteMeeting = async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        toast.success("会议已删除");
        router.push("/");
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error("删除会议失败:", error);
      toast.error("删除失败");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; color: string }> = {
      low: { label: "低", color: "bg-gray-100 text-gray-800" },
      medium: { label: "中", color: "bg-yellow-100 text-yellow-800" },
      high: { label: "高", color: "bg-orange-100 text-orange-800" },
      urgent: { label: "紧急", color: "bg-red-100 text-red-800" },
    };
    const c = config[priority] || config.medium;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>{c.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string }> = {
      pending: { label: "待处理", color: "bg-gray-100 text-gray-800" },
      in_progress: { label: "进行中", color: "bg-blue-100 text-blue-800" },
      completed: { label: "已完成", color: "bg-green-100 text-green-800" },
      cancelled: { label: "已取消", color: "bg-red-100 text-red-800" },
    };
    const c = config[status] || config.pending;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>{c.label}</span>;
  };

  // 格式化时间戳
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 获取说话人颜色
  const getSpeakerColor = (speaker: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      "说话人0": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      "说话人1": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
      "说话人2": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
      "说话人3": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
      "说话人4": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
      "说话人5": { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
    };
    return colors[speaker] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
  };

  // 按说话人分组 segments
  const groupSegmentsBySpeaker = (segments: TranscriptSegment[]) => {
    const groups: { speaker: string; segments: TranscriptSegment[] }[] = [];
    let currentSpeaker = "";
    let currentGroup: TranscriptSegment[] = [];

    segments.forEach((segment) => {
      if (segment.speaker !== currentSpeaker) {
        if (currentGroup.length > 0) {
          groups.push({ speaker: currentSpeaker, segments: currentGroup });
        }
        currentSpeaker = segment.speaker;
        currentGroup = [segment];
      } else {
        currentGroup.push(segment);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ speaker: currentSpeaker, segments: currentGroup });
    }

    return groups;
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AuthGuard>
    );
  }

  if (!meeting) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">会议不存在</h2>
          <Button className="mt-4" onClick={() => router.push("/")}>
            返回首页
          </Button>
        </div>
      </AuthGuard>
    );
  }

  const progress = meeting.status === "completed" ? 100 : meeting.status === "processing" ? 60 : 20;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {isValid(parseISO(meeting.meeting_date)) 
                    ? format(parseISO(meeting.meeting_date), "PPP", { locale: zhCN })
                    : meeting.meeting_date}
                </span>
                {meeting.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Math.floor(meeting.duration / 60)}分钟
                  </span>
                )}
              </div>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                删除会议
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除会议及其所有相关数据（音频、转写、纪要、任务），且无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteMeeting}>确认删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Progress */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">处理进度</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {audioFiles.length > 0 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-gray-300" />
                )}
                上传音频
              </span>
              <span className="flex items-center gap-1">
                {transcript ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-gray-300" />
                )}
                语音转写
              </span>
              <span className="flex items-center gap-1">
                {minutes ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-gray-300" />
                )}
                生成纪要
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upload">
              <FileAudio className="mr-2 h-4 w-4" />
              音频上传
            </TabsTrigger>
            <TabsTrigger value="transcript" disabled={!transcript}>
              <FileText className="mr-2 h-4 w-4" />
              转写文本
            </TabsTrigger>
            <TabsTrigger value="minutes" disabled={!minutes}>
              <FileText className="mr-2 h-4 w-4" />
              会议纪要
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ListTodo className="mr-2 h-4 w-4" />
              任务列表
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>上传会议音频</CardTitle>
                <CardDescription>支持 MP3、WAV、M4A 等格式，最大 100MB</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="audio-upload"
                    className="hidden"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="audio-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    {uploading ? (
                      <Loader2 className="h-12 w-12 text-muted-foreground animate-spin mb-4" />
                    ) : (
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                    )}
                    <span className="text-lg font-medium">
                      {uploading ? "上传中..." : "点击或拖拽上传音频文件"}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      支持 MP3, WAV, M4A, OGG 格式
                    </span>
                  </label>
                </div>

                {audioFiles.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">已上传文件</h3>
                    {audioFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileAudio className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(file.file_size)}
                              {file.duration != null && file.duration > 0 && ` · ${Math.floor(file.duration / 60)}分钟`}
                            </p>
                          </div>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  {(meeting.status === "transcribing" || transcribing) && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mb-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>语音转写正在进行中，请稍候...</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleTranscribe}
                    disabled={transcribing || meeting.status === "transcribing" || meeting.status === "completed" || audioFiles.length === 0}
                  >
                    {transcribing || meeting.status === "transcribing" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        转写中...
                      </>
                    ) : meeting.status === "completed" ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        转写已完成
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        开始语音转写 (FunASR)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>转写文本</CardTitle>
                <CardDescription>
                  多人语音识别结果，按说话人分组展示
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transcript?.segments && transcript.segments.length > 0 ? (
                  <div className="space-y-4 min-h-[400px]">
                    {groupSegmentsBySpeaker(transcript.segments).map((group, groupIndex) => {
                      const speakerColor = getSpeakerColor(group.speaker);
                      return (
                        <div
                          key={groupIndex}
                          className={`p-4 rounded-lg ${speakerColor.bg} ${speakerColor.border} border`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${speakerColor.text} bg-white/50`}>
                              {group.speaker}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.segments.map((segment, segIndex) => (
                              <div key={segIndex} className="flex items-start gap-3">
                                <span className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
                                  {formatTimestamp(segment.start_time)} - {formatTimestamp(segment.end_time)}
                                </span>
                                <p className="text-sm leading-relaxed">{segment.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Textarea
                    readOnly
                    value={transcript?.content || ""}
                    className="min-h-[400px] font-mono text-sm"
                  />
                )}
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleGenerateMinutes} disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        生成会议纪要
                      </>
                    )}
                  </Button>
                  {transcript && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(transcript.content);
                        toast.success("已复制到剪贴板");
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      复制转写文本
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Minutes Tab */}
          <TabsContent value="minutes">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>会议纪要</CardTitle>
                </CardHeader>
                <CardContent>
                  {minutes?.summary ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => <h2 className="text-xl font-bold mt-4 mb-2">{children}</h2>,
                          h2: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                          h3: ({ children }) => <h4 className="text-base font-medium mt-3 mb-1">{children}</h4>,
                          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>,
                          th: ({ children }) => (
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-medium">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                              {children}
                            </td>
                          ),
                          tr: ({ children }) => <tr className="even:bg-gray-50 dark:even:bg-gray-900">{children}</tr>,
                          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-muted-foreground my-2">
                              {children}
                            </blockquote>
                          ),
                          hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
                        }}
                      >
                        {minutes.summary}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">暂无纪要</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>任务列表</CardTitle>
                <CardDescription>
                  {tasks.length > 0 ? `共 ${tasks.length} 个任务` : "暂无任务"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>生成会议纪要后，行动项目将自动转为任务</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{task.title}</h3>
                              {getPriorityBadge(task.priority)}
                              {getStatusBadge(task.status)}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {task.assignee && <span>负责人: {task.assignee}</span>}
                              {task.due_date && isValid(parseISO(task.due_date)) && (
                                <span>截止: {format(parseISO(task.due_date), "PP", { locale: zhCN })}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {task.external_url ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={task.external_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-3 w-3" />
                                  {task.external_type?.toUpperCase()}
                                </a>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePushTask(task.id)}
                                disabled={pushingTaskId === task.id}
                              >
                                {pushingTaskId === task.id ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="mr-2 h-3 w-3" />
                                )}
                                推送到钉钉
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </AuthGuard>
  );
}
