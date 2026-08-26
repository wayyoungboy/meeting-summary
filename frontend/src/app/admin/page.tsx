"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, BarChart3, Plus, Key, Trash2, Save, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_meetings: number;
  completed_meetings: number;
  processing_meetings: number;
  pending_meetings: number;
}

function AdminContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);
  const [editingPassword, setEditingPassword] = useState<number | null>(null);
  const [newEditPassword, setNewEditPassword] = useState("");

  useEffect(() => {
    Promise.all([fetchUsers(), fetchStats()]).finally(() => setLoading(false));
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createUser = async () => {
    if (!newUsername || !newPassword) return;
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewUsername("");
        setNewPassword("");
        setNewRole("user");
        fetchUsers();
      } else {
        const data = await res.json();
        let msg = "创建失败";
        if (Array.isArray(data.detail)) {
          msg = data.detail.map((e: { msg: string }) => e.msg).join(", ");
        } else if (typeof data.detail === "string") {
          msg = data.detail;
        }
        setCreateError(msg);
      }
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updatePassword = async (userId: number) => {
    if (!newEditPassword) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: newEditPassword }),
      });
      if (res.ok) {
        setEditingPassword(null);
        setNewEditPassword("");
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    } finally {
    }
  };

  const updateRole = async (userId: number, role: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">系统管理</h1>

        <Tabs defaultValue="stats">
          <TabsList className="mb-6">
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" /> 数据统计
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> 用户管理
            </TabsTrigger>
          </TabsList>

          {/* 数据统计 */}
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center justify-center rounded-lg bg-blue-100 p-3 mr-4">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">总用户数</p>
                    <p className="text-2xl font-bold">{stats?.total_users}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center justify-center rounded-lg bg-gray-100 p-3 mr-4">
                    <AlertCircle className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">总会议数</p>
                    <p className="text-2xl font-bold">{stats?.total_meetings}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center justify-center rounded-lg bg-green-100 p-3 mr-4">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">已完成</p>
                    <p className="text-2xl font-bold">{stats?.completed_meetings}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center justify-center rounded-lg bg-yellow-100 p-3 mr-4">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">处理中</p>
                    <p className="text-2xl font-bold">{stats?.processing_meetings}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center justify-center rounded-lg bg-orange-100 p-3 mr-4">
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">待处理</p>
                    <p className="text-2xl font-bold">{stats?.pending_meetings}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 用户管理 */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>用户列表</CardTitle>
                  <CardDescription>管理系统中的所有用户</CardDescription>
                </div>
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(""); }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" /> 创建用户
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>创建新用户</DialogTitle>
                      <DialogDescription>填写新用户信息</DialogDescription>
                    </DialogHeader>
                    {createError && (
                      <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md p-3 border border-red-200 dark:border-red-900">
                        {createError}
                      </div>
                    )}
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>用户名</Label>
                        <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="输入用户名" />
                      </div>
                      <div className="grid gap-2">
                        <Label>密码</Label>
                        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少6个字符" />
                      </div>
                      <div className="grid gap-2">
                        <Label>角色</Label>
                        <Select value={newRole} onValueChange={setNewRole}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">普通用户</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
                      <Button onClick={createUser} disabled={creating || !newUsername || !newPassword}>
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        创建
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{user.username}</p>
                          <p className="text-sm text-gray-500">
                            创建于 {new Date(user.created_at).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? "管理员" : "用户"}
                        </Badge>
                        <Select defaultValue={user.role} onValueChange={(v) => updateRole(user.id, v)}>
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">用户</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                        {editingPassword === user.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="password"
                              className="w-[140px] h-8"
                              placeholder="新密码"
                              value={newEditPassword}
                              onChange={(e) => setNewEditPassword(e.target.value)}
                            />
                            <Button size="sm" className="h-8 px-2" onClick={() => updatePassword(user.id)}>
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setEditingPassword(null); setNewEditPassword(""); }}>
                              取消
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditingPassword(user.id)}>
                            <Key className="h-3 w-3" /> 重置密码
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={() => deleteUser(user.id, user.username)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard role="admin">
      <AdminContent />
    </AuthGuard>
  );
}
