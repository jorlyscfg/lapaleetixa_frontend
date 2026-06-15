"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function RegistroPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subdomainParam = searchParams.get("subdomain");
  const tokenParam = searchParams.get("token");
  const isProvisioningFromUrl = Boolean(subdomainParam);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [subdomain, setSubdomain] = useState(subdomainParam ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI states
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isProvisioningFromUrl);
  const [provisioning, setProvisioning] = useState(isProvisioningFromUrl);
  const [currentStep, setCurrentStep] = useState(isProvisioningFromUrl ? 1 : 0);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [statusToken, setStatusToken] = useState(tokenParam ?? "");

  // Polling for provisioning status
  useEffect(() => {
    if (!provisioning || !subdomain) return;

    const checkStatus = async () => {
      try {
        const query = new URLSearchParams({ subdomain });
        if (statusToken) {
          query.set("token", statusToken);
        }

        const res = await fetch(`/api/method/paletixa_saas.paletixa_saas.api.get_tenant_status?${query.toString()}`);
        if (!res.ok) throw new Error("Error checking tenant status");

        const data = await res.json();
        const status = data.message?.status;
        const log = data.message?.error_log;

        if (status === "In Progress") {
          // Advance steps dynamically based on time or just stay on step 2
          setCurrentStep(2);
        } else if (status === "Completed") {
          setCurrentStep(4); // Finished
          setProvisioning(false);
          setLoading(false);
          clearInterval(pollIntervalId);

          // Dynamic redirect to the newly created tenant workspace
          setTimeout(() => {
            const protocol = window.location.protocol;

            // Set cookie so they land directly on their workspace context
            const expires = new Date();
            expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
            document.cookie = `tenant_name=${subdomain};expires=${expires.toUTCString()};path=/;sameSite=lax${protocol === "https:" ? ";secure" : ""}`;

            window.location.href = "/";
          }, 2000);
        } else if (status === "Failed") {
          setProvisioning(false);
          setLoading(false);
          setError("El aprovisionamiento del sitio falló. Verificá los logs a continuación.");
          setErrorLog(log || "No se especificó un mensaje de error.");
          clearInterval(pollIntervalId);
        }
      } catch (err: unknown) {
        console.error("Polling error:", err);
      }
    };

    // Poll every 5 seconds
    const pollIntervalId = setInterval(checkStatus, 5000);
    checkStatus(); // Initial call

    return () => clearInterval(pollIntervalId);
  }, [provisioning, subdomain, statusToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setErrorLog(null);

    // Basic client validation
    if (!subdomain.match(/^[a-zA-Z0-9-]+$/)) {
      setError("El subdominio solo puede contener letras, números y guiones.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/method/paletixa_saas.paletixa_saas.api.request_tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subdomain,
          company_name: companyName,
          admin_email: email,
          admin_password: password,
        }),
      });

      const data = (await res.json()) as {
        exc?: unknown;
        _server_messages?: string;
        message?: { error?: string; request_token?: string };
      };

      if (!res.ok || data.exc) {
        const errorMsg = data._server_messages
          ? JSON.parse(data._server_messages)[0] || "Error en el registro"
          : data.message?.error || "Error al solicitar el inquilino";
        throw new Error(errorMsg);
      }

      // Successful request - enter provisioning mode
      setProvisioning(true);
      setCurrentStep(1);
      if (data.message?.request_token) {
        setStatusToken(data.message.request_token);
      }

      // Update URL query parameters silently
      const query = new URLSearchParams({ subdomain });
      if (data.message?.request_token) {
        query.set("token", data.message.request_token);
      }
      router.push(`/registro?${query.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado al registrar el sitio.");
      setLoading(false);
    }
  };

  const steps = [
    { label: "Validando solicitud...", desc: "Comprobando disponibilidad del subdominio" },
    { label: "Creando base de datos MariaDB...", desc: "Esto puede tardar hasta 1-2 minutos" },
    { label: "Instalando módulos y apps...", desc: "Instalando ERPNext y personalizaciones de SaaS" },
    { label: "Configurando identidad y sucursales...", desc: "Inicializando compañía y roles por defecto" },
    { label: "¡Despliegue exitoso!", desc: "Redireccionando a tu nuevo portal corporativo..." },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 font-sans text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full bg-indigo-900/20 blur-[120px]" />
        <div className="absolute -bottom-[45%] -right-[20%] h-[80%] w-[60%] rounded-full bg-sky-900/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white shadow-lg shadow-indigo-600/30">
            P
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {provisioning ? "Desplegando tu Empresa" : "Creá tu Inquilino Corporativo"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {provisioning
              ? "Estamos aprovisionando un tenant propio y aislado para tu organización."
              : "Registrate en segundos y obtené un entorno de ERPNext dedicado."}
          </p>
        </div>

        {/* Normal Registration Form */}
        {!provisioning && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Nombre de la Empresa
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Mi Empresa S.A."
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-650 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Identificador de la Empresa (Workspace ID)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                  placeholder="mi-empresa"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-650 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <p className="mt-1 pl-1 text-left text-[10px] text-slate-500">
                Esto definirá tus enlaces públicos (ej. `tudominio.com/c/mi-empresa/...`). Solo minúsculas, números y guiones.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Email de Administrador
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@miempresa.com"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-650 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Contraseña de Administrador
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-650 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-black text-white transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Procesando...</span>
                </>
              ) : (
                <span>Crear Compañía Dedicada</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-850 bg-slate-950/20 py-3.5 text-sm font-bold text-slate-400 transition-all hover:bg-slate-950/45 hover:text-slate-200 active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span>Volver al Login</span>
            </button>
          </form>
        )}

        {/* Provisioning/Loading State Screen */}
        {provisioning && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-850 bg-slate-950/30 p-6">
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
                {/* Spinner border animation */}
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500" />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-indigo-400 animate-pulse">
                  SaaS
                </div>
              </div>
              <h3 className="mb-1 text-base font-bold text-white">
                {steps[currentStep]?.label || "Aprovisionando..."}
              </h3>
              <p className="text-center text-xs text-slate-400">
                {steps[currentStep]?.desc || "Por favor no cierres esta ventana"}
              </p>
            </div>

            {/* Stepper details */}
            <div className="space-y-3">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                    idx === currentStep
                      ? "border border-indigo-500/20 bg-indigo-600/10 text-white"
                      : idx < currentStep
                        ? "text-emerald-400"
                        : "text-slate-600"
                  }`}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                    {idx < currentStep ? "✓" : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State with logs */}
        {!provisioning && error && errorLog && (
          <div className="mt-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-red-400">Log de Errores:</h4>
            <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-850 bg-slate-950 p-4 text-[10px] font-mono leading-normal text-slate-400 whitespace-pre-wrap">
              {errorLog}
            </div>
            <button
              onClick={() => {
                setError(null);
                setErrorLog(null);
                setProvisioning(false);
                setLoading(false);
                router.push("/registro");
              }}
              className="w-full cursor-pointer rounded-2xl bg-slate-850 py-3 text-center text-xs font-bold text-white transition-all hover:bg-slate-800"
            >
              Volver a Intentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
