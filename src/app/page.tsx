import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "white",
          borderRadius: 16,
          padding: 36,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0 }}>ProofMap</h1>

        <p style={{ marginTop: 12, fontSize: 16, color: "#444", lineHeight: 1.6 }}>
          Compare your resume skills with your GitHub projects and get a skill reality score.
        </p>

        <div style={{ marginTop: 22 }}>
          <Link href="/upload">
            <button
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                background: "black",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Go to Upload Page
            </button>
          </Link>
        </div>

        <div style={{ marginTop: 22, fontSize: 13, color: "#777" }}>
          Tip: Add a GitHub token in <code>.env.local</code> to avoid rate limits.
        </div>
      </div>
    </main>
  );
}