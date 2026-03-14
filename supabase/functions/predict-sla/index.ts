import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://openrouter.ai/api/v1/chat/completions";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is not configured");

    // Fetch all open complaints
    const openResp = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?status=in.(new,assigned,in_progress,pending_customer)&order=created_at.desc&select=id,ticket_id,subject,category,priority,status,assigned_agent_name,sla_deadline,sla_status,sla_hours_remaining,severity_score,sentiment,created_at`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    if (!openResp.ok) throw new Error("Failed to fetch complaints");
    const openComplaints = await openResp.json();

    if (openComplaints.length === 0) {
      return new Response(JSON.stringify({ success: true, predictions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch historical resolution data for context
    const histResp = await fetch(
      `${SUPABASE_URL}/rest/v1/complaints?status=in.(resolved,closed)&order=created_at.desc&limit=100&select=category,priority,severity_score,created_at,resolved_at,sla_status`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    const historicalData = histResp.ok ? await histResp.json() : [];

    // Calculate avg resolution times by category
    const avgTimes: Record<string, number[]> = {};
    for (const h of historicalData) {
      if (h.resolved_at && h.created_at) {
        const hours = (new Date(h.resolved_at).getTime() - new Date(h.created_at).getTime()) / 3600000;
        const key = `${h.category}_${h.priority}`;
        if (!avgTimes[key]) avgTimes[key] = [];
        avgTimes[key].push(hours);
      }
    }
    const avgResolution: Record<string, number> = {};
    for (const [key, times] of Object.entries(avgTimes)) {
      avgResolution[key] = times.reduce((a, b) => a + b, 0) / times.length;
    }

    const complaintsContext = openComplaints.map((c: any) => {
      const hoursOpen = (Date.now() - new Date(c.created_at).getTime()) / 3600000;
      const avgKey = `${c.category}_${c.priority}`;
      return `Ticket: ${c.ticket_id} | Category: ${c.category} | Priority: ${c.priority} | Status: ${c.status} | Agent: ${c.assigned_agent_name || "Unassigned"} | SLA Hours Remaining: ${c.sla_hours_remaining} | Hours Open: ${hoursOpen.toFixed(1)} | Severity: ${c.severity_score} | Sentiment: ${c.sentiment} | Avg Resolution for ${c.category}/${c.priority}: ${avgResolution[avgKey]?.toFixed(1) || "unknown"}h`;
    }).join("\n");

    const prompt = `Analyze these open banking complaints and predict which ones are likely to breach their SLA deadlines.

OPEN COMPLAINTS:
${complaintsContext}

For each complaint, predict:
1. Breach probability (0-100%)
2. Risk factors contributing to potential breach
3. Recommended action to prevent breach

Consider: time remaining vs avg resolution time, severity, sentiment, assignment status, and priority.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an SLA prediction expert for banking complaint management. Provide accurate breach probability predictions." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "predict_breaches",
            description: "Return SLA breach predictions for complaints",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ticket_id: { type: "string" },
                      breach_probability: { type: "integer", description: "0-100 percentage" },
                      risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      risk_factors: { type: "array", items: { type: "string" }, description: "Key risk factors" },
                      recommended_action: { type: "string", description: "What to do to prevent breach" },
                    },
                    required: ["ticket_id", "breach_probability", "risk_level", "risk_factors", "recommended_action"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string", description: "Overall SLA health summary in 1-2 sentences" },
              },
              required: ["predictions", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "predict_breaches" } },
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

    const prediction = JSON.parse(toolCall.function.arguments);

    // Enrich predictions with complaint IDs
    const enriched = prediction.predictions.map((p: any) => {
      const complaint = openComplaints.find((c: any) => c.ticket_id === p.ticket_id);
      return {
        ...p,
        complaint_id: complaint?.id,
        subject: complaint?.subject,
        assigned_agent_name: complaint?.assigned_agent_name,
        sla_hours_remaining: complaint?.sla_hours_remaining,
        category: complaint?.category,
        priority: complaint?.priority,
      };
    });

    return new Response(JSON.stringify({ success: true, predictions: enriched, summary: prediction.summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-sla error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
