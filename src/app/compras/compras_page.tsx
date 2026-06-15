"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useFrappeAuth } from "frappe-react-sdk";
import { useSaaSConfig } from "../providers";
import { CustomSelect } from "../components/custom_select";

type Tab = "proveedores" | "nueva-compra" | "historial";

interface Supplier {
  name: string;
  supplier_name: string;
  supplier_group: string;
  mobile_no: string;
  email_id: string;
  total_orders: number;
  total_amount: number;
  last_purchase_date: string | null;
}

interface PurchaseItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
}

interface AvailableItem {
  name: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  image: string;
  standard_rate: number;
}

interface Warehouse {
  name: string;
  warehouse_name: string;
}

interface PurchaseOrder {
  name: string;
  supplier: string;
  supplier_name: string;
  transaction_date: string;
  grand_total: number;
  net_total: number;
  docstatus: number;
  per_received: number;
  status: string;
  display_status: string;
  items_count: number;
}

interface PurchaseDetail {
  name: string;
  supplier: string;
  supplier_name: string;
  transaction_date: string;
  grand_total: number;
  net_total: number;
  total_taxes_and_charges: number;
  remarks: string;
  display_status: string;
  items: { item_code: string; item_name: string; qty: number; rate: number; amount: number; warehouse: string; uom: string }[];
  receipts: { name: string; date: string }[];
}

export default function ComprasPage() {
  const { currentUser } = useFrappeAuth();
  const { saasConfig } = useSaaSConfig();
  const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";

  const getWarehouseLabel = (name: string) => {
    const cleanName = name.split(" - ")[0];
    if (cleanName.startsWith("Fabrica")) return `🏭 ${cleanName}`;
    if (cleanName.startsWith("Distribucion")) return `📦 ${cleanName}`;
    if (cleanName.startsWith("Sucursal")) return `🍦 ${cleanName}`;
    return `🏪 ${cleanName}`;
  };

  const [activeTab, setActiveTab] = useState<Tab>("proveedores");
  const [loading, setLoading] = useState(false);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);

  // New Purchase state
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [submittingPurchase, setSubmittingPurchase] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ po: string; pr: string; total: number } | null>(null);

  // History state
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrder[]>([]);
  const [historyFilter, setHistoryFilter] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<PurchaseDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ──────────── DATA FETCHING ────────────

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_suppliers`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.message || []);
      }
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  }, [url]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_items_for_purchase`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data.message || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  }, [url]);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_warehouses_for_purchase`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const whs = data.message || [];
        setWarehouses(whs);
        if (whs.length > 0 && !selectedWarehouse) setSelectedWarehouse(whs[0].name);
      }
    } catch (err) {
      console.error("Error fetching warehouses:", err);
    }
  }, [url, selectedWarehouse]);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (historyFilter) params.set("supplier", historyFilter);
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_purchase_history?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPurchaseHistory(data.message?.orders || []);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  }, [url, historyFilter]);

  useEffect(() => {
    if (!currentUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([fetchSuppliers(), fetchItems(), fetchWarehouses(), fetchHistory()])
      .finally(() => setLoading(false));
  }, [currentUser, fetchSuppliers, fetchItems, fetchWarehouses, fetchHistory]);

  // ──────────── ACTIONS ────────────

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setSavingSupplier(true);
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.create_supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplier_name: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || null,
          email: newSupplierEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.message?.success) {
        showToast(`Proveedor "${newSupplierName}" creado exitosamente`);
        setShowNewSupplierModal(false);
        setNewSupplierName("");
        setNewSupplierPhone("");
        setNewSupplierEmail("");
        fetchSuppliers();
      } else {
        showToast(data.exc || "Error al crear proveedor", "error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(message || "Error al crear proveedor", "error");
    } finally {
      setSavingSupplier(false);
    }
  };

  const addItemToPurchase = (item: AvailableItem) => {
    if (purchaseItems.find((p) => p.item_code === item.name)) return;
    setPurchaseItems([...purchaseItems, { item_code: item.name, item_name: item.item_name, qty: 1, rate: item.standard_rate || 0 }]);
    setItemSearch("");
  };

  const removeItemFromPurchase = (itemCode: string) => {
    setPurchaseItems(purchaseItems.filter((p) => p.item_code !== itemCode));
  };

  const updatePurchaseItem = (itemCode: string, field: "qty" | "rate", value: number) => {
    setPurchaseItems(purchaseItems.map((p) => (p.item_code === itemCode ? { ...p, [field]: value } : p)));
  };

  const purchaseTotal = purchaseItems.reduce((sum, p) => sum + p.qty * p.rate, 0);

  const handleSubmitPurchase = async () => {
    if (!selectedSupplier) { showToast("Seleccioná un proveedor", "error"); return; }
    if (purchaseItems.length === 0) { showToast("Agregá al menos un producto", "error"); return; }
    if (!selectedWarehouse) { showToast("Seleccioná un almacén destino", "error"); return; }

    setSubmittingPurchase(true);
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.create_purchase_and_receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplier: selectedSupplier,
          items: purchaseItems.map((p) => ({ item_code: p.item_code, qty: p.qty, rate: p.rate })),
          warehouse: selectedWarehouse,
          notes: purchaseNotes || null,
        }),
      });
      const data = await res.json();
      if (data.message?.success) {
        setPurchaseSuccess({ po: data.message.purchase_order, pr: data.message.purchase_receipt, total: data.message.grand_total });
        showToast("¡Compra registrada y mercancía recibida exitosamente!");
        // Reset form
        setSelectedSupplier("");
        setPurchaseItems([]);
        setPurchaseNotes("");
        fetchHistory();
        fetchSuppliers();
      } else {
        const errMsg = data._server_messages ? JSON.parse(data._server_messages)?.[0] : "Error al registrar la compra";
        const parsed = typeof errMsg === "string" ? (() => { try { return JSON.parse(errMsg); } catch { return null; } })() : errMsg;
        showToast(parsed?.message || errMsg || "Error al registrar la compra", "error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(message || "Error al registrar la compra", "error");
    } finally {
      setSubmittingPurchase(false);
    }
  };

  const handleViewDetail = async (poName: string) => {
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_purchase_detail?po_name=${poName}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedDetail(data.message || null);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error("Error fetching detail:", err);
    }
  };

  const handleCancelPurchase = async (poName: string) => {
    try {
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.cancel_purchase_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ po_name: poName }),
      });
      const data = await res.json();
      if (data.message?.success) {
        showToast("Compra cancelada. El stock fue revertido.");
        setShowCancelConfirm(null);
        setShowDetailModal(false);
        fetchHistory();
        fetchSuppliers();
      } else {
        showToast("Error al cancelar", "error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(message || "Error al cancelar", "error");
    }
  };

  // ──────────── FILTERED DATA ────────────

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.mobile_no || "").includes(supplierSearch)
  );

  const filteredAvailableItems = availableItems.filter(
    (i) =>
      i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      i.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  // ──────────── CURRENCY FORMAT ────────────
  const currency = saasConfig?.custom_currency || "MXN";
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

  // ──────────── RENDER ────────────

  if (!currentUser) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "proveedores",
      label: "Proveedores",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: "nueva-compra",
      label: "Nueva Compra",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
    },
    {
      key: "historial",
      label: "Historial",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Background ambiance */}
      <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none"></div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-[100] rounded-2xl border px-5 py-3.5 text-sm font-semibold shadow-2xl backdrop-blur-xl animate-fade-in ${
          toast.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Main content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-4 sm:space-y-6 overflow-hidden flex-1 relative z-10">

        {/* Tab bar */}
        <div className="tab-container flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setPurchaseSuccess(null); }}
              className={`tab-button flex items-center gap-2 ${activeTab === tab.key ? "active" : ""}`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20 flex-shrink-0">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-amber-500"></div>
          </div>
        )}

        {/* ═══════════ TAB: PROVEEDORES ═══════════ */}
        {!loading && activeTab === "proveedores" && (
          <div className="space-y-6 overflow-y-auto flex-1 pr-1 pb-24">
            <div className="flex flex-col gap-4 bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl sm:flex-row sm:items-center sm:justify-between w-full">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full sm:w-auto">
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    placeholder="Buscar proveedor..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700 font-semibold"
                  />
                  <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSupplierModal(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/10 hover:bg-amber-600 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Proveedor
              </button>
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-12 text-center shadow-xl">
                <svg className="mx-auto h-12 w-12 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-slate-500 font-medium">No hay proveedores registrados</p>
                <p className="text-xs text-slate-600 mt-1">Creá tu primer proveedor para empezar a registrar compras</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSuppliers.map((s) => (
                  <div
                    key={s.name}
                    className="group rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-lg flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-2xl"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-sm">
                          {s.supplier_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">{s.supplier_name}</h3>
                          {s.supplier_group && s.supplier_group !== "All Supplier Groups" && (
                            <span className="text-[10px] text-slate-500 font-bold">{s.supplier_group}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {s.mobile_no && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 font-semibold">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {s.mobile_no}
                      </div>
                    )}
                    {s.email_id && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3 font-semibold">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {s.email_id}
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-3 border-t border-slate-850">
                      <div className="text-center flex-1">
                        <p className="text-lg font-black text-white">{s.total_orders}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compras</p>
                      </div>
                      <div className="w-px h-8 bg-slate-850"></div>
                      <div className="text-center flex-1">
                        <p className="text-lg font-black text-amber-400">{fmt(s.total_amount)}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ TAB: NUEVA COMPRA ═══════════ */}
        {!loading && activeTab === "nueva-compra" && (
          <div className="space-y-6 overflow-y-auto flex-1 pr-1 pb-24">
            {purchaseSuccess ? (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-4 backdrop-blur-sm">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-black text-white">¡Compra Registrada!</h3>
                <p className="text-sm text-slate-400">La mercancía fue recibida y el stock actualizado automáticamente.</p>
                <div className="flex gap-6 justify-center text-sm">
                  <div>
                    <span className="text-slate-500">Orden: </span>
                    <span className="font-bold text-white">{purchaseSuccess.po}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Recepción: </span>
                    <span className="font-bold text-white">{purchaseSuccess.pr}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Total: </span>
                    <span className="font-bold text-amber-400">{fmt(purchaseSuccess.total)}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setPurchaseSuccess(null); setActiveTab("historial"); }}
                  className="mt-4 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
                >
                  Ver Historial
                </button>
              </div>
            ) : (
              <>
                {/* Step 1: Supplier */}
                <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-550 mb-2">
                    1. Proveedor
                  </label>
                  <CustomSelect
                    value={selectedSupplier}
                    onChange={(val) => setSelectedSupplier(val)}
                    options={[
                      { value: "", label: "Seleccionar proveedor..." },
                      ...suppliers.map((s) => ({ value: s.name, label: s.supplier_name }))
                    ]}
                  />
                </div>

                {/* Step 2: Items */}
                <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-550 mb-2">
                    2. Productos
                  </label>

                  <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="Buscar producto para agregar..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-slate-700 focus:outline-none transition-all font-semibold"
                    />
                    {itemSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-2xl z-30">
                        {filteredAvailableItems.slice(0, 10).map((item) => (
                          <button
                            key={item.name}
                            onClick={() => addItemToPurchase(item)}
                            disabled={!!purchaseItems.find((p) => p.item_code === item.name)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-900 transition-colors flex items-center justify-between disabled:opacity-30 cursor-pointer"
                          >
                            <span className="text-white font-medium">{item.item_name}</span>
                            <span className="text-xs text-slate-500">{item.item_group}</span>
                          </button>
                        ))}
                        {filteredAvailableItems.length === 0 && (
                          <p className="px-4 py-3 text-xs text-slate-500">No se encontraron productos</p>
                        )}
                      </div>
                    )}
                  </div>

                  {purchaseItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 mb-1">
                        <span className="col-span-5">Producto</span>
                        <span className="col-span-2 text-center">Cantidad</span>
                        <span className="col-span-2 text-center">Costo Unit.</span>
                        <span className="col-span-2 text-right">Subtotal</span>
                        <span className="col-span-1"></span>
                      </div>
                      {purchaseItems.map((p) => (
                        <div key={p.item_code} className="grid grid-cols-12 gap-2 items-center rounded-xl bg-slate-900/50 border border-slate-800/50 px-3 py-2.5">
                          <span className="col-span-5 text-sm font-medium text-white truncate">{p.item_name}</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={p.qty}
                            onChange={(e) => updatePurchaseItem(p.item_code, "qty", Math.max(1, Number(e.target.value)))}
                            className="col-span-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-sm text-white text-center outline-none focus:border-amber-500/40"
                          />
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={p.rate}
                            onChange={(e) => updatePurchaseItem(p.item_code, "rate", Math.max(0.01, Number(e.target.value)))}
                            className="col-span-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-sm text-white text-center outline-none focus:border-amber-500/40"
                          />
                          <span className="col-span-2 text-sm font-bold text-amber-400 text-right">{fmt(p.qty * p.rate)}</span>
                          <button
                            onClick={() => removeItemFromPurchase(p.item_code)}
                            className="col-span-1 flex justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {purchaseItems.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-4">Buscá y seleccioná productos para agregar a la compra</p>
                  )}
                </div>

                {/* Step 3: Warehouse */}
                <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-550 mb-2">
                    3. Almacén Destino
                  </label>
                  <CustomSelect
                    value={selectedWarehouse}
                    onChange={(val) => setSelectedWarehouse(val)}
                    options={warehouses.map((w) => ({ value: w.name, label: getWarehouseLabel(w.warehouse_name) }))}
                  />
                </div>

                {/* Step 4: Notes */}
                <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-550 mb-2">
                    4. Notas / Referencia Factura (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Factura #12345"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-slate-700 focus:outline-none transition-all font-semibold"
                  />
                </div>

                {/* Total & Submit */}
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-6 flex items-center justify-between backdrop-blur-sm shadow-xl">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-550">Total de la Compra</p>
                    <p className="text-2xl font-black text-amber-400">{fmt(purchaseTotal)}</p>
                    <p className="text-xs text-slate-500">{purchaseItems.length} producto{purchaseItems.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={handleSubmitPurchase}
                    disabled={submittingPurchase || purchaseItems.length === 0 || !selectedSupplier}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/10 hover:bg-amber-600 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submittingPurchase ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                    {submittingPurchase ? "Registrando..." : "Registrar Compra y Recibir"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════ TAB: HISTORIAL ═══════════ */}
        {!loading && activeTab === "historial" && (
          <div className="space-y-6 overflow-y-auto flex-1 pr-1 pb-24">
            <div className="flex flex-col gap-4 bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl md:flex-row md:items-center md:justify-between w-full">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Historial de Órdenes</h2>
                <p className="text-xs text-slate-400 font-medium">Revisá las compras anteriores y sus estados de recepción.</p>
              </div>
              <div className="w-full md:w-64">
                <CustomSelect
                  value={historyFilter}
                  onChange={(val) => setHistoryFilter(val)}
                  options={[
                    { value: "", label: "Todos los proveedores" },
                    ...suppliers.map((s) => ({ value: s.name, label: s.supplier_name }))
                  ]}
                />
              </div>
            </div>

            {purchaseHistory.length === 0 ? (
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-12 text-center shadow-xl">
                <svg className="mx-auto h-12 w-12 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-500 font-medium">Sin historial de compras</p>
                <p className="text-xs text-slate-600 mt-1">Las compras registradas aparecerán acá</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseHistory.map((po) => (
                  <button
                    key={po.name}
                    type="button"
                    onClick={() => handleViewDetail(po.name)}
                    className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-5 shadow-lg flex items-center justify-between transition-all duration-300 hover:border-slate-700 hover:shadow-2xl cursor-pointer text-left gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        po.display_status === "Recibida"
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : po.display_status === "Cancelada"
                          ? "bg-red-500/10 border border-red-500/20 text-red-400"
                          : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                      }`}>
                        {po.display_status === "Recibida" ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : po.display_status === "Cancelada" ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-white">{po.name}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            po.display_status === "Recibida"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                              : po.display_status === "Cancelada"
                              ? "bg-red-500/10 text-red-400 border border-red-500/10"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/10"
                          }`}>
                            {po.display_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold">{po.supplier_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-amber-400">{fmt(po.grand_total)}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{po.transaction_date}</p>
                      </div>
                      <svg className="h-4 w-4 text-slate-650 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════ MODAL: NUEVO PROVEEDOR ═══════════ */}
      {showNewSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer" onClick={() => setShowNewSupplierModal(false)}></div>
          <div className="relative w-full max-w-md mx-4 rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-2xl z-50">
            <h3 className="text-lg font-black text-white mb-5">Nuevo Proveedor</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Ej. Distribuidora Lácteos del Norte"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-slate-700 focus:outline-none transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Teléfono</label>
                <input
                  type="tel"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="Ej. 55 1234 5678"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-slate-700 focus:outline-none transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  placeholder="Ej. ventas@proveedor.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-slate-700 focus:outline-none transition-all font-semibold"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowNewSupplierModal(false)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white px-4 py-2.5 text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateSupplier}
                disabled={savingSupplier || !newSupplierName.trim()}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/10 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              >
                {savingSupplier ? "Guardando..." : "Crear Proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL: DETALLE DE COMPRA ═══════════ */}
      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer" onClick={() => setShowDetailModal(false)}></div>
          <div className="relative w-full max-w-lg mx-4 rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black text-white">{selectedDetail.name}</h3>
                <p className="text-xs text-slate-400 font-semibold">{selectedDetail.supplier_name} · {selectedDetail.transaction_date}</p>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                selectedDetail.display_status === "Recibida"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                  : selectedDetail.display_status === "Cancelada"
                  ? "bg-red-500/10 text-red-400 border border-red-500/10"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/10"
              }`}>
                {selectedDetail.display_status}
              </span>
            </div>

            {/* Items table */}
            <div className="rounded-2xl border border-slate-850 overflow-hidden mb-4 shadow-inner">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-2.5 bg-slate-900 border-b border-slate-850">
                <span className="col-span-5">Producto</span>
                <span className="col-span-2 text-center">Cant.</span>
                <span className="col-span-2 text-center">Costo</span>
                <span className="col-span-3 text-right">Subtotal</span>
              </div>
              {selectedDetail.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 bg-slate-950 border-b border-slate-850 last:border-0 text-slate-350 font-bold">
                  <span className="col-span-5 text-xs font-bold text-white truncate">{item.item_name}</span>
                  <span className="col-span-2 text-xs text-center">{item.qty}</span>
                  <span className="col-span-2 text-xs text-center">{fmt(item.rate)}</span>
                  <span className="col-span-3 text-xs font-black text-amber-400 text-right">{fmt(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 mb-4 px-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-400">Subtotal</span>
                <span className="font-bold text-white">{fmt(selectedDetail.net_total)}</span>
              </div>
              {selectedDetail.total_taxes_and_charges > 0 && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-slate-400">Impuestos</span>
                  <span className="font-bold text-white">{fmt(selectedDetail.total_taxes_and_charges)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t border-slate-850">
                <span className="font-black text-white">Total</span>
                <span className="font-black text-amber-400">{fmt(selectedDetail.grand_total)}</span>
              </div>
            </div>

            {selectedDetail.remarks && (
              <div className="rounded-2xl bg-slate-900 border border-slate-850 p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notas</p>
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">{selectedDetail.remarks}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-855 text-slate-400 hover:text-white px-4 py-2.5 text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Cerrar
              </button>
              {selectedDetail.display_status === "Recibida" && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(selectedDetail.name)}
                  className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  Cancelar Compra
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL: CONFIRMAR CANCELACIÓN ═══════════ */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-sm mx-4 rounded-3xl border border-red-550/20 bg-slate-950 p-6 shadow-2xl z-50 text-center animate-scale-in">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
              <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-white mb-2">¿Cancelar esta compra?</h3>
            <p className="text-sm text-slate-400 mb-6 font-semibold">
              Se revertirá la entrada de stock asociada. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white px-4 py-2.5 text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={() => handleCancelPurchase(showCancelConfirm)}
                className="flex-1 rounded-xl bg-red-650 hover:bg-red-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Sí, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
