"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import React, { useState, useEffect } from "react";
import { useFrappeGetDocList } from "frappe-react-sdk";
import { useSaaSConfig } from "../providers";

interface OrderItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
}

interface WholesaleOrder {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string;
  grand_total: number;
  custom_metodo_pago: string;
  custom_metodo_entrega: string;
  status: string;
  items: OrderItem[];
  contact_phone?: string;
}

interface AdminOrdersPanelProps {
  primaryColor: string;
  callFrappeAPI: (method: string, args?: any) => Promise<any>;
}

export default function AdminOrdersPanel({ primaryColor, callFrappeAPI }: AdminOrdersPanelProps) {
  const { saasConfig } = useSaaSConfig();
  const { data: dbWarehouses } = useFrappeGetDocList("Warehouse", {
    fields: ["name"],
    filters: saasConfig?.client_name ? [
      ["company", "=", saasConfig.client_name],
      ["is_group", "=", 0],
      ["disabled", "=", 0]
    ] : undefined,
    limit: 100
  });

  const defaultWarehouse = dbWarehouses?.find((w: any) => w.name.toLowerCase().includes("distribucion"))?.name 
    || dbWarehouses?.[0]?.name 
    || "";

  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  // Modal de confirmación de pago
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WholesaleOrder | null>(null);
  const [registerPayment, setRegisterPayment] = useState(true);
  const [paymentMode, setPaymentMode] = useState("Cash");

  // Modal de cancelación de pedido
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<WholesaleOrder | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await callFrappeAPI("get_pending_wholesale_orders");
      setOrders(res || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al cargar los pedidos pendientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Configurar polling automático cada 10 segundos en segundo plano (silencioso para no parpadear el spinner principal)
    const interval = setInterval(() => {
      callFrappeAPI("get_pending_wholesale_orders")
        .then((res) => {
          if (res) {
            setOrders(res);
          }
        })
        .catch((err) => console.error("Error en auto-polling de pedidos mayoristas:", err));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenConfirm = (order: WholesaleOrder) => {
    setSelectedOrder(order);
    setRegisterPayment(true);
    // Asignar por defecto el método de pago elegido por el cliente
    setPaymentMode(order.custom_metodo_pago === "Efectivo" ? "Cash" : "Bank Draft");
    setShowConfirmModal(true);
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;
    setProcessingOrder(selectedOrder.name);
    setShowConfirmModal(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await callFrappeAPI("complete_wholesale_order", {
        sales_order_name: selectedOrder.name,
        register_payment: registerPayment ? 1 : 0,
        payment_mode: paymentMode,
        warehouse: defaultWarehouse
      });

      setSuccessMessage(
        `¡Pedido ${selectedOrder.name} completado y facturado con éxito! Factura: ${res.sales_invoice}. ` +
        (res.advance_paid > 0 ? "Cobro registrado de inmediato." : "Factura registrada a crédito.")
      );
      
      // Actualizar listado
      await fetchOrders();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || `Error al completar el pedido ${selectedOrder.name}.`);
    } finally {
      setProcessingOrder(null);
      setSelectedOrder(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    setProcessingOrder(orderToCancel.name);
    setShowCancelModal(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await callFrappeAPI("cancel_wholesale_order", {
        sales_order_name: orderToCancel.name
      });

      setSuccessMessage(`¡Pedido ${orderToCancel.name} cancelado con éxito y existencias liberadas!`);
      await fetchOrders();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || `Error al cancelar el pedido ${orderToCancel.name}.`);
    } finally {
      setProcessingOrder(null);
      setOrderToCancel(null);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedOrder(expandedOrder === name ? null : name);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-sky-500"></div>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">Cargando Pedidos Pendientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-sm text-emerald-400 font-semibold flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}
      
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-850 pb-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
              Pedidos Mayoristas Recibidos
            </h3>
            <p className="text-xs text-slate-450 mt-1 font-semibold">
              Aquí aparecen los pedidos registrados por tus clientes desde su portal. Podés facturarlos y cobrarlos en un solo paso.
            </p>
          </div>
          <button
            onClick={fetchOrders}
            className="text-slate-400 hover:text-white p-2 rounded-xl border border-slate-850 hover:bg-slate-900 transition-all active:scale-95 cursor-pointer"
            title="Refrescar Lista"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
            🎉 ¡No hay pedidos mayoristas pendientes!
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isExpanded = expandedOrder === order.name;
              const isProcessing = processingOrder === order.name;
              
              return (
                <div
                  key={order.name}
                  className={`border rounded-2xl transition-all ${
                    isExpanded 
                      ? "border-slate-750 bg-slate-900/30" 
                      : "border-slate-850/60 bg-slate-900/10 hover:bg-slate-900/20"
                  }`}
                >
                  {/* Encabezado del Pedido */}
                  <div
                    onClick={() => toggleExpand(order.name)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-white">{order.customer_name}</span>
                        <span className="text-[10px] text-slate-500 font-bold">({order.name})</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-850 border border-slate-800 text-slate-350">
                          {order.custom_metodo_entrega}
                        </span>
                        {order.contact_phone && (
                          <a
                            href={`https://wa.me/${order.contact_phone.replace(/[^\d+]/g, "")}?text=${encodeURIComponent(
                              `Hola ${order.customer_name}, te escribo de ${saasConfig?.company_name || saasConfig?.client_name || "nuestra empresa"} para coordinar los detalles de tu pedido mayorista ${order.name}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-[9px] font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-lg transition-all"
                            title="Chatear con el cliente en WhatsApp"
                          >
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                              <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.37 4.982L2 22l5.164-1.354a9.938 9.938 0 004.843 1.251h.004c5.507 0 10.011-4.479 10.012-9.985A9.98 9.98 0 0012.012 2zm5.856 14.195c-.32.9-1.577 1.636-2.184 1.713-.538.069-1.077.292-3.46-.649-3.05-1.202-4.996-4.309-5.148-4.512-.152-.203-1.233-1.636-1.233-3.118a3.17 3.17 0 011.002-2.355c.292-.292.639-.365.854-.365.176 0 .352.008.508.016.166.008.388-.063.608.468.225.545.766 1.865.832 1.996.066.132.11.285.022.456-.088.176-.132.285-.264.44-.132.155-.278.347-.396.467-.132.132-.27.276-.116.541.155.265.688 1.134 1.47 1.83.999.889 1.84 1.164 2.106 1.296.265.132.418.11.572-.066.155-.176.66-.767.838-1.026.176-.259.352-.22.596-.132.242.088 1.543.727 1.807.859.264.132.44.198.506.31.066.11.066.64-.253 1.542z"/>
                            </svg>
                            <span>{order.contact_phone}</span>
                          </a>
                        )}
                      </div>
                      
                      <div className="flex gap-4 text-[10px] text-slate-450 font-bold">
                        <span>F. Pedido: {order.transaction_date}</span>
                        <span>F. Entrega: {order.delivery_date}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 w-full sm:w-auto border-t border-slate-850/40 pt-4 sm:border-none sm:pt-0">
                      {/* Grid de Pago y Monto en móvil */}
                      <div className="flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-left sm:text-right">
                          <span className="text-[9px] text-slate-450 font-black uppercase tracking-wider block">Método de Pago</span>
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                            {order.custom_metodo_pago}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] text-slate-450 font-black uppercase tracking-wider block">Monto Total</span>
                          <span className="text-sm font-black text-white">
                            ${order.grand_total.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        {/* Botón de Acción Principal */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConfirm(order);
                          }}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-initial rounded-xl px-4 py-2.5 text-xs font-black text-white transition-all active:scale-95 cursor-pointer shadow-md whitespace-nowrap disabled:opacity-40 text-center"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {isProcessing ? "Procesando..." : "Confirmar y Entregar"}
                        </button>

                        {/* Botón de Cancelación (Borrar) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderToCancel(order);
                            setShowCancelModal(true);
                          }}
                          disabled={isProcessing}
                          className="rounded-xl p-2.5 text-xs font-black bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center border border-red-700/20"
                          title="Cancelar y Eliminar Pedido"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        
                        {/* Icono de Expansión */}
                        <svg
                          className={`h-4 w-4 text-slate-450 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo Expandible (Sabores y cantidades) */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 border-t border-slate-850/60 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450">Detalle de Sabores Solicitados</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-slate-200"
                          >
                            <div>
                              <span className="text-white block">{item.item_name}</span>
                              <span className="text-[9px] text-slate-500">Cód: {item.item_code}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-white block">{item.qty} pzs</span>
                              <span className="text-[10px] text-slate-400">${item.rate.toFixed(2)} / pz</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ENTREGA Y PAGO */}
      {showConfirmModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">📦 Confirmar y Entregar Pedido</h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-450 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 rounded-2xl space-y-2 border border-slate-850 text-xs font-semibold text-slate-300">
                <p><strong>Cliente:</strong> {selectedOrder.customer_name}</p>
                <p><strong>Pedido:</strong> {selectedOrder.name}</p>
                <p><strong>Total:</strong> ${selectedOrder.grand_total.toFixed(2)}</p>
                <p><strong>Método Entrega:</strong> {selectedOrder.custom_metodo_entrega}</p>
              </div>

              {/* Registro de Cobro */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={registerPayment}
                    onChange={(e) => setRegisterPayment(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-black uppercase tracking-wider text-white">¿Registrar Pago Inmediato?</span>
                </label>
                
                {registerPayment && (
                  <div className="space-y-2 pt-1.5">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-405">Forma de Pago en ERPNext</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { mode: "Cash", label: "Efectivo" },
                        { mode: "Bank Draft", label: "Transferencia" },
                        { mode: "Credit Card", label: "Tarjeta" }
                      ].map((item) => {
                        const isSelected = paymentMode === item.mode;
                        return (
                          <button
                            key={item.mode}
                            type="button"
                            onClick={() => setPaymentMode(item.mode)}
                            className={`rounded-xl py-2.5 text-[10px] font-bold transition-all border active:scale-95 ${
                              isSelected
                                ? "text-white"
                                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
                            }`}
                            style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] text-amber-400 leading-normal font-semibold">
                ℹ️ Al confirmar se generará una **Factura de Venta** vinculada con `update_stock = 1`, la cual deducirá el inventario de **{defaultWarehouse.split(" - ")[0]}** de inmediato.
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-2xl py-3.5 text-xs font-black text-slate-300 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleCompleteOrder}
                className="w-1/2 rounded-2xl py-3.5 text-xs font-black text-white shadow-xl transition-all cursor-pointer hover:brightness-110"
                style={{ backgroundColor: primaryColor }}
              >
                Confirmar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
      {showCancelModal && orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">⚠️ Cancelar Pedido</h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-450 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                ¿Estás seguro de que querés cancelar y eliminar el pedido <strong>{orderToCancel.name}</strong> de <strong>{orderToCancel.customer_name}</strong>?
              </p>
              
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-400 leading-normal font-semibold">
                🚨 Esta acción cancelará la reserva del inventario, restaurando la disponibilidad de los productos asociados inmediatamente.
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-2xl py-3.5 text-xs font-black text-slate-300 transition-all cursor-pointer"
              >
                Cerrar
              </button>
              
              <button
                type="button"
                onClick={handleCancelOrder}
                className="w-1/2 bg-red-600 hover:bg-red-500 rounded-2xl py-3.5 text-xs font-black text-white shadow-xl transition-all cursor-pointer"
              >
                Sí, Cancelar y Liberar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
