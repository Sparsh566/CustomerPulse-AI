import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { complaint_id, subject, body, category, customer_name } = await req.json();
    if (!complaint_id || !body) throw new Error("complaint_id and body are required");

    // Fetch recent open complaints (last 90 days, exclude current)
    const recentResp = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?id=neq.${complaint_id}&status=neq.closed&order=created_at.desc&limit=50&select=id,ticket_id,subject,body,category,customer_name,status,created_at`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    if (!recentResp.ok) throw new Error("Failed to fetch complaints");
    const recentComplaints = await recentResp.json();

    if (recentComplaints.length === 0) {
      return new Response(JSON.stringify({ success: true, duplicates: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build comparison prompt
    const complaintsContext = recentComplaints.map((c: any, i: number) => 
      `[${i}] Ticket: ${c.ticket_id} | Customer: ${c.customer_name} | Category: ${c.category} | Subject: ${c.subject} | Body: ${c.body?.substring(0, 200)}`
    ).join("\n");

    const prompt = `Compare this NEW complaint against existing complaints and identify potential duplicates or related cases.

NEW COMPLAINT:
Customer: ${customer_name}
Category: ${category}
Subject: ${subject}
Body: ${body}

EXISTING COMPLAINTS:
${complaintsContext}

Identify complaints that are:
1. Exact duplicates (same customer, same issue)
2. Related complaints (same issue type, different customer)
3. Similar pattern complaints (recurring systemic issues)

Only include matches with similarity >= 60%. Return the indices of matching complaints.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a complaint deduplication expert. Identify duplicate and related complaints accurately." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_duplicates",
            description: "Report duplicate and related complaints",
            parameters: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "integer", description: "Index of the matching complaint" },
                      similarity_score: { type: "integer", description: "Similarity percentage 0-100" },
                      match_type: { type: "string", enum: ["duplicate", "related", "pattern"], description: "Type of match" },
                      reason: { type: "string", description: "Brief explanation of why this is a match" },
                    },
                    required: ["index", "similarity_score", "match_type", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["matches"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_duplicates" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const { matches } = JSON.parse(toolCall.function.arguments);

    // Enrich matches with complaint data
    const enrichedMatches = matches
      .filter((m: any) => m.index >= 0 && m.index < recentComplaints.length)
      .map((m: any) => {
        const c = recentComplaints[m.index];
        return {
          complaint_id: c.id,
          ticket_id: c.ticket_id,
          subject: c.subject,
          customer_name: c.customer_name,
          category: c.category,
          status: c.status,
          similarity_score: m.similarity_score,
          match_type: m.match_type,
          reason: m.reason,
        };
      });

    return new Response(JSON.stringify({ success: true, duplicates: enrichedMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-duplicates error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
