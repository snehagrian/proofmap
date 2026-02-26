"use client";

import { useState } from "react";

declare global {
  interface Window {
    pdfjsLib?: any;
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
        <div style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Overall Skill Reality Score</div>
          <div style={{ fontSize: 44, fontWeight: 900, marginTop: 6 }}>{result.overallScore}%</div>
        </div>
      )}
    </div>
  );
}