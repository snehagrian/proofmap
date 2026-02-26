import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { Octokit } from "@octokit/rest";

export const runtime = "nodejs"; // important for pdf-parse

// super simple starter list (we’ll expand later)
const SKILLS = [
  "Java",
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Spring Boot",
  "FastAPI",
  "AWS",
  "Docker",
  "Jenkins",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "DynamoDB",
  "CI/CD",
  "Microservices",
  "REST API",
  "Event-driven",
  "Concurrency"
];

function extractClaimedSkills(resumeText: string): string[] {
  const text = resumeText.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILLS) {
    const s = skill.toLowerCase();
    // quick normalization for common words
    const patterns = [
      s,
      s.replace(".", ""),
      s.replace(" ", ""),
      s.replace("/", "")
    ];

    if (patterns.some((p) => p && text.includes(p))) {
      found.push(skill);
    }
  }
  return Array.from(new Set(found));
}

function findEvidenceInRepoFiles(files: string[], claimedSkills: string[]) {
  const evidence: { skill: string; repo: string; reason: string }[] = [];
  const fileText = files.map((f) => f.toLowerCase()).join(" ");

  for (const skill of claimedSkills) {
    const s = skill.toLowerCase();

    // Example: React evidence = package.json OR src files OR common config files
    const hit =
      (s.includes("react") && (fileText.includes("package.json") || fileText.includes("tsx"))) ||
      (s.includes("next") && (fileText.includes("next.config") || fileText.includes("app/"))) ||
      (s.includes("docker") && fileText.includes("dockerfile")) ||
      (s.includes("jenkins") && fileText.includes("jenkinsfile")) ||
      (s.includes("python") && (fileText.includes("requirements.txt") || fileText.includes(".py"))) ||
      (s.includes("java") && (fileText.includes("pom.xml") || fileText.includes(".java"))) ||
      (s.includes("typescript") && fileText.includes("tsconfig.json")) ||
      (s.includes("postgresql") && fileText.includes("postgres")) ||
      (s.includes("mysql") && fileText.includes("mysql"));

    if (hit) {
      evidence.push({ skill, repo: "(filled later)", reason: "matched repo file signals" });
    }
  }
  return evidence;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("resume") as File | null;
    const githubUsername = (form.get("githubUsername") as string | null) || "";

    if (!file) {
      return NextResponse.json({ error: "Missing resume PDF." }, { status: 400 });
    }
    if (!githubUsername.trim()) {
      return NextResponse.json({ error: "Missing GitHub username." }, { status: 400 });
    }

    // 1) Read resume PDF text
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const resumeText = parsed.text || "";

    // 2) Extract claimed skills from resume text
    const claimedSkills = extractClaimedSkills(resumeText);

    // 3) Fetch repos from GitHub
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined
    });

    const reposRes = await octokit.repos.listForUser({
      username: githubUsername.trim(),
      per_page: 8, // keep small for MVP
      sort: "updated"
    });

    const repos = reposRes.data.map((r) => ({
      name: r.name,
      default_branch: r.default_branch
    }));

    // 4) Scan each repo’s root tree (simple MVP)
    const evidence: { skill: string; repo: string; reason: string }[] = [];

    for (const repo of repos) {
      // fetch root contents
      const contents = await octokit.repos.getContent({
        owner: githubUsername.trim(),
        repo: repo.name,
        path: ""
      });

      const files: string[] = Array.isArray(contents.data)
        ? contents.data.map((x: any) => x.path || x.name).filter(Boolean)
        : [contents.data.path || contents.data.name].filter(Boolean);

      const repoEvidence = findEvidenceInRepoFiles(files, claimedSkills).map((e) => ({
        ...e,
        repo: repo.name
      }));

      evidence.push(...repoEvidence);
    }

    // 5) Simple score: % of claimed skills that have at least 1 evidence hit
    const provenSkills = new Set(evidence.map((e) => e.skill));
    const overallScore =
      claimedSkills.length === 0 ? 0 : Math.round((provenSkills.size / claimedSkills.length) * 100);

    return NextResponse.json({
      overallScore,
      claimedSkills,
      evidence: evidence.slice(0, 40) // keep response small
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error. Check terminal logs. (Tip: GitHub rate limits without token.)" },
      { status: 500 }
    );
  }
}