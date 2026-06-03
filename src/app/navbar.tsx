"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth } from "frappe-react-sdk";
import { useRouter, usePathname } from "next/navigation";
import { useSaaSConfig } from "./providers";

export function Navbar() {
  const { currentUser, logout } = useFrappeAuth();
  const { saasConfig } = useSaaSConfig();
  const router = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isCustomer, setIsCustomer] = useState(false);

  // Estados de Notificaciones
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Sintetizador de audio nativo Web Audio API (chime de cristal premium)
  const playChimeSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota La5 (chime de cristal)
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // Nota Mi6
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("AudioContext no admitido o aún no permitido por el navegador:", e);
    }
  };

  // Helper para tiempo relativo
  const getRelativeTime = (creationStr: string) => {
    if (!creationStr) return "";
    try {
      const t = Date.parse(creationStr.replace(" ", "T"));
      if (isNaN(t)) return "";
      
      const diffMs = Date.now() - t;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Hace un momento";
      if (diffMins === 1) return "Hace 1 min";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return "Hace 1 h";
      if (diffHours < 24) return `Hace ${diffHours} h`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Hace 1 día";
      return `Hace ${diffDays} días`;
    } catch (e) {
      return "";
    }
  };

  // Acción al hacer clic en una notificación
  const handleNotificationClick = async (notif: any) => {
    try {
      const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
      await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.mark_notification_as_read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_name: notif.name }),
        credentials: "include"
      });
      
      setNotifications(prev => prev.filter(n => n.name !== notif.name));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifDropdownOpen(false);
      
      if (notif.module === "Wholesale") {
        window.location.href = "/puntos-fijos?tab=pendientes";
      } else if (notif.module === "Event") {
        window.location.href = "/reservas?tab=pendientes";
      }
    } catch (err) {
      console.error("Error al marcar notificación como leída:", err);
    }
  };

  // Polling en segundo plano para notificaciones (cada 15 segundos)
  useEffect(() => {
    if (!currentUser || isCustomer) return;

    let prevUnread = 0;

    async function fetchNotifications() {
      try {
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_unread_notifications`, {
          credentials: "include",
          cache: "no-store"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            const count = data.message.unread_count || 0;
            const items = data.message.notifications || [];
            setUnreadCount(count);
            setNotifications(items);
            
            // Si hay un incremento de notificaciones no leídas, hacemos sonar el timbre
            if (count > prevUnread) {
              playChimeSound();
            }
            prevUnread = count;
          }
        }
      } catch (err) {
        console.error("Error al obtener notificaciones:", err);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [currentUser, isCustomer]);

  // Cargar tema inicial en el montaje
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

  // La configuración de SaaS se maneja de forma global mediante useSaaSConfig

  // Verificar si es un cliente mayorista
  useEffect(() => {
    if (!currentUser) return;
    const userEmail = currentUser;
    async function checkCustomerProfile() {
      try {
        // Si es administrador o personal interno, no tratar como cliente en el navbar
        const isCashier = userEmail.startsWith("cajero.");
        const isProdUser = userEmail === "produccion@lapaletixa.com";
        const isLogisticaUser = userEmail === "logistica@lapaletixa.com";
        const isStaff = isCashier || isProdUser || isLogisticaUser || userEmail === "Administrator" || userEmail.includes("admin");
        if (isStaff) {
          setIsCustomer(false);
          return;
        }

        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_customer_wholesale_profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message && data.message.success) {
            setIsCustomer(true);
          }
        }
      } catch (err) {
        console.error("Error checking customer profile in navbar:", err);
      }
    }
    checkCustomerProfile();
  }, [currentUser]);

  // Si no hay sesión iniciada o es un cliente, no mostramos el navbar
  if (!currentUser || isCustomer) return null;

  const isCashier = currentUser.startsWith("cajero.");
  const isProdUser = currentUser === "produccion@lapaletixa.com";
  const isLogisticaUser = currentUser === "logistica@lapaletixa.com";
  const isAdmin = currentUser && !isCashier && !isProdUser && !isLogisticaUser;

  // Determinar sucursal del cajero
  const getSucursalName = (email: string) => {
    if (email.includes(".s1.")) return "Sucursal 1";
    if (email.includes(".s2.")) return "Sucursal 2";
    if (email.includes(".s3.")) return "Sucursal 3";
    if (email.includes(".s4.")) return "Sucursal 4";
    return "";
  };

  const sucursalName = getSucursalName(currentUser);

  // Configurar elementos según la ruta activa
  const isPosPage = pathname === "/pos";
  const isProduccionPage = pathname === "/produccion";
  const isLogisticaPage = pathname === "/logistica";
  const isDashboard = pathname === "/";
  const isConfiguracionPage = pathname === "/configuracion";
  const isReportesPage = pathname === "/reportes";

  // Control de visibilidad del botón para volver atrás
  const showBackButton = !isDashboard && !isCashier && !isProdUser && !isLogisticaUser;

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      setMenuOpen(false);
      
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

      // 3. Borrar localmente cookies accesibles por JS expirándolas
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

      // Redireccionar limpiamente a la raíz del sistema
      window.location.href = "/";
    }
  };

  const activeColor = saasConfig?.colors?.primary || "#3498db";

  return (
    <>
      <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-50 print:hidden">
        <div className="w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Lado Izquierdo: Botón Hamburguesa + Botón Atrás + Branding + Badges */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                title="Abrir Menú"
                className="mr-1 rounded-full p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-slate-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {showBackButton && (
              <button 
                onClick={() => router.push("/")}
                className="mr-2 rounded-full p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}

            <div 
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg"
              style={{ backgroundColor: activeColor }}
            >
              {saasConfig?.client_name?.[0] || "L"}
            </div>
            
            <span className="text-xl font-bold tracking-tight text-slate-100 hidden sm:inline">
              {saasConfig?.client_name || "La Paletixa"}
            </span>

            {/* Badges dinámicos de sección */}
            {isPosPage && (
              <>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/10 animate-pulse">
                  Punto de Venta
                </span>
                {sucursalName && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/10">
                    {sucursalName}
                  </span>
                )}
              </>
            )}

            {isProduccionPage && (
              <>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/10">
                  Inventario de Planta
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-slate-350 border border-slate-700">
                  Almacén: Fábrica
                </span>
              </>
            )}

            {isLogisticaPage && (
              <>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/10 animate-pulse">
                  Logística de Despacho
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-slate-350 border border-slate-700">
                  Traspaso de Inventario
                </span>
              </>
            )}

            {isDashboard && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/10">
                Panel Operativo
              </span>
            )}

            {isConfiguracionPage && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/10 animate-pulse">
                Configuración del Sistema
              </span>
            )}

            {isReportesPage && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/10 animate-pulse">
                Reportes del Administrador
              </span>
            )}
          </div>

          {/* Lado Derecho: Identificación del usuario y Logout */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">
              {isPosPage ? "Cajero: " : isProduccionPage ? "Operario: " : isLogisticaPage ? "Logística: " : "Sesión: "}
              <strong className="text-slate-200">{currentUser}</strong>
            </span>
            {/* Botón de Notificaciones */}
            <div className="relative">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                title="Notificaciones"
                className="rounded-full p-2 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-slate-700 shadow-md relative"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white animate-bounce shadow-md border border-slate-950">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setNotifDropdownOpen(false)}
                  ></div>
                  
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-850 bg-slate-950/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-fade-in origin-top-right">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-900 bg-slate-900/30">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Notificaciones</span>
                      {unreadCount > 0 ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/10">
                          {unreadCount} Pendientes
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-500">Al día</span>
                      )}
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-900/50">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div
                            key={n.name}
                            onClick={() => handleNotificationClick(n)}
                            className="p-3.5 hover:bg-slate-900/40 transition-colors cursor-pointer flex flex-col gap-1 text-left relative group"
                          >
                            <div 
                              className={`absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 ${
                                n.module === "Wholesale" ? "bg-amber-500" : "bg-sky-500"
                              }`}
                            ></div>
                            
                            <div className="flex items-center justify-between pl-1">
                              <span className={`text-[10px] font-black uppercase tracking-wide ${
                                n.module === "Wholesale" ? "text-amber-400" : "text-sky-400"
                              }`}>
                                {n.module === "Wholesale" ? "Pedido Mayorista" : "Reserva Evento"}
                              </span>
                              <span className="text-[9px] font-medium text-slate-500 group-hover:text-slate-400 transition-colors">
                                {getRelativeTime(n.creation)}
                              </span>
                            </div>
                            
                            <p className="text-xs text-slate-300 font-medium pl-1 leading-relaxed">
                              {n.message}
                            </p>
                            
                            <div className="flex items-center gap-1.5 pl-1 mt-1 text-[9px] font-bold text-slate-500">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span>ID: {n.reference_name}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 flex flex-col items-center justify-center text-slate-500 gap-2">
                          <svg className="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <span className="text-xs font-semibold">Sin notificaciones pendientes</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              className="rounded-full p-2 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-slate-700 shadow-md"
            >
              {theme === "dark" ? (
                // Sol para cambiar a claro
                <svg className="h-4 w-4 transition-transform duration-300 rotate-0 hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 6.364A9 9 0 115.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                </svg>
              ) : (
                // Luna para cambiar a oscuro
                <svg className="h-4 w-4 transition-transform duration-300 hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full bg-slate-800 p-2 text-slate-350 hover:text-white transition-all active:scale-95 shadow-md border border-slate-700 cursor-pointer flex items-center justify-center h-8 w-8"
              title="Cerrar Sesión"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* MENU HAMBURGUESA / SIDEBAR DRAWER DEL ADMINISTRADOR */}
      {isAdmin && menuOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in">
          {/* Backdrop Blur Overlay */}
          <div 
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity cursor-pointer"
          ></div>

          {/* Sliding Panel */}
          <div className="fixed inset-y-0 left-0 w-80 bg-slate-950 border-r border-slate-850 p-6 flex flex-col space-y-6 shadow-2xl z-50 transform transition-transform duration-300 translate-x-0">
            {/* Header: Brand & Close */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center gap-2.5">
                <div 
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  style={{ backgroundColor: activeColor }}
                >
                  {saasConfig?.client_name?.[0] || "L"}
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-100">
                  {saasConfig?.client_name || "La Paletixa"}
                </span>
              </div>
              
              <button 
                onClick={() => setMenuOpen(false)}
                title="Cerrar Menú"
                className="rounded-full p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Profile Widget */}
            <div className="flex items-center gap-3 bg-slate-900/40 border border-slate-900 p-3.5 rounded-2xl">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-base">
                AD
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-100 truncate">{currentUser}</p>
                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Administrador</p>
              </div>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 flex flex-col space-y-2 overflow-y-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 px-2">Módulos del Sistema</span>
              
              {/* Enlace 1: Dashboard General */}
              <button
                onClick={() => {
                  router.push("/");
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                  isDashboard 
                    ? "text-white bg-slate-900 border border-slate-850" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Panel Operativo</span>
              </button>

              {/* Enlace 2: Punto de Venta (POS) */}
              {saasConfig?.features?.pos && (
                <button
                  onClick={() => {
                    router.push("/pos");
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                    isPosPage 
                      ? "text-white bg-slate-900 border border-slate-850" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Punto de Venta</span>
                </button>
              )}

              {/* Enlace 3: Control de Producción */}
              {saasConfig?.features?.production && (
                <button
                  onClick={() => {
                    router.push("/produccion");
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                    isProduccionPage 
                      ? "text-white bg-slate-900 border border-slate-850" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>Control de Planta</span>
                </button>
              )}

              {/* Enlace 4: Logística de Despacho */}
              {saasConfig?.features?.logistics && (
                <button
                  onClick={() => {
                    router.push("/logistica");
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                    isLogisticaPage 
                      ? "text-white bg-slate-900 border border-slate-850" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Logística de Traspaso</span>
                </button>
              )}

              {/* Enlace 5: Reserva de Eventos */}
              {saasConfig?.features?.reservations && (
                <button
                  onClick={() => {
                    router.push("/reservas");
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                    pathname === "/reservas" 
                      ? "text-white bg-slate-900 border border-slate-850" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Reserva de Eventos</span>
                </button>
              )}

              {/* Enlace 6: Venta Mayorista (Puntos Fijos) */}
              {saasConfig?.features?.wholesale && (
                <button
                  onClick={() => {
                    router.push("/puntos-fijos");
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                    pathname === "/puntos-fijos" 
                      ? "text-white bg-slate-900 border border-slate-850" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>Venta Mayorista</span>
                </button>
              )}

              {/* Enlace 7: Gestión de Clientes */}
              {saasConfig?.features?.wholesale && (
                <button
                  onClick={() => {
                    router.push("/clientes");
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                    pathname === "/clientes" 
                      ? "text-white bg-slate-900 border border-slate-850" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Gestión de Clientes</span>
                </button>
              )}

              {/* Enlace 7: Reportes del Administrador */}
              <button
                onClick={() => {
                  router.push("/reportes");
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                  isReportesPage 
                    ? "text-white bg-slate-900 border border-slate-850" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h-2a2 2 0 00-2-2z" />
                </svg>
                <span>Reportes</span>
              </button>

              {/* Enlace 8: Configuración del Sistema */}
              <button
                onClick={() => {
                  router.push("/configuracion");
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                  isConfiguracionPage 
                    ? "text-white bg-slate-900 border border-slate-850" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Configuración</span>
              </button>
            </nav>

            {/* Bottom Section: Logout */}
            <div className="border-t border-slate-900 pt-4 flex justify-center">
              <button
                onClick={handleLogout}
                className="rounded-full bg-slate-900 border border-slate-850 p-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-95 cursor-pointer flex items-center justify-center h-10 w-10 shadow-lg"
                title="Cerrar Sesión"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
