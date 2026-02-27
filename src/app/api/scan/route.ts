import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ProofMap – strict backend-only skill proof
 * - Scans repo tree recursively
 * - Reads code/config content (NOT markdown/docs)
 * - Scores resume-claimed skills by GitHub proof
 */

const SKILLS = [
  "Java", "Python", "JavaScript", "TypeScript", "C++",
  "React", "Next.js", "React Native",
  "HTML", "CSS", "Tailwind",
  "Node.js", "Express", "Spring Boot", "FastAPI",
  "REST API", "Microservices",
  "AWS", "Docker", "Jenkins", "CI/CD", "GitHub Actions",
  "PostgreSQL", "MySQL", "MongoDB",
  "Testing", "Concurrency",
];

function normalize(text: string) {
  return (text || "").toLowerCase();
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusFromScore(score: number) {
  if (score < 25) return { status: "Needs attention" as const, color: "red" as const };
  if (score < 60) return { status: "Medium" as const, color: "yellow" as const };
  return { status: "Good" as const, color: "green" as const };
}

function extractClaimedSkills(text: string) {
  const t = normalize(text);
  const synonyms: Record<string, string[]> = {
    "Next.js": ["nextjs", "next.js", "next js"],
    "Node.js": ["nodejs", "node.js", "node js"],
    "REST API": ["restful", "rest api", "restful api", "rest apis"],
    "CI/CD": ["cicd", "ci/cd", "pipeline", "pipelines"],
    "GitHub Actions": ["github actions", ".github/workflows"],
    "Spring Boot": ["spring boot", "springboot"],
    React: ["reactjs", "react js"],
    TypeScript: ["typescript"],
    JavaScript: ["javascript"],
    Tailwind: ["tailwindcss", "tailwind css"],
    Docker: ["dockerfile", "docker compose", "docker-compose"],
    PostgreSQL: ["postgres", "psql"],
    MongoDB: ["mongo", "mongodb"],
    "React Native": ["react-native", "react native"],
  };

  const found: string[] = [];
  for (const s of SKILLS) {
    const patterns = [s, ...(synonyms[s] || [])].map((x) => normalize(x));
    if (patterns.some((p) => p && t.includes(p))) found.push(s);
  }
  return Array.from(new Set(found));
}

function getExt(path: string) {
  const p = String(path || "");
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i).toLowerCase();
}

/* ---------------- GitHub helpers ---------------- */

async function tryGetFileText(octokit: Octokit, owner: string, repo: string, path: string) {
  try {
    const res = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(res.data)) return null;
    const data: any = res.data;
    if (!data.content || data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

async function fetchRepoTree(octokit: Octokit, owner: string, repo: string, treeSha: string) {
  const res = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "true",
  });
  return (res.data.tree || []) as any[];
}

async function fetchBlobText(octokit: Octokit, owner: string, repo: string, sha: string) {
  const blob = await octokit.git.getBlob({ owner, repo, file_sha: sha });
  if (!blob?.data?.content || blob.data.encoding !== "base64") return "";
  return Buffer.from(blob.data.content, "base64").toString("utf8");
}

function parsePackageJsonDeps(pkgText: string): Set<string> {
  try {
    const j = JSON.parse(pkgText);
    const deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}), ...(j.peerDependencies || {}) };
    return new Set(Object.keys(deps).map((x) => x.toLowerCase()));
  } catch {
    return new Set<string>();
  }
}

function parseRequirements(text: string): Set<string> {
  const out = new Set<string>();
  for (const line of (text || "").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const pkg = s.split(/[<>=\s;]/)[0]?.trim();
    if (pkg) out.add(pkg.toLowerCase());
  }
  return out;
}

/* ---------------- STRICT proof rules (ALL SKILLS) ----------------
   - NO markdown/doc proof
   - NO weak keyword proof
   - ONLY dependency/import/config evidence
*/

type SkillRules = {
  deps?: string[];
  pyDeps?: string[];
  fileIndicators?: string[]; // strong file/dir indicators
  importRegex?: RegExp[];    // strict imports/usage
  linguistLang?: string;     // for languages
};

const RULES: Record<string, SkillRules> = {
  // Languages
  Java: { linguistLang: "Java" },
  Python: { linguistLang: "Python" },
  JavaScript: { linguistLang: "JavaScript" },
  TypeScript: { linguistLang: "TypeScript" },
  "C++": { linguistLang: "C++" },
  HTML: { linguistLang: "HTML", fileIndicators: [".html"], importRegex: [/<\s*(div|section|main|header|footer|form|button|input)\b/i] },
  CSS: { linguistLang: "CSS", fileIndicators: [".css", ".scss"], importRegex: [/\bstyled\./i, /\bcss`/i, /\bstyle\.\w+\s*=\s*['"`]/i] },

  // Frameworks/Tools
  React: { deps: ["react", "react-dom"], importRegex: [/from\s+['"]react['"]/i, /require\(\s*['"]react['"]\s*\)/i] },
  "Next.js": { deps: ["next"], fileIndicators: ["next.config", "app/", "pages/"], importRegex: [/from\s+['"]next\//i] },
  "React Native": { deps: ["react-native"], importRegex: [/from\s+['"]react-native['"]/i] },
  Tailwind: { deps: ["tailwindcss"], fileIndicators: ["tailwind.config", "postcss.config"], importRegex: [/tailwindcss/i] },
  "Node.js": { fileIndicators: ["package.json"], importRegex: [/process\.env/i, /require\(\s*['"]http['"]\s*\)/i] },
  Express: { deps: ["express"], importRegex: [/from\s+['"]express['"]/i, /require\(\s*['"]express['"]\s*\)/i, /\bexpress\(\)/i] },
  FastAPI: { pyDeps: ["fastapi"], importRegex: [/\bfrom\s+fastapi\s+import\b/i, /\bFastAPI\(\)/i] },
  "Spring Boot": { fileIndicators: ["pom.xml", "build.gradle", "gradle"], importRegex: [/@SpringBootApplication/i, /org\.springframework/i] },

  // DevOps
  Docker: { fileIndicators: ["dockerfile", "docker-compose", "compose.yml"], importRegex: [/^FROM\s+/im] },
  "GitHub Actions": { fileIndicators: [".github/workflows"], importRegex: [/runs-on:\s+/i, /uses:\s+/i] },
  "CI/CD": { fileIndicators: [".github/workflows", "jenkinsfile", ".gitlab-ci", "azure-pipelines"], importRegex: [/runs-on:\s+/i, /pipeline\s*{/i] },
  Jenkins: { fileIndicators: ["jenkinsfile"], importRegex: [/pipeline\s*{/i] },

  // Cloud (STRICT)
  AWS: {
    deps: ["aws-sdk", "@aws-sdk/client-s3", "@aws-sdk/client-dynamodb", "@aws-sdk/client-lambda"],
    fileIndicators: ["serverless.yml", ".tf", "cloudformation", "template.yaml"],
    importRegex: [/from\s+['"]@aws-sdk\//i, /require\(\s*['"]aws-sdk['"]\s*\)/i, /\bprocess\.env\.AWS_/i],
  },

  // Databases
  PostgreSQL: { deps: ["pg", "postgres"], importRegex: [/\bfrom\s+['"](pg|postgres)['"]/i, /require\(\s*['"](pg|postgres)['"]\s*\)/i] },
  MySQL: { deps: ["mysql", "mysql2"], importRegex: [/\bfrom\s+['"](mysql|mysql2)['"]/i, /require\(\s*['"](mysql|mysql2)['"]\s*\)/i] },
  MongoDB: { deps: ["mongodb", "mongoose"], importRegex: [/\bfrom\s+['"](mongodb|mongoose)['"]/i, /require\(\s*['"](mongodb|mongoose)['"]\s*\)/i] },

  // QA
  Testing: { deps: ["jest", "vitest", "mocha", "chai", "cypress", "playwright"], fileIndicators: ["__tests__", ".spec.", ".test."], importRegex: [/\bdescribe\(/i, /\btest\(/i, /\bexpect\(/i] },

  // APIs
  "REST API": { deps: ["axios"], importRegex: [/\bfetch\(/i, /\baxios\./i, /\bapp\.(get|post|put|delete)\(/i, /\brouter\.(get|post|put|delete)\(/i] },

  // Concepts (kept strict + conservative)
  Concurrency: { importRegex: [/\bPromise\.all\b/i, /\bworker_threads\b/i, /\bnew\s+Worker\b/i] },
  Microservices: { fileIndicators: ["docker-compose", "k8s", "helm", "services/"], importRegex: [/\bgrpc\b/i, /\bkafka\b/i, /\brabbitmq\b/i] },
};

function matchScore(strongSignalsAcrossRepos: number) {
  // Match score = proof strength (not "resume %")
  if (strongSignalsAcrossRepos <= 0) return 0;
  if (strongSignalsAcrossRepos === 1) return 50;
  return 100;
}

// Do NOT scan markdown/docs at all
const SKIP_DIRS = ["node_modules", ".next", "dist", "build", "out", ".git", "coverage", "docs"];
const SCAN_EXTS = new Set([
  ".js", ".jsx", ".ts", ".tsx",
  ".py", ".java", ".kt",
  ".yml", ".yaml", ".json",
  ".html", ".css", ".scss",
  ".sh", ".gradle", ".properties",
  ".xml"
]);

type RepoFacts = {
  repo: string;
  deps: Set<string>;
  pyDeps: Set<string>;
  filesLower: string[];
  codeSamples: string[];
};

export async function POST(req: Request) {
  try {
    const { githubUsername, resumeText } = await req.json();

    if (!githubUsername) return NextResponse.json({ error: "Missing GitHub username" }, { status: 400 });
    if (!resumeText) return NextResponse.json({ error: "Missing resumeText" }, { status: 400 });

    const claimedSkills = extractClaimedSkills(resumeText);

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });

    const reposRes = await octokit.repos.listForUser({
      username: githubUsername,
      per_page: 25,
      sort: "updated",
    });

    const repos = reposRes.data
      .filter((r) => !r.fork)
      .map((r) => ({ name: r.name, default_branch: (r.default_branch || "main") as string }));

    // Linguist language %
    const langTotals: Record<string, number> = {};
    for (const repo of repos) {
      const langRes = await octokit.repos.listLanguages({ owner: githubUsername, repo: repo.name });
      for (const [lang, bytes] of Object.entries(langRes.data)) {
        langTotals[lang] = (langTotals[lang] || 0) + (bytes as number);
      }
    }
    const totalBytes = Object.values(langTotals).reduce((sum, b) => sum + b, 0) || 1;
    const langPercent = (lang: string) => clamp(((langTotals[lang] || 0) / totalBytes) * 100);

    // Repo facts (recursive scan, code/config only)
    const repoFacts: RepoFacts[] = [];
    const MAX_FILES_PER_REPO = 260;
    const MAX_CODE_FILES_FETCH = 70;
    const MAX_BLOB_CHARS = 40_000;

    for (const repo of repos) {
      const pkg = await tryGetFileText(octokit, githubUsername, repo.name, "package.json");
      const deps = pkg ? parsePackageJsonDeps(pkg) : new Set<string>();

      const reqTxt = await tryGetFileText(octokit, githubUsername, repo.name, "requirements.txt");
      const pyDeps = reqTxt ? parseRequirements(reqTxt) : new Set<string>();

      let tree: any[] = [];
      try {
        tree = await fetchRepoTree(octokit, githubUsername, repo.name, repo.default_branch);
      } catch {
        tree = await fetchRepoTree(octokit, githubUsername, repo.name, "master");
      }

      const blobs = tree
        .filter((x) => x.type === "blob" && x.path && x.sha)
        .map((x) => ({ path: String(x.path), sha: String(x.sha) }))
        .filter((x) => {
          const p = x.path.toLowerCase();
          if (SKIP_DIRS.some((d) => p.includes(`/${d}/`) || p.startsWith(`${d}/`))) return false;
          // skip markdown/docs entirely
          if (p.endsWith(".md") || p.endsWith(".rst") || p.endsWith(".txt")) return false;
          return true;
        })
        .filter((x) => SCAN_EXTS.has(getExt(x.path)))
        .slice(0, MAX_FILES_PER_REPO);

      const filesLower = blobs.map((b) => b.path.toLowerCase());

      const codeBlobs = blobs
        .filter((b) =>
          [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".kt", ".yml", ".yaml", ".html", ".css", ".scss", ".xml", ".gradle"].includes(
            getExt(b.path)
          )
        )
        .slice(0, MAX_CODE_FILES_FETCH);

      const codeSamples: string[] = [];
      for (const b of codeBlobs) {
        const txt = await fetchBlobText(octokit, githubUsername, repo.name, b.sha);
        if (!txt) continue;
        codeSamples.push(txt.length > MAX_BLOB_CHARS ? txt.slice(0, MAX_BLOB_CHARS) : txt);
      }

      repoFacts.push({ repo: repo.name, deps, pyDeps, filesLower, codeSamples });
    }

    // Proof breakdown: GitHub evidence for each resume skill
    const breakdown = claimedSkills.map((skill) => {
      const rules = RULES[skill];

      // Languages except HTML/CSS: linguist is the proof %
      if (rules?.linguistLang && skill !== "HTML" && skill !== "CSS") {
        const score = langPercent(rules.linguistLang);
        const { status, color } = statusFromScore(score);
        return { skill, score, status, color };
      }

      // Strong proof signals across repos (STRICT only)
      let reposWithProof = 0;

      for (const r of repoFacts) {
        let repoSignal = 0;

        if (rules?.fileIndicators?.length) {
          if (rules.fileIndicators.some((fi) => r.filesLower.some((p) => p.includes(fi.toLowerCase())))) repoSignal += 1;
        }

        if (rules?.deps?.length) {
          if (rules.deps.some((d) => r.deps.has(d.toLowerCase()))) repoSignal += 1;
        }

        if (rules?.pyDeps?.length) {
          if (rules.pyDeps.some((d) => r.pyDeps.has(d.toLowerCase()))) repoSignal += 1;
        }

        if (rules?.importRegex?.length) {
          if (r.codeSamples.some((txt) => rules.importRegex!.some((re) => re.test(txt)))) repoSignal += 1;
        }

        if (repoSignal > 0) reposWithProof += 1;
      }

      // HTML/CSS: combine linguist with strict proof
      if (skill === "HTML" || skill === "CSS") {
        const lp = langPercent(skill);
        const ms = matchScore(reposWithProof);
        const score = Math.max(lp, ms);
        const { status, color } = statusFromScore(score);
        return { skill, score, status, color };
      }

      const score = matchScore(reposWithProof);
      const { status, color } = statusFromScore(score);
      return { skill, score, status, color };
    });

    // Overall: average proof across resume skills
    const overallScore =
      breakdown.length === 0 ? 0 : Math.round(breakdown.reduce((sum, s) => sum + (s.score || 0), 0) / breakdown.length);

    const provenSkills = breakdown.filter((b) => b.score >= 25).map((b) => b.skill);
    const missingProof = breakdown.filter((b) => b.score < 25).map((b) => b.skill);

    return NextResponse.json({
      githubUsername,
      reposAnalyzed: repos.length,
      overallScore,
      claimedSkills,
      provenSkills,
      missingProof,
      breakdown,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.response?.data?.message || err?.message || "Unknown error";
    return NextResponse.json({ error: `Scan failed (${status}): ${message}` }, { status });
  }
}