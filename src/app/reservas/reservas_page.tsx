"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/purity */

import React, { useState, useEffect, useCallback } from "react";
import { useFrappeAuth } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { CustomDatePicker } from "../components/custom_date_picker";
import { CatalogImageTile } from "../components/catalog_image_tile";
import AdminEventsPanel from "./admin_events_panel";

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
  };
}

interface CartItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
}



const PRESET_COMBOS = [
  {
    id: "combo-infantil",
    name: "🎉 Combo Infantil",
    description: "Ideal para 150 niños. Mix de paletas de agua, crema y bolis.",
    items: [
      { item_code: "Paleta de Agua-F", item_name: "Paleta de Agua Fresa", qty: 50, rate: 14.0 },
      { item_code: "Paleta de Crema-O", item_name: "Paleta de Crema Oreo", qty: 50, rate: 16.0 },
      { item_code: "Bolis Saborines de Agua-L", item_name: "Bolis Saborines Limón", qty: 50, rate: 10.0 }
    ]
  },
  {
    id: "combo-frutal",
    name: "🍓 Combo Frutal de Agua",
    description: "200 piezas 100% de agua natural, súper refrescantes.",
    items: [
      { item_code: "Paleta de Agua-L", item_name: "Paleta de Agua Limón", qty: 50, rate: 14.0 },
      { item_code: "Paleta de Agua-F", item_name: "Paleta de Agua Fresa", qty: 50, rate: 14.0 },
      { item_code: "Paleta de Agua-CC", item_name: "Paleta de Agua Coco", qty: 50, rate: 14.0 },
      { item_code: "Paleta de Agua-P", item_name: "Paleta de Agua Piña", qty: 50, rate: 14.0 }
    ]
  },
  {
    id: "combo-premium",
    name: "⭐️ Combo Premium Cremoso",
    description: "150 piezas gourmet mezclando paletas de crema y nieves en vaso.",
    items: [
      { item_code: "Paleta de Crema-FC", item_name: "Paleta de Crema Fresa con Crema", qty: 50, rate: 16.0 },
      { item_code: "Paleta de Crema-O", item_name: "Paleta de Crema Oreo", qty: 50, rate: 16.0 },
      { item_code: "Nieve en Vaso-CHO", item_name: "Nieve en Vaso Chocolate", qty: 50, rate: 18.0 }
    ]
  }
];



export default function ReservasPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  // Estados generales de carga y configuración
  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pestañas y rol de administración
  const [activeTab, setActiveTab] = useState<"reserve" | "pending_events">("reserve");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  // Efecto para activar pestaña de pedidos pendientes al venir desde una notificación
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "pendientes") {
        setActiveTab("pending_events");
      }
    }
  }, []);

  // Estados del Calendario de Reservas
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split("T")[0] // Mañana por defecto
  );
  const [availability, setAvailability] = useState<any>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Estados del Formulario de Reserva
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("Público General");
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Estados de Invitado (Público General)
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Montos del Anticipo
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("Cash");

  // Filtros de Productos para agregar al evento
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

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
      throw new Error(err._server_messages ? JSON.parse(err._server_messages).join("\n") : err.message || "Error al procesar la reserva.");
    }
    const data = await response.json();
    return data.message;
  }, []);

  // Cargar disponibilidad para la fecha seleccionada
  const fetchAvailability = useCallback(async (date: string) => {
    setAvailabilityLoading(true);
    setErrorMessage(null);
    try {
      const res = await callFrappeAPI("check_cart_availability", { date });
      setAvailability(res);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al verificar disponibilidad.");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [callFrappeAPI]);

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
            // Pre-cargar el carrito con la plantilla por defecto si existe
            try {
              const parsed = JSON.parse(data.message.default_event_items || "[]");
              if (Array.isArray(parsed) && parsed.length > 0) {
                setCart(parsed);
              }
            } catch (e) {
              console.error("Error pre-cargando paquete estándar:", e);
            }
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

  // Control de bloqueo por Feature Flag
  useEffect(() => {
    if (!configLoading && saasConfig && !saasConfig.features.reservations) {
      router.push("/");
    }
  }, [saasConfig, configLoading, router]);

  // Validar rol del usuario logueado para habilitar la pestaña de administrador
  useEffect(() => {
    if (currentUser) {
      const userEmail = currentUser;
      const isUserAdmin = userEmail === "Administrator" || userEmail.includes("admin") || userEmail.startsWith("admin.");
      setIsAdmin(!!isUserAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [currentUser]);

  // Generar enlace dinámico para compartir con clientes
  useEffect(() => {
    if (typeof window !== "undefined") {
      let tenantName = "";
      const pathParts = window.location.pathname.split("/");
      if (pathParts[1] === "c" && pathParts[2]) {
        tenantName = pathParts[2];
      }
      if (!tenantName) {
        // Leer de las cookies
        const value = `; ${document.cookie}`;
        const parts = value.split(`; tenant_name=`);
        if (parts.length === 2) {
          tenantName = parts.pop()?.split(";").shift() || "";
        }
      }
      tenantName = tenantName || "frontend";
      setShareUrl(`${window.location.protocol}//${window.location.host}/c/${tenantName}/reservas`);
    }
  }, []);

  // Actualizar disponibilidad cuando cambia la fecha
  useEffect(() => {
    if (selectedDate) {
      fetchAvailability(selectedDate);
    }
  }, [selectedDate, fetchAvailability]);

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

  // Cargar catálogo de helados para agregar
  const [items, setItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      try {
        const res = await callFrappeAPI("get_active_items");
        setItems(res || []);
      } catch (err) {
        console.error("Error cargando catálogo de helados:", err);
      } finally {
        setItemsLoading(false);
      }
    }
    fetchItems();
  }, [callFrappeAPI]);

  // Agregar producto al carrito del evento
  const handleAddProduct = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_code === item.name);
      if (existing) {
        return prev.map((i) =>
          i.item_code === item.name ? { ...i, qty: i.qty + 1 } : i // Incrementar de 1 en 1
        );
      }
      return [...prev, {
        item_code: item.name,
        item_name: item.item_name,
        qty: 100, // Lote inicial
        rate: item.standard_rate || 14.0
      }];
    });
  };

  const handleUpdateQty = (itemCode: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.item_code !== itemCode));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.item_code === itemCode ? { ...i, qty } : i))
    );
  };

  const handleLoadCombo = (combo: typeof PRESET_COMBOS[0]) => {
    const loadedItems = combo.items.map((ci) => {
      const realItem = items.find((i) => i.name === ci.item_code);
      return {
        item_code: ci.item_code,
        item_name: realItem?.item_name || ci.item_name,
        qty: ci.qty,
        rate: realItem?.standard_rate || ci.rate
      };
    });
    setCart(loadedItems);
    setSuccessMessage(`¡${combo.name} cargado con éxito en tu carrito!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Crear Cliente Express
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await callFrappeAPI("create_pos_customer", {
        customer_name: newCustomerName,
        phone: newCustomerPhone
      });
      setSelectedCustomer(res.name);
      setSuccessMessage(`Cliente "${res.customer_name}" registrado y seleccionado.`);
      setShowCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setCustomerQuery("");
    } catch (err: any) {
      setErrorMessage(err.message || "Error al dar de alta el cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar y guardar reserva
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMessage("Debés agregar al menos un sabor o producto al evento.");
      return;
    }
    if (availability && availability.available_qty <= 0) {
      setErrorMessage("No hay carritos disponibles para esta fecha.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await callFrappeAPI("create_event_booking", {
        customer: currentUser ? selectedCustomer : "Público General",
        delivery_date: selectedDate,
        items: cart,
        advance_amount: advanceAmount,
        payment_mode: paymentMode,
        guest_name: !currentUser ? guestName : undefined,
        guest_phone: !currentUser ? guestPhone : undefined
      });
      setSuccessMessage(`¡Reserva creada con éxito! Pedido registrado: ${res.sales_order}`);
      setCart([]);
      setAdvanceAmount(0);
      setGuestName("");
      setGuestPhone("");
      await fetchAvailability(selectedDate);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al registrar la reserva del evento.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado
  const filteredProducts = items?.filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedCategory === "Todos" || item.item_group === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = ["Todos", ...Array.from(new Set(items?.map(item => item.item_group).filter(Boolean) || []))];

  const cartTotal = cart.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const primaryColor = saasConfig?.colors?.primary || "#3498db";

  if (authLoading || configLoading || itemsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans text-base">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-500"></div>
          <p className="text-base font-semibold tracking-wide animate-pulse">Cargando Módulo de Reservas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {isAdmin && (
        <div className="px-4 sm:px-6 lg:px-8 pt-6 flex-shrink-0">
          <div className="tab-container">
            <button
              type="button"
              onClick={() => setActiveTab("reserve")}
              className={`tab-button ${activeTab === "reserve" ? "active" : ""}`}
            >
              📅 <span>Registrar Reserva</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pending_events")}
              className={`tab-button ${activeTab === "pending_events" ? "active" : ""}`}
            >
              📋 <span>Eventos Pendientes</span>
            </button>
          </div>
        </div>
      )}

      {/* Condicional de pestañas para administrador o cliente normal */}
      {activeTab === "pending_events" && isAdmin ? (
        <div className="flex-1 w-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
          <AdminEventsPanel primaryColor={primaryColor} callFrappeAPI={callFrappeAPI} />
        </div>
      ) : (
        /* Grid del Layout General */
        <form onSubmit={handleReserveSubmit} className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pb-32">
        
        {/* PANEL IZQUIERDO: Calendario, Disponibilidad y Datos de Contacto (4/12) */}
        <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-4 text-base">
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Fecha del Evento
            </h3>
            
            <CustomDatePicker
              value={selectedDate}
              onChange={(val) => setSelectedDate(val)}
              className="focus:border-emerald-500"
            />

            {/* Caja de Disponibilidad del Recurso */}
            <div className="pt-4 border-t border-slate-850 space-y-3">
              {availabilityLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-slate-500 gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-800 border-t-emerald-500"></div>
                  Consultando disponibilidad...
                </div>
              ) : availability ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border text-center ${
                    availability.available_qty > 0
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                  }`}>
                    <span className="text-xs font-black uppercase tracking-widest block mb-1">
                      {availability.available_qty > 0 ? "Disponibilidad de Carritos" : "Fecha Agotada"}
                    </span>
                    <p className="text-lg font-black leading-none">
                      {availability.available_qty} libres
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Seleccioná una fecha para ver disponibilidad.</p>
              )}
            </div>

            {/* Compartir Enlace con Clientes (Solo visible para Administradores) */}
            {isAdmin && shareUrl && (
              <div className="mt-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/50 space-y-2.5">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-400 block">
                  🔗 Enlace para Clientes
                </span>
                <p className="text-xs text-slate-400 leading-normal">
                  Compartí este enlace con tus clientes para que registren sus propias reservas directamente:
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 outline-none select-all truncate font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    {copiedLink ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Configuración de Cliente / Datos de Contacto de Invitado */}
          {!currentUser ? (
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-4 text-base">
              <h3 className="text-base font-black text-white uppercase tracking-wider">👤 Tus Datos de Contacto</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Tu Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ej. María López"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-white focus:border-slate-700 outline-none font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Tu Teléfono / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Ej. +52 55 1234 5678"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-white focus:border-slate-700 outline-none font-bold"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-4 text-base">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white uppercase tracking-wider">Cliente de Facturación</h3>
                {selectedCustomer !== "Público General" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer("Público General");
                      setCustomerQuery("");
                    }}
                    className="text-sm text-sky-400 hover:text-sky-300 font-bold"
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
                    placeholder={selectedCustomer || "Buscar cliente..."}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-white focus:border-slate-700 outline-none font-semibold"
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
                  className="bg-slate-900 hover:bg-slate-850 text-sky-400 hover:text-sky-300 border border-slate-850 px-4 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  + Nuevo
                </button>
              </div>
            </div>
          )}

          {/* Cobro de Anticipo y Confirmación (Movilizado a la Izquierda) */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-6">
            <h3 className="text-base font-black text-white uppercase tracking-wider">Monto de Anticipo</h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Anticipo Cobrado</label>
                <input
                  type="number"
                  step="any"
                  value={advanceAmount || ""}
                  onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-base font-black text-white outline-none focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Cash", "Credit Card"].map((mode) => {
                    const isSelected = paymentMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`rounded-2xl py-3 text-sm font-bold transition-all border active:scale-95 ${
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
            </div>

            <button
              type="submit"
              disabled={submitting || cart.length === 0 || (availability && availability.available_qty <= 0)}
              className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? "Procesando Reserva en ERPNext..." : "Confirmar y Registrar Reserva de Evento"}
            </button>
          </div>
        </div>

        {/* PANEL CENTRAL/DERECHO: Catálogo y Reserva (8/12) */}
        <div className="lg:col-span-8 space-y-6 order-1 lg:order-2">
          
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

          {/* Catálogo de Productos y Carrito del Evento */}
          <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-850 shadow-xl space-y-8 text-base">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider border-b border-slate-850 pb-3 flex items-center gap-2">
                🍭 Armá tu Carrito para el Evento
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Elegí un combo preconfigurado o seleccioná tus paletas y helados favoritos de la grilla visual. ¡Se agregan en lotes de 50!
              </p>
            </div>

            {/* 1. SECTOR DE COMBOS SUGERIDOS */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">✨ Combos Sugeridos (Carga con 1 Clic)</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                {PRESET_COMBOS.map((combo) => (
                  <button
                    key={combo.id}
                    type="button"
                    onClick={() => handleLoadCombo(combo)}
                    className="p-4 rounded-2xl border border-slate-850 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/60 transition-all hover:scale-[1.02] text-left active:scale-95 flex flex-col justify-between h-36 relative group overflow-hidden cursor-pointer"
                  >
                    <div>
                      <span className="text-sm font-black text-white group-hover:text-sky-400 transition-colors block">{combo.name}</span>
                      <p className="text-xs text-slate-400 mt-1 leading-normal">{combo.description}</p>
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-wide text-sky-400/80 group-hover:text-sky-350 flex items-center gap-1 mt-2">
                      Cargar Combo →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. BARRA DE PESTAÑAS DE CATEGORÍA Y BUSCADOR */}
            <div className="space-y-4 pt-4 border-t border-slate-850/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">🍦 Catálogo de Sabores</h4>
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

            {/* 3. GRILLA VISUAL DE TARJETAS DE HELADO */}
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
                    <div
                      key={p.name}
                      className="group rounded-2xl border border-slate-850 bg-slate-900/20 hover:bg-slate-900/40 p-3 flex flex-col justify-between hover:border-slate-750 transition-all hover:scale-[1.01] h-[260px]"
                    >
                      {/* Imagen con Aspect Ratio */}
                      <CatalogImageTile
                        className="aspect-square w-full"
                        src={p.image}
                        alt={p.item_name}
                        imageClassName="group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Detalles del Sabor */}
                      <div className="mt-2 min-w-0">
                        <span className="text-xs font-black text-white truncate block" title={p.item_name}>
                          {p.item_name}
                        </span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-xs text-slate-350 font-bold">${(p.standard_rate || 14.0).toFixed(2)} / pz</span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-extrabold truncate">{p.item_group}</span>
                        </div>
                      </div>

                      {/* Botón de Agregar / Stepper de Lote (+50) */}
                      <div className="mt-3">
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

            {/* 4. CARRITO DE EVENTO / LISTADO DE PRODUCTOS AGREGADOS */}
            <div className="pt-6 border-t border-slate-850 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                  🛒 Tu Carrito Personalizado 
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
                  <p className="text-sm text-slate-500 text-center py-6 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl">
                    No has agregado ningún producto para el evento todavía.
                  </p>
                ) : (
                  cart.map((item) => (
                    <div key={item.item_code} className="flex items-center justify-between gap-4 p-3 bg-slate-900/40 hover:bg-slate-900/60 rounded-2xl border border-slate-850/70 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-black text-white truncate block">{item.item_name}</span>
                        <span className="text-xs text-slate-450 font-bold uppercase mt-0.5">Precio: ${item.rate.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-950 rounded-xl border border-slate-850 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.item_code, item.qty - 1)}
                          className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer px-1.5"
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
                          className="text-sm font-black text-white bg-transparent border-0 outline-none w-14 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.item_code, item.qty + 1)}
                          className="text-slate-400 hover:text-white font-extrabold text-sm cursor-pointer px-1.5"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-sm font-black text-white w-16 text-right">${(item.qty * item.rate).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Monto Total Estimado */}
              <div className="pt-4 border-t border-slate-850 flex justify-between items-center text-sm font-black text-white">
                <span className="uppercase tracking-widest text-xs text-slate-400">Monto Total Estimado</span>
                <span className="text-2xl" style={{ color: primaryColor }}>${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>
      </form>
      )}

      {/* MODAL REGISTRO EXPRESS DE NUEVO CLIENTE */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/5 bg-slate-900 p-6 shadow-2xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-lg font-black text-white">Registro de Nuevo Cliente</h4>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-sm">
              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-850">
                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Nombre Completo / Razón Social</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm font-bold text-white outline-none focus:border-slate-700"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Ej. +52 55 1234 5678"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm font-bold text-white outline-none focus:border-slate-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !newCustomerName.trim()}
                className="w-full rounded-xl py-3.5 text-sm font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? "Creando..." : "Registrar y Seleccionar Cliente"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
