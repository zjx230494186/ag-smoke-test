"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [time, setTime] = useState<string>("");
  const [healthData, setHealthData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleString("zh-CN"));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const checkHealth = async () => {
    setLoading(true);
    setHealthData(null);
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      setHealthData(JSON.stringify(json, null, 2));
    } catch (e) {
      setHealthData("Error: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl text-white">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Antigravity Smoke Test
        </h1>
        <p className="text-slate-400 text-sm mb-6">GitHub MCP + Next.js Verification</p>

        <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Current Time</p>
          <p className="text-xl font-mono text-cyan-300">{time || "Loading..."}</p>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 mb-4 cursor-pointer"
        >
          {loading ? "Checking..." : "Check /api/health"}
        </button>

        {healthData && (
          <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">API Response</p>
            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{healthData}</pre>
          </div>
        )}
      </div>
    </main>
  );
}
