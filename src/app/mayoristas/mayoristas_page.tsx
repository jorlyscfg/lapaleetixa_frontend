"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/immutability */

import React, { useState, useEffect, useCallback } from "react";
import { useFrappeAuth } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { CustomSelect } from "../components/custom_select";
import { CustomDatePicker } from "../components/custom_date_picker";
import { CatalogImageTile } from "../components/catalog_image_tile";
import AdminOrdersPanel from "./admin_orders_panel";

interface FeatureConfig {
  client_name: string;
  colors: {
    primary: string;
  };
  features: {
    pos: boolean;
    production: boolean;
    logistics: boolean;
    reservations: boolean;
    wholesale?: boolean;
  };
}

interface CartItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  retail_price: number;
  wholesale_price: number | null;
}



export default function MayoristasPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  // Estados del portal de auto-servicio de clientes
  const [isCustomer, setIsCustomer] = useState<boolean>(false);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [metodoPago, setMetodoPago] = useState<string>("Transferencia");
  const [metodoEntrega, setMetodoEntrega] = useState<string>("Domicilio");

  // Pestaña activa para el administrador: "venta_directa" o "pedidos_pendientes"
  const [activeAdminTab, setActiveAdminTab] = useState<"venta_directa" | "pedidos_pendientes">("venta_directa");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Efecto para activar pestaña de pedidos pendientes al venir desde una notificación
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "pendientes") {
        setActiveAdminTab("pedidos_pendientes");
      }
    }
  }, []);

  // Estados generales de carga y configuración
  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Estados para validación PIN Lock Screen
  const [wholesaleSession, setWholesaleSession] = useState<{ customer: string; customer_name: string; phone: string; token: string } | null>(null);
  const [authPhone, setAuthPhone] = useState("");
  const [authPin, setAuthPin] = useState("");
  const [validatingAccess, setValidatingAccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Cargar sesión guardada de local storage
  useEffect(() => {
    const saved = localStorage.getItem("wholesale_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.customer) {
          setWholesaleSession(parsed);
          setIsCustomer(true);
          setCustomerProfile(parsed);
          setSelectedCustomer(parsed.customer);
        }
      } catch (e) {
        console.error("Error reading wholesale session from localStorage", e);
      }
    }
  }, []);

  const handleValidateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPhone.trim() || !authPin.trim()) {
      setAuthError("Por favor, ingresá tu celular y el PIN de acceso.");
      return;
    }
    setValidatingAccess(true);
    setAuthError(null);
    try {
      const res = await callFrappeAPI("validate_wholesale_access", {
        phone: authPhone.trim(),
        pin: authPin.trim()
      });
      if (res && res.success) {
        const sessionData = {
          customer: res.customer,
          customer_name: res.customer_name,
          phone: res.phone,
          token: res.token
        };
        localStorage.setItem("wholesale_session", JSON.stringify(sessionData));
        setWholesaleSession(sessionData);
        setIsCustomer(true);
        setCustomerProfile(res);
        setSelectedCustomer(res.customer);
        setSuccessMessage(`¡Bienvenido/a, ${res.customer_name}!`);
      } else {
        setAuthError(res.error || "PIN o teléfono incorrecto.");
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Error al validar el acceso.");
    } finally {
      setValidatingAccess(false);
    }
  };

  const handleWholesaleLogout = async () => {
    localStorage.removeItem("wholesale_session");
    setWholesaleSession(null);
    setIsCustomer(false);
    setCustomerProfile(null);
    setSelectedCustomer("Público General");
    
    // Cerrar sesión en Frappe para limpiar cookies y restaurar el estado Guest real
    const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
    try {
      await fetch(`${url}/api/method/logout`, { credentials: "include" });
    } catch (e) {
      console.error("Error al cerrar sesión", e);
    }
    
    // Forzar recarga a la raíz para limpiar todos los estados en memoria
    window.location.href = "/";
  };

  const isWholesaleLocked = !currentUser && !wholesaleSession;

  // Helper para interactuar con Frappe
  const callFrappeAPI = useCallback(async (method: string, args: any = {}) => {
    const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
    const response = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      credentials: "include"
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err._server_messages ? JSON.parse(err._server_messages).join("\n") : err.message || "Error al procesar la venta.");
    }
    const data = await response.json();
    return data.message;
  }, []);

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

  // Estados de la Venta Directa
  const [postingDate, setPostingDate] = useState<string>(
    new Date().toISOString().split("T")[0] // Hoy por defecto
  );

  // Estados del Formulario
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("Público General");
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Montos del Cobro
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [warehouse, setWarehouse] = useState<string>("");

  // Filtros de Productos
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  // Estados para almacenes de la compañía (se cargan manualmente solo si es administrador)
  const [dbWarehouses, setDbWarehouses] = useState<any[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isAdmin) {
      setDbWarehouses([]);
      setWarehousesLoading(false);
      return;
    }

    async function fetchWarehouses() {
      setWarehousesLoading(true);
      try {
        const res = await callFrappeAPI("get_active_warehouses_with_stock");
        setDbWarehouses(res || []);
      } catch (err) {
        console.error("Error al cargar almacenes de origen con stock:", err);
      } finally {
        setWarehousesLoading(false);
      }
    }

    fetchWarehouses();
  }, [isAdmin, callFrappeAPI]);

  const getWarehouseLabel = (name: string) => {
    const cleanName = name.split(" - ")[0];
    if (cleanName.startsWith("Fabrica")) return `🏭 ${cleanName}`;
    if (cleanName.startsWith("Distribucion")) return `📦 ${cleanName}`;
    if (cleanName.startsWith("Sucursal")) return `🍦 ${cleanName}`;
    return `🏪 ${cleanName}`;
  };

  const sourceWarehouses = dbWarehouses?.map((w: any) => ({
    name: w.name,
    label: getWarehouseLabel(w.warehouse_name || w.name)
  })) || [];

  // Inicializar almacén de origen por defecto
  useEffect(() => {
    if (dbWarehouses && dbWarehouses.length > 0 && !warehouse) {
      const dist = dbWarehouses.find(w => w.name.toLowerCase().includes("distribucion"));
      setWarehouse(dist ? dist.name : dbWarehouses[0].name);
    }
  }, [dbWarehouses, warehouse]);

  // Cargar configuraciones de marca blanca
  useEffect(() => {
    async function fetchConfig() {
      try {
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_features`, {
          cache: "no-store"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            setSaasConfig(data.message);
          }
        }
      } catch (err) {
        console.error("Error cargando configuración SaaS:", err);
      } finally {
        setConfigLoading(false);
      }
    }
    fetchConfig();
  }, []);



  // Cargar perfil del cliente mayorista (portal de auto-servicio)
  useEffect(() => {
    if (!currentUser) {
      setProfileLoading(false);
      return;
    }
    const userEmail = currentUser;
    async function loadProfile() {
      try {
        // Si es administrador o personal interno, no restringir como cliente
        const isCashier = userEmail.startsWith("cajero.");
        const isProdUser = userEmail ? userEmail.startsWith("produccion@") : false;
        const isLogisticaUser = userEmail ? userEmail.startsWith("logistica@") : false;
        const isStaff = isCashier || isProdUser || isLogisticaUser || userEmail === "Administrator" || userEmail.includes("admin");

        const isUserAdmin = userEmail === "Administrator" || userEmail.includes("admin") || userEmail.startsWith("admin.");
        setIsAdmin(!!isUserAdmin);

        const res = await callFrappeAPI("get_customer_wholesale_profile");
        if (res && res.success && !isStaff) {
          setIsCustomer(true);
          setCustomerProfile(res);
          setSelectedCustomer(res.customer);
        } else {
          setIsCustomer(false);
          if (res && res.success && isStaff) {
            setCustomerProfile(res);
          }
        }
      } catch (err) {
        console.error("Error loading customer wholesale profile:", err);
        setIsCustomer(false);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [currentUser, callFrappeAPI]);

  // Control de bloqueo por Feature Flag
  useEffect(() => {
    if (!configLoading && saasConfig && !saasConfig.features.wholesale) {
      router.push("/");
    }
  }, [saasConfig, configLoading, router]);

  // Búsqueda de clientes debounced
  useEffect(() => {
    if (customerQuery.trim().length >= 2) {
      const delayDebounce = setTimeout(async () => {
        setSearchLoading(true);
        try {
          const res = await callFrappeAPI("search_customers", { query: customerQuery });
          setSearchResults(res || []);
        } catch (err) {
          console.error("Error buscando clientes:", err);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [customerQuery, callFrappeAPI]);

  // Cargar catálogo de helados con precios Standard Selling y Standard Wholesale
  const [items, setItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      setItemsLoading(true);
      try {
        const args = isAdmin && warehouse ? { warehouse } : {};
        const res = await callFrappeAPI("get_active_items_with_prices", args);
        setItems(res || []);
      } catch (err) {
        console.error("Error cargando catálogo con precios y stock:", err);
      } finally {
        setItemsLoading(false);
      }
    }
    fetchItems();
  }, [warehouse, isAdmin, callFrappeAPI]);

  // Agregar producto al carrito de venta
  const handleAddProduct = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_code === item.name);
      if (existing) {
        return prev.map((i) => {
          if (i.item_code === item.name) {
            const nextQty = i.qty + 1;
            const hasWholesale = i.wholesale_price !== null && i.wholesale_price > 0;
            const rate = (hasWholesale && nextQty >= 10) ? i.wholesale_price! : i.retail_price;
            return { ...i, qty: nextQty, rate };
          }
          return i;
        });
      }
      const initialQty = 10; // Lote mínimo sugerido para mayoristas
      const hasWholesale = item.wholesale_price !== null && item.wholesale_price > 0;
      const rate = (hasWholesale && initialQty >= 10) ? item.wholesale_price! : item.retail_price;
      return [...prev, {
        item_code: item.name,
        item_name: item.item_name,
        qty: initialQty,
        rate: rate,
        retail_price: item.retail_price,
        wholesale_price: item.wholesale_price
      }];
    });
  };

  // Modificar cantidad en carrito y recalcular precio dinámico (mayorista vs. minorista)
  const handleUpdateQty = (itemCode: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.item_code !== itemCode));
      return;
    }
    setCart((prev) =>
      prev.map((i) => {
        if (i.item_code === itemCode) {
          const hasWholesale = i.wholesale_price !== null && i.wholesale_price > 0;
          const rate = (hasWholesale && qty >= 10) ? i.wholesale_price! : i.retail_price;
          return { ...i, qty, rate };
        }
        return i;
      })
    );
  };

  // Confirmar y procesar la venta mayorista
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMessage("Debés agregar al menos un sabor o producto a la venta.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Preparar ítems para la API (con el rate resuelto)
    const itemsToSubmit = cart.map(i => ({
      item_code: i.item_code,
      qty: i.qty,
      rate: i.rate
    }));

    try {
      const res = await callFrappeAPI("create_wholesale_sale", {
        customer: selectedCustomer,
        items: itemsToSubmit,
        payment_amount: paymentAmount,
        payment_mode: paymentMode,
        warehouse: warehouse
      });
      
      setSuccessMessage(`¡Factura creada y registrada con éxito! Factura: ${res.sales_invoice}. Total: $${res.grand_total.toFixed(2)}.`);
      setCart([]);
      setPaymentAmount(0);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al registrar la venta mayorista.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar y procesar el pedido del cliente (auto-servicio)
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMessage("Debés agregar al menos un sabor o producto a tu pedido.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const itemsToSubmit = cart.map(i => ({
      item_code: i.item_code,
      qty: i.qty,
      rate: i.rate
    }));

    try {
      const res = await callFrappeAPI("create_wholesale_order", {
        items: itemsToSubmit,
        metodo_pago: metodoPago,
        metodo_entrega: metodoEntrega,
        customer: selectedCustomer
      });
      
      setSuccessMessage(`¡Tu pedido fue registrado con éxito! Código de Pedido: ${res.sales_order}. Un administrador lo confirmará y se pondrá en contacto.`);
      setCart([]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al registrar el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado de catálogo
  const filteredProducts = items?.filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedCategory === "Todos" || item.item_group === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = ["Todos", ...Array.from(new Set(items?.map(item => item.item_group).filter(Boolean) || []))];

  const cartTotal = cart.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const primaryColor = saasConfig?.colors?.primary || "#1abc9c";
  const formLayoutClass = isCustomer
    ? "flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 gap-6 overflow-y-auto pb-[calc(11rem+env(safe-area-inset-bottom))] sm:pb-32"
    : "flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pb-32";
  const leftPanelClass = isCustomer
    ? "w-full order-2"
    : "lg:col-span-4 space-y-6 order-2 lg:order-1";
  const catalogPanelClass = isCustomer
    ? "w-full order-1"
    : "lg:col-span-8 space-y-6 order-1 lg:order-2";

  // Pre-cargar el total del carrito en el cobro inmediato
  const handlePayFullAmount = () => {
    setPaymentAmount(parseFloat(cartTotal.toFixed(2)));
  };

  if (authLoading || configLoading || itemsLoading || profileLoading || (isAdmin && warehousesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-500"></div>
          <p className="text-sm font-semibold tracking-wide animate-pulse">Cargando Módulo de Ventas Mayoristas...</p>
        </div>
      </div>
    );
  }

  if (isWholesaleLocked) {
    const activeColor = saasConfig?.colors?.primary || "#3498db";
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 font-sans relative overflow-hidden p-4">
        {/* Background design */}
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse"></div>
        <div 
          className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full blur-[120px] opacity-5 pointer-events-none"
          style={{ backgroundColor: activeColor }}
        ></div>

        <div className="w-full max-w-md bg-slate-900/45 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl space-y-8 relative z-10 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center font-black text-white text-2xl shadow-lg border border-white/10">
              VM
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">Portal Mayorista Autogestionado</h2>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Ingresá tu celular y PIN registrado por administración para realizar tus pedidos.
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-455 font-bold leading-relaxed text-center animate-fade-in">
              {authError}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-bold leading-relaxed text-center animate-fade-in">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleValidateAccess} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Celular / WhatsApp</label>
              <input
                type="text"
                required
                value={authPhone}
                onChange={(e) => setAuthPhone(e.target.value)}
                placeholder="Ej. +52 55 1234 5678"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3.5 text-sm text-white outline-none focus:border-slate-700 focus:bg-slate-950/80 transition-all font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">PIN de Acceso</label>
              <input
                type="password"
                required
                value={authPin}
                onChange={(e) => setAuthPin(e.target.value)}
                placeholder="******"
                maxLength={6}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3.5 text-sm text-white text-center tracking-widest outline-none focus:border-slate-700 focus:bg-slate-950/80 transition-all font-black"
              />
            </div>

            <button
              type="submit"
              disabled={validatingAccess}
              className="w-full rounded-2xl py-4 text-xs font-black text-white shadow-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              style={{ backgroundColor: activeColor }}
            >
              {validatingAccess ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-white"></div>
                  <span>Validando Credenciales...</span>
                </>
              ) : (
                "Verificar y Entrar"
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-850/60 text-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs text-slate-500 hover:text-slate-350 font-bold transition-colors cursor-pointer"
            >
              ← Volver al Portal General
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {!isCustomer && isAdmin && (
        <div className="px-4 sm:px-6 lg:px-8 pt-6 flex-shrink-0">
          <div className="tab-container flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveAdminTab("venta_directa")}
              className={`tab-button ${activeAdminTab === "venta_directa" ? "active" : ""}`}
            >
              🛍️ <span>Registrar Venta</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab("pedidos_pendientes")}
              className={`tab-button ${activeAdminTab === "pedidos_pendientes" ? "active" : ""}`}
            >
              📦 <span>Pedidos Pendientes</span>
            </button>
          </div>
        </div>
      )}

      {/* Renderizar Panel de Pedidos Mayoristas si es admin y está seleccionada esa pestaña */}
      {activeAdminTab === "pedidos_pendientes" && !isCustomer && isAdmin ? (
        <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto pb-32">
          <AdminOrdersPanel primaryColor={primaryColor} callFrappeAPI={callFrappeAPI} />
        </div>
      ) : (
        /* Grid del Layout General: Venta Directa o Pedido de Cliente */
          <form 
            onSubmit={isCustomer ? handleOrderSubmit : handleSaleSubmit} 
            className={formLayoutClass}
          >
        
        {/* PANEL IZQUIERDO: Almacén, Clientes y Datos de Facturación (4/12) */}
        <div className={leftPanelClass}>
          
          {isCustomer ? (
            /* VISTA DEL CLIENTE: Opciones de Pedido */
            <>
              {/* Opciones del Pedido (Método de Pago y Entrega) */}
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-6">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Opciones del Pedido</h3>
                
                <div className="space-y-4">
                  {/* Método de Pago */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">¿Cómo vas a pagar?</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { mode: "Transferencia", label: "Transferencia" },
                        { mode: "Efectivo", label: "Efectivo al Recibir" }
                      ].map((item) => {
                        const isSelected = metodoPago === item.mode;
                        return (
                          <button
                            key={item.mode}
                            type="button"
                            onClick={() => setMetodoPago(item.mode)}
                            className={`rounded-2xl py-3 text-xs font-bold transition-all border active:scale-95 ${
                              isSelected
                                ? "text-white"
                                : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
                            }`}
                            style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Método de Entrega */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">¿Cómo querés recibirlo?</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { mode: "Domicilio", label: "Envío a Domicilio" },
                        { mode: "Recoger", label: "Recoger en Fábrica" }
                      ].map((item) => {
                        const isSelected = metodoEntrega === item.mode;
                        return (
                          <button
                            key={item.mode}
                            type="button"
                            onClick={() => setMetodoEntrega(item.mode)}
                            className={`rounded-2xl py-3 text-xs font-bold transition-all border active:scale-95 ${
                              isSelected
                                ? "text-white"
                                : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
                            }`}
                            style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || cart.length === 0}
                  className="w-full rounded-2xl py-4 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? "Registrando tu Pedido..." : "Registrar mi Pedido Mayorista"}
                </button>
              </div>
            </>
          ) : (
            /* VISTA DEL ADMINISTRADOR: Registro de Venta Directa */
            <>
              {/* Configuración de Almacén Origen y Fecha */}
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-4 text-base">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse"></span>
                  Almacén de Salida y Fecha
                </h3>
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Origen de Stock</label>
                  <CustomSelect
                    value={warehouse}
                    onChange={(val) => setWarehouse(val)}
                    options={sourceWarehouses.map((w) => ({ value: w.name, label: w.label }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Fecha de Registro</label>
                  <CustomDatePicker
                    value={postingDate}
                    onChange={(val) => setPostingDate(val)}
                    className="focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Selector de Cliente de Facturación */}
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-4 text-base">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">👤 Cliente Mayorista</h3>
                  {selectedCustomer !== "Público General" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer("Público General");
                        setCustomerQuery("");
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold"
                    >
                      Restablecer General
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder={selectedCustomer || "Buscar escuela, tienda..."}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white focus:border-slate-700 outline-none font-semibold"
                    />
                    {searchLoading && (
                      <div className="absolute right-4 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500"></div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                        {searchResults.map((c) => (
                          <div
                            key={c.name}
                            onClick={() => {
                              setSelectedCustomer(c.name);
                              setSearchResults([]);
                              setCustomerQuery("");
                            }}
                            className="px-4 py-2.5 hover:bg-slate-900 text-sm text-slate-200 hover:text-white cursor-pointer transition-all border-b border-slate-900 last:border-0 font-bold"
                          >
                            {c.customer_name} ({c.name})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="bg-slate-900 hover:bg-slate-850 text-sky-400 hover:text-sky-300 border border-slate-850 px-4 py-3 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    + Nuevo
                  </button>
                </div>
              </div>

              {/* Cobro y Forma de Pago */}
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Registro de Cobro</h3>
                  {cartTotal > 0 && (
                    <button
                      type="button"
                      onClick={handlePayFullAmount}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold"
                    >
                      Cobrar Total
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Importe Recibido</label>
                    <input
                      type="number"
                      step="any"
                      value={paymentAmount || ""}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none focus:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Método de Cobro</label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Cash", "Credit Card"].map((mode) => {
                        const isSelected = paymentMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentMode(mode)}
                            className={`rounded-2xl py-3 text-xs font-bold transition-all border active:scale-95 ${
                              isSelected
                                ? "text-white"
                                : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
                            }`}
                            style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                          >
                            {mode === "Cash" ? "Efectivo" : "Tarjeta"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalle de Crédito si el pago es menor al total */}
                  {cartTotal > paymentAmount && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-400 leading-normal">
                      ⚠️ <strong>Venta a Crédito</strong>: Se registrará un saldo pendiente de <strong>${(cartTotal - paymentAmount).toFixed(2)}</strong> en las cuentas del cliente.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || cart.length === 0}
                  className="w-full rounded-2xl py-4 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? "Registrando Factura en ERPNext..." : "Registrar Venta Directa Mayorista"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* PANEL CENTRAL/DERECHO: Catálogo Mayorista y Carrito (8/12) */}
        <div className={catalogPanelClass}>
          
          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-sm text-emerald-400 font-semibold">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Catálogo de Productos y Precios Dinámicos */}
          <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-850 shadow-xl space-y-8 text-base">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-850 pb-3 flex items-center gap-2">
                🍨 Catálogo de Productos Mayorista
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Elegí sabores de la grilla visual. A partir de **10 unidades**, se activa automáticamente el precio mayorista (resaltado en dorado) si existe para esa variante.
              </p>
            </div>

            {/* BARRA DE PESTAÑAS DE CATEGORÍA Y BUSCADOR */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Sabores Disponibles</h4>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar sabor o producto..."
                  className="rounded-2xl border border-slate-850 bg-slate-900/60 px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none w-full sm:max-w-xs text-sm"
                />
              </div>

              {/* Pestañas Horizontales */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-850 pb-3">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer border ${
                        isActive
                          ? "text-white border-white bg-slate-900"
                          : "bg-slate-900/25 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRILLA VISUAL DE TARJETAS DE HELADO */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[360px] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-500">
                  No se encontraron productos en esta categoría.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const cartItem = cart.find((i) => i.item_code === p.name);
                  const qty = cartItem ? cartItem.qty : 0;

                  return (
                    <div key={p.name} className="relative rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-5 shadow-lg flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-2xl">
                      {/* Imagen */}
                      <CatalogImageTile
                        className="aspect-square w-full mb-4"
                        src={p.image}
                        alt={p.item_name}
                        mode="cover"
                      />

                      {/* Detalles del Sabor */}
                      <div className="min-w-0">
                        <span className="text-xs font-black text-white truncate block" title={p.item_name}>
                          {p.item_name}
                        </span>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold">P. Unit:</span>
                            <span className="text-xs text-white font-extrabold">${p.retail_price.toFixed(2)}</span>
                          </div>
                          {p.wholesale_price && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">Mayorista:</span>
                              <span className="text-xs text-amber-400 font-black">${p.wholesale_price.toFixed(2)}</span>
                            </div>
                          )}
                          {!isCustomer && isAdmin && p.actual_qty !== undefined && p.actual_qty !== null && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-450 font-bold">Stock:</span>
                              <span className={`text-[11px] font-extrabold ${p.actual_qty > 0 ? "text-emerald-400" : "text-rose-500 font-bold"}`}>
                                {p.actual_qty > 0 ? `${p.actual_qty} pz` : "Sin stock"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botón de Agregar / Stepper de Lote */}
                      <div className="mt-4 shrink-0">
                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleAddProduct(p)}
                            className="w-full rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 py-2 text-xs font-black text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm"
                          >
                            + Agregar
                          </button>
                        ) : (
                          <div className="flex items-center justify-between bg-slate-950 rounded-xl border border-slate-800 p-1 w-full max-w-[130px] mx-auto">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(p.name, qty - 1)}
                              className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer px-2.5"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleUpdateQty(p.name, isNaN(val) ? 0 : val);
                              }}
                              className="text-xs font-black text-white bg-transparent border-0 outline-none w-12 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(p.name, qty + 1)}
                              className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer px-2.5"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* CARRITO DE COMPRA / DETALLE DE LA VENTA */}
            <div className="pt-6 border-t border-slate-850 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                  🛒 Detalle del Carrito 
                  {cart.length > 0 && (
                    <span className="text-xs bg-slate-900 border border-slate-850 px-2 py-0.5 rounded-full text-slate-300 text-center font-bold">
                      {cart.reduce((sum, item) => sum + item.qty, 0)} piezas
                    </span>
                  )}
                </h4>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-extrabold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wide cursor-pointer"
                  >
                    Vaciar Carrito
                  </button>
                )}
              </div>

              {/* Lista actual del carrito */}
              <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl">
                    El carrito está vacío. Hacé clic en los productos para agregarlos a la venta.
                  </p>
                ) : (
                  cart.map((item) => {
                    const isWholesaleApplied = item.wholesale_price !== null && item.qty >= 10;
                    return (
                      <div
                        key={item.item_code}
                        className="flex items-center justify-between bg-slate-900/30 border border-slate-850/60 p-3 rounded-2xl"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <span className="text-xs font-black text-white block truncate">
                            {item.item_name}
                          </span>
                          <span className="text-[10px] text-slate-550 font-bold block">
                            Código: {item.item_code}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            {isWholesaleApplied ? (
                              <>
                                <span className="text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                  Mayoreo Aplicado
                                </span>
                                <span className="text-xs text-amber-400 font-bold">
                                  ${item.rate.toFixed(2)} / pz
                                </span>
                                <span className="text-[10px] text-slate-500 line-through">
                                  ${item.retail_price.toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 font-bold">
                                ${item.rate.toFixed(2)} / pz
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Controles del stepper del carrito */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1 w-28">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.item_code, item.qty - 1)}
                              className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer px-2"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleUpdateQty(item.item_code, isNaN(val) ? 0 : val);
                              }}
                              className="text-xs font-black text-white bg-transparent border-0 outline-none w-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.item_code, item.qty + 1)}
                              className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer px-2"
                            >
                              +
                            </button>
                          </div>

                          <div className="w-20 text-right min-w-[70px]">
                            <span className="text-xs font-black text-white block">
                              ${(item.qty * item.rate).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
      )}

      {/* Checkout flotante estético */}
      {cartTotal > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-40 bg-slate-950/90 border border-white/5 shadow-2xl rounded-3xl p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/10">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1">Total a Pagar</p>
              <p className="text-2xl font-black text-white leading-none">
                ${cartTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {isCustomer ? (
              <button
                type="button"
                onClick={() => setCart([])}
                className="rounded-xl px-5 py-3 text-xs font-semibold text-rose-405 hover:text-rose-300 border border-rose-950/40 hover:border-rose-900/60 hover:bg-rose-950/20 transition-all bg-rose-950/10 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>✕</span> Vaciar Carrito
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCart([])}
                  disabled={submitting}
                  className="rounded-xl px-5 py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 transition-all bg-slate-900/60 active:scale-95 cursor-pointer"
                >
                  Cancelar Compra
                </button>
                <button
                  type="button"
                  onClick={handleSaleSubmit}
                  disabled={submitting}
                  className="rounded-xl px-6 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-95 cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? "Registrando..." : "Confirmar Venta Directa"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL EXPRESS REGISTRO CLIENTE */}
      <ExpressCustomerModal
        show={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        primaryColor={primaryColor}
        callFrappeAPI={callFrappeAPI}
        onSelectCustomer={(customerName, customerId) => {
          setSelectedCustomer(customerId);
          setSuccessMessage(`Cliente "${customerName}" seleccionado.`);
          setCustomerQuery("");
        }}
      />
    </div>
  );
}

interface ExpressCustomerModalProps {
  show: boolean;
  onClose: () => void;
  primaryColor: string;
  callFrappeAPI: (method: string, args?: any) => Promise<any>;
  onSelectCustomer: (customerName: string, customerId: string) => void;
}

export function ExpressCustomerModal({
  show,
  onClose,
  primaryColor,
  callFrappeAPI,
  onSelectCustomer
}: ExpressCustomerModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"idle" | "found" | "new" | "error">("idle");
  const [existingCustomer, setExistingCustomer] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!show) return null;

  const handleSearch = async () => {
    if (!name.trim() && !phone.trim()) {
      setErrorMsg("Escribí el nombre o el teléfono para buscar.");
      return;
    }
    setSearching(true);
    setErrorMsg(null);
    setSearchStatus("idle");
    try {
      const res = await callFrappeAPI("find_customer_by_name_or_phone", {
        name: name.trim(),
        phone: phone.trim()
      });
      if (res && res.found) {
        setExistingCustomer(res);
        setName(res.customer_name);
        setPhone(res.phone || "");
        setSearchStatus("found");
      } else {
        setExistingCustomer(null);
        setSearchStatus("new");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al buscar cliente.");
      setSearchStatus("error");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (existingCustomer) {
      onSelectCustomer(existingCustomer.customer_name, existingCustomer.name);
      onClose();
      return;
    }

    setRegistering(true);
    setErrorMsg(null);
    try {
      const res = await callFrappeAPI("create_pos_customer", {
        customer_name: name.trim(),
        phone: phone.trim()
      });
      onSelectCustomer(res.customer_name, res.name);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al registrar cliente nuevo.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            👤 Registrar Cliente Express
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-450 hover:text-white text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-semibold leading-relaxed animate-fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Nombre / Razón Social *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSearchStatus("idle");
                setExistingCustomer(null);
              }}
              placeholder="Ej. Escuela Primaria Benito Juarez"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Teléfono / WhatsApp</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSearchStatus("idle");
                setExistingCustomer(null);
              }}
              placeholder="Ej. +52 55 1234 5678"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all"
            />
          </div>

          {searchStatus === "found" && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-bold flex items-center gap-2 animate-fade-in">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ¡Cliente encontrado en la base de datos!
            </div>
          )}

          {searchStatus === "new" && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-400 font-bold flex items-center gap-2 animate-fade-in">
              <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
              Cliente nuevo. Se registrará al guardar.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={searching}
              onClick={handleSearch}
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 py-3.5 text-xs font-black text-slate-350 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {searching ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-white"></div>
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Buscar</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={registering}
              className="flex-2 rounded-2xl py-3.5 text-xs font-black text-white shadow-xl transition-all active:scale-95 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              {registering ? (
                "Registrando..."
              ) : existingCustomer ? (
                "Seleccionar Cliente"
              ) : (
                "Guardar y Seleccionar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
