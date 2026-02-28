"use client";

import { useState } from "react";
import Link from "next/link";
import ParallaxSection from "@/components/ParallaxSection";
import FloatingOrbs from "@/components/FloatingOrbs";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

function getColor(score: number) {
  if (score < 25)
    return { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", text: "#fca5a5", label: "Needs attention" };
  if (score < 60)
    return { bg: "rgba(251, 191, 36, 0.15)", border: "rgba(251, 191, 36, 0.4)", text: "#fcd34d", label: "Medium" };
  return { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.4)", text: "#86efac", label: "Good" };
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function getProficiencyColor(level: string) {
  switch (level) {
    case "Expert":
      return { bg: "rgba(168, 85, 247, 0.2)", border: "rgba(168, 85, 247, 0.5)", text: "#c084fc" };
    case "Intermediate":
      return { bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.4)", text: "#a78bfa" };
    case "Beginner":
      return { bg: "rgba(124, 58, 237, 0.1)", border: "rgba(124, 58, 237, 0.3)", text: "#8b5cf6" };
    default:
      return { bg: "rgba(139, 92, 246, 0.05)", border: "rgba(139, 92, 246, 0.2)", text: "#9ca3af" };
  }
}

export default function UploadPage() {
  const [githubUsername, setGithubUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMissing, setSelectedMissing] = useState<string[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planResult, setPlanResult] = useState<any>(null);
  // Track open/closed state for per-skill collapsible project lists
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // ✅ Load PDF.js from CDN so Next never bundles it
  async function loadPdfJsFromCdn(): Promise<any> {
    if (typeof window === "undefined") throw new Error("Browser only");

    if (window.pdfjsLib) return window.pdfjsLib;

    const pdfVersion = "3.11.174"; // stable
    const scriptUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.min.js`;

    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = scriptUrl;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
      document.body.appendChild(s);
    });

    // pdf.js attaches itself to window as "pdfjsLib"
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF.js did not initialize");

    // worker also from CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.js`;

    window.pdfjsLib = pdfjsLib;
    return pdfjsLib;
  }

  async function extractTextFromPdfInBrowser(pdfFile: File): Promise<string> {
    const pdfjsLib = await loadPdfJsFromCdn();

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let text = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it?.str || "").join(" ") + "\n";
    }
    return text;
  }

  async function onScan() {
    if (!file) return setError("Please upload a resume PDF.");
    if (!githubUsername.trim()) return setError("Please enter your GitHub username.");

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const resumeText = await extractTextFromPdfInBrowser(file);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: githubUsername.trim(),
          resumeText,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data?.error || "Scan failed.");
        return;
      }

      setResult(data);
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Failed to read the PDF.");
    }
  }

  async function onGeneratePlan() {
    if (!result) return;
    if (selectedMissing.length === 0) return setError("Select at least one missing skill to generate a plan.");

    setError(null);
    setPlanLoading(true);
    setPlanResult(null);

    try {
      // Reuse same resumeText and githubUsername to request an action plan
      const resumeText = await extractTextFromPdfInBrowser(file!);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: githubUsername.trim(),
          resumeText,
          selectedSkills: selectedMissing,
        }),
      });

      const data = await res.json();
      setPlanLoading(false);

      if (!res.ok) {
        setError(data?.error || "Failed to generate plan.");
        return;
      }

      setPlanResult(data);
    } catch (e: any) {
      setPlanLoading(false);
      setError(e?.message || "Failed to generate plan.");
    }
  }

  return (
    <>
      <FloatingOrbs />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(139, 92, 246, 0.15)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/">
              <div style={{ fontSize: 24, fontWeight: 900, background: "linear-gradient(135deg, #a78bfa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", cursor: "pointer" }}>
                ProofMap
              </div>
            </Link>
            <Link href="/">
              <button style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid rgba(139, 92, 246, 0.3)",
                background: "transparent",
                color: "#e6eef8",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}>
                ← Back to Home
              </button>
            </Link>
          </div>
        </header>

        <div style={{ maxWidth: 1000, margin: "60px auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h1 style={{ 
              fontSize: 42, 
              fontWeight: 900, 
              marginBottom: 16,
              background: "linear-gradient(135deg, #a78bfa, #c084fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Resume to GitHub Validator</h1>
            <p style={{ fontSize: 18, color: 'rgba(230, 238, 248, 0.7)', maxWidth: 600, margin: "0 auto" }}>
              Upload your resume and connect your GitHub to see how your claimed skills match your actual code
            </p>
          </div>

          {/* Upload Form Card */}
          <div className="pm-card" style={{ padding: 40, marginBottom: 32 }}>
            <div style={{ display: "grid", gap: 24 }}>
              <div>
                <label>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: "#e6eef8", fontSize: 15 }}>
                    <span style={{ color: "#a78bfa" }}>1.</span> GitHub Username
                  </div>
                  <input
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="e.g., octocat"
                    style={{ 
                      width: "100%", 
                      padding: "14px 18px", 
                      border: "2px solid rgba(139, 92, 246, 0.3)", 
                      borderRadius: 12,
                      background: "rgba(139, 92, 246, 0.05)",
                      color: "#e6eef8",
                      fontSize: 16,
                      fontWeight: 500,
                      transition: "all 0.3s ease",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.6)";
                      e.currentTarget.style.background = "rgba(139, 92, 246, 0.08)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
                      e.currentTarget.style.background = "rgba(139, 92, 246, 0.05)";
                    }}
                  />
                </label>
              </div>

              <div>
                <label>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: "#e6eef8", fontSize: 15 }}>
                    <span style={{ color: "#a78bfa" }}>2.</span> Resume PDF
                  </div>
                  <div style={{ 
                    position: "relative",
                    border: "2px dashed rgba(139, 92, 246, 0.3)",
                    borderRadius: 12,
                    padding: 32,
                    textAlign: "center",
                    background: "rgba(139, 92, 246, 0.03)",
                    transition: "all 0.3s ease",
                  }}>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      style={{ 
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer",
                      }}
                    />
                    {!file ? (
                      <div>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                        <div style={{ color: "#e6eef8", fontWeight: 600, marginBottom: 4 }}>
                          Click to upload or drag and drop
                        </div>
                        <div style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.5)" }}>
                          PDF file only
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                        <div style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 4 }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.5)" }}>
                          Click to change file
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <button
                onClick={onScan}
                disabled={loading}
                className="pm-btn"
                style={{
                  padding: "16px 32px",
                  borderRadius: 12,
                  border: "none",
                  background: loading ? "rgba(139, 92, 246, 0.5)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 18,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 8px 20px rgba(139, 92, 246, 0.4)",
                  transition: "all 0.3s ease",
                }}
              >
                {loading ? "🔍 Analyzing..." : "🚀 Analyze My Skills"}
              </button>

              {error && (
                <div style={{ 
                  color: "#fca5a5", 
                  fontWeight: 600, 
                  padding: 16, 
                  background: "rgba(239, 68, 68, 0.1)", 
                  borderRadius: 12, 
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

      {result && (
        <ParallaxSection speed={0.2}>
        <div className="pm-card" style={{ marginTop: 28, padding: 20 }}>          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#e6eef8" }}>Overall Skill Reality Score</div>
              <div style={{ 
                fontSize: 44, 
                fontWeight: 950, 
                marginTop: 6,
                background: "linear-gradient(135deg, #a78bfa, #c084fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {clamp01(result.overallScore)}%
              </div>
              <div style={{ marginTop: 6, color: "rgba(230, 238, 248, 0.7)", fontWeight: 700 }}>
                Analyzed <span style={{ color: "#a78bfa" }}>{result.reposAnalyzed ?? "—"}</span> repos for{" "}
                <span style={{ color: "#a78bfa" }}>{result.githubUsername ?? githubUsername}</span>
              </div>
            </div>

            <div style={{ minWidth: 300 }}>
              <div style={{ fontWeight: 900, marginBottom: 8, color: "#e6eef8" }}>Proof Status</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)" }} />
                  <span style={{ fontWeight: 700, color: "rgba(230, 238, 248, 0.8)", fontSize: 13 }}>Needs attention</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(251, 191, 36, 0.15)", border: "1px solid rgba(251, 191, 36, 0.4)" }} />
                  <span style={{ fontWeight: 700, color: "rgba(230, 238, 248, 0.8)", fontSize: 13 }}>Medium proof</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.4)" }} />
                  <span style={{ fontWeight: 700, color: "rgba(230, 238, 248, 0.8)", fontSize: 13 }}>Good proof</span>
                </div>
              </div>
              
              <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 8, color: "#e6eef8" }}>Proficiency Levels</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(168, 85, 247, 0.2)", border: "1px solid rgba(168, 85, 247, 0.5)" }} />
                  <span style={{ fontWeight: 700, color: "rgba(230, 238, 248, 0.8)", fontSize: 13 }}>Expert</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.4)" }} />
                  <span style={{ fontWeight: 700, color: "rgba(230, 238, 248, 0.8)", fontSize: 13 }}>Intermediate</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.3)" }} />
                  <span style={{ fontWeight: 700, color: "rgba(230, 238, 248, 0.8)", fontSize: 13 }}>Beginner</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10, color: "#e6eef8" }}>
              Skill Proof Table
            </div>

            <div style={{ overflowX: "auto", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: 12, background: "rgba(139, 92, 246, 0.03)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "rgba(139, 92, 246, 0.1)" }}>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid rgba(139, 92, 246, 0.2)", color: "#c084fc" }}>
                      Skill
                    </th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid rgba(139, 92, 246, 0.2)", color: "#c084fc" }}>
                      Proof %
                    </th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid rgba(139, 92, 246, 0.2)", color: "#c084fc" }}>
                      Proficiency
                    </th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid rgba(139, 92, 246, 0.2)", color: "#c084fc" }}>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(result.breakdown ?? [])
                    .slice()
                    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
                    .map((row: any) => {
                      const score = clamp01(Number(row.score ?? 0));
                      const c = getColor(score);

                      return (
                        <tr key={row.skill}>
                          <td style={{ padding: 12, borderBottom: "1px solid rgba(139, 92, 246, 0.1)", fontWeight: 900, color: "#e6eef8" }}>
                            {row.skill}
                          </td>

                          <td style={{ padding: 12, borderBottom: "1px solid rgba(139, 92, 246, 0.1)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  height: 10,
                                  width: 160,
                                  borderRadius: 999,
                                  background: "rgba(139, 92, 246, 0.1)",
                                  overflow: "hidden",
                                  border: "1px solid rgba(139, 92, 246, 0.2)",
                                }}
                              >
                                <div style={{ height: "100%", width: `${score}%`, background: c.text }} />
                              </div>
                              <div style={{ fontWeight: 900, color: "#e6eef8" }}>{score}%</div>
                            </div>
                          </td>

                          <td style={{ padding: 12, borderBottom: "1px solid rgba(139, 92, 246, 0.1)" }}>
                            {row.proficiency && (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  background: getProficiencyColor(row.proficiency).bg,
                                  border: `1px solid ${getProficiencyColor(row.proficiency).border}`,
                                  color: getProficiencyColor(row.proficiency).text,
                                  fontWeight: 900,
                                  fontSize: 12,
                                }}
                              >
                                {row.proficiency}
                              </span>
                            )}
                            {!row.proficiency && (
                              <span style={{ color: "rgba(230, 238, 248, 0.5)", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: 12, borderBottom: "1px solid rgba(139, 92, 246, 0.1)" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                color: c.text,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              {c.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="pm-card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 950, color: "#e6eef8" }}>✅ Skills present (proven)</div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(result.breakdown ?? [])
                  .filter((x: any) => clamp01(Number(x.score ?? 0)) >= 25)
                  .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
                  .map((x: any) => {
                    const score = clamp01(Number(x.score ?? 0));
                    const c = getColor(score);
                    return (
                      <span
                        key={x.skill}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          color: c.text,
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {x.skill} · {score}%
                      </span>
                    );
                  })}
              </div>
            </div>

            <div className="pm-card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 950, color: "#e6eef8" }}>⚠️ Skills not present (missing proof)</div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(result.breakdown ?? [])
                  .filter((x: any) => clamp01(Number(x.score ?? 0)) < 25)
                  .sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
                  .map((x: any) => {
                    const score = clamp01(Number(x.score ?? 0));
                    const c = getColor(score);
                    const checked = selectedMissing.includes(x.skill);
                    return (
                      <label
                        key={x.skill}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          color: c.text,
                          fontWeight: 900,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedMissing((prev) => {
                              if (e.target.checked) return [...prev, x.skill];
                              return prev.filter((s) => s !== x.skill);
                            });
                          }}
                        />
                        <span>{x.skill} · {score}%</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              onClick={onGeneratePlan}
              disabled={planLoading || selectedMissing.length === 0}
              className="pm-btn"
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: selectedMissing.length ? "linear-gradient(135deg, #8b5cf6, #7c3aed)" : "rgba(139, 92, 246, 0.2)",
                color: "white",
                fontWeight: 800,
                cursor: selectedMissing.length ? "pointer" : "not-allowed",
                boxShadow: selectedMissing.length ? "0 4px 12px rgba(139, 92, 246, 0.3)" : "none",
              }}
            >
              {planLoading ? "Generating..." : "Generate Plan"}
            </button>
          </div>

          {planResult && (
            <div style={{ marginTop: 18 }}>
              <div className="pm-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8, color: "#e6eef8" }}>Action Plan</div>

                {(planResult.actionPlan ?? []).map((p: any, pidx: number) => {
                  const open = !!openMap[p.skill];
                  const summaryRaw = String(p.summary || "").trim();
                  const summary = summaryRaw ? (/[.?!]$/.test(summaryRaw) ? summaryRaw : summaryRaw + '.') : '';

                  return (
                    <div key={p.skill} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontWeight: 800, color: "#c084fc" }}>{p.skill}</div>
                          {summary && <div style={{ marginTop: 8, color: 'rgba(230, 238, 248, 0.8)' }}>{summary}</div>}

                          <div style={{ marginTop: 6 }}>
                            {p.candidateExists ? (
                              <div style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#86efac', fontWeight: 900, fontSize: 13 }}>
                                this skill can be used in your GitHub
                              </div>
                            ) : (
                              <div style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontWeight: 900, fontSize: 13 }}>
                                this skill cannot be used in Github. But I can give you additional project suggestions.
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          className="pm-btn pm-btn-ghost"
                          onClick={() => setOpenMap((m) => ({ ...m, [p.skill]: !m[p.skill] }))}
                          aria-expanded={open}
                        >
                          <span className={`pm-chevron ${open ? 'open' : ''}`}>›</span>
                          <span style={{ marginLeft: 8 }}>{open ? (p.candidateExists ? 'Hide guidance' : 'Hide projects') : (p.candidateExists ? 'Repo guidance' : 'Project ideas')}</span>
                        </button>
                      </div>

                      <div className={`pm-collapsible ${open ? 'expanded' : 'collapsed'}`} aria-hidden={!open}>
                        <div style={{ marginTop: 12, color: 'rgba(230, 238, 248, 0.8)' }}>
                          {p.candidateExists ? (
                            // Repo guidance path — concise paragraph (no code snippets)
                            <div>
                              {p.usage && (
                                <div style={{ marginBottom: 8 }}>
                                  {String(p.usage).trim().replace(/\s+/g, ' ')}{(/[.?!]$/.test(String(p.usage).trim()) ? '' : '.')} 
                                </div>
                              )}

                              <div style={{ marginTop: 6, color: 'rgba(230, 238, 248, 0.8)' }}>
                                To make this skill clearly provable on GitHub, provide a short, runnable example that exercises the capability end‑to‑end and make it easy to find from the repository README. Document the single command(s) needed to run the example and the exact expected output so reviewers can reproduce the result quickly, and add a lightweight automated check (one focused test or a minimal CI job) so the repository shows a passing status. Keep the demo and instructions minimal and secret‑free so anyone can verify your claim in under a minute.
                              </div>
                            </div>
                          ) : (
                            // Project ideas path — numbered project list and three-step plans directly under each project
                            <div>
                              <div style={{ fontWeight: 700, marginBottom: 8, color: "#e6eef8" }}>Recommended projects to demonstrate this skill</div>

                              {(p.ideas && p.ideas.length > 0) ? (
                                <ol style={{ marginLeft: 18 }}>
                                  {p.ideas.map((idea: string, idx: number) => {
                                    const plan = (p.projectPlans && p.projectPlans[idea]) || [];
                                    return (
                                      <li key={idx} style={{ marginTop: 10, color: 'rgba(230, 238, 248, 0.8)' }}>
                                        <div style={{ fontWeight: 800, color: "#a78bfa" }}>{idea}</div>

                                        {(plan && plan.length > 0) ? (
                                          <ol style={{ marginLeft: 18, marginTop: 8 }}>
                                            {plan.map((step: string, sidx: number) => {
                                              const trimmed = String(step || '').trim();
                                              if (!trimmed) return null;
                                              // Ensure first letter is capitalized and sentence ends with a period.
                                              const s = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/\s+/g, ' ');
                                              const sentence = /[.?!]$/.test(s) ? s : s + '.';
                                              return (
                                                <li key={sidx} style={{ marginTop: 6 }}>{sentence}</li>
                                              );
                                            })}
                                          </ol>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ol>
                              ) : (
                                <div style={{ fontStyle: 'italic', color: 'rgba(230, 238, 248, 0.6)' }}>No project ideas available — try selecting a different skill.</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 12, color: 'rgba(230, 238, 248, 0.8)' }}>
                  <div style={{ fontWeight: 900, marginBottom: 6, color: "#e6eef8" }}>Suggestions shown only for selected skills</div>
                  <div>Select one or more missing skills above and click <b>Generate Plan</b> to get per-skill project ideas and availability guidance.</div>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              border: "1px solid rgba(139, 92, 246, 0.2)",
              borderRadius: 12,
              padding: 14,
              background: "rgba(139, 92, 246, 0.05)",
            }}
          >
            {(() => {
              const breakdown = result.breakdown ?? [];
              const proven = breakdown.filter((x: any) => clamp01(Number(x.score ?? 0)) >= 60);
              const medium = breakdown.filter((x: any) => {
                const s = clamp01(Number(x.score ?? 0));
                return s >= 25 && s < 60;
              });
              const weak = breakdown.filter((x: any) => clamp01(Number(x.score ?? 0)) < 25);

              const topMissing = weak
                .slice()
                .sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
                .slice(0, 4)
                .map((x: any) => x.skill);

              return (
                <div style={{ color: "rgba(230, 238, 248, 0.8)", lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 950, color: "#e6eef8" }}>Quick feedback</div>
                  <div>
                    • Strong proof: <b>{proven.length}</b> skills (green) are well-supported by your repos.
                  </div>
                  <div>
                    • Moderate proof: <b>{medium.length}</b> skills (yellow) show some evidence — add stronger examples or clearer repo descriptions.
                  </div>
                  <div>
                    • Needs attention: <b>{weak.length}</b> skills (red) have low/no proof — prioritize building or showcasing them in GitHub.
                  </div>
                  <div>
                    • Next step: pick 1–2 red skills (e.g., <b>{topMissing.join(", ") || "—"}</b>) and create a small repo/demo that clearly uses them.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        </ParallaxSection>
      )}
    </div>

        {/* Footer */}
        <footer style={{
          padding: "40px 24px",
          borderTop: "1px solid rgba(139, 92, 246, 0.15)",
          textAlign: "center",
          marginTop: 60,
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <p style={{ fontSize: 24, fontWeight: 900, marginBottom: 12, background: "linear-gradient(135deg, #a78bfa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              ProofMap
            </p>
            <p style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.5)" }}>
              © 2026 ProofMap. Validate your skills with GitHub proof.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}