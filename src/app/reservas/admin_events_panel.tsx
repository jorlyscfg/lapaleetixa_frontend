"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CustomSelect } from "../components/custom_select";

interface OrderItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
}

interface EventBooking {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string;
  grand_total: number;
  advance_paid: number;
  status: string;
  items: OrderItem[];
}

interface EventWarehouse {
  name: string;
  warehouse_name: string;
}

interface AdminEventsPanelProps {
  primaryColor: string;
  callFrappeAPI: (method: string, args?: Record<string, unknown>) => Promise<unknown>;
}

export default function AdminEventsPanel({ primaryColor, callFrappeAPI }: AdminEventsPanelProps) {
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [warehouses, setWarehouses] = useState<EventWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [processingBooking, setProcessingBooking] = useState<string | null>(null);

  // Almacén seleccionado por pedido (name -> warehouse_name)
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({});

  // Modal de confirmación de facturación/pago
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<EventBooking | null>(null);
  const [registerPayment, setRegisterPayment] = useState(true);
  const [paymentMode, setPaymentMode] = useState("Cash");

  // Modal de cancelación
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<EventBooking | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const pendingBookings = (await callFrappeAPI("get_pending_event_bookings")) as EventBooking[];
      setBookings(pendingBookings || []);

      const activeWarehouses = (await callFrappeAPI("get_event_warehouses")) as EventWarehouse[];
      setWarehouses(activeWarehouses || []);

      // Inicializar almacenes seleccionados con el por defecto
      const initialWhs: Record<string, string> = {};
      if (pendingBookings) {
        const defaultWh = (activeWarehouses && activeWarehouses.length > 0)
          ? (activeWarehouses.find((wh: EventWarehouse) => wh.name.toLowerCase().includes("distribucion"))?.name || activeWarehouses[0].name)
          : "";
        pendingBookings.forEach((b: EventBooking) => {
          initialWhs[b.name] = defaultWh;
        });
      }
      setSelectedWarehouses(initialWhs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMessage(message || "Error al cargar los datos del panel de administración.");
    } finally {
      setLoading(false);
    }
  }, [callFrappeAPI]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleWarehouseChange = (bookingName: string, warehouseName: string) => {
    setSelectedWarehouses((prev) => ({
      ...prev,
      [bookingName]: warehouseName
    }));
  };

  const handleOpenConfirm = (booking: EventBooking) => {
    setSelectedBooking(booking);
    setRegisterPayment(true);
    setPaymentMode("Cash");
    setShowConfirmModal(true);
  };

  const handleCompleteBooking = async () => {
    if (!selectedBooking) return;
    const defaultWh = warehouses.find((wh) => wh.name.toLowerCase().includes("distribucion"))?.name || warehouses[0]?.name || "";
    const chosenWarehouse = selectedWarehouses[selectedBooking.name] || defaultWh;
    setProcessingBooking(selectedBooking.name);
    setShowConfirmModal(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = (await callFrappeAPI("complete_event_booking", {
        sales_order_name: selectedBooking.name,
        register_payment: registerPayment ? 1 : 0,
        payment_mode: paymentMode,
        warehouse: chosenWarehouse
      })) as { sales_invoice: string; advance_paid: number };

      setSuccessMessage(
        `¡Reserva ${selectedBooking.name} completada y facturada con éxito! Factura: ${res.sales_invoice}. ` +
        (res.advance_paid > 0 ? `Cobro de saldo registrado (${res.advance_paid.toFixed(2)} MXN).` : "Factura registrada a crédito.")
      );

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMessage(message || `Error al completar la reserva de evento ${selectedBooking.name}.`);
    } finally {
      await fetchData();
      setProcessingBooking(null);
      setSelectedBooking(null);
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    setProcessingBooking(bookingToCancel.name);
    setShowCancelModal(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await callFrappeAPI("cancel_event_booking", {
        sales_order_name: bookingToCancel.name
      });

      setSuccessMessage(`¡Reserva ${bookingToCancel.name} cancelada con éxito y carrito liberado para esa fecha!`);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMessage(message || `Error al cancelar la reserva ${bookingToCancel.name}.`);
    } finally {
      await fetchData();
      setProcessingBooking(null);
      setBookingToCancel(null);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedBooking(expandedBooking === name ? null : name);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-sky-500"></div>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">Cargando Reservas Pendientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full px-6 py-4">
      
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-sm text-emerald-400 font-semibold flex items-center justify-between shadow-md">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}
      
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-semibold flex items-center justify-between shadow-md">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-850 pb-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Reservas de Eventos Pendientes
            </h3>
            <p className="text-xs text-slate-450 mt-1 font-semibold">
              Gestione las reservas recibidas. Puede facturar y descontar el inventario de helados asignando el Carrito correspondiente.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="text-slate-400 hover:text-white p-2 rounded-xl border border-slate-850 hover:bg-slate-900 transition-all active:scale-95 cursor-pointer"
            title="Refrescar Lista"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {bookings.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-550 font-black uppercase tracking-wider">
            🎉 ¡No hay reservas de eventos pendientes de confirmar!
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const isExpanded = expandedBooking === booking.name;
              const isProcessing = processingBooking === booking.name;
              const defaultWh = warehouses.find((wh) => wh.name.toLowerCase().includes("distribucion"))?.name || warehouses[0]?.name || "";
              const currentWh = selectedWarehouses[booking.name] || defaultWh;
              const pendingAmount = booking.grand_total - booking.advance_paid;

              return (
                <div
                  key={booking.name}
                  className={`border rounded-2xl transition-all ${
                    isExpanded 
                      ? "border-slate-750 bg-slate-900/30" 
                      : "border-slate-850/60 bg-slate-900/10 hover:bg-slate-900/20"
                  }`}
                >
                  {/* Encabezado del Pedido */}
                  <div
                    onClick={() => toggleExpand(booking.name)}
                    className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">{booking.customer_name}</span>
                        <span className="text-[10px] text-slate-500 font-bold">({booking.name})</span>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          Reserva Activa
                        </span>
                      </div>
                      
                      <div className="flex gap-4 text-[10px] text-slate-450 font-bold">
                        <span>F. Pedido: {booking.transaction_date}</span>
                        <span className="text-sky-400">F. Evento: {booking.delivery_date}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between xl:justify-end gap-6">
                      
                      <div className="text-left w-44 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] text-slate-455 font-black uppercase tracking-wider block mb-1">
                          Almacén de Stock
                        </span>
                        <CustomSelect
                          value={currentWh}
                          onChange={(val) => handleWarehouseChange(booking.name, val)}
                          options={warehouses.map((wh) => ({
                            value: wh.name,
                            label: wh.warehouse_name
                          }))}
                        />
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-450 font-black uppercase tracking-wider block">Anticipo Cobrado</span>
                        <span className="text-xs font-black text-emerald-400">
                          ${booking.advance_paid.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-right font-sans">
                        <span className="text-[9px] text-slate-450 font-black uppercase tracking-wider block">Diferencia Pendiente</span>
                        <span className={`text-xs font-black ${pendingAmount > 0 ? "text-amber-400" : "text-slate-400"}`}>
                          ${pendingAmount.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-450 font-black uppercase tracking-wider block">Monto Total</span>
                        <span className="text-sm font-black text-white">
                          ${booking.grand_total.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botón Confirmar y Facturar */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConfirm(booking);
                          }}
                          disabled={isProcessing}
                          className="rounded-xl px-4 py-2 text-xs font-black text-white transition-all active:scale-95 cursor-pointer shadow-md whitespace-nowrap disabled:opacity-40"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {isProcessing ? "Procesando..." : "Completar y Facturar"}
                        </button>

                        {/* Botón de Cancelación */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookingToCancel(booking);
                            setShowCancelModal(true);
                          }}
                          disabled={isProcessing}
                          className="rounded-xl p-2.5 text-xs font-black bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center border border-red-600/20"
                          title="Cancelar Reserva"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        
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

                  {/* Detalle Expandible */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-850/60 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450">Detalle de Productos Reservados</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {booking.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-slate-200"
                          >
                            <div>
                              <span className="text-white block truncate max-w-[180px]">{item.item_name}</span>
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

      {/* MODAL DE CONFIRMACIÓN DE COMPLETAR EVENTO */}
      {showConfirmModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">🍦 Completar y Facturar Evento</h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-450 hover:text-slate-700 dark:text-slate-455 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-100 dark:bg-slate-950/60 rounded-2xl space-y-2 border border-slate-300 dark:border-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <p><strong>Cliente:</strong> {selectedBooking.customer_name}</p>
                <p><strong>Reserva:</strong> {selectedBooking.name}</p>
                <p><strong>Total Reserva:</strong> ${selectedBooking.grand_total.toFixed(2)}</p>
                <p><strong>Anticipo Abonado:</strong> ${selectedBooking.advance_paid.toFixed(2)}</p>
                <p className="pt-1.5 border-t border-slate-200 dark:border-slate-850 mt-1.5 text-slate-900 dark:text-white font-black">
                  <strong>Saldo Pendiente:</strong> ${(selectedBooking.grand_total - selectedBooking.advance_paid).toFixed(2)} MXN
                </p>
                <p className="text-sky-600 dark:text-sky-400 font-bold"><strong>Almacén de Stock:</strong> {selectedWarehouses[selectedBooking.name] || (warehouses.find((wh) => wh.name.toLowerCase().includes("distribucion"))?.name || warehouses[0]?.name || "")}</p>
              </div>

              {/* Registro de Cobro de saldo pendiente */}
              {(selectedBooking.grand_total - selectedBooking.advance_paid) > 0 && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={registerPayment}
                      onChange={(e) => setRegisterPayment(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-sky-500 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">¿Registrar Pago del Saldo Pendiente?</span>
                  </label>
                  
                  {registerPayment && (
                    <div className="space-y-2 pt-1.5">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Forma de Pago</span>
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
                                  : "bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-850 text-slate-655 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
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
              )}
              
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] text-amber-600 dark:text-amber-400 leading-normal font-semibold">
                ℹ️ Al confirmar se generará una **Factura de Venta (Sales Invoice)** con `update_stock = 1`. El stock de helados se descontará del almacén seleccionado.
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
                onClick={handleCompleteBooking}
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
      {showCancelModal && bookingToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">⚠️ Cancelar Reserva de Evento</h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-450 hover:text-slate-700 dark:text-slate-455 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-700 dark:text-slate-350 leading-relaxed font-semibold">
                ¿Estás seguro de que deseas cancelar y eliminar permanentemente la reserva <strong>{bookingToCancel.name}</strong> de <strong>{bookingToCancel.customer_name}</strong>?
              </p>
              
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-600 dark:text-red-400 leading-normal font-semibold">
                🚨 Esta acción cancelará y borrará el pedido de venta en ERPNext, liberando de inmediato la disponibilidad del carrito de paletas y el stock reservado para esa fecha específica.
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
                onClick={handleCancelBooking}
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
