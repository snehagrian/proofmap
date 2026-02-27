"use client";

import { useState } from "react";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

function getColor(score: number) {
  if (score < 25)
    return { bg: "#fff1f1", border: "#ffb3b3", text: "#b00020", label: "Needs attention" }; // red
  if (score < 60)
    return { bg: "#fff8e1", border: "#ffd27a", text: "#8a5a00", label: "Medium" }; // yellow
  return { bg: "#ecfff1", border: "#9fe7b0", text: "#0b6b2b", label: "Good" }; // green
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function getProficiencyColor(level: string) {
  switch (level) {
    case "Expert":
      return { bg: "#e8f5e9", border: "#81c784", text: "#2e7d32" };
    case "Intermediate":
      return { bg: "#fff8e1", border: "#ffd54f", text: "#f57f17" };
    case "Beginner":
      return { bg: "#e3f2fd", border: "#64b5f6", text: "#1565c0" };
    default:
      return { bg: "#f5f5f5", border: "#bdbdbd", text: "#616161" };
  }
}

export default function UploadPage() {
  const [githubUsername, setGithubUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        ProofMap — Resume ↔ GitHub Skill Proof
      </h1>

      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>GitHub username</div>
          <input
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="e.g. snehagrian"
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Upload resume (PDF)</div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file && <div style={{ marginTop: 6, color: "#444" }}>Selected: {file.name}</div>}
        </label>

        <button
          onClick={onScan}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "black",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
            width: 170,
          }}
        >
          {loading ? "Scanning..." : "Scan Resume"}
        </button>

        {error && <div style={{ color: "crimson", fontWeight: 700 }}>{error}</div>}
      </div>

      {result && (
        <div
          style={{
            marginTop: 28,
            padding: 18,
            border: "1px solid #eee",
            borderRadius: 14,
            background: "white",
          }}
        >
          {/* Top summary */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Overall Skill Reality Score</div>
              <div style={{ fontSize: 44, fontWeight: 950, marginTop: 6 }}>
                {clamp01(result.overallScore)}%
              </div>
              <div style={{ marginTop: 6, color: "#555", fontWeight: 700 }}>
                Analyzed <span style={{ color: "#000" }}>{result.reposAnalyzed ?? "—"}</span> repos for{" "}
                <span style={{ color: "#000" }}>{result.githubUsername ?? githubUsername}</span>
              </div>
            </div>

            <div style={{ minWidth: 300 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Proof Status</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "#ffe1e1", border: "1px solid #ffb3b3" }} />
                  <span style={{ fontWeight: 700, color: "#444", fontSize: 13 }}>Needs attention</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "#fff3cf", border: "1px solid #ffd27a" }} />
                  <span style={{ fontWeight: 700, color: "#444", fontSize: 13 }}>Medium proof</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "#e9ffef", border: "1px solid #9fe7b0" }} />
                  <span style={{ fontWeight: 700, color: "#444", fontSize: 13 }}>Good proof</span>
                </div>
              </div>
              
              <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 8 }}>Proficiency Levels</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "#e8f5e9", border: "1px solid #81c784" }} />
                  <span style={{ fontWeight: 700, color: "#444", fontSize: 13 }}>Expert</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "#fff8e1", border: "1px solid #ffd54f" }} />
                  <span style={{ fontWeight: 700, color: "#444", fontSize: 13 }}>Intermediate</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: "#e3f2fd", border: "1px solid #64b5f6" }} />
                  <span style={{ fontWeight: 700, color: "#444", fontSize: 13 }}>Beginner</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skill Table */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
              Skill Proof Table
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>
                      Skill
                    </th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>
                      Proof %
                    </th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>
                      Proficiency
                    </th>
                    <th style={{ textAlign: "left", padding: 12, fontWeight: 900, borderBottom: "1px solid #eee" }}>
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
                          <td style={{ padding: 12, borderBottom: "1px solid #f1f1f1", fontWeight: 900 }}>
                            {row.skill}
                          </td>

                          <td style={{ padding: 12, borderBottom: "1px solid #f1f1f1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  height: 10,
                                  width: 160,
                                  borderRadius: 999,
                                  background: "#eee",
                                  overflow: "hidden",
                                  border: "1px solid #e5e5e5",
                                }}
                              >
                                <div style={{ height: "100%", width: `${score}%`, background: c.text }} />
                              </div>
                              <div style={{ fontWeight: 900 }}>{score}%</div>
                            </div>
                          </td>

                          <td style={{ padding: 12, borderBottom: "1px solid #f1f1f1" }}>
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
                              <span style={{ color: "#999", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: 12, borderBottom: "1px solid #f1f1f1" }}>
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

          {/* Present vs Missing */}
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 950 }}>✅ Skills present (proven)</div>
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

            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 950 }}>⚠️ Skills not present (missing proof)</div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(result.breakdown ?? [])
                  .filter((x: any) => clamp01(Number(x.score ?? 0)) < 25)
                  .sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
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
          </div>

          {/* 4-line feedback summary */}
          <div
            style={{
              marginTop: 16,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 14,
              background: "#fafafa",
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
                <div style={{ color: "#333", lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 950 }}>Quick feedback</div>
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
      )}
    </div>
  );
}