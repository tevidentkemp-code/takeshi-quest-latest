const OPENAI_URL = "https://api.openai.com/v1/responses";

type Mode = "studio_intro" | "studio_outro";

type ReqBody = {
  game_id: string;
  mode: Mode;
  // optional: if you later want to pass this
  event_id?: number;
};

type LLMOut = {
  lines: Array<{
    speaker: "SARAH" | "WADE" | "MICKY";
    text: string;
    intensity: number; // 1..10
  }>;
};

function clampText(s: string) {
  // tight + safe. avoid mega-lines.
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function stripCodeFences(s: string) {
  return s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function extractOutputText(data: any): string {
  // Responses API returns an `output[]` array containing `content[]` items.
  // We want the first usable text chunk.
  const out = Array.isArray(data?.output) ? data.output : [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      // Most common is { type:"output_text", text:"..." }
      if (c && typeof c?.text === "string" && c.text.trim()) return c.text.trim();
    }
  }
  // Fallbacks (SDK convenience / future variants)
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (typeof data?.response === "string" && data.response.trim()) return data.response.trim();
  return "";
}

async function callOpenAI(apiKey: string, mode: Mode, ctx: any): Promise<LLMOut> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["lines"],
    properties: {
      lines: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["speaker", "text", "intensity"],
          properties: {
            speaker: { type: "string", enum: ["SARAH", "WADE", "MICKY"] },
            text: { type: "string" },
            intensity: { type: "integer", minimum: 1, maximum: 10 },
          },
        },
      },
    },
  } as const;

  const instruction =
    mode === "studio_intro"
      ? `
You are in the STUDIO at the Ally Pally (World Championships vibe).
Speakers: SARAH (host, quietly knows her stuff), WADE (expert), MICKY (old-school character).

This is BEFORE ANY DARTS.
- Build hype, introduce who’s playing (if provided).
- Mention form and *one* interesting angle (no stat-dump).
- Mention format briefly.
- Banter + chemistry; likeable, funny.
- Present tense: it’s happening NOW.
- End with a natural handover to the comms team (Baz & Gaz).`

      : `
You are in the STUDIO at the Ally Pally (World Championships vibe).
Speakers: SARAH (host, quietly knows her stuff), WADE (expert), MICKY (old-school character).

This is AFTER THE MATCH ENDS.
- Quick wrap: winner (if provided), key swing/turning point (if provided), one cheeky line.
- Present tense: live TV vibe.
- End with a sign-off. No stat-dump.`;

  const payload = {
    mode,
    context: ctx,
    style: {
      vibe: "old school Ally Pally studio, world championships",
      studio_team: ["Sarah", "Wade", "Micky"],
      in_game_team: ["Baz", "Gaz"],
      rules: [
        "Do NOT mention OpenAI.",
        "No massive paragraphs. Each line <= ~140 chars.",
        "Use **BOLD** sparingly for big shouts only.",
        "Avoid repeating the same phrase twice.",
      ],
    },
  };

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: "You generate lively darts studio commentary." },
        { role: "developer", content: instruction.trim() },
        { role: "user", content: JSON.stringify(payload) },
      ],

      // ✅ Structured Outputs in Responses API goes here (NOT response_format)
      text: {
        format: {
          type: "json_schema",
          name: "studio_lines",
          strict: true,
          schema,
        },
      },

      // NOTE: do NOT pass temperature here (you saw it's rejected for this model in your env)
      // You can experiment later with top_p if needed, but start clean.
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  let text = extractOutputText(data);

  if (!text) throw new Error("OpenAI: missing text in response.output");

  text = stripCodeFences(text);

  try {
    return JSON.parse(text) as LLMOut;
  } catch (e) {
    throw new Error(`OpenAI: JSON parse failed: ${String((e as any)?.message || e)} :: ${text}`);
  }
}


export { callOpenAI };
