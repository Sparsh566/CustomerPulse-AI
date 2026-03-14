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
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is not configured");

    const { complaint_id, subject, body, category, customer_name, tone, conversation_history } = await req.json();
    if (!body || !tone) throw new Error("body and tone are required");

    const toneInstructions: Record<string, string> = {
      formal: "Use a formal, professional tone. Address the customer respectfully. Use proper banking terminology. Be direct but courteous.",
      empathetic: "Use a warm, empathetic tone. Acknowledge the customer's frustration. Show understanding and compassion. Reassure them that their issue is being taken seriously.",
      escalation: "Use a serious, urgent tone. Acknowledge the severity of the issue. Indicate that the matter has been escalated to senior management. Provide clear timelines for resolution.",
    };

    const prompt = `Generate a professional customer response for this banking complaint.

Customer: ${customer_name || "Customer"}
Category: ${category || "General"}
Subject: ${subject || "Complaint"}
Original Complaint: ${body}
${conversation_history ? `\nConversation History:\n${conversation_history}` : ""}

Tone: ${tone} - ${toneInstructions[tone] || toneInstructions.formal}

Write a 2-3 paragraph response that:
1. Acknowledges the specific issue
2. Explains what actions are being taken
3. Provides next steps or timeline
4. Closes professionally`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional banking customer service representative. Generate appropriate responses based on the specified tone." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_response",
            description: "Return the generated customer response",
            parameters: {
              type: "object",
              properties: {
                response_text: { type: "string", description: "The full response text to send to the customer" },
                subject_line: { type: "string", description: "A suitable email subject line for this response" },
                key_actions: { type: "array", items: { type: "string" }, description: "2-4 key actions mentioned in the response" },
              },
              required: ["response_text", "subject_line", "key_actions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_response" } },
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

    const generated = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, ...generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-response error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
