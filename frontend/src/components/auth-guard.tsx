"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  role?: "admin";
}

export function AuthGuard({ children, role }: AuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json();

        if (data.success && data.data) {
          if (role && data.data.role !== role) {
            router.replace("/");
            return;
          }
          setAuthorized(true);
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    void checkAuth();
  }, [role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500 dark:text-gray-400">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
