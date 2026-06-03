"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { useSaaSConfig } from "./providers";

export default function HomePage() {
  const { currentUser, login, logout, isLoading: authLoading, error: authError } = useFrappeAuth();
  const { saasConfig, configLoading } = useSaaSConfig();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

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
    } else if (currentUser === "produccion@lapaletixa.com") {
      if (saasConfig.features.production) {
        window.location.href = "/produccion";
      }
    } else if (currentUser === "logistica@lapaletixa.com") {
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
        const isProdUser = userEmail === "produccion@lapaletixa.com";
        const isLogisticaUser = userEmail === "logistica@lapaletixa.com";
        const isStaff = isCashier || isProdUser || isLogisticaUser || userEmail === "Administrator" || userEmail.includes("admin");
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
            router.push("/puntos-fijos");
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
      await login({ username: email, password: password });
      // Forzar una recarga/redirección limpia a la raíz para que el Navbar monte de cero y detecte la sesión
      window.location.href = "/";
    } catch (err: any) {
      console.error("Error en login:", err);
      setLoginError("Credenciales incorrectas. Por favor, verificá e intentá de nuevo.");
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

  // VISTA: DENTRO DE LA SESIÓN (DASHBOARD PERSONALIZADO POR FEATURE FLAGS)
  if (currentUser) {
    const isRestrictedLogistica = currentUser === "logistica@lapaletixa.com" && !saasConfig?.features?.logistics;
    const isRestrictedProduccion = currentUser === "produccion@lapaletixa.com" && !saasConfig?.features?.production;
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

    return (
      <div className="relative w-full h-full overflow-y-auto bg-slate-950 text-slate-100 font-sans">
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
            {saasConfig?.features?.pos && (
              <div className="group relative rounded-3xl border border-white/5 bg-slate-900/30 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-sky-500/30 hover:bg-slate-900/60 hover:shadow-sky-500/5 flex flex-col justify-between h-full">
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
            {saasConfig?.features?.production && (
              <div className="group relative rounded-3xl border border-white/5 bg-slate-900/30 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60 hover:shadow-emerald-500/5 flex flex-col justify-between h-full">
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
            {saasConfig?.features?.logistics && (
              <div className="group relative rounded-3xl border border-white/5 bg-slate-900/30 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-indigo-500/30 hover:bg-slate-900/60 hover:shadow-indigo-500/5 flex flex-col justify-between h-full">
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
              <div className="group relative rounded-3xl border border-white/5 bg-slate-900/30 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-teal-500/30 hover:bg-slate-900/60 hover:shadow-teal-500/5 flex flex-col justify-between h-full">
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
            {saasConfig?.features?.wholesale && (
              <div className="group relative rounded-3xl border border-white/5 bg-slate-900/30 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-sky-500/30 hover:bg-slate-900/60 hover:shadow-sky-500/5 flex flex-col justify-between h-full">
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
                  href="/puntos-fijos"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/10 transition-all duration-300 hover:bg-sky-600 hover:shadow-sky-500/20 active:scale-95 cursor-pointer text-center"
                >
                  Ingresar a Ventas
                </a>
              </div>
            )}

            {/* Módulo F: Gestión de Clientes */}
            {saasConfig?.features?.wholesale && (
              <div className="group relative rounded-3xl border border-white/5 bg-slate-900/30 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60 hover:shadow-emerald-500/5 flex flex-col justify-between h-full">
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
              {saasConfig?.client_name?.[0] || "L"}
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              {saasConfig?.client_name || "La Paletixa"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Ingresá tus credenciales para acceder a la plataforma SaaS
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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
                placeholder="operario@lapaletixa.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-600 focus:bg-slate-950"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-600 focus:bg-slate-950"
              />
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
        </div>
        
        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Powered by Jegdev Multi-tenant SaaS Engine
        </p>
      </div>
    </div>
  );
}
