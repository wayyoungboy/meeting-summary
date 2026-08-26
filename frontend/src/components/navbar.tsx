"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, User, LogOut, Home, FileAudio, Calendar, Shield } from "lucide-react";

interface User {
  id?: string;
  email?: string;
  name?: string;
  username?: string;
  role?: string;
}

interface NavbarProps {
  showAuth?: boolean;
}

export function Navbar({ showAuth = true }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (showAuth) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [showAuth]);

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = await response.json();
      if (data.success && data.data) {
        const userObj = data.data.data || data.data;
        setUser(userObj);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      // ignore
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
              <FileAudio className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              会议智能助手
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                首页
              </Button>
            </Link>
            <Link href="/meetings">
              <Button variant="ghost" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                会议管理
              </Button>
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  系统管理
                </Button>
              </Link>
            )}
            {user?.role === "admin" && (
              <Link href="/settings">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  系统设置
                </Button>
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : showAuth && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-600 text-white">
                        {(user.name || user.username || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name || user.username || "用户"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email || ""}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user?.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center">
                        <Shield className="mr-2 h-4 w-4" />
                        系统管理
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        系统设置
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : showAuth ? (
              <Link href="/login">
                <Button>登录</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
