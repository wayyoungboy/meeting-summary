"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuthGuard } from "@/components/auth-guard";
import { Navbar } from "@/components/navbar";

interface User {
  id?: number;
  username: string;
  role: string;
  created_at?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = await response.json();
      if (data.success && data.data) {
        setUser(data.data);
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "两次输入的新密码不一致" });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: "error", text: "新密码长度至少8位" });
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: "密码修改成功" });
        setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setMessage({ type: "error", text: data.error || "修改失败" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误" });
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-gray-500">加载中...</div>
        </div>
      </AuthGuard>
    );
  }

  if (!user) return null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{user.username}</CardTitle>
                  <CardDescription>
                    {user.role === "admin" ? "管理员" : "普通用户"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>修改密码</CardTitle>
              <CardDescription>建议使用至少8位且不与其他网站重复的密码</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {message.text && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"}>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="old-password">旧密码</Label>
                  <Input
                    id="old-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.oldPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, oldPassword: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">新密码</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">确认新密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                    required
                  />
                </div>
                <Button type="submit">修改密码</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>退出登录</CardTitle>
              <CardDescription>清除当前浏览器中的登录会话</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleLogout}>退出登录</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
