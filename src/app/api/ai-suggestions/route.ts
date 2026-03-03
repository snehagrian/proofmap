import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const { skills, githubUsername, breakdown } = await req.json();

    if (!Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json({ error: "No skills provided." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const suggestions = await Promise.all(
      skills.map(async (skill: string) => {
        const skillData = (breakdown ?? []).find((b: any) => b.skill === skill);
        const score: number = skillData?.score ?? 0;
        const proficiency: string = skillData?.proficiency ?? "Unknown";

        const prompt = `You are a technical career advisor. A developer lists "${skill}" on their resume but GitHub proof is weak (score: ${score}/100, proficiency: ${proficiency}). GitHub: ${githubUsername}.

Return ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "whyItMatters": "one sentence on career impact",
  "projects": [
    { "name": "Project Name", "description": "one sentence" },
    { "name": "Project Name", "description": "one sentence" },
    { "name": "Project Name", "description": "one sentence" }
  ],
  "keyPatterns": ["pattern 1", "pattern 2", "pattern 3", "pattern 4"],
  "estimatedTime": "e.g. 1-2 weekends",
  "visibilityTip": "one concrete GitHub tip"
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 520,
          temperature: 0.7,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
        let parsed: any = {};
        try { parsed = JSON.parse(raw); } catch { parsed = { whyItMatters: raw }; }

        return { skill, plan: parsed };
      })
    );

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[ProofMap] AI suggestions failed:", message);
    return NextResponse.json(
      { error: `AI suggestion failed: ${message}` },
      { status: 500 }
    );
  }
}
