'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import dynamic_import from 'next/dynamic';
import * as Y from 'yjs';
import { SupabaseProvider, type AwarenessUser } from '@/lib/supabase-provider';

// Dynamically import heavy components to avoid SSR issues
const RichTextEditor = dynamic_import(() => import('@/components/RichTextEditor'), { ssr: false });
const PdfViewer = dynamic_import(() => import('@/components/PdfViewer'), { ssr: false });
const ExcelViewer = dynamic_import(() => import('@/components/ExcelViewer'), { ssr: false });
const FileUploader = dynamic_import(() => import('@/components/FileUploader'), { ssr: false });

type Role = 'owner' | 'editor' | 'viewer' | null;
type FileType = 'text' | 'docx' | 'pdf' | 'excel';

interface Version {
    id: string;
    content: string;
    comment: string | null;
    created_at: string;
    created_by: string | null;
}

interface MemberEmail {
    user_id: string;
    email: string;
}

export default function DocPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [role, setRole] = useState<Role>(null);
    const [fileType, setFileType] = useState<FileType>('text');
    const [fileUrl, setFileUrl] = useState<string | null>(null);

    // Rich text editor state
    const [editorContent, setEditorContent] = useState('<p></p>');
    const [displayContent, setDisplayContent] = useState('<p></p>');

    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const [versions, setVersions] = useState<Version[]>([]);
    const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
    const [showUploader, setShowUploader] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Ref to imperatively set editor content (needed in collab mode)
    const editorSetContentRef = useRef<((html: string) => void) | null>(null);

    // Collaboration state
    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<SupabaseProvider | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<AwarenessUser[]>([]);
    const [collabReady, setCollabReady] = useState(false);

    const canEdit = role === 'owner' || role === 'editor';

    useEffect(() => {
        async function load() {
            // Auth check
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/supabase-test'); return; }
            setUserId(session.user.id);

            // Fetch document
            const { data: doc, error } = await supabase
                .from('documents')
                .select('id, title, user_id, file_url, file_type')
                .eq('id', id)
                .single();

            if (error || !doc) { router.push('/supabase-test'); return; }
            setTitle(doc.title);
            const docFileType = (doc.file_type as FileType) ?? 'text';
            setFileType(docFileType);
            setFileUrl(doc.file_url);

            // Determine role
            const isOwner = doc.user_id === session.user.id;
            if (isOwner) {
                setRole('owner');
            } else {
                const { data: membership } = await supabase
                    .from('document_members')
                    .select('role')
                    .eq('document_id', id)
                    .eq('user_id', session.user.id)
                    .single();
                if (!membership) { router.push('/supabase-test'); return; }
                setRole(membership.role as Role);
            }

            // Fetch versions (pass current fileType to avoid stale closure)
            await fetchVersions(session.user.id, docFileType);

            // Initialize collaboration for text-based documents
            if (docFileType === 'text' || docFileType === 'docx') {
                const ydoc = new Y.Doc();
                ydocRef.current = ydoc;

                const userName = session.user.email?.split('@')[0] ?? 'Anonymous';
                const provider = new SupabaseProvider(id, ydoc, userName);
                providerRef.current = provider;

                provider.onAwarenessChange = (users) => {
                    setOnlineUsers([...users]);
                };

                setCollabReady(true);
            }

            setLoading(false);
        }

        load();

        return () => {
            providerRef.current?.destroy();
            ydocRef.current?.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function fetchVersions(uid?: string, currentFileType?: FileType) {
        const { data: vers } = await supabase
            .from('versions')
            .select('id, content, comment, created_at, created_by')
            .eq('document_id', id)
            .order('created_at', { ascending: false });

        setVersions(vers ?? []);

        // Fetch member emails for version display
        const { data: members } = await supabase
            .from('member_with_email')
            .select('user_id, email')
            .eq('document_id', id);

        const map: Record<string, string> = {};
        (members as MemberEmail[] ?? []).forEach(m => { map[m.user_id] = m.email; });

        // Also add current user's id → email if available
        if (uid) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) map[user.id] = user.email!;
        }
        setMemberEmails(map);

        // Load latest version content into editor (solo fallback)
        const ft = currentFileType ?? fileType;
        if (vers && vers.length > 0 && (ft === 'text' || ft === 'docx')) {
            setEditorContent(vers[0].content);
            setDisplayContent(vers[0].content);
        }
    }

    async function saveVersion() {
        if (!canEdit) return;
        setSaving(true);
        setSaveMsg('');

        const contentToSave = fileType === 'text' || fileType === 'docx'
            ? editorContent
            : fileUrl ?? '';

        const { error } = await supabase.from('versions').insert({
            document_id: id,
            content: contentToSave,
            comment: comment.trim() || null,
            created_by: userId,
        });

        if (error) {
            setSaveMsg('❌ 保存失败：' + error.message);
        } else {
            setSaveMsg('✅ 版本已保存');
            setComment('');
            await fetchVersions();
        }
        setSaving(false);
        setTimeout(() => setSaveMsg(''), 3000);
    }

    function loadVersion(v: Version) {
        if (fileType === 'text' || fileType === 'docx') {
            setEditorContent(v.content);
            setDisplayContent(v.content);
            // In collab mode, React state won't update the editor — use imperative API
            editorSetContentRef.current?.(v.content);
        }
    }

    const handleEditorReady = useCallback((setContentFn: (html: string) => void) => {
        editorSetContentRef.current = setContentFn;
    }, []);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#64748b' }}>加载中...</p>
            </div>
        );
    }

    const badgeColor = role === 'owner' ? '#3b82f6' : role === 'editor' ? '#10b981' : '#f59e0b';

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid #1e293b', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Link href="/supabase-test" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>← 返回列表</Link>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, flex: 1 }}>{title}</h1>

                {/* Online users */}
                {onlineUsers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>在线</span>
                        <div style={{ display: 'flex' }}>
                            {onlineUsers.slice(0, 5).map((u) => (
                                <div
                                    key={u.clientId}
                                    title={u.name}
                                    style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 700, color: '#fff',
                                        border: '2px solid #0f172a', marginLeft: -6,
                                    }}
                                >{u.name.charAt(0).toUpperCase()}</div>
                            ))}
                        </div>
                        {onlineUsers.length > 5 && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>+{onlineUsers.length - 5}</span>
                        )}
                    </div>
                )}

                <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44`,
                }}>{role}</span>
                {role === 'owner' && (
                    <Link href={`/doc/${id}/share`} style={{
                        padding: '6px 14px', borderRadius: 6, background: '#1e293b', border: '1px solid #334155',
                        color: '#94a3b8', textDecoration: 'none', fontSize: 13,
                    }}>👥 成员管理</Link>
                )}
            </div>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
                {/* File type badge + upload toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                        文档类型：<strong style={{ color: '#94a3b8' }}>{fileType.toUpperCase()}</strong>
                    </span>
                    {collabReady && (
                        <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 10,
                            background: '#10b98122', color: '#10b981', border: '1px solid #10b98144',
                        }}>🔴 实时协作</span>
                    )}
                    {canEdit && (
                        <button
                            onClick={() => setShowUploader(!showUploader)}
                            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer' }}
                        >{showUploader ? '收起' : '📎 上传文件'}</button>
                    )}
                </div>

                {/* File uploader */}
                {showUploader && canEdit && (
                    <div style={{ marginBottom: 20 }}>
                        <FileUploader
                            documentId={id}
                            onUploaded={(url, type) => {
                                setFileUrl(url);
                                setFileType(type);
                                setShowUploader(false);
                            }}
                            onTextImport={(html) => {
                                setEditorContent(html);
                                setDisplayContent(html);
                                setShowUploader(false);
                            }}
                        />
                    </div>
                )}

                {/* Content area based on fileType */}
                <div style={{ marginBottom: 24 }}>
                    {(fileType === 'text' || fileType === 'docx') && (
                        <RichTextEditor
                            content={canEdit ? editorContent : displayContent}
                            onChange={setEditorContent}
                            readOnly={!canEdit}
                            placeholder="开始编写文档内容..."
                            ydoc={collabReady ? ydocRef.current ?? undefined : undefined}
                            provider={collabReady ? providerRef.current ?? undefined : undefined}
                            onEditorReady={handleEditorReady}
                        />
                    )}
                    {fileType === 'pdf' && fileUrl && <PdfViewer fileUrl={fileUrl} />}
                    {fileType === 'pdf' && !fileUrl && (
                        <div style={{ padding: 32, textAlign: 'center', color: '#64748b', background: '#1e293b', borderRadius: 8 }}>
                            尚未上传 PDF 文件，请点击&quot;上传文件&quot;
                        </div>
                    )}
                    {fileType === 'excel' && fileUrl && <ExcelViewer fileUrl={fileUrl} />}
                    {fileType === 'excel' && !fileUrl && (
                        <div style={{ padding: 32, textAlign: 'center', color: '#64748b', background: '#1e293b', borderRadius: 8 }}>
                            尚未上传 Excel 文件，请点击&quot;上传文件&quot;
                        </div>
                    )}
                </div>

                {/* Save version area */}
                {canEdit && (
                    <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 24, border: '1px solid #334155' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#94a3b8' }}>💾 保存版本</h3>
                        <input
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="版本备注（可选）"
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 6,
                                border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
                                fontSize: 14, boxSizing: 'border-box', marginBottom: 10,
                            }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                onClick={saveVersion}
                                disabled={saving}
                                style={{
                                    padding: '8px 20px', borderRadius: 6, border: 'none',
                                    background: saving ? '#334155' : 'linear-gradient(135deg, #3b82f6, #10b981)',
                                    color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600,
                                }}
                            >{saving ? '保存中...' : '保存新版本'}</button>
                            {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('✅') ? '#10b981' : '#f87171' }}>{saveMsg}</span>}
                        </div>
                    </div>
                )}

                {/* Version history */}
                <div>
                    <h3 style={{ fontSize: 15, color: '#94a3b8', marginBottom: 12 }}>📋 版本历史</h3>
                    {versions.length === 0 ? (
                        <p style={{ color: '#475569', fontSize: 14 }}>暂无版本记录</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {versions.map((v, i) => (
                                <div key={v.id} style={{
                                    background: '#1e293b', borderRadius: 8, padding: '12px 16px',
                                    border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12,
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                                            <strong>v{versions.length - i}</strong>
                                            {v.comment && <span style={{ color: '#94a3b8', marginLeft: 8 }}>— {v.comment}</span>}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                                            {new Date(v.created_at).toLocaleString('zh-CN')}
                                            {v.created_by && memberEmails[v.created_by] && (
                                                <span style={{ marginLeft: 8 }}>· {memberEmails[v.created_by]}</span>
                                            )}
                                        </div>
                                    </div>
                                    {(fileType === 'text' || fileType === 'docx') && (
                                        <button
                                            onClick={() => loadVersion(v)}
                                            style={{
                                                padding: '5px 12px', borderRadius: 5, border: '1px solid #334155',
                                                background: '#0f172a', color: '#94a3b8', cursor: 'pointer', fontSize: 12,
                                            }}
                                        >加载此版</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
