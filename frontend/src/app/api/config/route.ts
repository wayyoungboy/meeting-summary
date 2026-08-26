import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, proxyToFastAPI } from "@/lib/api-proxy";

// 获取系统配置
export async function GET(request: NextRequest) {
  try {
    const response = await proxyToFastAPI(request, "/api/config");

    if (response.ok) {
      const data = await response.json();
      const configs = [
        { key: "llm_base_url", value: data.llm_baseurl || "" },
        { key: "llm_api_key", value: data.llm_apikey || "" },
        { key: "llm_model", value: data.llm_model || "" },
        { key: "dingtalk_webhook", value: data.dingtalk_webhook || "" },
        { key: "dingtalk_secret", value: data.dingtalk_secret || "" },
        { key: "auth_enabled", value: String(data.auth_enabled ?? true) },
      ];
      return NextResponse.json({ success: true, data: configs });
    }

    const error: unknown = await response.json().catch(() => null);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "获取配置失败") },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}

// 更新系统配置
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!Array.isArray(body.configs)) {
      return NextResponse.json({ success: false, error: "配置格式无效" }, { status: 400 });
    }

  // 前端发送 {configs: [{key, value}]}
  // 转换为后端期望的格式
    const configMap: Record<string, string> = {};
    for (const item of body.configs) {
      if (
        typeof item !== "object" || item === null ||
        typeof (item as Record<string, unknown>).key !== "string" ||
        typeof (item as Record<string, unknown>).value !== "string"
      ) {
        return NextResponse.json({ success: false, error: "配置格式无效" }, { status: 400 });
      }
      const entry = item as { key: string; value: string };
      configMap[entry.key] = entry.value;
    }

    const updateData = {
      llm_baseurl: configMap.llm_base_url,
      llm_apikey: configMap.llm_api_key,
      llm_model: configMap.llm_model,
      dingtalk_webhook: configMap.dingtalk_webhook,
      dingtalk_secret: configMap.dingtalk_secret,
      auth_enabled: configMap.auth_enabled === "true",
    };

    const response = await proxyToFastAPI(request, "/api/config", "PUT", updateData);

    if (response.ok) {
      return NextResponse.json({ success: true });
    }

    const error: unknown = await response.json().catch(() => null);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "更新配置失败") },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}
