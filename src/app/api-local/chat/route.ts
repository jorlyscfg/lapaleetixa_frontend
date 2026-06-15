import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// Configuración genérica para admitir OpenRouter, OpenCode, u otros proveedores compatibles con OpenAI
const LLM_API_URL = process.env.LLM_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "google/gemini-2.5-flash:free";

type JsonObject = Record<string, unknown>;

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonObject;
}

// Helper to make JSON-RPC calls to Frappe MCP endpoint using dynamic API Key/Secret token auth
async function callFrappeMCP(method: string, params: JsonObject, apiKey: string, apiSecret: string) {
  const mcpUrl = `${BACKEND_URL}/api/method/frappe_assistant_core.api.fac_endpoint.handle_mcp`;
  
  console.log("[ChatAPI] callFrappeMCP credentials check:", {
    BACKEND_URL,
    apiKeyPreview: apiKey ? `${apiKey.substring(0, 4)}...` : "missing",
    secretLength: apiSecret?.length
  });

  if (!apiKey || !apiSecret) {
    throw new Error("Missing Frappe API credentials for MCP calling.");
  }

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `token ${apiKey}:${apiSecret}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now().toString(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Frappe MCP error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages array" }, { status: 400 });
    }

    // Forward the cookies from the incoming client request to verify authentication
    const cookieHeader = req.headers.get("cookie") || "";
    console.log("[ChatAPI] Incoming cookie header length:", cookieHeader.length, "content preview:", cookieHeader.substring(0, 50));
    
    // Verify session and dynamically fetch assistant API keys from Frappe using the user's cookies
    let apiKey = "";
    let apiSecret = "";
    let company = "La Empresa";
    let companyAbbr = "";
    try {
      const keysUrl = `${BACKEND_URL}/api/method/paletixa_saas.paletixa_saas.api.get_assistant_keys`;
      console.log("[ChatAPI] Fetching assistant keys from:", keysUrl);
      const keysRes = await fetch(keysUrl, {
        method: "POST",
        headers: {
          "Cookie": cookieHeader,
        },
      });

      console.log("[ChatAPI] Frappe response status:", keysRes.status);
      if (!keysRes.ok) {
        const errorBody = await keysRes.text();
        console.error("[ChatAPI] Frappe get_assistant_keys non-ok response:", errorBody);
        return NextResponse.json({ error: "Session expired or unauthorized. Please log in again.", details: errorBody }, { status: 401 });
      }

      const keysData = await keysRes.json();
      if (!keysData?.message?.api_key || !keysData?.message?.api_secret) {
        return NextResponse.json({ error: "Failed to resolve assistant API keys." }, { status: 401 });
      }
      
      apiKey = keysData.message.api_key;
      apiSecret = keysData.message.api_secret;
      company = keysData.message.company || "La Empresa";
      companyAbbr = keysData.message.company_abbr || "";
      console.log(`[ChatAPI] Session successfully verified. Retrieved dynamic API keys for user: ${company} (${companyAbbr})`);
    } catch (authErr: unknown) {
      const details = authErr instanceof Error ? authErr.message : String(authErr);
      console.error("[ChatAPI] API credentials retrieval failed:", authErr);
      return NextResponse.json({ error: "Authentication verification failed.", details }, { status: 401 });
    }

    // 1. Fetch available tools from the Frappe MCP server
    let toolsResponse;
    try {
      toolsResponse = await callFrappeMCP("tools/list", {}, apiKey, apiSecret);
    } catch (err: unknown) {
      const details = err instanceof Error ? err.message : String(err);
      console.error("[ChatAPI] Error listing MCP tools:", err);
      return NextResponse.json({ 
        error: "Failed to list assistant tools. Check server credentials.",
        details
      }, { status: 500 });
    }

    const mcpTools: McpTool[] = toolsResponse?.result?.tools || [];
    
    // Map MCP tools to OpenRouter/OpenAI tool call schema
    const openRouterTools = mcpTools.map((tool: McpTool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || { type: "object", properties: {} },
      },
    }));

    // Load database querying guidelines if available
    let dbInstructions = "";
    try {
      const filepath = path.join(process.cwd(), "src/app/api-local/chat/instructions.md");
      dbInstructions = fs.readFileSync(filepath, "utf8");
      // Replace tenant placeholder values
      dbInstructions = dbInstructions
        .replace(/\{\{company\}\}/g, company)
        .replace(/\{\{company_abbr\}\}/g, companyAbbr);
    } catch (err) {
      console.warn("[ChatAPI] Could not load instructions.md guidelines:", err);
    }

    // Start LLM conversation loop
    const currentMessages = [
      { 
        role: "system", 
        content: `You are an AI ERP assistant for ${company}. Use the provided database and report tools to answer the user's questions about invoices, stock, transactions, etc.\n\n${dbInstructions || "Translate your thoughts and responses to Spanish Rioplatense where natural."}` 
      },
      ...messages
    ];

    let loopCount = 0;
    const maxLoops = 6;
    let finalMessage = null;

    while (loopCount < maxLoops) {
      loopCount++;
      
      const llmHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (LLM_API_KEY) {
        llmHeaders["Authorization"] = `Bearer ${LLM_API_KEY}`;
      }

      // Call LLM Provider (OpenRouter, OpenCode, etc.)
      const llmResponse = await fetch(LLM_API_URL, {
        method: "POST",
        headers: llmHeaders,
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: currentMessages,
          tools: openRouterTools.length > 0 ? openRouterTools : undefined,
          tool_choice: openRouterTools.length > 0 ? "auto" : undefined,
        }),
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        throw new Error(`LLM API error (${llmResponse.status}): ${errorText}`);
      }

      const completion = await llmResponse.json();
      const choice = completion.choices?.[0];
      if (!choice) {
        throw new Error("Invalid response from OpenRouter");
      }

      const responseMessage = choice.message;

      // Check if LLM requested function execution
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Append assistant tool request to history
        currentMessages.push(responseMessage);

        // Execute all requested tool calls
        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          
          console.log(`[ChatAPI] Executing tool ${toolName} with args:`, toolArgs);

          let toolOutput;
          try {
            const mcpCallResult = await callFrappeMCP("tools/call", {
              name: toolName,
              arguments: toolArgs,
            }, apiKey, apiSecret);

            // Extract text/json content from MCP response
            const contentList = mcpCallResult?.result?.content || [];
            toolOutput = contentList
              .filter((c: { type?: string }) => c.type === "text")
              .map((c: { text?: string }) => c.text)
              .join("\n") || JSON.stringify(contentList);
          } catch (toolError: unknown) {
            const details = toolError instanceof Error ? toolError.message : String(toolError);
            console.error(`[ChatAPI] Tool ${toolName} failed:`, toolError);
            toolOutput = `Error executing tool: ${details}`;
          }

          // Append tool response to message history
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: toolOutput,
          });
        }
      } else {
        // No more tool calls, we have the final output
        finalMessage = responseMessage;
        break;
      }
    }

    if (!finalMessage) {
      return NextResponse.json({ error: "Exceeded max tool execution loops" }, { status: 500 });
    }

    return NextResponse.json({ message: finalMessage });

  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("[ChatAPI] API Route error:", err);
    return NextResponse.json({ error: details }, { status: 500 });
  }
}
