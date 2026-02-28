export type RepoFacts = {
  repo: string;
  deps: Set<string>;
  pyDeps: Set<string>;
  filesLower: string[];
  codeSamples?: string[];
};

// Generate a short goal for a missing skill
export function generateGoal(skill: string) {
  switch (skill) {
    case "React":
      return "Add a small React component and integrate it into an existing frontend repo to demonstrate component based UI work.";
    case "Next.js":
      return "Add a page or API route using Next.js features (app/pages, next.config) to show framework usage.";
    case "Node.js":
      return "Add a small Node.js service or script (package.json + index.js) to demonstrate backend work.";
    case "Docker":
      return "Add a Dockerfile and .dockerignore to containerize an existing service.";
    case "GitHub Actions":
    case "CI/CD":
      return "Add a CI workflow under .github/workflows to run tests and builds.";
    case "Testing":
      return "Add unit or integration tests using a standard test framework and expose a test script.";
    case "AWS":
      return "Add a small integration showing AWS SDK usage or a short infrastructure example.";
    default:
      return `Add a focused example demonstrating ${skill}.`;
  }
}

function scoreRepoForSkill(skill: string, r: RepoFacts) {
  // lightweight heuristic scoring
  let score = 0;
  const low = r.filesLower || [];
  const deps = r.deps || new Set<string>();
  const pyDeps = r.pyDeps || new Set<string>();

  // simple indicators
  const jsExt = [".js", ".jsx", ".ts", ".tsx"];
  const pyExt = [".py"];

  if (skill === "React" || skill === "Next.js" || skill === "Node.js") {
    if (low.some((p) => jsExt.some((e) => p.endsWith(e)))) score += 3;
  }
  if (skill === "FastAPI" || skill === "Python") {
    if (low.some((p) => pyExt.some((e) => p.endsWith(e)))) score += 3;
  }

  // dependency signals
  const lowerDeps = new Set(Array.from(deps).map((d) => d.toLowerCase()));
  if (skill === "React" && (lowerDeps.has("react") || lowerDeps.has("react-dom"))) score += 4;
  if (skill === "Next.js" && lowerDeps.has("next")) score += 4;
  if (skill === "Node.js" && lowerDeps.has("express")) score += 2;
  if (skill === "Docker") {
    if (low.some((p) => p.includes("dockerfile"))) score += 5;
  }
  if (skill === "GitHub Actions" || skill === "CI/CD") {
    if (low.some((p) => p.includes(".github/workflows"))) score += 5;
  }

  // small bonus for repository size
  score += Math.min(2, Math.floor(low.length / 50));

  return score;
}

function getTopReposForSkill(skill: string, repoFacts: RepoFacts[], limit = 3) {
  return repoFacts
    .map((r) => ({ repo: r.repo, score: scoreRepoForSkill(skill, r) }))
    .sort((a, b) => b.score - a.score)
    .filter((x) => x.score > 0)
    .slice(0, limit)
    .map((x) => x.repo);
}

export function generateIntegrationSuggestions(skill: string, repoFacts: RepoFacts[]) {
  // Score repos and pick best candidate
  const scored = repoFacts.map((r) => ({ repo: r.repo, score: scoreRepoForSkill(skill, r) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((s) => s.score > 0);

  // Helper: produce concise project idea sentences for a given skill
  function projectIdeasForSkill(s: string): string[] {
    const lower = (s || '').toLowerCase();

    if (lower.includes('react')) {
      return [
        'A notes component library that showcases interactive list and state management.',
        'A reusable form input collection with validation patterns and examples.',
        'A dashboard card component that displays live or sample data and can be reused across pages.',
        'A small UI widget library focused on accessibility and keyboard navigation.',
      ];
    }

    if (lower.includes('next')) {
      return [
        'A minimal blog that demonstrates server rendered pages and simple post fetching.',
        'An events listing site with a server rendered index and JSON API for details.',
        'A documentation site that uses server rendering for content and a search API.',
      ];
    }

    if (lower.includes('node')) {
      return [
        'A resume analyzer service that accepts profiles and returns simple matching suggestions.',
        'A parking helper API that tracks available spots and exposes search endpoints.',
        'A small CRUD microservice that manages items and demonstrates input validation.',
      ];
    }

    if (lower.includes('docker')) {
      return [
        'A containerized sample web service designed to demonstrate multi stage builds.',
        'A tiny tooling image that wraps a CLI and can be run as a portable utility.',
      ];
    }

    if (lower.includes('github actions') || lower.includes('ci') || lower.includes('cicd')) {
      return [
        'A continuous integration workflow that runs lint and tests for a project.',
        'A release automation workflow that builds and publishes an artifact when releasing.',
      ];
    }

    if (lower.includes('test') || lower.includes('testing')) {
      return [
        'A focused unit test suite that covers core module behavior and edge cases.',
        'A small end to end test that verifies a critical user flow for the app.',
      ];
    }

    if (lower.includes('aws')) {
      return [
        'An S3 uploader utility that demonstrates object storage interactions.',
        'A simple Lambda function that processes input and writes results to storage.',
      ];
    }

    if (lower.includes('postgres') || lower.includes('mysql') || lower.includes('postgresql')) {
      return [
        'A tiny app that illustrates database migrations and a sample analytical query.',
        'A URL shortener service that stores mappings and demonstrates basic SQL usage.',
      ];
    }

    if (lower.includes('mongo') || lower.includes('mongodb')) {
      return [
        'A notes API that stores JSON documents and demonstrates flexible queries.',
        'A content service that uses document storage for varying schemas and search.',
      ];
    }

    if (lower.includes('python')) {
      return [
        'A small machine learning trainer that fits a random forest on a toy dataset and reports metrics.',
        'A command line CSV processor that summarizes and filters data.',
      ];
    }

    if (lower.includes('java')) {
      return [
        'A tiny service module with one REST endpoint and a JUnit test that validates its behavior.',
        'A simple library that provides a clear example class and unit test.',
      ];
    }

    // Generic fallback project idea names
    return [
      `A focused demo project that highlights ${s} with one clear outcome reviewers can run locally.`,
      `A small example that exercises ${s} in isolation and is easy to inspect.`,
    ];
  }

  // Helper: extra concrete project names when no existing repo fits
  function extraProjectNamesForSkill(s: string): string[] {
    const lower = (s || '').toLowerCase();
    if (lower.includes('react')) {
      return [
        'Interactive notes app',
        'Tagged todo list',
        'Recipe manager with filters',
        'Kanban board for tasks',
        'Mini analytics dashboard',
      ];
    }
    if (lower.includes('next')) {
      return [
        'Server rendered personal blog',
        'Events calendar with details API',
        'Documentation site with search',
        'Minimal ecommerce product list',
        'Landing page with newsletter signup',
      ];
    }
    if (lower.includes('node')) {
      return [
        'Resume analyzer API',
        'Parking availability service',
        'Inventory CRUD API',
        'Authentication demo service',
        'Webhook receiver service',
      ];
    }
    if (lower.includes('python')) {
      return [
        'Random forest trainer for toy data',
        'CSV summarizer CLI',
        'Simple web scraper',
        'Data validation tool',
        'Small ETL pipeline',
      ];
    }
    if (lower.includes('docker')) {
      return [
        'Containerized web API',
        'CLI utility image',
        'Multi stage build example',
        'Containerized database with seed data',
        'Tiny microservice image',
      ];
    }
    if (lower.includes('aws')) {
      return [
        'S3 uploader utility',
        'Lambda image processor',
        'Simple DynamoDB key value store',
        'SNS notification demo',
        'Serverless form handler',
      ];
    }
    if (lower.includes('postgres') || lower.includes('mysql')) {
      return [
        'URL shortener',
        'Analytics sample app',
        'Blog with migrations',
        'Order tracking table demo',
        'Simple reporting service',
      ];
    }
    if (lower.includes('mongo')) {
      return [
        'Notes API',
        'Content store with flexible schema',
        'Activity log service',
        'User preferences store',
        'Document tagging service',
      ];
    }
    if (lower.includes('github actions') || lower.includes('ci') || lower.includes('cicd')) {
      return [
        'Lint and test CI workflow',
        'Release automation workflow',
        'Dependency update workflow',
        'Container build and publish workflow',
        'Security scan workflow',
      ];
    }
    if (lower.includes('test') || lower.includes('testing')) {
      return [
        'Unit test suite for core module',
        'End to end test for critical flow',
        'Property based test example',
        'Integration test against a fake service',
        'Quick performance smoke test',
      ];
    }
    if (lower.includes('java')) {
      return [
        'Tiny REST service module',
        'Utility library with example',
        'CLI tool with unit tests',
        'Sample Spring Boot controller',
        'Simple data processing module',
      ];
    }

    // Generic fallback names
    return [
      `${s} demo project`,
      `${s} example service`,
      `${s} starter app`,
      `${s} small utility`,
      `${s} sample module`,
    ];
  }

  const candidateExists = Boolean(best);
  const primary = projectIdeasForSkill(skill).slice(0, 3);
  let ideas: string[];
  if (candidateExists) {
    ideas = primary.slice(0, 3);
  } else {
    const extra = extraProjectNamesForSkill(skill).filter((e) => !primary.includes(e)).slice(0, 3);
    ideas = [...primary, ...extra].slice(0, 3);
  }

  // When a repo candidate exists, return repo name and three repository-specific guidance bullets
  if (candidateExists) {
    const repoName = best!.repo;
    function usageDetailsForSkill(s: string): string[] {
      const lower = (s || '').toLowerCase();
      if (lower.includes('react')) return [
        'Add a small demo component in an examples or components folder so reviewers can see React usage in context.',
        'Document one example import and the demo page where the component is rendered so it is easy to find.',
        'Include a short note describing the component purpose and expected behavior for quick verification.',
      ];
      if (lower.includes('next')) return [
        'Add one server rendered page or API route in the app or pages directory to show Next.js features.',
        'Mention the route path and the local URL to visit so reviewers can confirm server side rendering.',
        'Include a brief note about where data originates and which file demonstrates the framework usage.',
      ];
      if (lower.includes('node')) return [
        'Add a compact API route or script in a server or scripts folder to show Node.js backend work.',
        'Provide one curl example or command that demonstrates the endpoint response for quick verification.',
        'Add a short description of the endpoint purpose and expected JSON fields so reviewers can validate behavior.',
      ];
      if (lower.includes('docker')) return [
        'Add a Dockerfile at the project root and a .dockerignore so the repository shows containerization skills.',
        'Document exact build and run commands so reviewers can reproduce the container locally.',
        'Point to a health or status command the reviewer can run to confirm the container starts correctly.',
      ];
      if (lower.includes('github actions') || lower.includes('ci') || lower.includes('cicd')) return [
        'Add a minimal workflow under .github/workflows that runs the project test command to demonstrate CI integration.',
        'Mention the workflow file name and the trigger (push or pull request) so reviewers can find the run.',
        'Include a short note about what the workflow verifies and how success looks in the Actions tab.',
      ];
      if (lower.includes('test') || lower.includes('testing')) return [
        'Add a focused unit test for a core module and expose a test script in the project manifest.',
        'Point to the test file and list the exact command to run tests so reviewers can reproduce results.',
        'Include one sentence about what the test demonstrates and any fixture or mock used.',
      ];
      if (lower.includes('aws')) return [
        'Add a short example that uses the AWS SDK to perform one clear action such as uploading to S3.',
        'Document how reviewers can configure credentials or use a local emulator like LocalStack.',
        'Mention the file that contains the example and the exact command to run it for verification.',
      ];
      if (lower.includes('postgres') || lower.includes('mysql') || lower.includes('postgresql')) return [
        'Add a migration or a small query example in a migrations or db directory to demonstrate database usage.',
        'Document the connection URL format and a one line query to run for verification.',
        'Mention the migration or seed file so reviewers can inspect the schema and sample data.',
      ];
      if (lower.includes('mongo') || lower.includes('mongodb')) return [
        'Add a small data example that inserts and queries a document to show MongoDB usage within the repository.',
        'Mention the script or module that runs the example and the connection string format.',
        'Include a short note about the expected document output so reviewers can confirm the example quickly.',
      ];
      if (lower.includes('python')) return [
        'Add a small script and a requirements.txt and include a pytest test to make Python usage visible.',
        'Document the Python version and exact commands to create a venv and run the test.',
        'Point to the script and test file so reviewers can inspect the behavior quickly.',
      ];
      if (lower.includes('java')) return [
        'Add a tiny module with a JUnit test and include build files so Java usage is visible in the repository.',
        'Mention the build command (mvn or gradle) and the test to run for verification.',
        'Point to the example class and test file so reviewers can see the demonstration immediately.',
      ];
      return [
        'Add a focused example in a clear folder and mention the file that demonstrates the skill.',
        'Document the exact command reviewers can run to verify the example.',
        'Include a one line description of what the example shows for quick inspection.',
      ];
    }

    const usage = `Demonstrate this skill in repository: ${repoName}.`;
    const usageDetails = usageDetailsForSkill(skill);
    return { candidateExists: true, repoName: repoName, usage, usageDetails, ideas };
  }

  // No candidate: return project ideas and three-bullet plans per idea
  function planForProject(name: string): string[] {
    const low = (name || '').toLowerCase();
    // Provide three human-friendly approach bullets for each project idea
    if (low.includes('notes') || low.includes('notes app')) return [
      'Build a single page that creates, edits, and lists notes with local persistence.',
      'Include a small search or tag filter to demonstrate state management or queries.',
      'Add one example data file or seed so reviewers can see sample content quickly.',
    ];
    if (low.includes('todo') || low.includes('tasks')) return [
      'Implement create, update, and delete flows for tasks to show CRUD behavior.',
      'Add a small filter by tag or status to demonstrate list handling and state.',
      'Provide a sample dataset or example usage that reviewers can inspect without running complex setup.',
    ];
    if (low.includes('resume') || low.includes('analyzer')) return [
      'Accept a simple JSON profile and return a scored summary of matching skills.',
      'Demonstrate how matching logic maps resume fields to skill categories with one example input.',
      'Include one sample input and the corresponding output so reviewers can verify the behavior quickly.',
    ];
    if (low.includes('parking')) return [
      'Model available spots and a query endpoint to find nearby spots by simple criteria.',
      'Provide an example of adding and removing spots so reviewers can exercise state changes.',
      'Include one example query and the expected JSON response for quick verification.',
    ];
    if (low.includes('random forest') || low.includes('trainer')) return [
      'Train a small random forest on a toy dataset and report accuracy or a simple metric.',
      'Include the dataset or a script that generates synthetic data so results are reproducible.',
      'Provide the command and expected metric output so reviewers can confirm the training ran.',
    ];
    // Generic fallback plan bullets
    return [
      'Provide a minimal runnable entrypoint that demonstrates the core feature.',
      'Include one sample input and the expected output so reviewers can verify behavior quickly.',
      'Add a short README note explaining where the example is and how to run the verification command.',
    ];
  }

  const projectPlans: Record<string, string[]> = {};
  ideas.forEach((name) => { projectPlans[name] = planForProject(name); });
  return { candidateExists: false, ideas, projectPlans };
}
