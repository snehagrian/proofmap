import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ hasKey: !!process.env.OPENAI_API_KEY });
}

const PLAN_SCHEMA = `{
  "existingProjectAnalysis": {
    "canBeIntegrated": bool,
    "reasoning": "1 sentence",
    "enhancementSuggestions": [{"targetProject":"name","enhancement":"what","implementation":"how","skillDemonstration":"proof","estimatedEffort":"time"}]
  },
  "newProjectIdeas": [{"name":"X","description":"Y","keyFeatures":["a","b","c"],"skillFocus":"Z","estimatedTime":"T"}],
  "implementationGuidance": {"technologies":[],"architecturePatterns":[],"measurableOutcomes":[],"visibilityTips":[]},
  "priorityRecommendation": "existing-enhancement|new-project (why)"
}`;

async function buildPlan(
  openai: OpenAI,
  label: string,
  skillsInfo: string,
  githubUsername: string,
  existingReposStr: string
): Promise<any> {
  const prompt = `Skills: ${skillsInfo}
User: ${githubUsername}
Repos: ${existingReposStr}

Analyze if these skills can be demonstrated together in existing repos or a new project. Return JSON:
${PLAN_SCHEMA}
Integrate if backend/API+Docker/Testing/CI-CD or frontend+CSS/UI. New if domain mismatch. Max 2 per array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a senior engineering mentor providing actionable, specific GitHub project recommendations for demonstrating technical skills." },
      { role: "user", content: prompt },
    ],
    max_tokens: 900,
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {
      existingProjectAnalysis: { canBeIntegrated: false, reasoning: "Analysis failed", enhancementSuggestions: [] },
      newProjectIdeas: [],
      implementationGuidance: {},
      priorityRecommendation: "new-project",
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const { skills, githubUsername, breakdown, existingRepos } = await req.json();

    if (!Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json({ error: "No skills provided." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const existingReposStr =
      Array.isArray(existingRepos) && existingRepos.length > 0
        ? existingRepos.join(", ")
        : "none";

    // ─── Step 1: Ask AI to group the selected skills ───────────────────────────
    let rawGroups: { groups: string[][], ungrouped: string[] } = { groups: [], ungrouped: skills };

    if (skills.length > 1) {
      const groupPrompt = `Skills: ${skills.join(", ")}
Repos: ${existingReposStr}

Group related skills that can be demonstrated together in one project. Skills with different domains stay ungrouped.
Return JSON: {"groups":[["skill1","skill2"]],"ungrouped":["skill3"]}
Rules: group only if strongly related (e.g. Docker+CI/CD, React+CSS, PostgreSQL+Redis). Min 2 per group.`;

      try {
        const groupRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a technical skills grouping assistant." },
            { role: "user", content: groupPrompt },
          ],
          max_tokens: 300,
          temperature: 0.3,
          response_format: { type: "json_object" },
        });

        const parsed = JSON.parse(groupRes.choices[0]?.message?.content?.trim() ?? "{}");
        if (Array.isArray(parsed.groups) && Array.isArray(parsed.ungrouped)) {
          rawGroups = parsed;
        }
      } catch {
        // grouping failed – fall back to all individual
        rawGroups = { groups: [], ungrouped: skills };
      }
    }

    // ─── Step 2: Build a plan for each group + each ungrouped skill ──────────
    const groupPlans = await Promise.all(
      rawGroups.groups.map(async (groupSkills: string[]) => {
        const skillsInfo = groupSkills
          .map((s) => {
            const d = (breakdown ?? []).find((b: any) => b.skill === s);
            return `"${s}" (${d?.score ?? 0}/100, ${d?.proficiency ?? "Unknown"})`;
          })
          .join(", ");

        const plan = await buildPlan(openai, groupSkills.join(" + "), skillsInfo, githubUsername, existingReposStr);
        const groupName = groupSkills.length === 2
          ? `${groupSkills[0]} + ${groupSkills[1]}`
          : `${groupSkills[0]} & ${groupSkills.length - 1} more`;

        return {
          type: "group" as const,
          skills: groupSkills,
          groupName,
          plan,
        };
      })
    );

    const individualPlans = await Promise.all(
      rawGroups.ungrouped.map(async (skill: string) => {
        const d = (breakdown ?? []).find((b: any) => b.skill === skill);
        const skillsInfo = `"${skill}" (${d?.score ?? 0}/100, ${d?.proficiency ?? "Unknown"})`;
        const plan = await buildPlan(openai, skill, skillsInfo, githubUsername, existingReposStr);
        return { type: "individual" as const, skill, plan };
      })
    );

    return NextResponse.json({ groups: groupPlans, individual: individualPlans });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[ProofMap] AI suggestions failed:", message);
    return NextResponse.json(
      { error: `AI suggestion failed: ${message}` },
      { status: 500 }
    );
  }
}
