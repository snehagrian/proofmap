"use client";

import { useState } from "react";
import Link from "next/link";
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
  
  // Skill selection for recommendations
  const [selectedMissing, setSelectedMissing] = useState<string[]>([]);
  
  // AI suggestions – generated on-demand, grouped where possible
  const [aiSuggestions, setAiSuggestions] = useState<{ groups: any[]; individual: any[] } | null>(null);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);

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
    setAiSuggestions(null);

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
      // Reset selections and AI suggestions for new scan
      setSelectedMissing([]);
      setAiSuggestions(null);
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Failed to read the PDF.");
    }
  }

  async function onGenerateRecommendations() {
    if (!result) return;
    if (selectedMissing.length === 0) {
      return setError("Please select at least one skill to get recommendations.");
    }

    setError(null);
    setAiSuggestions(null);
    setAiSuggestionsLoading(true);

    try {
      const aiRes = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: selectedMissing,
          githubUsername: githubUsername.trim(),
          breakdown: result.breakdown,
          existingRepos: result.breakdown
            .filter((b: any) => b.repos && b.repos.length > 0)
            .flatMap((b: any) => b.repos)
            .filter((r: string, i: number, arr: string[]) => arr.indexOf(r) === i),
        }),
      });

      const aiData = await aiRes.json();

      if (aiRes.ok && (Array.isArray(aiData.groups) || Array.isArray(aiData.individual))) {
        setAiSuggestions({
          groups: aiData.groups ?? [],
          individual: aiData.individual ?? [],
        });
      } else {
        setError(aiData?.error || "Failed to generate recommendations. Make sure OPENAI_API_KEY is configured.");
      }
    } catch (aiErr: any) {
      setError(aiErr?.message || "Failed to generate recommendations.");
    } finally {
      setAiSuggestionsLoading(false);
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

              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={onScan}
                  disabled={loading}
                  className="pm-btn"
                  style={{
                    flex: 1,
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
              </div>

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

            <div className="pm-card" style={{ padding: 16 }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontWeight: 950, color: "#e6eef8", fontSize: 14 }}>⚠️ Skills not present <span style={{ color: "rgba(230,238,248,0.45)", fontWeight: 600, fontSize: 12 }}>(missing proof)</span></div>
                {(() => {
                  const weakSkills = (result.breakdown ?? []).filter((x: any) => clamp01(Number(x.score ?? 0)) < 25).map((x: any) => x.skill);
                  const allSelected = weakSkills.length > 0 && weakSkills.every((s: string) => selectedMissing.includes(s));
                  return weakSkills.length > 0 ? (
                    <button
                      onClick={() => setSelectedMissing(allSelected ? [] : weakSkills)}
                      style={{
                        background: "none",
                        border: "none",
                        color: allSelected ? "rgba(239,68,68,0.7)" : "#a78bfa",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        padding: "4px 8px",
                        borderRadius: 6,
                        transition: "color 150ms ease",
                      }}
                    >
                      {allSelected ? "✕ Deselect all" : "✓ Select all"}
                    </button>
                  ) : null;
                })()}
              </div>
              <div style={{ fontSize: 12, color: "rgba(230, 238, 248, 0.5)", marginBottom: 12 }}>
                Tap skills to select, then generate AI-powered recommendations
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(result.breakdown ?? [])
                  .filter((x: any) => clamp01(Number(x.score ?? 0)) < 25)
                  .sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
                  .map((x: any) => {
                    const score = clamp01(Number(x.score ?? 0));
                    const c = getColor(score);
                    const checked = selectedMissing.includes(x.skill);
                    return (
                      <button
                        key={x.skill}
                        type="button"
                        onClick={() =>
                          setSelectedMissing((prev) =>
                            checked ? prev.filter((s) => s !== x.skill) : [...prev, x.skill]
                          )
                        }
                        className={`pm-skill-chip${checked ? " selected" : ""}`}
                        style={{
                          background: checked ? c.bg.replace("0.15", "0.28") : c.bg,
                          border: `2px solid ${checked ? c.text : c.border}`,
                          color: c.text,
                          boxShadow: checked ? `0 4px 14px ${c.border}` : "none",
                        }}
                      >
                        <span className="pm-chip-dot">{checked ? "✓" : ""}</span>
                        <span>{x.skill}</span>
                        <span style={{ opacity: 0.55, fontWeight: 600, fontSize: 11 }}>{score}%</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Generate Recommendations Button */}
          {(result.breakdown ?? []).filter((x: any) => clamp01(Number(x.score ?? 0)) < 25).length > 0 && (
            <div style={{ marginTop: 18 }}>
              <button
                onClick={onGenerateRecommendations}
                disabled={aiSuggestionsLoading || selectedMissing.length === 0}
                className={`pm-reco-btn${aiSuggestionsLoading ? " loading" : selectedMissing.length > 0 ? " active" : ""}`}
              >
                {aiSuggestionsLoading ? (
                  <>
                    <span className="pm-spin" style={{ fontSize: 18 }}>⟳</span>
                    <span>Analyzing your projects…</span>
                    <span style={{ fontSize: 12, color: "#c4b5fd", fontWeight: 600 }}>this may take a moment</span>
                  </>
                ) : selectedMissing.length > 0 ? (
                  <>
                    <span style={{ fontSize: 18 }}>✨</span>
                    <span>Generate Recommendations</span>
                    <span className="pm-reco-count">{selectedMissing.length} skill{selectedMissing.length !== 1 ? "s" : ""}</span>
                  </>
                ) : (
                  <>
                    <span style={{ opacity: 0.45 }}>✨</span>
                    <span>Select skills above to get recommendations</span>
                  </>
                )}
              </button>
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
          {/* ✨ AI Skill Recommendations – shown when available */}
          {(aiSuggestions || aiSuggestionsLoading) && (() => {
            // Reusable plan card body
            const PlanBody = ({ plan }: { plan: any }) => (
              <>
                {plan?.existingProjectAnalysis && (
                  <div style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 10, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                    <div style={{ fontWeight: 800, color: "#e6eef8", fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      {plan.existingProjectAnalysis.canBeIntegrated ? "✅" : "❌"} Existing Project Analysis
                    </div>
                    <div style={{ color: "rgba(230,238,248,0.8)", fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
                      {plan.existingProjectAnalysis.reasoning}
                    </div>
                    {plan.existingProjectAnalysis.enhancementSuggestions?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 700, color: "rgba(230,238,248,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Enhancement Suggestions</div>
                        {plan.existingProjectAnalysis.enhancementSuggestions.map((enh: any, i: number) => (
                          <div key={i} style={{ padding: "11px 13px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 7 }}>
                            <div style={{ fontWeight: 800, color: "#86efac", fontSize: 13, marginBottom: 4 }}>📦 {enh.targetProject}</div>
                            <div style={{ color: "rgba(230,238,248,0.85)", fontSize: 13, marginBottom: 5 }}><strong>Enhancement:</strong> {enh.enhancement}</div>
                            <div style={{ color: "rgba(230,238,248,0.7)", fontSize: 12, marginBottom: 4 }}>{enh.implementation}</div>
                            <div style={{ display: "flex", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: "rgba(230,238,248,0.55)" }}>💡 {enh.skillDemonstration}</span>
                              {enh.estimatedEffort && <span style={{ fontSize: 11, color: "#86efac", fontWeight: 700 }}>⏱️ {enh.estimatedEffort}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {plan?.newProjectIdeas?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, color: "rgba(230,238,248,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>New Project Ideas</div>
                    <div style={{ display: "grid", gap: 9 }}>
                      {plan.newProjectIdeas.map((proj: any, i: number) => (
                        <div key={i} style={{ padding: "11px 13px", borderRadius: 10, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                          <div style={{ fontWeight: 800, color: "#a78bfa", fontSize: 14, marginBottom: 3 }}>{proj.name}</div>
                          <div style={{ color: "rgba(230,238,248,0.7)", fontSize: 13, marginBottom: 5 }}>{proj.description}</div>
                          {proj.keyFeatures?.length > 0 && (
                            <ul style={{ margin: "0 0 6px", paddingLeft: 16, fontSize: 12, color: "rgba(230,238,248,0.7)" }}>
                              {proj.keyFeatures.map((f: string, fi: number) => <li key={fi}>{f}</li>)}
                            </ul>
                          )}
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            {proj.skillFocus && <span style={{ fontSize: 11, color: "#c084fc", fontWeight: 700 }}>🎯 {proj.skillFocus}</span>}
                            {proj.estimatedTime && <span style={{ fontSize: 11, color: "rgba(230,238,248,0.5)" }}>⏱️ {proj.estimatedTime}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {plan?.implementationGuidance && Object.keys(plan.implementationGuidance).some((k) => (plan.implementationGuidance[k]?.length ?? 0) > 0) && (
                  <div style={{ padding: "13px 15px", borderRadius: 10, background: "rgba(168,85,247,0.07)", border: "1px dashed rgba(168,85,247,0.28)" }}>
                    <div style={{ fontWeight: 700, color: "rgba(230,238,248,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 9 }}>📋 Implementation Guidance</div>
                    <div style={{ display: "grid", gap: 9 }}>
                      {plan.implementationGuidance.technologies?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(230,238,248,0.5)", marginBottom: 4 }}>Technologies:</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {plan.implementationGuidance.technologies.map((tech: string, i: number) => (
                              <span key={i} style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>{tech}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {plan.implementationGuidance.architecturePatterns?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(230,238,248,0.5)", marginBottom: 3 }}>Architecture Patterns:</div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "rgba(230,238,248,0.7)" }}>
                            {plan.implementationGuidance.architecturePatterns.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                      {plan.implementationGuidance.measurableOutcomes?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(230,238,248,0.5)", marginBottom: 3 }}>Measurable Outcomes:</div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "rgba(230,238,248,0.7)" }}>
                            {plan.implementationGuidance.measurableOutcomes.map((o: string, i: number) => <li key={i}>{o}</li>)}
                          </ul>
                        </div>
                      )}
                      {plan.implementationGuidance.visibilityTips?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(230,238,248,0.5)", marginBottom: 3 }}>GitHub Visibility Tips:</div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "rgba(230,238,248,0.7)" }}>
                            {plan.implementationGuidance.visibilityTips.map((tip: string, i: number) => <li key={i}>{tip}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );

            const priorityBadge = (plan: any) => {
              if (!plan?.priorityRecommendation) return null;
              const isEnhance = plan.priorityRecommendation.startsWith("existing");
              return (
                <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: isEnhance ? "rgba(34,197,94,0.15)" : "rgba(139,92,246,0.2)", border: `1px solid ${isEnhance ? "rgba(34,197,94,0.3)" : "rgba(139,92,246,0.4)"}`, color: isEnhance ? "#86efac" : "#a78bfa", fontWeight: 700 }}>
                  {isEnhance ? "🔧 Enhance Existing" : "🚀 New Project"}
                </span>
              );
            };

            return (
            <div style={{ marginTop: 20 }}>
              {/* section header */}
              <div style={{ fontWeight: 900, color: "#c084fc", marginBottom: 14, fontSize: 17, display: "flex", alignItems: "center", gap: 10 }}>
                ✨ AI Skill Recommendations
                <span style={{ fontSize: 12, color: "rgba(230,238,248,0.4)", fontWeight: 500 }}>powered by GPT-4o mini</span>
                {aiSuggestions && aiSuggestions.groups.length > 0 && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc", fontWeight: 700 }}>
                    {aiSuggestions.groups.length} group{aiSuggestions.groups.length !== 1 ? "s" : ""} · {aiSuggestions.individual.length} individual
                  </span>
                )}
              </div>

              {/* loading */}
              {aiSuggestionsLoading && !aiSuggestions && (
                <div style={{ color: "#a78bfa", fontSize: 14, padding: "16px 18px", borderRadius: 12, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}>
                  <span className="pm-spin" style={{ marginRight: 8 }}>⟳</span>
                  Grouping related skills and generating personalized recommendations…
                </div>
              )}

              <div style={{ display: "grid", gap: 16 }}>
                {/* ── Grouped recommendations ─────────────────────── */}
                {aiSuggestions?.groups.map((g: any, gi: number) => (
                  <div key={`group-${gi}`} style={{ padding: "20px 22px", borderRadius: 14, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.35)" }}>
                    {/* group header */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                          <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "rgba(99,102,241,0.22)", border: "1px solid rgba(99,102,241,0.45)", color: "#a5b4fc", fontWeight: 800, letterSpacing: 0.5 }}>
                            🔗 GROUPED · {g.skills?.length} skills
                          </span>
                          {priorityBadge(g.plan)}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(g.skills ?? []).map((s: string) => (
                            <span key={s} style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)", color: "#c7d2fe", fontWeight: 800, fontSize: 12 }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {g.plan && <PlanBody plan={g.plan} />}
                  </div>
                ))}

                {/* ── Individual recommendations ───────────────────── */}
                {(aiSuggestions?.individual?.length ?? 0) > 0 && (aiSuggestions?.groups?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                    <div style={{ height: 1, flex: 1, background: "rgba(139,92,246,0.15)" }} />
                    <span style={{ fontSize: 11, color: "rgba(230,238,248,0.35)", fontWeight: 600 }}>INDIVIDUAL</span>
                    <div style={{ height: 1, flex: 1, background: "rgba(139,92,246,0.15)" }} />
                  </div>
                )}

                {aiSuggestions?.individual.map((item: any, ii: number) => (
                  <div key={`ind-${ii}`} style={{ padding: "20px 22px", borderRadius: 14, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.32)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      <span style={{ padding: "4px 12px", borderRadius: 999, background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.45)", color: "#d8b4fe", fontWeight: 900, fontSize: 13 }}>{item.skill}</span>
                      {priorityBadge(item.plan)}
                    </div>
                    {item.plan && <PlanBody plan={item.plan} />}
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>
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