'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';

interface FileUploaderProps {
    documentId: string;
    onUploaded: (fileUrl: string, fileType: 'text' | 'docx' | 'pdf' | 'excel') => void;
    onTextImport?: (html: string) => void;
}

export default function FileUploader({ documentId, onUploaded, onTextImport }: FileUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const accept = '.txt,.docx,.pdf,.xlsx,.xls';

    async function handleFile(file: File) {
        setError('');
        setUploading(true);

        try {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            let fileType: 'text' | 'docx' | 'pdf' | 'excel' = 'text';

            if (ext === 'pdf') fileType = 'pdf';
            else if (ext === 'docx') fileType = 'docx';
            else if (ext === 'xlsx' || ext === 'xls') fileType = 'excel';
            else if (ext === 'txt') fileType = 'text';
            else {
                setError('不支持的文件格式，请上传 txt / docx / pdf / xlsx');
                setUploading(false);
                return;
            }

            // For .txt and .docx, also extract content for TipTap
            if (fileType === 'text') {
                const text = await file.text();
                onTextImport?.(`<p>${text.replace(/\n/g, '</p><p>')}</p>`);
                setUploading(false);
                return; // No upload needed for plain text
            }

            if (fileType === 'docx' && onTextImport) {
                const mammoth = (await import('mammoth')).default;
                const buf = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer: buf });
                onTextImport?.(result.value);
                // Still upload the original file too
            }

            // Upload to Supabase Storage
            const path = `${documentId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('doc-files')
                .upload(path, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('doc-files')
                .getPublicUrl(path);

            // Update document record
            await supabase
                .from('documents')
                .update({ file_url: urlData.publicUrl, file_type: fileType })
                .eq('id', documentId);

            onUploaded(urlData.publicUrl, fileType);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '上传失败';
            setError(msg);
        } finally {
            setUploading(false);
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }

    return (
        <div>
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                style={{
                    border: '2px dashed #334155',
                    borderRadius: 8,
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    transition: 'border-color 0.2s',
                    background: '#0f172a',
                }}
            >
                {uploading ? (
                    <span>上传中...</span>
                ) : (
                    <>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                        <div style={{ fontSize: 14 }}>拖拽文件到此，或点击上传</div>
                        <div style={{ fontSize: 12, marginTop: 4, color: '#475569' }}>
                            支持 TXT · DOCX · PDF · XLSX
                        </div>
                    </>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                style={{ display: 'none' }}
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
    );
}
