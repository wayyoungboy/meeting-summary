"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Settings, CheckCircle2, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { Switch } from "@/components/ui/switch";

interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
}

export default function SettingsPage() {
  return (
    <AuthGuard role="admin">
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch("/api/config", { credentials: "include" });
      const result = await response.json();
      if (result.success) {
        const configMap: Record<string, string> = {};
        result.data.forEach((c: SystemConfig) => {
          configMap[c.key] = c.value;
        });
        setConfigs(configMap);
      }
    } catch (error) {
      console.error("获取配置失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const configsArray = Object.entries(configs).map(([key, value]) => ({ key, value }));
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: configsArray }),
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: "success", text: "配置保存成功" });
      } else {
        setMessage({ type: "error", text: result.error || "保存失败" });
      }
    } catch {
      setMessage({ type: "error", text: "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">系统设置</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">配置 LLM 服务和钉钉推送</p>
        </div>

        {/* LLM 配置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              LLM 服务配置
            </CardTitle>
            <CardDescription>
              配置大语言模型服务，支持 OpenAI 兼容的 API。推荐使用智谱 GLM-4.7-Flash（免费）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="llm_base_url">Base URL *</Label>
              <Input
                id="llm_base_url"
                placeholder="https://open.bigmodel.cn/api/paas/v4"
                value={configs.llm_base_url || ""}
                onChange={(e) => setConfigs({ ...configs, llm_base_url: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                智谱 GLM: https://open.bigmodel.cn/api/paas/v4 | OpenAI: https://api.openai.com/v1 | Ollama: http://localhost:11434/v1
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm_api_key">API Key *</Label>
              <Input
                id="llm_api_key"
                type="password"
                placeholder="请输入 API Key"
                value={configs.llm_api_key || ""}
                onChange={(e) => setConfigs({ ...configs, llm_api_key: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                智谱 API Key 请前往 <a href="https://bigmodel.cn/usercenter/proj-mgmt/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">bigmodel.cn</a> 创建
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm_model">模型名称</Label>
              <Input
                id="llm_model"
                placeholder="GLM-4.7-Flash（推荐，免费）"
                value={configs.llm_model || ""}
                onChange={(e) => setConfigs({ ...configs, llm_model: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                推荐: GLM-4.7-Flash（免费） | 其他: gpt-3.5-turbo, deepseek-chat, llama2
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 钉钉配置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              钉钉推送配置
            </CardTitle>
            <CardDescription>
              配置钉钉机器人 Webhook，用于推送待办任务通知
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dingtalk_webhook">钉钉 Webhook 地址</Label>
              <Input
                id="dingtalk_webhook"
                placeholder="例如: https://oapi.dingtalk.com/robot/send?access_token=xxx"
                value={configs.dingtalk_webhook || ""}
                onChange={(e) => setConfigs({ ...configs, dingtalk_webhook: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                钉钉群机器人的 Webhook 地址，用于推送任务通知
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dingtalk_secret">钉钉加签密钥（可选）</Label>
              <Input
                id="dingtalk_secret"
                type="password"
                placeholder="SEC...开头的密钥"
                value={configs.dingtalk_secret || ""}
                onChange={(e) => setConfigs({ ...configs, dingtalk_secret: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                如果机器人安全设置开启了“加签”，需要填写此密钥
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 认证设置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              认证设置
            </CardTitle>
            <CardDescription>
              控制系统是否需要登录认证
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auth_enabled">启用认证</Label>
                <p className="text-sm text-muted-foreground">
                  关闭后普通会议功能无需登录；管理设置仍需管理员身份
                </p>
              </div>
              <Switch
                id="auth_enabled"
                checked={configs.auth_enabled === "true"}
                onCheckedChange={(checked) => setConfigs({ ...configs, auth_enabled: checked ? "true" : "false" })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 消息提示 */}
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"} className="mb-6">
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* 保存按钮 */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              "保存配置"
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
