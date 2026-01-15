import { NextResponse } from "next/server";

type FixLyricsPayload = {
  lyrics: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as FixLyricsPayload;
  if (!body?.lyrics?.trim()) {
    return NextResponse.json(
      { cleanedLyrics: "", notes: "No lyrics provided." },
      { status: 400 },
    );
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { cleanedLyrics: body.lyrics, notes: "AI_GATEWAY_API_KEY is not set in .env.local" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          {
            role: "system",
            content: [
              "You are a worship lyric editor.",
              "Correct spelling, fix casing for deity references (God vs god),",
              "remove non-lyrical metadata, and keep bracketed section labels",
              "like [Verse 1] or [Chorus]. If line breaks separate verses, keep them.",
              "Normalize spacing: collapse multiple spaces into one, trim lines.",
              "Remove filler symbols like ...., --- or decorative punctuation.",
              "Only allow brackets for section labels or translations like [Yoruba].",
              "You MUST respond with valid JSON only: {\"cleanedLyrics\": \"...\", \"notes\": \"...\"}",
            ].join("\n"),
          },
          { role: "user", content: body.lyrics },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return NextResponse.json(
        {
          cleanedLyrics: body.lyrics,
          notes: `AI Gateway error (${response.status}): ${errorText.slice(0, 200)}`,
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { cleanedLyrics: body.lyrics, notes: "AI Gateway returned no content." },
        { status: 502 },
      );
    }

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // No JSON found - return content as-is (it's already the cleaned lyrics)
      return NextResponse.json({
        cleanedLyrics: content.trim(),
        notes: undefined,
      });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        cleanedLyrics?: string;
        notes?: string;
      };
      
      // Handle case where cleanedLyrics might itself be a JSON string
      let cleanedLyrics = parsed.cleanedLyrics ?? body.lyrics;
      if (typeof cleanedLyrics === 'string' && cleanedLyrics.startsWith('{')) {
        try {
          const innerParsed = JSON.parse(cleanedLyrics);
          if (innerParsed.cleanedLyrics) {
            cleanedLyrics = innerParsed.cleanedLyrics;
          }
        } catch {
          // Not nested JSON, use as-is
        }
      }
      
      return NextResponse.json({
        cleanedLyrics,
        notes: parsed.notes,
      });
    } catch {
      // JSON parsing failed - return content as cleaned lyrics
      return NextResponse.json({
        cleanedLyrics: content.trim(),
        notes: undefined,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.cause
          ? `${error.message}: ${String(error.cause)}`
          : error.message
        : "Request failed.";
    console.error("Lyrics fix error:", error);
    return NextResponse.json(
      {
        cleanedLyrics: body.lyrics,
        notes: `Request failed: ${message}`,
      },
      { status: 502 },
    );
  }
}
