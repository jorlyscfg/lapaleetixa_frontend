"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useFrappeAuth } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { ExpressCustomerModal } from "../mayoristas/mayoristas_page";

interface HistoryOrder {
  name: string;
  transaction_date: string;
  grand_total: number;
  status: string;
}

interface HistoryInvoice {
  name: string;
  posting_date: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
}

interface HistoryData {
  orders?: HistoryOrder[];
  invoices?: HistoryInvoice[];
}

interface Customer {
  name: string;
  customer_name: string;
  mobile_no?: string;
  email_id?: string;
  territory?: string;
  customer_group?: string;
  custom_wholesale_access_pin?: string;
}

interface FeatureConfig {
  client_name: string;
  colors: {
    primary: string;
  };
}

export default function ClientesPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<Customer | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper para interactuar con Frappe
  const callFrappeAPI = async <TResponse, TArgs extends Record<string, unknown> = Record<string, unknown>>(method: string, args: TArgs = {} as TArgs): Promise<TResponse> => {
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
      throw new Error(err._server_messages ? JSON.parse(err._server_messages).join("\n") : err.message || "Error al procesar la solicitud.");
    }
    const data = await response.json() as { message: TResponse };
    return data.message;
  };

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
      }
    }
    fetchConfig();
  }, []);

  // Validar rol de administrador
  useEffect(() => {
    if (currentUser) {
      const userEmail = currentUser;
      const isCashier = userEmail.startsWith("cajero.");
      const isProdUser = userEmail ? userEmail.startsWith("produccion@") : false;
      const isLogisticaUser = userEmail ? userEmail.startsWith("logistica@") : false;
      const isStaff = isCashier || isProdUser || isLogisticaUser || userEmail === "Administrator" || userEmail.includes("admin");

      if (!isStaff) {
        // Redirigir si es cliente normal
        router.push("/mayoristas");
      }
    } else if (!authLoading) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  const isAdmin = !!(currentUser && (currentUser === "Administrator" || currentUser.includes("admin") || currentUser.startsWith("admin.")));

  // Cargar clientes de la base de datos
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callFrappeAPI<Customer[]>("get_all_customers");
      setCustomers(res || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMsg(message || "Error al cargar la lista de clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCustomers();
    }
  }, [currentUser, isAdmin, fetchCustomers]);

  // Cargar historial del cliente seleccionado
  const loadHistory = async (customer: Customer) => {
    setSelectedHistoryCustomer(customer);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const res = await callFrappeAPI<HistoryData>("get_customer_orders_history", {
        customer_name: customer.name
      });
      setHistoryData(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMsg(message || "Error al obtener historial del cliente.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const cleanPhone = (phone?: string) => {
    if (!phone) return "";
    return phone.replace(/[^\d+]/g, ""); // Dejar solo números y el símbolo +
  };

  const getWhatsAppInvitationLink = (customer: Customer) => {
    if (!customer.mobile_no) return "#";
    const phone = customer.mobile_no.replace(/[^\d]/g, ""); // Dejar solo dígitos
    
    // Normalización local México
    let normalizedPhone = phone;
    if (phone.length === 10) {
      normalizedPhone = "52" + phone;
    }
    
    const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/mayoristas` : "";
    const pin = customer.custom_wholesale_access_pin || "------";
    const text = encodeURIComponent(
      `Hola *${customer.customer_name}*, ya podés realizar tus pedidos mayoristas ingresando a nuestro portal autogestionado: ${portalUrl}\n\n📱 *Celular registrado:* ${customer.mobile_no}\n🔑 *PIN de acceso:* ${pin}`
    );
    return `https://wa.me/${normalizedPhone}?text=${text}`;
  };

  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = c.customer_name.toLowerCase().includes(query);
    const phoneMatch = c.mobile_no && c.mobile_no.includes(query);
    const codeMatch = c.name.toLowerCase().includes(query);
    return nameMatch || phoneMatch || codeMatch;
  });

  const primaryColor = saasConfig?.colors?.primary || "#10b981"; // Esmeralda por defecto para clientes

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-emerald-500"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">Cargando Gestión de Clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-y-auto pb-32">
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-semibold flex items-center justify-between animate-fade-in">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-sm text-emerald-400 font-semibold flex items-center justify-between animate-fade-in">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {/* Buscador y Filtros */}
        <div className="bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl flex flex-row items-center gap-3 sm:gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente por razón social, celular o código..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/50 pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-slate-700 transition-all shadow-inner"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl px-4 sm:px-5 py-3.5 text-xs font-black text-white shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
            style={{ backgroundColor: primaryColor }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Registrar Cliente</span>
          </button>
        </div>

        {/* Listado en Grilla de Tarjetas */}
        {filteredCustomers.length === 0 ? (
          <div className="bg-slate-950 rounded-3xl border border-slate-850 p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
            <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-550">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-wider">No se encontraron clientes</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Escribí otro término de búsqueda o registra un cliente express nuevo.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map((c) => (
              <div 
                key={c.name}
                className="bg-slate-950 border border-slate-850 hover:border-slate-700/60 p-6 rounded-3xl shadow-xl flex flex-col justify-between gap-5 transition-all duration-300 hover:scale-[1.01]"
              >
                {/* Cabecera Tarjeta: Razón Social + Código */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      {c.name}
                    </span>
                    {c.territory && (
                      <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">
                        📍 {c.territory}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-white leading-snug pt-1 truncate">{c.customer_name}</h3>
                  <p className="text-xs text-slate-400 font-semibold truncate">
                    {c.email_id || "Sin correo electrónico"}
                  </p>
                </div>

                {/* Info celular */}
                <div className="p-3.5 bg-slate-900/60 border border-slate-850 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-350">
                  <span>Celular / WhatsApp:</span>
                  <span className="text-white font-black">{c.mobile_no || "No registrado"}</span>
                </div>

                {/* PIN de Acceso */}
                <div className="p-3.5 bg-slate-900/60 border border-slate-850 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-350">
                  <span>PIN de Acceso:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black font-mono tracking-widest bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {c.custom_wholesale_access_pin || "------"}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          setErrorMsg(null);
                          setSuccessMsg(null);
                          const res = await callFrappeAPI<{ success: boolean; pin: string }>("generate_customer_access_pin", { customer_name: c.name });
                          if (res && res.success) {
                            setSuccessMsg(`¡PIN generado con éxito para ${c.customer_name}! PIN: ${res.pin}`);
                            fetchCustomers();
                          }
                        } catch (err: unknown) {
                          const message = err instanceof Error ? err.message : String(err);
                          console.error(err);
                          setErrorMsg(message || "Error al generar PIN.");
                        }
                      }}
                      className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-xl transition-all cursor-pointer font-black"
                    >
                      {c.custom_wholesale_access_pin ? "🔄 Nuevo" : "➕ Generar"}
                    </button>
                  </div>
                </div>

                {/* Acciones de Contacto e Historial */}
                <div className="grid grid-cols-3 gap-2.5">
                  <a
                    href={getWhatsAppInvitationLink(c)}
                    onClick={(e) => {
                      if (!c.mobile_no) {
                        e.preventDefault();
                        setErrorMsg("Este cliente no posee número celular registrado.");
                      }
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-2xl py-3 text-[11px] font-black tracking-wider uppercase text-center flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md ${
                      c.mobile_no 
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                        : "bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.729-1.458L0 24zm6.59-4.846c1.666.988 3.311 1.5 5.353 1.51 5.483.004 9.948-4.456 9.951-9.934.002-2.652-1.03-5.148-2.902-7.022C17.159 1.83 14.672.799 12.02.799c-5.488 0-9.954 4.457-9.957 9.937a9.824 9.824 0 001.414 5.093l-.995 3.633 3.73-.976l.445.263z"/>
                    </svg>
                    <span>Invitar</span>
                  </a>

                  <a
                    href={c.mobile_no ? `tel:${cleanPhone(c.mobile_no)}` : "#"}
                    onClick={(e) => {
                      if (!c.mobile_no) {
                        e.preventDefault();
                        setErrorMsg("Este cliente no posee número celular registrado.");
                      }
                    }}
                    className={`rounded-2xl py-3 text-[11px] font-black tracking-wider uppercase text-center flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md ${
                      c.mobile_no 
                        ? "bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20" 
                        : "bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Llamar</span>
                  </a>

                  <button
                    onClick={() => loadHistory(c)}
                    className="rounded-2xl bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white py-3 text-[11px] font-black tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Historial</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL REGISTRO CLIENTE EXPRESS (COMPONENTE COMPARTIDO) */}
      <ExpressCustomerModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        primaryColor={primaryColor}
        callFrappeAPI={callFrappeAPI}
        onSelectCustomer={(customerName) => {
          setSuccessMsg(`Cliente "${customerName}" registrado y seleccionado con éxito.`);
          fetchCustomers();
        }}
      />

      {/* MODAL HISTORIAL DE CONSUMOS */}
      {selectedHistoryCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl space-y-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  📊 Historial de Consumo
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase">
                  {selectedHistoryCustomer.customer_name} ({selectedHistoryCustomer.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryCustomer(null)}
                className="text-slate-450 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {historyLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-emerald-500"></div>
                <p className="text-xs text-slate-450 font-bold tracking-wider uppercase animate-pulse">Obteniendo datos de ERPNext...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {/* 1. Pedidos Recientes (Sales Orders) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest px-1">📦 Pedidos Mayoristas Recientes (Sales Orders)</h4>
                  {historyData?.orders?.length === 0 ? (
                    <p className="text-xs text-slate-500 font-semibold italic p-4 bg-slate-950/40 border border-slate-900 rounded-2xl">
                      No hay pedidos registrados para este cliente.
                    </p>
                  ) : (
                    <div className="border border-slate-850 rounded-2xl overflow-x-auto bg-slate-950/30">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3 text-right">Monto Total</th>
                            <th className="px-4 py-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-xs font-semibold text-slate-300">
                          {historyData?.orders?.map((o) => (
                            <tr key={o.name} className="hover:bg-slate-900/40">
                              <td className="px-4 py-3 font-bold text-white">{o.name}</td>
                              <td className="px-4 py-3 text-slate-400">{o.transaction_date}</td>
                              <td className="px-4 py-3 text-right font-black text-white">${o.grand_total.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  o.status === "Completed" 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                    : o.status === "On Hold" 
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                }`}>
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 2. Facturas y Saldos (Sales Invoices) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-teal-400 uppercase tracking-widest px-1">💳 Historial de Facturación y Cobro (Sales Invoices)</h4>
                  {historyData?.invoices?.length === 0 ? (
                    <p className="text-xs text-slate-500 font-semibold italic p-4 bg-slate-950/40 border border-slate-900 rounded-2xl">
                      No hay facturas emitidas para este cliente.
                    </p>
                  ) : (
                    <div className="border border-slate-850 rounded-2xl overflow-x-auto bg-slate-950/30">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            <th className="px-4 py-3">Factura</th>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3 text-right">Monto</th>
                            <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                            <th className="px-4 py-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-xs font-semibold text-slate-300">
                          {historyData?.invoices?.map((i) => (
                            <tr key={i.name} className="hover:bg-slate-900/40">
                              <td className="px-4 py-3 font-bold text-white">{i.name}</td>
                              <td className="px-4 py-3 text-slate-400">{i.posting_date}</td>
                              <td className="px-4 py-3 text-right font-black text-white">${i.grand_total.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right">
                                {i.outstanding_amount > 0 ? (
                                  <span className="font-black text-rose-400">${i.outstanding_amount.toFixed(2)}</span>
                                ) : (
                                  <span className="font-bold text-slate-500">$0.00</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  i.status === "Paid" 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                                }`}>
                                  {i.status === "Paid" ? "Cobrado" : "Por Cobrar"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-850 pt-4 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedHistoryCustomer(null)}
                className="rounded-2xl bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 hover:text-white px-5 py-3 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-inner"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
