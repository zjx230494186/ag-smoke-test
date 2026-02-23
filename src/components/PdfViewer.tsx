'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use CDN worker - avoids needing to copy the worker file locally
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    fileUrl: string;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);

    return (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <button
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                    style={btnStyle}
                >← 上一页</button>
                <span style={{ color: '#94a3b8', fontSize: 14 }}>
                    第 {pageNumber} / {numPages} 页
                </span>
                <button
                    onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                    style={btnStyle}
                >下一页 →</button>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={btnStyle}>－</button>
                    <span style={{ color: '#94a3b8', fontSize: 13, lineHeight: '32px' }}>{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} style={btnStyle}>＋</button>
                </span>
            </div>
            <div style={{ overflow: 'auto', background: '#0f172a', borderRadius: 6, padding: 16 }}>
                <Document
                    file={fileUrl}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    loading={<p style={{ color: '#64748b' }}>加载 PDF 中...</p>}
                    error={<p style={{ color: '#f87171' }}>PDF 加载失败，请检查文件。</p>}
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                    />
                </Document>
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 13,
};
