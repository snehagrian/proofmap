# ProofMap

**ProofMap** is a resume skill validation tool that cross-references the skills listed on your resume against your actual GitHub repositories. It gives you a skill reality score, identifies proof gaps, and generates actionable goals to help you back up your claims with real code.

> 🚀 **Open source & self-hostable** — check out the project at [github.com/snehagrian/proofmap](https://github.com/snehagrian/proofmap) and run your own instance.

---

## How It Works

1. **Upload your resume** — Upload a PDF resume and enter your GitHub username.
2. **Deep repository scan** — The app scans your public GitHub repos: code content, file structures, dependencies, and language usage.
3. **Get your score** — Each claimed skill is scored and assigned a proficiency level (Beginner / Intermediate / Expert) along with a status (Good / Medium / Needs attention).
4. **Select skills for recommendations** — Choose which missing/weak skills you want help with using checkboxes.
5. **Generate AI recommendations** — Click "Generate Recommendations" to get personalized guidance (requires OpenAI API key):
   - **Existing Project Analysis** — Determines if the skill can be integrated into your current projects
   - **Enhancement Suggestions** — Specific ways to add the skill to existing repos
   - **New Project Ideas** — Tailored project suggestions if existing integration isn't feasible
   - **Implementation Guidance** — Technologies, patterns, and measurable outcomes

---

## Features

- PDF resume parsing via PDF.js (loaded from CDN, zero bundle overhead)
- GitHub repository analysis using the GitHub REST API
- Detects 25+ skills across languages, frameworks, databases, and DevOps tools
- Hybrid scoring: GitHub Linguist language stats + code pattern recognition
- Proficiency detection based on advanced API/pattern usage (Beginner / Intermediate / Expert)
- Smart file prioritization (configs and entry points first)
- Excludes generated, minified, and bundled files from analysis
- Animated UI with floating orbs and parallax scrolling
- **On-demand AI recommendations** (optional, requires OpenAI API key)
  - Select specific skills to get recommendations for
  - Analyzes existing projects for integration opportunities
  - Provides both enhancement suggestions and new project ideas
  - Includes implementation guidance with technologies, patterns, and outcomes
  - Intelligent prioritization (enhance vs. build new)

### Tracked Skills

| Category | Skills |
|---|---|
| Languages | Java, Python, JavaScript, TypeScript, C++ |
| Frontend | React, React Native, Next.js, HTML, CSS, Tailwind |
| Backend | Node.js, Express, Spring Boot, FastAPI |
| APIs & Architecture | REST API, Microservices |
| DevOps & Cloud | AWS, Docker, Jenkins, CI/CD, GitHub Actions |
| Databases | PostgreSQL, MySQL, MongoDB |
| Quality | Testing, Concurrency |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4 |
| GitHub API | @octokit/rest |
| PDF Parsing | PDF.js (CDN) |
| AI (Optional) | OpenAI GPT-4o mini |
| Charts | Recharts |
| Compiler | React Compiler (babel-plugin-react-compiler) |

---

## Project Structure

```
src/
  app/
    page.tsx              # Landing page (hero, features, benefits)
    layout.tsx            # Root layout
    globals.css           # Global styles
    upload/
      page.tsx            # Upload form + results UI
    api/
      scan/
        route.ts          # Backend API: GitHub scan + skill scoring
      ai-suggestions/
        route.ts          # AI-powered skill development plans (optional)
  components/
    FloatingOrbs.tsx      # Animated background orbs
    ParallaxSection.tsx   # Parallax scroll wrapper
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub Personal Access Token (recommended to avoid rate limiting)

### Installation

```bash
git clone https://github.com/snehagrian/proofmap.git
cd proofmap
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
GITHUB_TOKEN=your_github_personal_access_token

# Optional: Enable AI-powered skill development suggestions
OPENAI_API_KEY=your_openai_api_key
```

**AI Features (Optional):**
- If `OPENAI_API_KEY` is configured, the app enables the "Generate Recommendations" button for weak skills (score < 25)
- If the key is **not set**, the app automatically detects this on page load and shows a clear setup message instead of the button
- AI suggestions group related skills (e.g. Docker + CI/CD) into combined project plans, with individual plans for ungrouped skills
- The app works perfectly fine without the key — GitHub-based analysis is always available
- Great for showcasing: deploy without AI for free, let developers enable it locally

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## API

### `POST /api/scan`

Scans a GitHub user's repositories and validates skills extracted from resume text.

**Request body:**

```json
{
  "githubUsername": "octocat",
  "resumeText": "Skills: React, TypeScript, Docker, PostgreSQL..."
}
```

**Response:**

```json
{
  "overallScore": 72,
  "breakdown": [
    {
      "skill": "React",
      "score": 85,
      "status": "Good",
      "proficiency": "Intermediate",
      "repos": ["my-app", "portfolio"]
    }
  ],
  "missingProof": ["Docker", "CI/CD"]
}
```

### `GET /api/ai-suggestions`

Checks whether `OPENAI_API_KEY` is configured on the server. Called automatically on page load.

**Response:**

```json
{ "hasKey": true }
```

### `POST /api/ai-suggestions` (Optional)

Generates AI-powered skill recommendations with grouped project plans. Requires `OPENAI_API_KEY`.

**Request body:**

```json
{
  "skills": ["Docker", "CI/CD", "React"],
  "githubUsername": "octocat",
  "breakdown": [...],
  "existingRepos": ["backend-api", "frontend-app"]
}
```

**Response:**

Related skills are intelligently grouped into combined plans; remaining skills get individual plans.

```json
{
  "groups": [
    {
      "type": "group",
      "skills": ["Docker", "CI/CD"],
      "groupName": "Docker + CI/CD",
      "plan": {
        "existingProjectAnalysis": {
          "canBeIntegrated": true,
          "reasoning": "Your backend-api project is a good fit for containerisation and automation",
          "enhancementSuggestions": [
            {
              "targetProject": "backend-api",
              "enhancement": "Add multi-stage Dockerfile and GitHub Actions workflow",
              "implementation": "Create Dockerfile with build/runtime stages, add .github/workflows/ci.yml",
              "skillDemonstration": "Shows production-ready Docker + CI/CD in one repo",
              "estimatedEffort": "4-6 hours"
            }
          ]
        },
        "newProjectIdeas": [],
        "implementationGuidance": {
          "technologies": ["Docker", "GitHub Actions", "docker-compose"],
          "architecturePatterns": ["Multi-stage builds", "Automated testing pipeline"],
          "measurableOutcomes": ["Image size < 100MB", "CI runs on every PR"],
          "visibilityTips": ["Add badges to README", "Pin the repo"]
        },
        "priorityRecommendation": "existing-enhancement"
      }
    }
  ],
  "individual": [
    {
      "type": "individual",
      "skill": "React",
      "plan": { "..." : "same plan shape as above" }
    }
  ]
}
```

---

## Deployment

Deploy instantly on [Vercel](https://vercel.com/new):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/snehagrian/proofmap)

Set the following environment variables in your Vercel project settings:
- `GITHUB_TOKEN` — GitHub Personal Access Token (avoids API rate limits)
- `OPENAI_API_KEY` — _(optional)_ enables AI-powered recommendations
