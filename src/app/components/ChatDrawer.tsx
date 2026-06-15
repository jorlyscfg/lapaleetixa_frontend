"use client";

import React, { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  primaryColor?: string;
}

const QUICK_PROMPTS = [
  "¿Cuántos clientes tenemos en total?",
  "Mostrar facturas vencidas este mes",
  "Resumen de ventas del mes actual",
  "¿Cuál es el stock de SKU en almacén?",
];

export function ChatDrawer({ isOpen, onClose, primaryColor = "#6366f1" }: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (textToSend: string) => {
    const trimmedText = textToSend.trim();
    if (!trimmedText || loading) return;

    setError(null);
    setInput("");
    setLoading(true);

    const userMessage: Message = { role: "user", content: trimmedText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      // call the local Next.js API route
      const res = await fetch("/api-local/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ocurrió un error inesperado al conectar con el asistente.");
      }

      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.message?.content || "No obtuve una respuesta clara del servidor.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ChatDrawer] Error sending message:", err);
      setError(message || "Error al enviar el mensaje.");
    } finally {
      setLoading(false);
    }
  };

  // Basic regex formatter for assistant markdown responses, supporting tables, code blocks, and lists
  const renderMessageContent = (content: string) => {
    if (!content) return null;

    // Protegemos bloques de código para evitar que el formateador rompa tablas u otros tags
    const codeBlocks: string[] = [];
    let processed = content.replace(/```([\s\S]*?)```/g, (_, code) => {
      codeBlocks.push(code);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Protegemos código inline
    const inlineCodes: string[] = [];
    processed = processed.replace(/`(.*?)`/g, (_, code) => {
      inlineCodes.push(code);
      return `__INLINE_CODE_${inlineCodes.length - 1}__`;
    });

    // Escapamos caracteres especiales de HTML
    processed = processed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Procesamos tablas de markdown
    const lines = processed.split("\n");
    let insideTable = false;
    let tableRows: string[] = [];
    const formattedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith("|") && line.endsWith("|")) {
        // Ignoramos la línea separadora del tipo |---|---|
        if (/^[|\s\-:]+$/.test(line)) {
          continue;
        }

        // Extraemos las columnas (removiendo el primer y último pipe vacío)
        const cols = line.split("|").slice(1, -1).map(c => c.trim());
        
        if (!insideTable) {
          insideTable = true;
          const headerCols = cols.map(c => `<th class="border-b border-slate-700 bg-slate-800/80 px-4 py-2.5 text-left font-bold text-white text-xs uppercase tracking-wider">${c}</th>`).join("");
          tableRows.push(`<thead><tr>${headerCols}</tr></thead>`);
          tableRows.push("<tbody>");
        } else {
          const rowCols = cols.map(c => `<td class="border-b border-slate-800/60 px-4 py-2 text-slate-350 text-xs font-semibold">${c}</td>`).join("");
          tableRows.push(`<tr class="hover:bg-white/2 transition-colors">${rowCols}</tr>`);
        }
      } else {
        if (insideTable) {
          insideTable = false;
          tableRows.push("</tbody>");
          formattedLines.push(`<div class="overflow-x-auto my-4 border border-white/5 rounded-2xl bg-slate-900/40 shadow-sm"><table class="min-w-full table-auto border-collapse">${tableRows.join("")}</table></div>`);
          tableRows = [];
        }
        formattedLines.push(lines[i]);
      }
    }

    if (insideTable) {
      tableRows.push("</tbody>");
      formattedLines.push(`<div class="overflow-x-auto my-4 border border-white/5 rounded-2xl bg-slate-900/40 shadow-sm"><table class="min-w-full table-auto border-collapse">${tableRows.join("")}</table></div>`);
    }

    processed = formattedLines.join("\n");

    // Formateamos texto en negrita
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Formateamos viñetas (listas)
    processed = processed.replace(/^\s*-\s+(.*?)$/gm, '<li class="ml-4 list-disc text-slate-300 my-1">$1</li>');

    // Restauramos bloques de código y código inline protegidos
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
      const code = codeBlocks[parseInt(idx, 10)];
      return `<pre class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto my-3">${code}</pre>`;
    });

    processed = processed.replace(/__INLINE_CODE_(\d+)__/g, (_, idx) => {
      const code = inlineCodes[parseInt(idx, 10)];
      return `<code class="bg-slate-950 px-1.5 py-0.5 rounded font-mono text-emerald-300 text-xs">${code}</code>`;
    });

    // Reemplazamos saltos de línea con <br /> para formatear texto plano
    processed = processed.replace(/\n/g, "<br />");

    return (
      <div 
        dangerouslySetInnerHTML={{ __html: processed }} 
        className="space-y-1 text-sm text-slate-300 leading-relaxed break-words font-medium animate-fade-in"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative h-full w-full max-w-lg border-l border-white/5 bg-slate-900/95 backdrop-blur-md shadow-2xl flex flex-col transition-transform duration-300 translate-x-0">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/10"
              style={{ backgroundColor: primaryColor }}
            >
              <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Asistente Inteligente</h3>
              <p className="text-xs text-slate-400 font-medium">Búsquedas y consultas a base de datos</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center space-y-6 max-w-sm mx-auto">
              <div 
                className="h-16 w-16 rounded-3xl flex items-center justify-center text-white opacity-40"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.452M18 10.5V18a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8a2 2 0 012 2v2.5M12 10h.01M12 14h.01" />
                </svg>
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-bold text-white">¿En qué puedo ayudarte hoy?</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Preguntame sobre facturas vencidas, clientes, inventario o pedime análisis de tus datos de venta.
                </p>
              </div>
              <div className="grid gap-3.5 w-full pt-4">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="text-left w-full p-3.5 text-xs text-slate-300 font-bold border border-white/5 rounded-2xl bg-white/2 hover:bg-white/5 hover:border-slate-700 transition-all cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div 
                  className={`max-w-[85%] px-4.5 py-3.5 rounded-3xl shadow-md ${
                    msg.role === "user" 
                      ? "bg-indigo-600 text-white rounded-br-none" 
                      : "bg-slate-800/60 border border-white/5 rounded-bl-none text-slate-350"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: primaryColor } : undefined}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm font-semibold leading-relaxed break-words">{msg.content}</p>
                  ) : (
                    renderMessageContent(msg.content)
                  )}
                </div>
              </div>
            ))
          )}

          {/* Typing Loading Indicator */}
          {loading && (
            <div className="flex flex-col items-start">
              <div className="bg-slate-800/60 border border-white/5 rounded-3xl rounded-bl-none px-4.5 py-4 flex items-center gap-2.5 shadow-md">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
                <span className="text-xs text-slate-400 font-bold animate-pulse">Consultando ERP...</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 font-medium leading-normal animate-fade-in">
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Footer Input */}
        <div className="p-6 border-t border-white/5 bg-slate-950/20">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-3 bg-slate-950/50 border border-slate-800 rounded-2xl p-2 focus-within:border-slate-600 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Preguntá al asistente..."
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-650 outline-none disabled:opacity-50 font-medium"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md hover:brightness-110 active:scale-95"
              style={{ backgroundColor: primaryColor }}
            >
              <svg className="h-5.5 w-5.5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
