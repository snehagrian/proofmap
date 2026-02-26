"use client";

import { useState } from "react";

export default function UploadPage() {
  const [githubUsername, setGithubUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onScan() {
    if (!file) return setError("Please upload your resume PDF.");
    if (!githubUsername.trim()) return setError("Please enter your GitHub username.");

    setError(null);
    setLoading(true);
    setResult(null);

    const form = new FormData();
    form.append("resume", file);
    form.append("githubUsername", githubUsername.trim());

    const res = await fetch("/api/scan", { method: "POST", body: form });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "Scan failed.");
      return;
    }
    setResult(data);
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>ProofMap — Resume ↔ GitHub Skill Proof</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Upload your resume + enter GitHub username. Get proof-based skill score.
      </p>

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>GitHub username</div>
          <input
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="e.g. snehagrian"
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Resume PDF</div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
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
            fontWeight: 700,
            cursor: "pointer",
            width: 140
          }}
        >
          {loading ? "Scanning..." : "Scan"}
        </button>

        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </div>

      {result && (
        <div style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Overall Skill Reality Score</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>
            {result.overallScore}%
          </div>

          <div style={{ marginTop: 16, fontWeight: 700 }}>Skills found in resume</div>
          <ul>
            {result.claimedSkills.map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          <div style={{ marginTop: 16, fontWeight: 700 }}>Evidence (first pass)</div>
          <ul>
            {result.evidence.map((e: any, idx: number) => (
              <li key={idx}>
                <b>{e.skill}</b> → {e.repo} ({e.reason})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}