"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Member {
    user_id: string;
    role: string;
    email: string;
    created_at: string;
}

export default function SharePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [isOwner, setIsOwner] = useState<boolean | null>(null);
    const [docTitle, setDocTitle] = useState("");
    const [members, setMembers] = useState<Member[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const fetchMembers = useCallback(async () => {
        const { data } = await supabase
            .from("member_with_email")
            .select("user_id, role, email, created_at")
            .eq("document_id", id)
            .order("created_at", { ascending: true });
        if (data) setMembers(data as Member[]);
    }, [id]);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) { router.push("/supabase-test"); return; }

            const { data: docData } = await supabase
                .from("documents")
                .select("id, title, user_id")
                .eq("id", id)
                .single();

            if (!docData) { setIsOwner(false); setPageLoading(false); return; }

            setDocTitle(docData.title);
            const owner = docData.user_id === session.user.id;
            setIsOwner(owner);

            if (owner) await fetchMembers();
            setPageLoading(false);
        });
    }, [id, router, fetchMembers]);

    const invite = async () => {
        if (!inviteEmail.trim()) return;
        setLoading(true);
        setStatus("");
        const { data, error } = await supabase.rpc("invite_member", {
            p_document_id: id,
            p_email: inviteEmail.trim(),
            p_role: inviteRole,
        });
        setLoading(false);

        if (error) {
            setStatus(`❌ ${error.message}`);
        } else if (data?.error) {
            const msgs: Record<string, string> = {
                user_not_found: "❌ 该邮箱未注册，请对方先用 Magic Link 登录一次",
                not_owner: "❌ 你不是此文档的 owner",
                invalid_role: "❌ 无效角色",
                cannot_invite_owner: "❌ 不可邀请文档 owner 本身",
            };
            setStatus(msgs[data.error] ?? `❌ ${data.error}`);
        } else {
            setInviteEmail("");
            setStatus("✅ 成员已添加/更新！");
            await fetchMembers();
        }
    };

    const removeMember = async (userId: string) => {
        const { error } = await supabase
            .from("document_members")
            .delete()
            .eq("document_id", id)
            .eq("user_id", userId);
        if (error) {
            setStatus(`❌ ${error.message}`);
        } else {
            setStatus("✅ 成员已移除");
            await fetchMembers();
        }
    };

    const changeRole = async (userId: string, newRole: string) => {
        const { data, error } = await supabase.rpc("invite_member", {
            p_document_id: id,
            p_email: members.find((m) => m.user_id === userId)?.email ?? "",
            p_role: newRole,
        });
        if (error || data?.error) {
            setStatus(`❌ 更新失败`);
        } else {
            setStatus("✅ 角色已更新");
            await fetchMembers();
        }
    };

    if (pageLoading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="text-white animate-pulse">Loading...</div>
            </main>
        );
    }

    if (!isOwner) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="text-center text-white">
                    <p className="text-4xl mb-3">🚫</p>
                    <p className="text-xl font-semibold mb-1">无权限</p>
                    <p className="text-sm text-slate-400 mb-4">只有文档 owner 可以管理成员</p>
                    <a href={`/doc/${id}`} className="text-indigo-400 hover:underline text-sm">← 返回文档</a>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
            <div className="max-w-lg mx-auto space-y-4">
                {/* Header */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">共享设置</h1>
                            <p className="text-xs text-slate-400 mt-0.5">{docTitle}</p>
                        </div>
                        <a href={`/doc/${id}`} className="text-xs text-slate-500 hover:text-slate-300 transition">← 返回文档</a>
                    </div>
                </div>

                {/* 邀请表单 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md text-white space-y-3">
                    <h2 className="font-semibold text-slate-200">邀请成员</h2>
                    <input
                        type="email"
                        placeholder="被邀请者的邮箱..."
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && invite()}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition text-sm"
                    />
                    <div className="flex gap-2">
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer"
                        >
                            <option value="editor" className="bg-slate-800">editor（可编辑）</option>
                            <option value="viewer" className="bg-slate-800">viewer（只读）</option>
                        </select>
                        <button
                            onClick={invite}
                            disabled={loading || !inviteEmail.trim()}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-40 text-white font-semibold py-2 rounded-xl transition-all cursor-pointer text-sm"
                        >
                            {loading ? "处理中..." : "邀请 / 更新"}
                        </button>
                    </div>
                    {status && <p className="text-xs text-slate-300">{status}</p>}
                </div>

                {/* 成员列表 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md text-white">
                    <h2 className="font-semibold text-slate-200 mb-3">
                        当前成员 <span className="text-slate-500 text-sm">({members.length})</span>
                    </h2>
                    {members.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-3">还没有共享成员</p>
                    ) : (
                        <ul className="space-y-2">
                            {members.map((m) => (
                                <li key={m.user_id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">{m.email}</p>
                                        <p className="text-xs text-slate-500">
                                            加入于 {new Date(m.created_at).toLocaleDateString("zh-CN")}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <select
                                            value={m.role}
                                            onChange={(e) => changeRole(m.user_id, e.target.value)}
                                            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                                        >
                                            <option value="editor" className="bg-slate-800">editor</option>
                                            <option value="viewer" className="bg-slate-800">viewer</option>
                                        </select>
                                        <button
                                            onClick={() => removeMember(m.user_id)}
                                            className="text-xs bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 px-2 py-1 rounded-lg transition cursor-pointer"
                                        >
                                            移除
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </main>
    );
}
