"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Document {
    id: string;
    title: string;
    created_at: string;
}

export default function SupabaseTestPage() {
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [docs, setDocs] = useState<Document[]>([]);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const fetchDocs = useCallback(async () => {
        const { data, error } = await supabase
            .from("documents")
            .select("id, title, created_at")
            .order("created_at", { ascending: false });
        if (error) {
            console.error("fetchDocs error:", error);
            setStatus(`❌ 加载文档失败：${error.message}`);
        } else {
            setDocs((data as Document[]) ?? []);
        }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchDocs();
            setPageLoading(false);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchDocs();
        });
        return () => listener.subscription.unsubscribe();
    }, [fetchDocs]);

    const sendMagicLink = async () => {
        if (!email) return;
        setLoading(true);
        setStatus("");
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback` },
        });
        setLoading(false);
        setStatus(error ? `❌ ${error.message}` : "✅ Magic Link 已发送，请检查邮箱！");
    };

    const createDoc = async () => {
        if (!newTitle.trim()) return;
        setLoading(true);
        const { error } = await supabase
            .from("documents")
            .insert({ title: newTitle.trim(), user_id: user!.id });
        setLoading(false);
        if (error) {
            setStatus(`❌ ${error.message}`);
        } else {
            setNewTitle("");
            setStatus("✅ 文档已创建！");
            await fetchDocs();
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setDocs([]);
        setStatus("");
    };

    if (pageLoading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="text-white text-lg animate-pulse">Loading...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
            <div className="max-w-xl w-full space-y-4">
                {/* Header */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-1">
                        我的文档
                    </h1>
                    <p className="text-slate-400 text-xs">Supabase · Magic Link · 多人共享</p>
                </div>

                {!user ? (
                    /* ── 未登录：Magic Link 表单 ── */
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md text-white space-y-4">
                        <h2 className="font-semibold text-slate-200">登录（Magic Link）</h2>
                        <input
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                        />
                        <button
                            onClick={sendMagicLink}
                            disabled={loading || !email}
                            className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                            {loading ? "发送中..." : "发送 Magic Link"}
                        </button>
                        {status && <p className="text-sm text-center text-slate-300">{status}</p>}
                    </div>
                ) : (
                    <>
                        {/* 用户信息 */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex items-center justify-between text-white">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest">已登录</p>
                                <p className="text-sm font-mono text-emerald-300">{user.email}</p>
                            </div>
                            <button
                                onClick={signOut}
                                className="text-xs bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 px-3 py-1 rounded-lg transition cursor-pointer"
                            >
                                登出
                            </button>
                        </div>

                        {/* 创建文档 */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md text-white space-y-3">
                            <h2 className="font-semibold text-slate-200">新建文档</h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="文档标题..."
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && createDoc()}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                />
                                <button
                                    onClick={createDoc}
                                    disabled={loading || !newTitle.trim()}
                                    className="bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer"
                                >
                                    {loading ? "..." : "创建"}
                                </button>
                            </div>
                            {status && <p className="text-xs text-slate-300">{status}</p>}
                        </div>

                        {/* 文档列表 */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md text-white">
                            <h2 className="font-semibold text-slate-200 mb-3">
                                文档列表 <span className="text-slate-500 text-sm">({docs.length})</span>
                            </h2>
                            {docs.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-4">暂无文档，创建第一篇吧 👆</p>
                            ) : (
                                <ul className="space-y-2">
                                    {docs.map((doc) => (
                                        <li key={doc.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white">{doc.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {new Date(doc.created_at).toLocaleString("zh-CN")}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 ml-3 shrink-0">
                                                <a
                                                    href={`/doc/${doc.id}`}
                                                    className="text-xs bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-lg transition"
                                                >
                                                    打开
                                                </a>
                                                <a
                                                    href={`/doc/${doc.id}/share`}
                                                    className="text-xs bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-lg transition"
                                                >
                                                    共享
                                                </a>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}

                <div className="text-center">
                    <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
                        ← 返回首页
                    </a>
                </div>
            </div>
        </main>
    );
}
