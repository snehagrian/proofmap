import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKILLS = [
  "Java","Python","JavaScript","TypeScript","C++",
  "React","Next.js","React Native","HTML","CSS","Tailwind",
  "Node.js","Express","Spring Boot","FastAPI",
  "REST API","Microservices",
  "AWS","Docker","Jenkins","CI/CD","GitHub Actions","CloudWatch","Lambda","DynamoDB","S3",
  "PostgreSQL","MySQL","MongoDB",
  "Event-driven","Asynchronous","Concurrency",
  "Testing","Performance Optimization","Query Optimization","Scalability","Fault Tolerance"
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function extractClaimedSkills(text: string) {
  const t = normalize(text);
  const synonyms: Record<string, string[]> = {
    "Next.js": ["nextjs", "next.js", "next js"],
    "Node.js": ["nodejs", "node.js", "node js"],
    "REST API": ["restful", "rest api", "restful api", "rest apis"],
    "CI/CD": ["cicd", "ci cd", "ci/cd", "pipeline"],
    "GitHub Actions": [".github/workflows", "github actions"],
    "Spring Boot": ["springboot", "spring boot"],
    "Event-driven": ["event driven", "event-driven", "pubsub", "pub/sub"],
    "Asynchronous": ["async", "asynchronous", "non-blocking"]
  };

  const found: string[] = [];
  for (const s of SKILLS) {
    const patterns = [s, ...(synonyms[s] || [])].map((x) => normalize(x));
    if (patterns.some((p) => t.includes(p))) found.push(s);
  }
  return Array.from(new Set(found));
}

type Evidence = { skill: string; repo: string };

function detectEvidence(files: string[], skills: string[]): Evidence[] {
  const f = files.map((x) => x.toLowerCase());
  const has = (needle: string) => f.some((p) => p.includes(needle));
  const anyHas = (needles: string[]) => needles.some((n) => has(n));

  const out: Evidence[] = [];

  for (const skill of skills) {
    const s = skill.toLowerCase();

    const hit =
      (s.includes("react") && (has("package.json") || anyHas([".tsx", ".jsx"]))) ||
      (s.includes("next") && anyHas(["next.config", "app/", "pages/"])) ||
      (s.includes("typescript") && anyHas(["tsconfig.json", ".ts", ".tsx"])) ||
      (s.includes("node") && has("package.json")) ||
      (s.includes("docker") && anyHas(["dockerfile", "docker-compose"])) ||
      (s.includes("github actions") && has(".github/workflows")) ||
      (s === "ci/cd" && (has(".github/workflows") || has("jenkinsfile"))) ||
      (s.includes("spring boot") && anyHas(["pom.xml", "build.gradle"])) ||
      (s.includes("fastapi") && anyHas(["requirements.txt", ".py", "main.py"])) ||
      (s.includes("postgresql") && anyHas(["postgres", "psql"])) ||
      (s.includes("mysql") && has("mysql")) ||
      (s.includes("mongodb") && anyHas(["mongo", "mongodb"]));

    if (hit) out.push({ skill, repo: "(temp)" });
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const { githubUsername, resumeText } = await req.json();

    if (!githubUsername) return NextResponse.json({ error: "Missing GitHub username" }, { status: 400 });
    if (!resumeText) return NextResponse.json({ error: "Missing resumeText" }, { status: 400 });

    const claimedSkills = extractClaimedSkills(resumeText);

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });

    const reposRes = await octokit.repos.listForUser({
      username: githubUsername,
      per_page: 10,
      sort: "updated"
    });

    const repos = reposRes.data.filter((r) => !r.fork).map((r) => r.name);

    const evidence: Evidence[] = [];
    for (const repoName of repos) {
      const contents = await octokit.repos.getContent({
        owner: githubUsername,
        repo: repoName,
        path: ""
      });

      const files: string[] = Array.isArray(contents.data)
        ? contents.data.map((x: any) => x.name).filter(Boolean)
        : [contents.data.name].filter(Boolean);

      const repoEvidence = detectEvidence(files, claimedSkills).map((e) => ({ ...e, repo: repoName }));
      evidence.push(...repoEvidence);
    }

    const provenSkills = new Set(evidence.map((e) => e.skill));
    const overallScore =
      claimedSkills.length === 0 ? 0 : Math.round((provenSkills.size / claimedSkills.length) * 100);

    const missingProof = claimedSkills.filter((s) => !provenSkills.has(s));

    return NextResponse.json({
      overallScore,
      claimedSkills,
      provenSkills: Array.from(provenSkills),
      missingProof,
      evidence
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.response?.data?.message || err?.message || "Unknown error";
    return NextResponse.json({ error: `Scan failed (${status}): ${message}` }, { status });
  }
}