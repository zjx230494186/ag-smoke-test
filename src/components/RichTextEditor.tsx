'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import { useEffect } from 'react';
import type * as Y from 'yjs';
import type { SupabaseProvider } from '@/lib/supabase-provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExtension = any;

interface RichTextEditorProps {
    content?: string;
    onChange?: (html: string) => void;
    readOnly?: boolean;
    placeholder?: string;
    ydoc?: Y.Doc;
    provider?: SupabaseProvider;
}

export default function RichTextEditor({
    content,
    onChange,
    readOnly = false,
    placeholder = '开始编写内容...',
    ydoc,
    provider,
}: RichTextEditorProps) {
    // Suppress unused var warning — provider used for awareness display only
    void provider;

    const extensions: AnyExtension[] = [];

    if (ydoc) {
        // Collaboration extension automatically handles history in TipTap v3
        extensions.push(StarterKit);
        extensions.push(
            Collaboration.configure({
                document: ydoc,
            }),
        );
    } else {
        extensions.push(StarterKit);
    }

    extensions.push(
        Placeholder.configure({ placeholder }),
    );

    const editor = useEditor({
        extensions,
        content: ydoc ? undefined : content,
        editable: !readOnly,
        onUpdate: ({ editor: ed }) => {
            onChange?.(ed.getHTML());
        },
        immediatelyRender: false,
    });

    // Sync content when switching versions (solo mode only)
    useEffect(() => {
        if (ydoc || !editor || editor.isDestroyed) return;
        if (content !== undefined) {
            const currentHTML = editor.getHTML();
            if (currentHTML !== content) {
                editor.commands.setContent(content);
            }
        }
    }, [content, editor, ydoc]);

    // Sync readOnly state
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!readOnly);
        }
    }, [readOnly, editor]);

    return (
        <div className={`rich-editor-wrapper ${readOnly ? 'read-only' : ''}`}>
            {!readOnly && (
                <div className="toolbar">
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={editor?.isActive('bold') ? 'active' : ''}
                        title="粗体"
                    >B</button>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className={editor?.isActive('italic') ? 'active' : ''}
                        title="斜体"
                    ><em>I</em></button>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleStrike().run()}
                        className={editor?.isActive('strike') ? 'active' : ''}
                        title="删除线"
                    ><s>S</s></button>
                    <span className="sep">|</span>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''}
                        title="标题1"
                    >H1</button>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''}
                        title="标题2"
                    >H2</button>
                    <span className="sep">|</span>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        className={editor?.isActive('bulletList') ? 'active' : ''}
                        title="无序列表"
                    >• 列表</button>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        className={editor?.isActive('orderedList') ? 'active' : ''}
                        title="有序列表"
                    >1. 列表</button>
                    <span className="sep">|</span>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                        className={editor?.isActive('blockquote') ? 'active' : ''}
                        title="引用"
                    >❝</button>
                    <button
                        type="button"
                        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                        title="分割线"
                    >—</button>
                </div>
            )}
            <EditorContent editor={editor} className="editor-content" />
            <style>{`
        .rich-editor-wrapper {
          border: 1px solid #334155;
          border-radius: 8px;
          overflow: hidden;
          background: #1e293b;
        }
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          padding: 8px;
          background: #0f172a;
          border-bottom: 1px solid #334155;
          align-items: center;
        }
        .toolbar button {
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid #334155;
          background: #1e293b;
          color: #e2e8f0;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s;
        }
        .toolbar button:hover { background: #334155; }
        .toolbar button.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .toolbar .sep { color: #475569; margin: 0 4px; }
        .editor-content { min-height: 300px; }
        .editor-content .ProseMirror {
          padding: 16px;
          min-height: 300px;
          outline: none;
          color: #e2e8f0;
          line-height: 1.7;
          font-size: 15px;
        }
        .editor-content .ProseMirror p.is-editor-empty:first-child::before {
          color: #64748b;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .editor-content .ProseMirror h1 { font-size: 1.8em; font-weight: bold; margin: 0.5em 0; }
        .editor-content .ProseMirror h2 { font-size: 1.4em; font-weight: bold; margin: 0.5em 0; }
        .editor-content .ProseMirror ul { padding-left: 1.5em; list-style: disc; }
        .editor-content .ProseMirror ol { padding-left: 1.5em; list-style: decimal; }
        .editor-content .ProseMirror blockquote {
          border-left: 3px solid #3b82f6;
          padding-left: 12px;
          color: #94a3b8;
          margin: 8px 0;
        }
        .editor-content .ProseMirror hr { border-color: #334155; margin: 16px 0; }
        .read-only .editor-content .ProseMirror { cursor: default; }
        /* Collaboration cursor styles */
        .collaboration-cursor__caret {
          position: relative;
          margin-left: -1px;
          margin-right: -1px;
          border-left: 2px solid #f87171;
          pointer-events: none;
          word-break: normal;
        }
        .collaboration-cursor__label {
          position: absolute;
          top: -1.4em;
          left: -1px;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 3px 3px 3px 0;
          color: #fff;
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
        }
      `}</style>
        </div>
    );
}
