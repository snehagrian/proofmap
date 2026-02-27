import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ProofMap – strict backend-only skill proof with advanced detection
 * - Scans repo tree recursively
 * - Reads code/config content (NOT markdown/docs)
 * - Scores resume-claimed skills by GitHub proof
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * ✅ Parallel language API calls (all repos at once)
 * ✅ Parallel repository processing (concurrent analysis)
 * ✅ Batch blob fetching (10 files at a time)
 * ✅ Early termination (stop at 3+ repos proof)
 * ✅ Smart file prioritization (configs & entry points first)
 * ✅ Reduced limits (35 files vs 70, 25k chars vs 40k)
 * ✅ Error resilience (failed fetches don't block other repos)
 * 
 * ACCURACY IMPROVEMENTS:
 * ✅ Hybrid language scoring (50% linguist + 50% proficiency)
 * ✅ Proficiency detection (Beginner/Intermediate/Expert levels)
 * ✅ Advanced pattern recognition (hooks, middleware, advanced APIs)
 * ✅ JavaScript: validates actual syntax patterns (functions, imports, modules)
 * ✅ TypeScript: checks for type annotations, interfaces, enums
 * ✅ Python: detects function/class definitions and imports
 * ✅ Java: validates class structures and package imports
 * ✅ React: detects hooks usage (useState, useEffect, advanced hooks)
 * ✅ Frameworks: validates actual framework-specific patterns
 * ✅ Databases: checks for query patterns and ORMs
 * ✅ Testing: detects test structures and assertions
 * ✅ Excludes generated code (minified, bundled, lock files)
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

async function checkRateLimit(octokit: Octokit) {
  try {
    const { data } = await octokit.rateLimit.get();
    const remaining = data.rate.remaining;
    const resetTime = new Date(data.rate.reset * 1000);
    
    if (remaining < 100) {
      console.warn(`GitHub API rate limit low: ${remaining} requests remaining. Resets at ${resetTime.toISOString()}`);
    }
    
    return { remaining, resetTime };
  } catch {
    return { remaining: -1, resetTime: new Date() };
  }
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
  advancedPatterns?: RegExp[]; // patterns indicating advanced usage
  excludePatterns?: RegExp[]; // patterns to exclude (generated code, etc.)
};

const RULES: Record<string, SkillRules> = {
  // Languages (enhanced with usage patterns)
  Java: { 
    linguistLang: "Java",
    fileIndicators: [".java"],
    importRegex: [/\bpublic\s+class\b/i, /\bprivate\s+\w+\s+\w+\(/i, /\bimport\s+java\./i, /@Override/i]
  },
  Python: { 
    linguistLang: "Python",
    fileIndicators: [".py", "__init__.py"],
    importRegex: [/\bdef\s+\w+\s*\(/i, /\bimport\s+\w+/i, /\bfrom\s+\w+\s+import\b/i, /\bclass\s+\w+.*:/i]
  },
  JavaScript: { 
    linguistLang: "JavaScript",
    fileIndicators: [".js", ".mjs", ".cjs"],
    importRegex: [
      /\bfunction\s+\w+\s*\(/i,
      /\bconst\s+\w+\s*=/i,
      /\blet\s+\w+\s*=/i,
      /\bvar\s+\w+\s*=/i,
      /=>\s*{/i, // arrow functions
      /\brequire\(\s*['"]/i,
      /\bmodule\.exports\s*=/i,
      /\bexport\s+(default|const|function|class)\b/i
    ]
  },
  TypeScript: { 
    linguistLang: "TypeScript",
    fileIndicators: [".ts", ".tsx", "tsconfig.json"],
    importRegex: [
      /:\s*(string|number|boolean|any|void|unknown)\b/i,
      /\binterface\s+\w+/i,
      /\btype\s+\w+\s*=/i,
      /\benum\s+\w+/i,
      /<\w+>/i, // generics
      /\bas\s+(string|number|boolean|any)\b/i
    ]
  },
  "C++": { 
    linguistLang: "C++",
    fileIndicators: [".cpp", ".hpp", ".cc", ".cxx"],
    importRegex: [/#include\s*[<"]/i, /\bstd::/i, /\busing\s+namespace\b/i, /\bclass\s+\w+\s*{/i]
  },
  HTML: { linguistLang: "HTML", fileIndicators: [".html"], importRegex: [/<\s*(div|section|main|header|footer|form|button|input)\b/i] },
  CSS: { linguistLang: "CSS", fileIndicators: [".css", ".scss"], importRegex: [/\bstyled\./i, /\bcss`/i, /\bstyle\.\w+\s*=\s*['"`]/i] },

  // Frameworks/Tools (enhanced with advanced patterns)
  React: { 
    deps: ["react", "react-dom"], 
    importRegex: [/from\s+['"]react['"]/i, /require\(\s*['"]react['"]\s*\)/i, /useState|useEffect|useContext/i],
    advancedPatterns: [/useCallback|useMemo|useReducer/i, /React\.memo|React\.lazy/i, /createContext/i, /forwardRef/i],
    excludePatterns: [/node_modules/i, /\.next\//i, /build\//i]
  },
  "Next.js": { 
    deps: ["next"], 
    fileIndicators: ["next.config", "app/", "pages/"], 
    importRegex: [/from\s+['"]next\//i, /export\s+(async\s+)?function\s+(getServerSideProps|getStaticProps)/i],
    advancedPatterns: [/getStaticPaths/i, /middleware/i, /revalidate/i, /Image\s+from\s+['"]next\/image/i]
  },
  "React Native": { 
    deps: ["react-native"], 
    importRegex: [/from\s+['"]react-native['"]/i, /StyleSheet\.create/i],
    advancedPatterns: [/Animated\./i, /useNativeDriver/i, /Platform\.select/i]
  },
  Tailwind: { 
    deps: ["tailwindcss"], 
    fileIndicators: ["tailwind.config", "postcss.config"], 
    importRegex: [/tailwindcss/i, /className=['"].*\b(flex|grid|p-|m-|bg-|text-)/i],
    advancedPatterns: [/@apply/i, /@layer/i, /theme\(/i]
  },
  "Node.js": { 
    fileIndicators: ["package.json"], 
    importRegex: [/process\.env/i, /require\(\s*['"]http['"]\s*\)/i, /require\(\s*['"](fs|path|os)['"]\s*\)/i],
    advancedPatterns: [/EventEmitter/i, /Stream/i, /Buffer\./i, /cluster/i]
  },
  Express: { 
    deps: ["express"], 
    importRegex: [/from\s+['"]express['"]/i, /require\(\s*['"]express['"]\s*\)/i, /\bexpress\(\)/i, /app\.(get|post|put|delete)/i],
    advancedPatterns: [/express\.Router/i, /middleware/i, /app\.use\(/i, /req\.(params|query|body)/i]
  },
  FastAPI: { 
    pyDeps: ["fastapi"], 
    importRegex: [/\bfrom\s+fastapi\s+import\b/i, /\bFastAPI\(\)/i, /@app\.(get|post|put|delete)/i],
    advancedPatterns: [/Depends\(/i, /BackgroundTasks/i, /WebSocket/i, /OAuth2/i]
  },
  "Spring Boot": { 
    fileIndicators: ["pom.xml", "build.gradle", "gradle"], 
    importRegex: [/@SpringBootApplication/i, /org\.springframework/i, /@RestController/i],
    advancedPatterns: [/@Autowired/i, /@Service/i, /@Repository/i, /@Transactional/i, /JpaRepository/i]
  },

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

  // Databases (enhanced with query patterns)
  PostgreSQL: { 
    deps: ["pg", "postgres", "knex", "typeorm"], 
    importRegex: [/\bfrom\s+['"](pg|postgres)['"]/i, /require\(\s*['"](pg|postgres)['"]\s*\)/i, /SELECT.*FROM/i, /INSERT.*INTO/i],
    advancedPatterns: [/JOIN/i, /TRANSACTION/i, /INDEX/i, /\$1.*\$2/i, /RETURNING/i]
  },
  MySQL: { 
    deps: ["mysql", "mysql2", "sequelize"], 
    importRegex: [/\bfrom\s+['"](mysql|mysql2)['"]/i, /require\(\s*['"](mysql|mysql2)['"]\s*\)/i],
    advancedPatterns: [/connection\.query/i, /\?.*\?/i, /LIMIT.*OFFSET/i]
  },
  MongoDB: { 
    deps: ["mongodb", "mongoose"], 
    importRegex: [/\bfrom\s+['"](mongodb|mongoose)['"]/i, /require\(\s*['"](mongodb|mongoose)['"]\s*\)/i, /Schema|model/i],
    advancedPatterns: [/aggregate\(/i, /populate\(/i, /\$match|\$group|\$lookup/i, /find(One|Many)/i]
  },

  // QA (enhanced with test patterns)
  Testing: { 
    deps: ["jest", "vitest", "mocha", "chai", "cypress", "playwright", "@testing-library/react"], 
    fileIndicators: ["__tests__", ".spec.", ".test."], 
    importRegex: [/\bdescribe\(/i, /\btest\(/i, /\bit\(/i, /\bexpect\(/i, /\bassert\./i],
    advancedPatterns: [/beforeEach|afterEach/i, /mock|spy/i, /toBe|toEqual|toHaveBeenCalled/i, /cy\./i, /page\./i]
  },

  // APIs (enhanced)
  "REST API": { 
    deps: ["axios", "node-fetch"], 
    importRegex: [/\bfetch\(/i, /\baxios\./i, /\bapp\.(get|post|put|delete)\(/i, /\brouter\.(get|post|put|delete)\(/i],
    advancedPatterns: [/async.*await.*fetch/i, /axios\.(interceptors|create)/i, /res\.(json|status)\(/i, /req\.(body|headers)/i]
  },

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

function calculateProficiency(
  reposWithProof: number, 
  reposWithAdvanced: number, 
  totalCodeFiles: number
): { level: string; score: number } {
  // Proficiency levels based on depth of usage
  if (reposWithProof === 0) {
    return { level: "None", score: 0 };
  }
  
  const baseScore = matchScore(reposWithProof);
  
  // Boost score if advanced patterns detected
  const proficiencyBoost = reposWithAdvanced > 0 ? Math.min(20, reposWithAdvanced * 10) : 0;
  const finalScore = Math.min(100, baseScore + proficiencyBoost);
  
  // Determine proficiency level
  if (reposWithAdvanced >= 2 && finalScore >= 80) {
    return { level: "Expert", score: finalScore };
  } else if (reposWithAdvanced >= 1 || (reposWithProof >= 2 && totalCodeFiles >= 20)) {
    return { level: "Intermediate", score: Math.max(finalScore, 60) };
  } else if (reposWithProof >= 1) {
    return { level: "Beginner", score: Math.min(finalScore, 65) };
  }
  
  return { level: "None", score: 0 };
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
  totalCodeFiles: number;
};

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { githubUsername, resumeText } = await req.json();

    if (!githubUsername) return NextResponse.json({ error: "Missing GitHub username" }, { status: 400 });
    if (!resumeText) return NextResponse.json({ error: "Missing resumeText" }, { status: 400 });

    const claimedSkills = extractClaimedSkills(resumeText);

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
    
    // Check rate limit early to provide better error messages
    const rateLimit = await checkRateLimit(octokit);
    if (rateLimit.remaining >= 0 && rateLimit.remaining < 50) {
      return NextResponse.json({ 
        error: `GitHub API rate limit too low (${rateLimit.remaining} remaining). Please try again after ${rateLimit.resetTime.toLocaleTimeString()}.` 
      }, { status: 429 });
    }

    const reposRes = await octokit.repos.listForUser({
      username: githubUsername,
      per_page: 25,
      sort: "updated",
    });

    const repos = reposRes.data
      .filter((r) => !r.fork)
      .map((r) => ({ name: r.name, default_branch: (r.default_branch || "main") as string }));

    // Linguist language % - PARALLEL fetching
    const langTotals: Record<string, number> = {};
    const langResults = await Promise.all(
      repos.map((repo) => 
        octokit.repos.listLanguages({ owner: githubUsername, repo: repo.name })
          .catch(() => ({ data: {} }))
      )
    );
    
    for (const langRes of langResults) {
      for (const [lang, bytes] of Object.entries(langRes.data)) {
        langTotals[lang] = (langTotals[lang] || 0) + (bytes as number);
      }
    }
    const totalBytes = Object.values(langTotals).reduce((sum, b) => sum + b, 0) || 1;
    const langPercent = (lang: string) => clamp(((langTotals[lang] || 0) / totalBytes) * 100);

    // Repo facts (recursive scan, code/config only) - PARALLEL processing
    const MAX_FILES_PER_REPO = 200;
    const MAX_CODE_FILES_FETCH = 35; // Reduced from 70 for better efficiency
    const MAX_BLOB_CHARS = 25_000; // Reduced from 40k - most imports are in first 25k
    const MAX_PARALLEL_BLOBS = 10; // Fetch blobs in batches
    
    // Helper to process a single repo
    async function processRepo(repo: { name: string; default_branch: string }): Promise<RepoFacts> {
      // Fetch package.json and requirements.txt in parallel
      const [pkg, reqTxt] = await Promise.all([
        tryGetFileText(octokit, githubUsername, repo.name, "package.json"),
        tryGetFileText(octokit, githubUsername, repo.name, "requirements.txt"),
      ]);
      
      const deps = pkg ? parsePackageJsonDeps(pkg) : new Set<string>();
      const pyDeps = reqTxt ? parseRequirements(reqTxt) : new Set<string>();

      // Fetch tree with fallback
      let tree: any[] = [];
      try {
        tree = await fetchRepoTree(octokit, githubUsername, repo.name, repo.default_branch);
      } catch {
        try {
          tree = await fetchRepoTree(octokit, githubUsername, repo.name, "master");
        } catch {
          // If tree fetch fails, return what we have (deps still valuable)
          return { repo: repo.name, deps, pyDeps, filesLower: [], codeSamples: [], totalCodeFiles: 0 };
        }
      }

      const blobs = tree
        .filter((x) => x.type === "blob" && x.path && x.sha)
        .map((x) => ({ path: String(x.path), sha: String(x.sha) }))
        .filter((x) => {
          const p = x.path.toLowerCase();
          // Skip common excluded directories
          if (SKIP_DIRS.some((d) => p.includes(`/${d}/`) || p.startsWith(`${d}/`))) return false;
          // Skip documentation
          if (p.endsWith(".md") || p.endsWith(".rst") || p.endsWith(".txt")) return false;
          // Skip generated/compiled files
          if (p.includes(".min.") || p.includes(".bundle.") || p.endsWith(".map")) return false;
          // Skip lock files and auto-generated configs
          if (p.includes("package-lock") || p.includes("yarn.lock") || p.includes("pnpm-lock")) return false;
          return true;
        })
        .filter((x) => SCAN_EXTS.has(getExt(x.path)))
        .slice(0, MAX_FILES_PER_REPO);

      const filesLower = blobs.map((b) => b.path.toLowerCase());

      // Prioritize important files (configs, entry points)
      const codeBlobs = blobs
        .filter((b) =>
          [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".kt", ".yml", ".yaml", ".html", ".css", ".scss", ".xml", ".gradle"].includes(
            getExt(b.path)
          )
        )
        .sort((a, b) => {
          // Prioritize config and important files
          const priorityFiles = [
            "package.json", "tsconfig.json", "main", "index", "app", "server", "config", 
            "__init__", "settings", "routes", "api", "controller", "service"
          ];
          const aScore = priorityFiles.some(pf => a.path.toLowerCase().includes(pf)) ? 1 : 0;
          const bScore = priorityFiles.some(pf => b.path.toLowerCase().includes(pf)) ? 1 : 0;
          return bScore - aScore;
        })
        .slice(0, MAX_CODE_FILES_FETCH);

      // Fetch blobs in parallel batches
      const codeSamples: string[] = [];
      for (let i = 0; i < codeBlobs.length; i += MAX_PARALLEL_BLOBS) {
        const batch = codeBlobs.slice(i, i + MAX_PARALLEL_BLOBS);
        const batchResults = await Promise.all(
          batch.map((b) => 
            fetchBlobText(octokit, githubUsername, repo.name, b.sha)
              .catch(() => "")
          )
        );
        
        for (const txt of batchResults) {
          if (txt) {
            codeSamples.push(txt.length > MAX_BLOB_CHARS ? txt.slice(0, MAX_BLOB_CHARS) : txt);
          }
        }
      }

      return { repo: repo.name, deps, pyDeps, filesLower, codeSamples, totalCodeFiles: codeBlobs.length };
    }

    // Process all repos in parallel
    const repoFacts = await Promise.all(repos.map(processRepo));

    // Proof breakdown: GitHub evidence for each resume skill
    const breakdown = claimedSkills.map((skill) => {
      const rules = RULES[skill];

      // Pure linguist languages (no additional validation needed)
      const pureLinguistSkills = ["C++"];
      if (rules?.linguistLang && pureLinguistSkills.includes(skill)) {
        const score = langPercent(rules.linguistLang);
        const { status, color } = statusFromScore(score);
        return { skill, score, status, color };
      }

      // Languages with hybrid scoring (linguist % + code pattern validation)
      const hybridLanguages = ["Java", "Python", "JavaScript", "TypeScript", "HTML", "CSS"];
      if (rules?.linguistLang && hybridLanguages.includes(skill)) {
        const linguistScore = langPercent(rules.linguistLang);
        
        // Count repos with actual code patterns and advanced usage
        let reposWithCodePatterns = 0;
        let reposWithAdvanced = 0;
        let totalCodeFilesForSkill = 0;
        
        for (const r of repoFacts) {
          let hasPattern = false;
          let hasAdvancedPattern = false;
          
          // Check file indicators
          if (rules?.fileIndicators?.length) {
            if (rules.fileIndicators.some((fi) => r.filesLower.some((p) => p.includes(fi.toLowerCase())))) {
              hasPattern = true;
              totalCodeFilesForSkill += r.totalCodeFiles;
            }
          }
          
          // Check code patterns
          if (!hasPattern && rules?.importRegex?.length) {
            if (r.codeSamples.some((txt) => rules.importRegex!.some((re) => re.test(txt)))) {
              hasPattern = true;
              totalCodeFilesForSkill += r.totalCodeFiles;
            }
          }
          
          // Check advanced patterns
          if (hasPattern && rules?.advancedPatterns?.length) {
            if (r.codeSamples.some((txt) => rules.advancedPatterns!.some((re) => re.test(txt)))) {
              hasAdvancedPattern = true;
            }
          }
          
          if (hasPattern) {
            reposWithCodePatterns++;
            if (hasAdvancedPattern) reposWithAdvanced++;
          }
        }
        
        const proficiency = calculateProficiency(reposWithCodePatterns, reposWithAdvanced, totalCodeFilesForSkill);
        
        // Combine linguist % with pattern validation (weighted: 50% linguist, 50% proficiency)
        const score = Math.round(linguistScore * 0.5 + proficiency.score * 0.5);
        const { status, color } = statusFromScore(score);
        return { skill, score, status, color, proficiency: proficiency.level };
      }

      // Strong proof signals across repos (STRICT only) for non-language skills
      let reposWithProof = 0;
      let reposWithAdvanced = 0;
      let totalCodeFilesForSkill = 0;

      for (const r of repoFacts) {
        let repoSignal = 0;
        let hasAdvancedPattern = false;

        if (rules?.fileIndicators?.length) {
          if (rules.fileIndicators.some((fi) => r.filesLower.some((p) => p.includes(fi.toLowerCase())))) {
            repoSignal += 1;
            totalCodeFilesForSkill += r.totalCodeFiles;
          }
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
        
        // Check for advanced patterns
        if (rules?.advancedPatterns?.length && repoSignal > 0) {
          if (r.codeSamples.some((txt) => rules.advancedPatterns!.some((re) => re.test(txt)))) {
            hasAdvancedPattern = true;
          }
        }

        if (repoSignal > 0) {
          reposWithProof += 1;
          if (hasAdvancedPattern) reposWithAdvanced += 1;
        }
        
        // Early termination: if we already have 3+ repos with proof
        if (reposWithProof >= 3) break;
      }

      const proficiency = calculateProficiency(reposWithProof, reposWithAdvanced, totalCodeFilesForSkill);
      const { status, color } = statusFromScore(proficiency.score);
      return { skill, score: proficiency.score, status, color, proficiency: proficiency.level };
    });

    // Overall: average proof across resume skills
    const overallScore =
      breakdown.length === 0 ? 0 : Math.round(breakdown.reduce((sum, s) => sum + (s.score || 0), 0) / breakdown.length);

    const provenSkills = breakdown.filter((b) => b.score >= 25).map((b) => b.skill);
    const missingProof = breakdown.filter((b) => b.score < 25).map((b) => b.skill);

    const processingTime = Date.now() - startTime;
    console.log(`[ProofMap] Analyzed ${repos.length} repos for ${githubUsername} in ${processingTime}ms`);

    return NextResponse.json({
      githubUsername,
      reposAnalyzed: repos.length,
      overallScore,
      claimedSkills,
      provenSkills,
      missingProof,
      breakdown,
      meta: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.response?.data?.message || err?.message || "Unknown error";
    console.error(`[ProofMap] Scan failed: ${message}`, err);
    return NextResponse.json({ error: `Scan failed (${status}): ${message}` }, { status });
  }
}