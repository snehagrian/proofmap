# ProofMap

**ProofMap** is a resume skill validation tool that cross-references the skills listed on your resume against your actual GitHub repositories. It gives you a skill reality score, identifies proof gaps, and generates actionable goals to help you back up your claims with real code.

---

## How It Works

1. **Upload your resume** — Upload a PDF resume and enter your GitHub username.
2. **Deep repository scan** — The app scans your public GitHub repos: code content, file structures, dependencies, and language usage.
3. **Get your score** — Each claimed skill is scored and assigned a proficiency level (Beginner / Intermediate / Expert) along with a status (Good / Medium / Needs attention).
4. **Set goals for gaps** — Select missing or low-scoring skills to receive tailored project ideas and integration suggestions to build GitHub proof.

---

## Features

- PDF resume parsing via PDF.js (loaded from CDN, zero bundle overhead)
- GitHub repository analysis using the GitHub REST API
- Detects 25+ skills across languages, frameworks, databases, and DevOps tools
- Hybrid scoring: GitHub Linguist language stats + code pattern recognition
- Proficiency detection based on advanced API/pattern usage (Beginner / Intermediate / Expert)
- Parallel repo processing with early termination for performance
- Smart file prioritization (configs and entry points first)
- Excludes generated, minified, and bundled files from analysis
- Collapsible per-skill project breakdown in results
- Animated UI with floating orbs and parallax scrolling

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
  components/
    FloatingOrbs.tsx      # Animated background orbs
    ParallaxSection.tsx   # Parallax scroll wrapper
  lib/
    suggestions.ts        # Goal generation + integration suggestions
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub Personal Access Token (recommended to avoid rate limiting)

### Installation

```bash
git clone https://github.com/your-username/proofmap.git
cd proofmap
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
GITHUB_TOKEN=your_github_personal_access_token
```

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
  "skills": [
    {
      "skill": "React",
      "score": 85,
      "status": "Good",
      "proficiency": "Intermediate",
      "repos": ["my-app", "portfolio"]
    }
  ],
  "missingSkills": ["Docker", "CI/CD"]
}
```

---

## Deployment

Deploy instantly on [Vercel](https://vercel.com/new):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Set the `GITHUB_TOKEN` environment variable in your Vercel project settings to avoid GitHub API rate limits.
