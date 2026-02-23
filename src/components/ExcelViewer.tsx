'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

interface ExcelViewerProps {
    fileUrl: string;
}

export default function ExcelViewer({ fileUrl }: ExcelViewerProps) {
    const [sheets, setSheets] = useState<{ name: string; data: string[][] }[]>([]);
    const [activeSheet, setActiveSheet] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        fetch(fileUrl)
            .then(res => res.arrayBuffer())
            .then(buf => {
                const wb = XLSX.read(buf, { type: 'array' });
                const parsed = wb.SheetNames.map(name => ({
                    name,
                    data: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1 }),
                }));
                setSheets(parsed);
                setActiveSheet(0);
            })
            .catch(() => setError('Excel 文件加载失败'))
            .finally(() => setLoading(false));
    }, [fileUrl]);

    if (loading) return <p style={{ color: '#64748b', padding: 16 }}>加载 Excel 中...</p>;
    if (error) return <p style={{ color: '#f87171', padding: 16 }}>{error}</p>;
    if (!sheets.length) return <p style={{ color: '#64748b', padding: 16 }}>空文件</p>;

    const currentData = sheets[activeSheet]?.data ?? [];

    return (
        <div style={{ background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
            {/* Sheet tabs */}
            {sheets.length > 1 && (
                <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: '#0f172a', borderBottom: '1px solid #334155' }}>
                    {sheets.map((s, i) => (
                        <button
                            key={s.name}
                            onClick={() => setActiveSheet(i)}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '4px 4px 0 0',
                                border: '1px solid #334155',
                                background: i === activeSheet ? '#1e293b' : '#0f172a',
                                color: i === activeSheet ? '#e2e8f0' : '#64748b',
                                cursor: 'pointer',
                                fontSize: 13,
                            }}
                        >{s.name}</button>
                    ))}
                </div>
            )}

            {/* Table */}
            <div style={{ overflow: 'auto', maxHeight: 500 }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}>
                    <thead>
                        {currentData[0] && (
                            <tr style={{ position: 'sticky', top: 0, background: '#0f172a' }}>
                                {currentData[0].map((cell, ci) => (
                                    <th key={ci} style={thStyle}>{cell ?? ''}</th>
                                ))}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {currentData.slice(1).map((row, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? '#1e293b' : '#172032' }}>
                                {row.map((cell, ci) => (
                                    <td key={ci} style={tdStyle}>{cell ?? ''}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {currentData.length <= 1 && (
                    <p style={{ color: '#64748b', padding: 16 }}>此工作表为空</p>
                )}
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    color: '#94a3b8',
    fontWeight: 600,
    borderBottom: '1px solid #334155',
    whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
    padding: '6px 12px',
    color: '#e2e8f0',
    borderBottom: '1px solid #1e293b',
    whiteSpace: 'nowrap',
};
