"use client";
import { useState } from "react";
import { useAuth } from "@/lib/store/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter()
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    try {
      if (mode === "login") {
        await login(email, password);
        setSuccess("登录成功，返回首页体验吧！");
        // 给cookie设置一些时间，然后跳转
        setTimeout(() => {
          window.location.href = "/";
        }, 100);
      } else {
        await register({ name, email, password });
        setSuccess("注册并登录成功！");
        // 给cookie设置一些时间，然后跳转
        setTimeout(() => {
          window.location.href = "/";
        }, 100);
      }
    } catch (_) {}
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🪑</div>
            <h1 className="text-2xl font-semibold">{mode === "login" ? "欢迎登录" : "创建账号"}</h1>
            <p className="text-sm text-muted-foreground mt-1">ChaTofFun 账号用于登录站点助手（聊天与选品）</p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button variant={mode === "login" ? "default" : "outline"} className="w-1/2" onClick={() => setMode("login")}>登录</Button>
            <Button variant={mode === "register" ? "default" : "outline"} className="w-1/2" onClick={() => setMode("register")}>注册</Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm mb-1">昵称</label>
                <Input placeholder="你的名字（可选）" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-sm mb-1">邮箱</label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">密码</label>
              <Input type="password" placeholder="至少 6 位" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            返回 <Link href="/" className="underline">首页</Link>
          </p>
        </div>
      </div>
    </main>
  );
}


