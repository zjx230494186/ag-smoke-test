"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface DocRow {
    id: string;
    title: string;
    user_id: string;
}

interface Version {
    id: string;
    content: string;
    comment: string;
    created_at: string;
    created_by: string | null;
    creator_email?: string;
}

interface Membership {
    role: string;
}

export default function DocPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [doc, setDoc] = useState<DocRow | null>(null);
    const [myRole, setMyRole] = useState<string>(""); // owner | editor | viewer | ""
    const [content, setContent] = useState("");
    const [comment, setComment] = useState("");
    const [versions, setVersions] = useState<Version[]>([]);
    const [status, setStatus] = useState("");
    const [saving, setSaving] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const fetchVersions = useCallback(async () => {
        const { data } = await supabase
            .from("versions")
            .select("id, content, comment, created_at, created_by")
            .eq("document_id", id)
            .order("created_at", { ascending: false });
        if (!data) return;

        // 获取提交者邮箱：轮询 member_with_email view
        const memberEmails: Record<string, string> = {};
        const { data: members } = await supabase
            .from("member_with_email")
            .select("user_id, email")
            .eq("document_id", id);
        if (members) {
            for (const m of members) {
                memberEmails[m.user_id] = m.email;
            }
        }

        setVersions(
            data.map((v) => ({
                ...v,
                creator_email: v.created_by
                    ? (memberEmails[v.created_by] ?? v.created_by.slice(0, 8) + "…")
                    : "未知",
            }))
        );
    }, [id]);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) { router.push("/supabase-test"); return; }
            const currentUser = session.user;
            setUser(currentUser);

            // 加载文档
            const { data: docData, error } = await supabase
                .from("documents")
                .select("id, title, user_id")
                .eq("id", id)
                .single();

            if (error || !docData) {
                setStatus("❌ 文档不存在或无权限");
                setPageLoading(false);
                return;
            }
            setDoc(docData);

            // 判断角色
            if (docData.user_id === currentUser.id) {
                setMyRole("owner");
            } else {
                const { data: mem } = await supabase
                    .from("document_members")
                    .select("role")
                    .eq("document_id", id)
                    .eq("user_id", currentUser.id)
                    .single();
                setMyRole((mem as Membership | null)?.role ?? "");
            }

            await fetchVersions();
            setPageLoading(false);
        });
    }, [id, router, fetchVersions]);

    const saveVersion = async () => {
        if (!content.trim()) { setStatus("❌ 内容不能为空"); return; }
        setSaving(true);
        setStatus("");
        const { error } = await supabase.from("versions").insert({
            document_id: id,
            content: content.trim(),
            comment: comment.trim(),
            created_by: user!.id,
        });
        setSaving(false);
        if (error) {
            setStatus(`❌ ${error.message}`);
        } else {
            setComment("");
            setStatus("✅ 版本已保存！");
            await fetchVersions();
        }
    };

    const loadVersion = (v: Version) => {
        setContent(v.content);
        setStatus(`📂 已加载版本 ${new Date(v.created_at).toLocaleString("zh-CN")}`);
    };

    const canEdit = myRole === "owner" || myRole === "editor";
    const roleBadgeColor: Record<string, string> = {
        owner: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        editor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        viewer: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    };

    if (pageLoading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="text-white animate-pulse">Loading...</div>
            </main>
        );
    }

    if (!doc) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="text-red-400 text-center">
                    <p className="text-xl mb-2">🚫 无法访问此文档</p>
                    <p className="text-sm text-slate-500">{status}</p>
                    <a href="/supabase-test" className="text-indigo-400 text-sm mt-4 block hover:underline">← 返回文档列表</a>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
            <div className="max-w-3xl mx-auto space-y-4">
                {/* Header */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white">{doc.title}</h1>
                        <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${roleBadgeColor[myRole] ?? "text-slate-400"}`}>
                            {myRole || "no access"}
                        </span>
                        {myRole === "owner" && (
                            <a href={`/doc/${id}/share`} className="text-xs bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-lg transition">
                                共享设置
                            </a>
                        )}
                        <a href="/supabase-test" className="text-xs text-slate-500 hover:text-slate-300 transition">← 返回</a>
                    </div>
                </div>

                {/* 编辑区 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-3">
                    <h2 className="text-sm font-semibold text-slate-300">文档内容</h2>
                    <textarea
                        rows={8}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={canEdit ? "在这里编写文档内容..." : "（只读权限，无法编辑）"}
                        readOnly={!canEdit}
                        className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-y font-mono"
                    />
                    {canEdit && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="版本备注（可选）"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveVersion()}
                                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                            />
                            <button
                                onClick={saveVersion}
                                disabled={saving}
                                className="bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer text-sm"
                            >
                                {saving ? "保存中..." : "保存新版本"}
                            </button>
                        </div>
                    )}
                    {status && <p className="text-xs text-slate-300">{status}</p>}
                </div>

                {/* 版本列表 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                    <h2 className="text-sm font-semibold text-slate-300 mb-3">
                        版本历史 <span className="text-slate-500">({versions.length})</span>
                    </h2>
                    {versions.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-4">暂无版本，保存第一个版本吧 👆</p>
                    ) : (
                        <ul className="space-y-2">
                            {versions.map((v) => (
                                <li key={v.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-slate-400 font-mono">
                                                {new Date(v.created_at).toLocaleString("zh-CN")}
                                            </span>
                                            <span className="text-xs text-indigo-400">{v.creator_email}</span>
                                        </div>
                                        {v.comment && (
                                            <p className="text-xs text-slate-300 mt-1 italic">"{v.comment}"</p>
                                        )}
                                        <p className="text-xs text-slate-600 mt-1 truncate">
                                            {v.content.slice(0, 60)}{v.content.length > 60 ? "…" : ""}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => loadVersion(v)}
                                        className="shrink-0 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-3 py-1 rounded-lg transition cursor-pointer"
                                    >
                                        加载
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </main>
    );
}
