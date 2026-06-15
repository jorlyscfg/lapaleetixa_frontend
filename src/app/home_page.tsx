"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetCall } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { useSaaSConfig } from "./providers";

interface MetricState {
  total_sales_today: number;
  pos_sales_today: number;
  wholesale_sales_today: number;
  pending_wholesale_count: number;
  pending_wholesale_total: number;
  pending_events_count: number;
  pending_events_total: number;
  low_stock_alerts: Array<{
    item_code: string;
    item_name: string;
    actual_qty: number;
  }>;
  payment_methods_breakdown: Array<{
    mode_of_payment: string;
    total: number;
  }>;
}

export default function HomePage() {
  const { currentUser, login, logout, isLoading: authLoading, error: authError } = useFrappeAuth();
  const { saasConfig, configLoading } = useSaaSConfig();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [showWorkspaceSuggestions, setShowWorkspaceSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  
  // Multi-tenant master site landing states
  const [isMasterSite, setIsMasterSite] = useState(true);
  const [targetSubdomain, setTargetSubdomain] = useState("");
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [domainSuffix, setDomainSuffix] = useState(".localhost");
  const [masterSiteUrl, setMasterSiteUrl] = useState("http://localhost:3000");

  const setCookie = (name: string, value: string, days = 30) => {
    if (typeof window !== "undefined") {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;sameSite=lax${window.location.protocol === "https:" ? ";secure" : ""}`;
    }
  };

  const isSuperAdminAccount = (user?: string | null) => {
    const normalized = user?.toLowerCase() || "";
    return normalized === "admin@jegdev.com" || user === "Administrator";
  };

  // Platform admin states
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [platformTenants, setPlatformTenants] = useState<any[]>([]);
  const [adminLoginActive, setAdminLoginActive] = useState(false);

  const { data: platformDataRaw, error: platformError, mutate: mutatePlatform } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_platform_admin_dashboard",
    {},
    (isMasterSite && currentUser && (adminLoginActive || isSuperAdminAccount(currentUser))) ? "platform_admin_dashboard" : null
  );

  useEffect(() => {
    if (platformDataRaw && (platformDataRaw as any).message) {
      setPlatformTenants((platformDataRaw as any).message);
      setIsPlatformAdmin(true);
    } else if (platformError) {
      setIsPlatformAdmin(false);
    }
  }, [platformDataRaw, platformError]);

  useEffect(() => {
    if (!currentUser) {
      setIsPlatformAdmin(false);
      setPlatformTenants([]);
    }
  }, [currentUser]);

  const isCashier = currentUser?.startsWith("cajero.") || false;
  const isProdUser = currentUser?.startsWith("produccion@") || false;
  const isLogisticaUser = currentUser?.startsWith("logistica@") || false;
  const isAdmin = currentUser && !isCashier && !isProdUser && !isLogisticaUser;

  // Cargar métricas del dashboard si el usuario es administrador (solo en inquilinos)
  const { data: metricsRaw, isLoading: metricsLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_admin_dashboard_metrics",
    {},
    (isAdmin && !isMasterSite) ? "saas_admin_metrics" : null
  );
  const metrics: MetricState | null = (metricsRaw as { message?: { metrics?: MetricState } })?.message?.metrics || null;

  // Dynamic host and base domain suffix detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const host = window.location.host;
      
      setIsMasterSite(true);
      setMasterSiteUrl(`${window.location.protocol}//${host}`);
      if (hostname.startsWith("erpadmin")) {
        setAdminLoginActive(true);
      }
      
      // Parse active tenant name from cookies to auto-populate workspace if present
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || "";
        return "";
      };
      const activeTenant = getCookie("tenant_name");
      if (activeTenant && activeTenant !== "frontend" && activeTenant !== "master") {
        setWorkspace(activeTenant);
      }
      
      // Load recent workspaces from localStorage
      const saved = localStorage.getItem("recent_workspaces");
      if (saved) {
        try {
          setRecentWorkspaces(JSON.parse(saved));
        } catch (e) {
          console.error("Error loading recent workspaces", e);
        }
      }
    }
  }, []);

  const handleTenantRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    setRedirectError(null);
    const sub = targetSubdomain.trim().toLowerCase().replace(/\s+/g, "");
    if (!sub) {
      setRedirectError("Ingresá un subdominio válido.");
      return;
    }
    if (!sub.match(/^[a-zA-Z0-9-]+$/)) {
      setRedirectError("El subdominio solo puede contener letras, números y guiones.");
      return;
    }
    
    const protocol = window.location.protocol;
    const host = window.location.host;
    let redirectUrl = "";
    
    if (host.includes("localhost")) {
      redirectUrl = `${protocol}//${sub}.localhost:3000`;
    } else {
      const hostWithoutPort = host.split(":")[0];
      const port = host.split(":")[1];
      const baseDomain = hostWithoutPort.replace("frontend.", "").replace("app.", "").replace("erpnext.", "").replace("erpadmin.", "");
      redirectUrl = `${protocol}//${sub}.${baseDomain}${port ? `:${port}` : ""}`;
    }
    window.location.href = redirectUrl;
  };

  // Cargar tema inicial
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Redirigir cajeros, producción, logística y clientes de forma segura con recarga completa para inicializar el Navbar
  useEffect(() => {
    if (!currentUser || configLoading || !saasConfig) return;
    
    if (currentUser.startsWith("cajero.")) {
      if (saasConfig.features.pos) {
        window.location.href = "/pos";
      }
    } else if (currentUser.startsWith("produccion@")) {
      if (saasConfig.features.production) {
        window.location.href = "/produccion";
      }
    } else if (currentUser.startsWith("logistica@")) {
      if (saasConfig.features.logistics) {
        window.location.href = "/logistica";
      }
    }
  }, [currentUser, saasConfig, configLoading]);

  // Verificar si es un cliente mayorista y redirigir al portal de auto-servicio
  useEffect(() => {
    if (!currentUser) return;
    const userEmail = currentUser;
    async function checkCustomerProfile() {
      try {
        // Si es administrador o personal interno, no redirigir como cliente
        const isCashier = userEmail.startsWith("cajero.");
        const isProdUser = userEmail.startsWith("produccion@");
        const isLogisticaUser = userEmail.startsWith("logistica@");
        const isStaff = isCashier || isProdUser || isLogisticaUser || userEmail === "Administrator" || userEmail.startsWith("admin@") || userEmail.includes("admin");
        if (isStaff) return;

        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_customer_wholesale_profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message && data.message.success) {
            router.push("/mayoristas");
          }
        }
      } catch (err) {
        console.error("Error checking customer profile for redirect:", err);
      }
    }
    checkCustomerProfile();
  }, [currentUser, router]);

  // La configuración de SaaS se maneja de forma global mediante useSaaSConfig

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setSubmitting(true);
    setLoginError(null);
    
    try {
      const workspaceValue = workspace.trim().toLowerCase();
      const activeTenant = workspaceValue || (isSuperAdminAccount(email) ? "master" : "frontend");
      setCookie("tenant_name", activeTenant);
      
      await login({ username: email, password: password });
      
      // Save workspace to recent list on successful login
      if (activeTenant !== "frontend" && activeTenant !== "master") {
        const filtered = recentWorkspaces.filter(w => w !== activeTenant);
        const updated = [activeTenant, ...filtered].slice(0, 5);
        localStorage.setItem("recent_workspaces", JSON.stringify(updated));
      }
      
      // Forzar una recarga/redirección limpia a la raíz para que el Navbar monte de cero y detecte la sesión
      window.location.href = "/";
    } catch (err) {
      console.error("Error en login:", err);
      setLoginError("Credenciales incorrectas. Por favor, verificá e intentá de nuevo.");
      setCookie("tenant_name", "", -1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHomePageLogout = async () => {
    if (typeof window !== "undefined") {
      // 1. Limpiar localStorage inmediatamente
      localStorage.removeItem("wholesale_session");
      
      // 2. Auxiliar para leer cookies
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || "";
        return "";
      };
      const csrfToken = getCookie("csrf_token");

      // 3. Borrar localmente cookies accesibles por JS
      const clearCookie = (name: string) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      };
      
      clearCookie("sid");
      clearCookie("csrf_token");
      clearCookie("user_image");
      clearCookie("user_id");
      clearCookie("system_user");
      clearCookie("full_name");
      clearCookie("tenant_name");

      const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
      
      // Intentar método A: Custom Logout GET (infalible porque elude los bloqueos de CSRF de los POST en arquitecturas desacopladas)
      try {
        await fetch("/api/method/paletixa_saas.paletixa_saas.api.custom_logout", {
          method: "GET",
          credentials: "include"
        });
      } catch (e) {
        console.warn("Falla en custom_logout relativo:", e);
      }

      // Si hay URL absoluta configurada, probar también el custom_logout absoluto
      if (url) {
        try {
          await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.custom_logout`, {
            method: "GET",
            credentials: "include"
          });
        } catch (e) {
          console.warn("Falla en custom_logout absoluto:", e);
        }
      }

      // Intentar también el SDK Oficial por buena práctica
      try {
        await logout();
      } catch (err) {
        console.warn("Falla en SDK logout, probando alternativas convencionales...", err);
      }

      // Intentar método B: POST relativo convencional
      try {
        await fetch("/api/method/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Frappe-CSRF-Token": csrfToken
          },
          credentials: "include"
        });
      } catch (e) {
        console.warn("Falla en POST relativo:", e);
      }

      // Intentar método C: GET relativo convencional
      try {
        await fetch("/api/method/logout", {
          method: "GET",
          credentials: "include"
        });
      } catch (e) {
        console.warn("Falla en GET relativo:", e);
      }

      // Si hay URL absoluta configurada, probar también POST y GET absolutos convencionales
      if (url) {
        try {
          await fetch(`${url}/api/method/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Frappe-CSRF-Token": csrfToken
            },
            credentials: "include"
          });
        } catch (e) {
          console.warn("Falla en POST absoluto:", e);
        }
        
        try {
          await fetch(`${url}/api/method/logout`, {
            method: "GET",
            credentials: "include"
          });
        } catch (e) {
          console.warn("Falla en GET absoluto:", e);
        }
      }

      // Redireccionar limpiamente
      window.location.href = "/";
    }
  };

  const activeColor = saasConfig?.colors?.primary || "#3498db";

  if (authLoading || configLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-500"></div>
          <p className="text-sm font-medium tracking-wide animate-pulse">Cargando plataforma SaaS...</p>
        </div>
      </div>
    );
  }

  // 1. Check if the current tenant is inactive
  if (!configLoading && saasConfig && (saasConfig as any).is_active === false && !isMasterSite) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 font-sans overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-[-20%] left-[-20%] h-[60%] w-[60%] rounded-full bg-red-500/10 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] h-[60%] w-[60%] rounded-full bg-slate-900/40 blur-[120px]"></div>
        
        <div className="w-full max-w-md px-6 z-10 text-center space-y-6">
          <div className="rounded-3xl border border-red-500/15 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-lg space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white">Cuenta Suspendida</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              El espacio de trabajo para **{saasConfig.client_name}** se encuentra inactivo o con pagos pendientes. 
              Por favor, ponte en contacto con el administrador de la plataforma para regularizar la situación.
            </p>
            <div className="pt-4">
              <button
                onClick={handleHomePageLogout}
                className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-95 border border-slate-700 cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Powered by Jegdev Multi-tenant SaaS Engine
          </p>
        </div>
      </div>
    );
  }

  // 2. Check if logged in platform admin
  if (currentUser && isPlatformAdmin) {
    return (
      <div className="relative w-full h-full min-h-screen overflow-y-auto bg-slate-950 text-slate-100 font-sans pb-12">
        {/* Background gradients */}
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-sky-500/5 blur-[120px] pointer-events-none"></div>

        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 space-y-8">
          {/* KPIs Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
            <div className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6 backdrop-blur-md text-left">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Total Inquilinos</span>
              <h3 className="text-3xl font-black text-white mt-1">{platformTenants.length}</h3>
              <p className="text-xs text-slate-500 mt-2">Empresas con sitio completado</p>
            </div>
            <div className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6 backdrop-blur-md text-left">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Sucursales Activas</span>
              <h3 className="text-3xl font-black text-white mt-1">
                {platformTenants.reduce((acc, curr) => acc + (curr.branch_count || 0), 0)}
              </h3>
              <p className="text-xs text-slate-500 mt-2">Puntos de venta habilitados globales</p>
            </div>
            <div className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6 backdrop-blur-md text-left">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Usuarios Globales</span>
              <h3 className="text-3xl font-black text-white mt-1">
                {platformTenants.reduce((acc, curr) => acc + (curr.users_count || 0), 0)}
              </h3>
              <p className="text-xs text-slate-500 mt-2">Usuarios activos en todos los tenants</p>
            </div>
            <div className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6 backdrop-blur-md text-left">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Facturación Global (30d)</span>
              <h3 className="text-3xl font-black text-emerald-400 mt-1">
                ${platformTenants.reduce((acc, curr) => acc + (curr.sales_30_days || 0), 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-slate-500 mt-2">Volumen de ventas transaccionado</p>
            </div>
          </div>

          {/* Tenants Management Table */}
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in">
            <div className="px-6 py-5 border-b border-white/5 text-left">
              <h3 className="text-lg font-black text-white">Listado de Inquilinos</h3>
              <p className="text-xs text-slate-400 mt-1">Ajustá límites y estados de acceso de cada compañía.</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-900/30">
                    <th className="px-2 sm:px-6 py-4">Empresa</th>
                    <th className="px-2 sm:px-6 py-4 hidden md:table-cell">Base de Datos</th>
                    <th className="px-2 sm:px-6 py-4 hidden md:table-cell">Admin</th>
                    <th className="px-2 sm:px-6 py-4 hidden lg:table-cell">Creado</th>
                    <th className="px-2 sm:px-6 py-4">Límite <span className="hidden sm:inline">Sucursales</span></th>
                    <th className="px-2 sm:px-6 py-4 text-center">Estado</th>
                    <th className="px-2 sm:px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {platformTenants.map((t) => (
                    <TenantRow 
                      key={t.name} 
                      tenant={t} 
                      masterSiteUrl={masterSiteUrl} 
                      onUpdateConfig={async (active, max_branches, exempt_from_payment) => {
                        try {
                          const url = `/api/method/paletixa_saas.paletixa_saas.api.update_tenant_config`;
                          const res = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                              subdomain: t.name, 
                              active, 
                              max_branches,
                              exempt_from_payment: exempt_from_payment !== undefined ? exempt_from_payment : null
                            })
                          });
                          if (res.ok) mutatePlatform();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      onConfirmPayment={async () => {
                        try {
                          const url = `/api/method/paletixa_saas.paletixa_saas.api.confirm_tenant_payment`;
                          const res = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ subdomain: t.name })
                          });
                          if (res.ok) mutatePlatform();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      onToggleBranch={async (branch_name, disabled) => {
                        try {
                          const url = `/api/method/paletixa_saas.paletixa_saas.api.toggle_tenant_branch`;
                          const res = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ subdomain: t.name, branch_name, disabled })
                          });
                          if (res.ok) mutatePlatform();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // VISTA: DENTRO DE LA SESIÓN (DASHBOARD PERSONALIZADO POR FEATURE FLAGS)
  if (currentUser) {
    const isRestrictedLogistica = currentUser.startsWith("logistica@") && !saasConfig?.features?.logistics;
    const isRestrictedProduccion = currentUser.startsWith("produccion@") && !saasConfig?.features?.production;
    const isRestrictedCashier = currentUser.startsWith("cajero.") && !saasConfig?.features?.pos;

    const isRestricted = isRestrictedLogistica || isRestrictedProduccion || isRestrictedCashier;

    if (isRestricted) {
      return (
        <div className="w-full h-full flex items-center justify-center p-6 bg-slate-900 text-slate-100 font-sans">
          <div className="rounded-3xl bg-slate-950 border border-slate-800 p-8 max-w-xl text-center space-y-4 shadow-xl">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Módulo No Contratado</h3>
            <p className="text-sm text-slate-400 leading-normal">
              Tu inquilino no tiene contratado o activo el módulo correspondiente a tu perfil en este momento. 
              Por favor, ponete en contacto con el administrador de **{saasConfig?.client_name || "La Paletixa"}** para habilitarlo.
            </p>
            <div className="pt-4 flex justify-center">
              <button
                onClick={handleHomePageLogout}
                className="rounded-full bg-slate-800 p-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-95 border border-slate-700 cursor-pointer shadow-md flex items-center justify-center h-10 w-10"
                title="Cerrar Sesión"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isAdmin) {
      return (
        <div className="relative w-full h-full overflow-y-auto bg-slate-900 text-slate-100 font-sans">
          {/* Fondo estético con gradientes dinámicos y micro-animaciones */}
          <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse"></div>
          <div 
            className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none"
            style={{ backgroundColor: activeColor }}
          ></div>

          <main className="w-full px-4 sm:px-6 lg:px-8 py-10 relative z-10 space-y-8">

            {/* Panel de Métricas Operativas */}
            <div className="space-y-6">
                
                {/* Grid de KPIs */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* KPI 1: Ventas Hoy */}
                  <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl relative overflow-hidden text-left hover:border-slate-700 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Ventas de Hoy</span>
                    {metricsLoading ? (
                      <div className="h-8 w-32 bg-slate-800/40 animate-pulse rounded mt-2"></div>
                    ) : (
                      <h3 className="text-2xl font-black text-white mt-1.5">${metrics?.total_sales_today.toFixed(2) || "0.00"}</h3>
                    )}
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-4 pt-3 border-t border-slate-800">
                      <span>POS: ${metrics?.pos_sales_today.toFixed(2) || "0.00"}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-700"></span>
                      <span>Mayoristas: ${metrics?.wholesale_sales_today.toFixed(2) || "0.00"}</span>
                    </div>
                  </div>

                  {/* KPI 2: Pedidos Mayoristas */}
                  <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl relative overflow-hidden text-left hover:border-slate-700 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Pedidos Mayoristas</span>
                    {metricsLoading ? (
                      <div className="h-8 w-24 bg-slate-800/40 animate-pulse rounded mt-2"></div>
                    ) : (
                      <h3 className="text-2xl font-black text-white mt-1.5">{metrics?.pending_wholesale_count || 0} activos</h3>
                    )}
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-4 pt-3 border-t border-slate-800">
                      <span>Valor estimado:</span>
                      <span className="font-extrabold" style={{ color: activeColor }}>${metrics?.pending_wholesale_total.toFixed(2) || "0.00"}</span>
                    </div>
                  </div>

                  {/* KPI 3: Reservas */}
                  <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl relative overflow-hidden text-left hover:border-slate-700 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Reservas de Eventos</span>
                    {metricsLoading ? (
                      <div className="h-8 w-24 bg-slate-800/40 animate-pulse rounded mt-2"></div>
                    ) : (
                      <h3 className="text-2xl font-black text-white mt-1.5">{metrics?.pending_events_count || 0} activas</h3>
                    )}
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-4 pt-3 border-t border-slate-800">
                      <span>Monto reservado:</span>
                      <span className="font-extrabold" style={{ color: activeColor }}>${metrics?.pending_events_total.toFixed(2) || "0.00"}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-grid de Alertas y Métodos de Pago */}
                <div className="grid gap-6 md:grid-cols-2">
                  
                  {/* Panel A: Alertas de Stock en Fábrica */}
                  <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl space-y-4 text-left hover:border-slate-700 transition-all">
                    <div>
                      <h4 className="text-sm font-black uppercase text-white tracking-wider">Alertas de Stock en Fábrica</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Productos con existencias críticas por debajo de 100 unidades.</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      {metricsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-10 bg-slate-900/20 rounded-xl animate-pulse"></div>
                        ))
                      ) : metrics?.low_stock_alerts && metrics.low_stock_alerts.length > 0 ? (
                        metrics.low_stock_alerts.map((item) => {
                          const percent = Math.max(5, Math.min(100, (item.actual_qty / 100) * 100));
                          const color = item.actual_qty < 50 ? "bg-red-500" : "bg-amber-500";
                          return (
                            <div key={item.item_code} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-white truncate max-w-[70%]" title={item.item_name}>
                                  {item.item_name}
                                </span>
                                <span className={`font-bold ${item.actual_qty < 50 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                                  {item.actual_qty} uds
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${percent}%` }}></div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center flex flex-col items-center gap-2 border border-slate-800 border-dashed rounded-2xl bg-slate-900/20">
                          <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-400">Todo el stock está al día.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Panel B: Desglose de Pagos de Hoy */}
                  <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl space-y-4 text-left hover:border-slate-700 transition-all">
                    <div>
                      <h4 className="text-sm font-black uppercase text-white tracking-wider">Métodos de Pago (Hoy)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Ingresos recaudados hoy por cada método de pago.</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      {metricsLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="h-10 bg-slate-900/20 rounded-xl animate-pulse"></div>
                        ))
                      ) : metrics?.payment_methods_breakdown && metrics.payment_methods_breakdown.length > 0 ? (
                        metrics.payment_methods_breakdown.map((pm) => {
                          const totalSales = metrics.total_sales_today || 1;
                          const percent = Math.max(5, Math.min(100, (pm.total / totalSales) * 100));
                          return (
                            <div key={pm.mode_of_payment} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-white">
                                  {pm.mode_of_payment === "Cash" ? "Efectivo" : pm.mode_of_payment === "Credit Card" ? "Tarjeta" : pm.mode_of_payment}
                                </span>
                                <span className="font-bold text-slate-350">${pm.total.toFixed(2)}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, backgroundColor: activeColor }}></div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center flex flex-col items-center gap-2 border border-slate-800 border-dashed rounded-2xl bg-slate-900/20">
                          <svg className="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-400">Sin transacciones registradas hoy.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        );
    }

    // FALLBACK: RENDER COMPLETO ORIGINAL (Grilla de accesos directos estándar)
    return (
      <div className="relative w-full h-full overflow-y-auto bg-slate-900 text-slate-100 font-sans">
        {/* Fondo estético con gradientes dinámicos y micro-animaciones */}
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse"></div>
        <div 
          className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none"
          style={{ backgroundColor: activeColor }}
        ></div>

        {/* Contenido Principal */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="mb-12 text-center sm:text-left space-y-2">
            <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              ¡Hola de nuevo!
            </h2>
            <p className="text-base sm:text-lg text-slate-400 font-medium">
              Seleccioná el módulo operativo con el que vas a trabajar hoy en <strong style={{ color: activeColor }}>{saasConfig?.client_name || "La Paletixa"}</strong>.
            </p>
          </div>

          {/* Grilla Dinámica de Módulos (Filtrada por Feature Flags) */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Módulo A: Punto de Venta */}
            {saasConfig?.features?.pos && (saasConfig?.features?.products !== false) && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-sky-500/30 hover:bg-slate-850 hover:shadow-sky-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 shadow-sky-500/10"
                    style={{ backgroundColor: activeColor }}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-sky-400 transition-colors duration-300">Punto de Venta (POS)</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Terminal de ventas optimizado para sucursales físicas. Registrá ventas, cobrá de forma rápida y abrí/cerrá turnos.
                  </p>
                </div>
                <a
                  href="/pos"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:brightness-110 active:scale-95 cursor-pointer text-center hover:shadow-sky-500/10"
                  style={{ backgroundColor: activeColor }}
                >
                  Ingresar al POS
                </a>
              </div>
            )}
 
            {/* Módulo B: Control de Producción */}
            {saasConfig?.features?.production && (saasConfig?.features?.products !== false) && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-850 hover:shadow-emerald-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-emerald-500 shadow-emerald-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors duration-300">Control de Producción</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Ingreso minimalista de entradas de producción para operarios de planta. Registrá bolis y paletas fabricadas al instante.
                  </p>
                </div>
                <a
                  href="/produccion"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/10 transition-all duration-300 hover:bg-emerald-600 hover:shadow-emerald-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Registrar Planta
                </a>
              </div>
            )}
 
            {/* Módulo C: Logística */}
            {saasConfig?.features?.logistics && (saasConfig?.features?.products !== false) && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-indigo-500/30 hover:bg-slate-850 hover:shadow-indigo-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-indigo-500 shadow-indigo-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors duration-300">Logística de Despacho</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Gestión rápida de traspasos de stock entre la fábrica y almacenes/carritos de sucursales.
                  </p>
                </div>
                <a
                  href="/logistica"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/10 transition-all duration-300 hover:bg-indigo-600 hover:shadow-indigo-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ver Logística
                </a>
              </div>
            )}
 
            {/* Módulo D: Reserva de Eventos */}
            {saasConfig?.features?.reservations && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-teal-500/30 hover:bg-slate-850 hover:shadow-teal-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-teal-500 shadow-teal-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-teal-400 transition-colors duration-300">Reserva de Eventos</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Reserva carritos paleteros, define productos del evento y controla la disponibilidad en el calendario operativo.
                  </p>
                </div>
                <a
                  href="/reservas"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/10 transition-all duration-300 hover:bg-teal-650 hover:shadow-teal-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ingresar a Reservas
                </a>
              </div>
            )}
 
            {/* Módulo E: Venta Mayorista (Puntos Fijos) */}
            {saasConfig?.features?.wholesale && (saasConfig?.features?.products !== false) && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-sky-500/30 hover:bg-slate-850 hover:shadow-sky-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-sky-500 shadow-sky-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-sky-400 transition-colors duration-300">Venta Mayorista</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Registrá ventas directas a escuelas, tiendas de abarrotes y puntos fijos desde tu stock de distribución de forma ágil.
                  </p>
                </div>
                <a
                  href="/mayoristas"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/10 transition-all duration-300 hover:bg-sky-600 hover:shadow-sky-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ingresar a Ventas
                </a>
              </div>
            )}
 
            {/* Módulo F: Gestión de Clientes */}
            {saasConfig?.features?.wholesale && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-850 hover:shadow-emerald-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-emerald-500 shadow-emerald-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors duration-300">Gestión de Clientes</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Administrá el padrón de clientes mayoristas, visualizá sus números de contacto e historial de consumo en un solo lugar.
                  </p>
                </div>
                <a
                  href="/clientes"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/10 transition-all duration-300 hover:bg-emerald-600 hover:shadow-emerald-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ingresar a Clientes
                </a>
              </div>
            )}

            {/* Módulo G: Servicios */}
            {saasConfig?.features?.services && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-purple-500/30 hover:bg-slate-850 hover:shadow-purple-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-purple-500 shadow-purple-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-purple-400 transition-colors duration-300">Gestión de Servicios</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Hojas de horas (Timesheets), asistencia técnica de mantenimiento y tickets de soporte al cliente con SLAs.
                  </p>
                </div>
                <a
                  href="/servicios"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-purple-500 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/10 transition-all duration-300 hover:bg-purple-650 hover:shadow-purple-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ingresar a Servicios
                </a>
              </div>
            )}

            {/* Módulo H: Compras */}
            {saasConfig?.features?.purchasing && (
              <div className="group relative rounded-3xl border border-slate-850 bg-slate-950 p-8 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-amber-500/30 hover:bg-slate-850 hover:shadow-amber-500/5 flex flex-col justify-between h-full">
                <div>
                  <div 
                    className="mb-6 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-amber-500 shadow-amber-500/10 transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition-colors duration-300">Compras</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">
                    Registrá proveedores, creá órdenes de compra y recibí mercancía directamente en tu almacén.
                  </p>
                </div>
                <a
                  href="/compras"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/10 transition-all duration-300 hover:bg-amber-600 hover:shadow-amber-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ingresar a Compras
                </a>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // VISTA: PANTALLA DE LOGIN PREMIUM (GLASSMORPHISM)
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Botón flotante para alternar tema público */}
      <div className="absolute top-6 right-6 z-50 animate-fade-in">
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          className="rounded-full p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-lg backdrop-blur-md"
        >
          {theme === "dark" ? (
            <svg className="h-4.5 w-4.5 transition-transform duration-300 rotate-0 hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 6.364A9 9 0 115.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
            </svg>
          ) : (
            <svg className="h-4.5 w-4.5 transition-transform duration-300 hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Fondo estético con gradientes dinámicos y micro-animaciones */}
      <div className="absolute top-[-20%] left-[-20%] h-[60%] w-[60%] rounded-full bg-sky-500/10 blur-[120px] animate-pulse"></div>
      <div 
        className="absolute bottom-[-20%] right-[-20%] h-[60%] w-[60%] rounded-full blur-[120px] opacity-20"
        style={{ backgroundColor: activeColor }}
      ></div>

      <div className="w-full max-w-md px-6 z-10">
        {/* Formulario Glassmorphic */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-lg">
          {/* Logo y Encabezado */}
          <div className="mb-8 text-center">
            <div 
              className="mx-auto h-12 w-12 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4 animate-bounce"
              style={{ backgroundColor: activeColor }}
            >
              {isMasterSite ? "S" : (saasConfig?.client_name?.[0] || "L")}
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Portal de la Plataforma
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Ingresá tus credenciales y el espacio de trabajo de tu empresa.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Workspace Input */}
            <div className="relative">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Espacio de Trabajo (Workspace ID)
              </label>
              <input
                type="text"
                value={workspace}
                onFocus={() => setShowWorkspaceSuggestions(true)}
                onBlur={() => setTimeout(() => setShowWorkspaceSuggestions(false), 200)}
                onChange={(e) => setWorkspace(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                placeholder="nombre-empresa (ej: lapaletixa)"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-600 focus:bg-slate-950"
              />
              {showWorkspaceSuggestions && recentWorkspaces.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl space-y-1 text-left">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 py-1.5 border-b border-slate-900">
                    Espacios Recientes
                  </p>
                  {recentWorkspaces.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={() => {
                        setWorkspace(item);
                        setShowWorkspaceSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-900 hover:text-white transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>{item}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-600">Reciente</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[10px] text-slate-500 pl-1 text-left">
                Dejá vacío para ingresar como administrador de plataforma.
              </p>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@tuempresa.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-600 focus:bg-slate-950"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-4 pr-12 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-600 focus:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-450 hover:text-white transition-colors cursor-pointer flex items-center justify-center p-1"
                  title={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.025 10.025 0 014.132-5.4M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 21l-2-2m-2-2L3 3" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Errores */}
            {(loginError || authError) && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 leading-relaxed">
                {loginError || authError?.message || "Ocurrió un error en el inicio de sesión."}
              </div>
            )}

            {/* Botón de Enviar con Hover dinámico */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: activeColor }}
            >
              {submitting ? "Iniciando Sesión..." : "Entrar a la Plataforma"}
            </button>
          </form>
          
          {/* Registro de Inquilino / Retorno a Landing */}
          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            {isMasterSite ? (
              <p className="text-xs text-slate-400">
                ¿Querés usar la plataforma para tu empresa?{" "}
                <a 
                  href="/registro" 
                  className="font-bold hover:underline transition-colors"
                  style={{ color: activeColor }}
                >
                  Registrar nueva compañía
                </a>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                ¿Buscás otra empresa?{" "}
                <a 
                  href={masterSiteUrl}
                  className="font-bold hover:underline transition-colors"
                  style={{ color: activeColor }}
                >
                  Volver al inicio central
                </a>
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Powered by Jegdev Multi-tenant SaaS Engine
        </p>
      </div>
    </div>
  );
}

interface TenantRowProps {
  tenant: any;
  masterSiteUrl: string;
  onUpdateConfig: (active: boolean, max_branches: number, exempt_from_payment?: boolean) => Promise<void>;
  onToggleBranch: (branch_name: string, disabled: boolean) => Promise<void>;
  onConfirmPayment: () => Promise<void>;
}

function TenantRow({ tenant, masterSiteUrl, onUpdateConfig, onToggleBranch, onConfirmPayment }: TenantRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [maxBranches, setMaxBranches] = useState(tenant.max_branches);
  const [exemptPayment, setExemptPayment] = useState(tenant.exempt_from_payment === 1);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    setExemptPayment(tenant.exempt_from_payment === 1);
    setMaxBranches(tenant.max_branches);
  }, [tenant]);
  
  const handleLimitChange = async (val: number) => {
    setMaxBranches(val);
    setSaving(true);
    await onUpdateConfig(tenant.active === 1, val, exemptPayment);
    setSaving(false);
  };
  
  const handleActiveToggle = async () => {
    setSaving(true);
    await onUpdateConfig(tenant.active !== 1, maxBranches, exemptPayment);
    setSaving(false);
  };

  const getBillingStatus = () => {
    if (tenant.exempt_from_payment === 1) {
      return { label: "Exento", className: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" };
    }
    if (!tenant.expiration_date) {
      return { label: "Trial / Nuevo", className: "bg-slate-500/10 text-slate-400 border border-slate-500/20" };
    }
    const expiry = new Date(tenant.expiration_date);
    const today = new Date();
    expiry.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { label: `Vencido hace ${Math.abs(diffDays)}d`, className: "bg-red-500/10 text-red-400 border border-red-500/20" };
    } else if (diffDays === 0) {
      return { label: "Vence hoy", className: "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" };
    } else if (diffDays <= 7) {
      return { label: `Vence en ${diffDays}d`, className: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
    } else {
      return { label: `Al día (${diffDays}d)`, className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    }
  };

  const billing = getBillingStatus();

  const tenantUrl = `/c/${tenant.name}/mayoristas`;

  return (
    <>
      <tr className="hover:bg-slate-900/10 transition-colors">
        <td className="px-2 sm:px-6 py-4">
          <div className="font-bold text-white text-left break-words line-clamp-2">{tenant.company_name}</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <a href={tenantUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline block text-left truncate max-w-[80px] sm:max-w-none">
              {tenant.name}
            </a>
            <span className={`px-1 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide whitespace-nowrap ${billing.className}`}>
              {billing.label}
            </span>
          </div>
        </td>
        <td className="px-2 sm:px-6 py-4 font-mono text-xs text-slate-400 text-left hidden md:table-cell">
          {tenant.database_name || "N/A"}
        </td>
        <td className="px-2 sm:px-6 py-4 text-xs text-slate-400 text-left hidden md:table-cell">
          {tenant.admin_email}
        </td>
        <td className="px-2 sm:px-6 py-4 text-xs text-slate-400 text-left hidden lg:table-cell">
          {new Date(tenant.creation).toLocaleDateString()}
        </td>
        <td className="px-2 sm:px-6 py-4 text-left">
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap whitespace-nowrap">
            <span className="text-xs font-semibold text-slate-300 flex-shrink-0">
              {tenant.branch_count}&nbsp;/
            </span>
            <input
              type="number"
              min="1"
              value={maxBranches}
              onChange={(e) => handleLimitChange(parseInt(e.target.value) || 1)}
              disabled={saving}
              className="w-10 sm:w-16 rounded-lg border border-slate-800 bg-slate-950 px-1 py-0.5 text-center text-xs font-bold text-white outline-none focus:border-indigo-500 flex-shrink-0"
            />
          </div>
        </td>
        <td className="px-2 sm:px-6 py-4 text-center">
          <button
            onClick={handleActiveToggle}
            disabled={saving}
            className={`rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-black tracking-wide cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
              tenant.active === 1 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {tenant.active === 1 ? "Activo" : "Suspendido"}
          </button>
        </td>
        <td className="px-2 sm:px-6 py-4 text-right">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer whitespace-nowrap"
          >
            {expanded ? "Ocultar" : <span>Ver <span className="hidden sm:inline">Sucursales</span></span>}
          </button>
        </td>
      </tr>
      
      {expanded && (
        <tr>
          <td colSpan={7} className="px-2 sm:px-6 py-4 bg-slate-900/10 border-b border-white/5">
            <div className="space-y-6 text-left p-2 sm:p-3">
              
              {/* Sección superior: Módulos, Métricas y Facturación en grid */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* 1. Módulos Habilitados */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Módulos Habilitados</h4>
                  <div className="flex flex-wrap gap-2">
                    {tenant.active_modules && Object.values(tenant.active_modules).some(Boolean) ? (
                      Object.entries(tenant.active_modules).map(([moduleName, active]) => {
                        if (!active) return null;
                        const labels: Record<string, string> = {
                          pos: "Punto de Venta",
                          production: "Producción / Planta",
                          logistics: "Logística",
                          wholesale: "Venta Mayorista",
                          services: "Módulo Servicios",
                          products: "Catálogo Productos",
                          purchasing: "Módulo Compras"
                        };
                        return (
                          <span 
                            key={moduleName}
                            className="px-3 py-1 rounded-lg text-[10px] font-black tracking-wide bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                          >
                            {labels[moduleName] || moduleName}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500 italic">Ningún módulo habilitado o configuración no disponible.</span>
                    )}
                  </div>
                </div>

                {/* 2. Métricas de Operación */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Métricas Operativas</h4>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Ventas (30d)</span>
                      <span className="text-xs font-black text-white block mt-0.5">
                        ${tenant.sales_30_days?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0,00"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Usuarios</span>
                      <span className="text-xs font-black text-white block mt-0.5">
                        {tenant.users_count || 0}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Clientes</span>
                      <span className="text-xs font-black text-white block mt-0.5">
                        {tenant.customers_count || 0}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Última Venta</span>
                      <span className="text-[10px] font-black text-slate-350 block mt-0.5 truncate" title={tenant.last_sale_date}>
                        {tenant.last_sale_date 
                          ? new Date(tenant.last_sale_date).toLocaleDateString()
                          : "Sin ventas"
                        }
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 md:hidden">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Base de Datos</span>
                      <span className="text-[10px] font-black text-white block mt-0.5 truncate" title={tenant.database_name}>
                        {tenant.database_name || "N/A"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 md:hidden">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Email Admin</span>
                      <span className="text-[10px] font-black text-white block mt-0.5 truncate" title={tenant.admin_email}>
                        {tenant.admin_email}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 lg:hidden">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Creado</span>
                      <span className="text-[10px] font-black text-white block mt-0.5 truncate">
                        {new Date(tenant.creation).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Facturación / Suscripción */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Facturación & Control</h4>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 font-sans">Vencimiento:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${billing.className}`}>
                        {billing.label}
                      </span>
                    </div>
                    {tenant.last_payment_date && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500 font-sans">Último Pago:</span>
                        <span className="font-bold text-slate-300">{new Date(tenant.last_payment_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {/* Exento de pago toggle */}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[11px] font-bold text-slate-400 font-sans">Exento de Pago:</span>
                      <button
                        onClick={async () => {
                          setSaving(true);
                          await onUpdateConfig(tenant.active === 1, maxBranches, !exemptPayment);
                          setExemptPayment(!exemptPayment);
                          setSaving(false);
                        }}
                        disabled={saving}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer transition-all active:scale-95 border ${
                          exemptPayment 
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
                            : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {exemptPayment ? "Sí" : "No"}
                      </button>
                    </div>

                    {/* Botón confirmar pago */}
                    <button
                      onClick={async () => {
                        setSaving(true);
                        await onConfirmPayment();
                        setSaving(false);
                      }}
                      disabled={saving || exemptPayment}
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-900 text-white font-bold py-2 text-xs transition-all active:scale-95 cursor-pointer shadow-lg"
                    >
                      Confirmar Pago (+30d)
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Sucursales */}
              <div className="space-y-3 border-t border-white/5 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Sucursales del Inquilino</h4>
                {tenant.branches && tenant.branches.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {tenant.branches.map((b: any) => (
                      <div 
                        key={b.name} 
                        className="flex justify-between items-center bg-slate-950/40 border border-slate-850 rounded-xl p-3 shadow-md hover:border-slate-700 transition-colors"
                      >
                        <div className="truncate pr-4 text-left">
                          <div className="text-xs font-bold text-white truncate" title={b.name}>{b.name.replace("Punto de Venta - ", "")}</div>
                          <div className="text-[10px] text-slate-500 truncate" title={b.warehouse}>{b.warehouse}</div>
                        </div>
                        
                        <button
                          onClick={async () => {
                            setSaving(true);
                            await onToggleBranch(b.name, b.disabled !== 1);
                            setSaving(false);
                          }}
                          disabled={saving}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-black cursor-pointer transition-all active:scale-95 ${
                            b.disabled !== 1 
                              ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" 
                              : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                          }`}
                        >
                          {b.disabled !== 1 ? "Habilitada" : "Deshabilitada"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No hay sucursales creadas en este inquilino todavía.</p>
                )}
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}
