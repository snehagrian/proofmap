"use client";

import Link from "next/link";
import ParallaxSection from "@/components/ParallaxSection";
import FloatingOrbs from "@/components/FloatingOrbs";

export default function Home() {
  return (
    <>
      <FloatingOrbs />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Hero Section */}
        <section style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          textAlign: "center",
        }}>
          <ParallaxSection speed={0.3}>
            <div style={{ maxWidth: 1200 }}>
              <div style={{ marginBottom: 24 }}>
                <span style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(139, 92, 246, 0.15)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  color: "#c084fc",
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 32,
                }}>✨ Resume Validation</span>
              </div>

              <h1 style={{ 
                fontSize: "clamp(40px, 8vw, 72px)",
                fontWeight: 900,
                margin: 0,
                lineHeight: 1.1,
                marginBottom: 24,
              }}>
                <span style={{
                  background: "linear-gradient(135deg, #a78bfa, #c084fc, #e879f9)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>Validate Your Skills</span>
                <br />
                <span style={{ color: "#e6eef8" }}>with GitHub ProofMap</span>
              </h1>

              <p style={{
                fontSize: 20,
                color: "rgba(230, 238, 248, 0.7)",
                lineHeight: 1.8,
                maxWidth: 700,
                margin: "0 auto 40px",
              }}>
                Compare your resume skills against your actual GitHub projects.
                Get a comprehensive skill reality score and actionable insights to boost your credibility.
              </p>

              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/upload">
                  <button className="pm-btn" style={{
                    padding: "16px 32px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 18,
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(139, 92, 246, 0.4)",
                    transition: "all 0.3s ease",
                  }}>
                    Start Free Analysis →
                  </button>
                </Link>
                <a href="#features">
                  <button style={{
                    padding: "16px 32px",
                    borderRadius: 12,
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    background: "rgba(139, 92, 246, 0.05)",
                    color: "#e6eef8",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}>
                    Learn More
                  </button>
                </a>
              </div>

              {/* Stats */}
              {/* <div style={{
                display: "flex",
                gap: 48,
                justifyContent: "center",
                marginTop: 64,
                flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#a78bfa" }}>25+</div>
                  <div style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.6)", fontWeight: 600 }}>Skills Tracked</div>
                </div>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#a78bfa" }}>100%</div>
                  <div style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.6)", fontWeight: 600 }}>Accurate</div>
                </div>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#a78bfa" }}>Free</div>
                  <div style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.6)", fontWeight: 600 }}>Forever</div>
                </div>
              </div> */}
            </div>
          </ParallaxSection>
        </section>

        {/* Features Section */}
        <section id="features" style={{
          padding: "100px 24px",
          background: "rgba(139, 92, 246, 0.02)",
        }}>
          <ParallaxSection speed={0.2}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 64 }}>
                <h2 style={{
                  fontSize: 48,
                  fontWeight: 900,
                  marginBottom: 16,
                  background: "linear-gradient(135deg, #a78bfa, #c084fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>How It Works</h2>
                <p style={{ fontSize: 18, color: "rgba(230, 238, 248, 0.7)", maxWidth: 600, margin: "0 auto" }}>
                  Our system analyzes your GitHub repositories to validate your resume claims
                </p>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 32,
              }}>
                {[
                  {
                    icon: "📄",
                    title: "Upload Your Resume",
                    description: "Simply upload your resume PDF and enter your GitHub username"
                  },
                  {
                    icon: "🔍",
                    title: "Deep Repository Scan",
                    description: "We analyze your code, dependencies, and project structures across all repos"
                  },
                  {
                    icon: "📊",
                    title: "Get Your Score",
                    description: "Receive a detailed breakdown with proficiency levels and improvement suggestions"
                  },
                  {
                    icon: "🎯",
                    title: "Set Goals for Missing Skills",
                    description: "Select missing skills and set clear learning goals with an action plan to build proof on GitHub"
                  },
                ].map((feature, idx) => (
                  <div key={idx} className="pm-card" style={{
                    padding: 32,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>{feature.icon}</div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: "#e6eef8" }}>
                      {feature.title}
                    </h3>
                    <p style={{ fontSize: 16, color: "rgba(230, 238, 248, 0.7)", lineHeight: 1.6 }}>
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ParallaxSection>
        </section>

        {/* Benefits Section */}
        <section style={{ padding: "100px 24px" }}>
          <ParallaxSection speed={0.15}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 24,
              }}>
                {[
                  { icon: "⚡", title: "Lightning Fast", desc: "Get results in seconds with optimized parallel processing" },
                  { icon: "🎯", title: "Highly Accurate", desc: "Advanced pattern recognition validates actual skill usage" },
                  { icon: "🔒", title: "100% Secure", desc: "We never store your resume or access private repositories" },
                  { icon: "💡", title: "Actionable Insights", desc: "Get specific project ideas to fill skill gaps" },
                  { icon: "🚀", title: "Career Boost", desc: "Stand out with verified, provable technical skills" },
                  { icon: "📈", title: "Track Progress", desc: "See your skill validation improve over time" },
                ].map((benefit, idx) => (
                  <div key={idx} style={{
                    padding: 24,
                    background: "rgba(139, 92, 246, 0.05)",
                    border: "1px solid rgba(139, 92, 246, 0.15)",
                    borderRadius: 12,
                    transition: "all 0.3s ease",
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{benefit.icon}</div>
                    <h4 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: "#e6eef8" }}>
                      {benefit.title}
                    </h4>
                    <p style={{ fontSize: 14, color: "rgba(230, 238, 248, 0.6)", lineHeight: 1.5 }}>
                      {benefit.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ParallaxSection>
        </section>

        {/* CTA Section */}
        <section style={{
          padding: "100px 24px",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(109, 40, 217, 0.05))",
          textAlign: "center",
        }}>
          <ParallaxSection speed={0.25}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <h2 style={{
                fontSize: 48,
                fontWeight: 900,
                marginBottom: 24,
                color: "#e6eef8",
              }}>Ready to Validate Your Skills?</h2>
              <p style={{
                fontSize: 20,
                color: "rgba(230, 238, 248, 0.7)",
                marginBottom: 40,
                lineHeight: 1.7,
              }}>
                Join developers worldwide in proving their technical expertise with GitHub-backed evidence.
                It's completely free and takes less than a minute.
              </p>
              <Link href="/upload">
                <button className="pm-btn" style={{
                  padding: "18px 40px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 20,
                  cursor: "pointer",
                  boxShadow: "0 12px 28px rgba(139, 92, 246, 0.4)",
                }}>
                  Start Your Free Analysis →
                </button>
              </Link>
            </div>
          </ParallaxSection>
        </section>

        {/* Footer */}
        <footer style={{
          padding: "40px 24px",
          borderTop: "1px solid rgba(139, 92, 246, 0.15)",
          textAlign: "center",
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