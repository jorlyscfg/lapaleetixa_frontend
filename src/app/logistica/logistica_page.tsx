"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetDocList, useFrappeCreateDoc } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { CustomSelect } from "../components/custom_select";
import { CatalogImageTile } from "../components/catalog_image_tile";

interface FeatureConfig {
  client_name: string;
  colors: {
    primary: string;
  };
  features: {
    pos: boolean;
    production: boolean;
    logistics: boolean;
  };
}

export default function LogisticsPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  // Estados de control
  const [fromWarehouse, setFromWarehouse] = useState<string>("");
  const [toWarehouse, setToWarehouse] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [adjustStep, setAdjustStep] = useState<number>(1);
  const [updating, setUpdating] = useState(false);

  // Mapeo de cantidades a traspasar por item (item_code -> cantidad)
  const [transferQuantities, setTransferQuantities] = useState<Record<string, number>>({});

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Consultar dinámicamente los almacenes de la compañía
  const { data: dbWarehouses, isLoading: warehousesLoading } = useFrappeGetDocList("Warehouse", {
    fields: ["name", "warehouse_name"],
    filters: [
      ["company", "=", saasConfig?.client_name || "La Paletixa"],
      ["is_group", "=", 0],
      ["disabled", "=", 0]
    ],
    limit: 100
  });

  const getWarehouseLabel = (name: string) => {
    const cleanName = name.split(" - ")[0];
    if (cleanName.startsWith("Fabrica")) return `🏭 ${cleanName}`;
    if (cleanName.startsWith("Distribucion")) return `📦 ${cleanName}`;
    if (cleanName.startsWith("Sucursal")) return `🍦 ${cleanName}`;
    return `🏪 ${cleanName}`;
  };

  const warehouses = dbWarehouses?.map((w: { name: string; warehouse_name?: string | null }) => ({
    name: w.name,
    label: getWarehouseLabel(w.warehouse_name || w.name)
  })) || [];

  // Inicializar almacenes por defecto una vez cargados
  useEffect(() => {
    if (dbWarehouses && dbWarehouses.length > 0) {
      const factory = dbWarehouses.find(w => w.name.toLowerCase().includes("fabrica"));
      const defaultFrom = factory ? factory.name : dbWarehouses[0].name;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFromWarehouse(defaultFrom);
      
      const sucursal = dbWarehouses.find(w => w.name.toLowerCase().includes("sucursal") && w.name !== defaultFrom);
      setToWarehouse(sucursal ? sucursal.name : (dbWarehouses[1] ? dbWarehouses[1].name : dbWarehouses[0].name));
    }
  }, [dbWarehouses]);

  // 1. Cargar configuraciones de SaaS y Feature Flags
  useEffect(() => {
    async function fetchConfig() {
      try {
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_features`);
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

  // 2. Seguridad: Redirigir si no hay sesión
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  // 3. Feature Flag: Bloquear si no tiene el módulo Logistics activo
  useEffect(() => {
    if (!configLoading && saasConfig && !saasConfig.features.logistics) {
      router.push("/");
    }
  }, [saasConfig, configLoading, router]);

  // 4. Consultar catálogo de productos listos para venta en ERPNext (filtrando plantillas con has_variants=0)
  const { data: items, isLoading: itemsLoading } = useFrappeGetDocList("Item", {
    fields: ["name", "item_name", "item_group", "image", "standard_rate", "has_variants", "stock_uom"],
    filters: [
      ["disabled", "=", 0],
      ["is_sales_item", "=", 1],
      ["has_variants", "=", 0],
      ["name", "!=", "Carrito Paletero"]
    ],
    limit: 150
  });

  // 5. Consultar stock consolidado (Bins) para todos nuestros almacenes a la vez
  const { data: bins, isLoading: binsLoading, mutate: mutateBins } = useFrappeGetDocList("Bin", {
    fields: ["item_code", "warehouse", "actual_qty"],
    filters: [
      ["warehouse", "in", warehouses.length > 0 ? warehouses.map(w => w.name) : ["dummy"]]
    ],
    limit: 1000
  });

  const { createDoc } = useFrappeCreateDoc();

  // Función para obtener stock actual en un almacén específico
  const getItemStock = (itemCode: string, warehouseName: string) => {
    const bin = bins?.find(b => b.item_code === itemCode && b.warehouse === warehouseName);
    return bin ? bin.actual_qty : 0;
  };

  // Ajustes interactivos de cantidad a traspasar
  const updateTransferQty = (itemCode: string, change: number) => {
    const originStock = getItemStock(itemCode, fromWarehouse);
    const currentQty = transferQuantities[itemCode] || 0;
    
    let newQty = currentQty + change;
    
    // Validar límites: no menor a 0, y no mayor a la existencia real en el origen
    if (newQty < 0) newQty = 0;
    if (newQty > originStock) newQty = originStock;

    setTransferQuantities(prev => ({
      ...prev,
      [itemCode]: newQty
    }));
  };

  const handleResetQuantities = () => {
    setTransferQuantities({});
  };

  const handleSwapWarehouses = () => {
    const temp = fromWarehouse;
    setFromWarehouse(toWarehouse);
    setToWarehouse(temp);
    handleResetQuantities();
  };

  // Procesar el Traspaso de Stock en ERPNext (Material Transfer)
  const handleStockTransferSubmit = async () => {
    // Filtrar sólo ítems con cantidad mayor a 0
    const itemsToTransfer = Object.entries(transferQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemCode, qty]) => {
        const item = items?.find(i => i.name === itemCode);
        return {
          item_code: itemCode,
          qty: qty,
          uom: item?.stock_uom || "Unit",
          allow_zero_valuation_rate: 1, // Evitar errores de Valuation Rate en ERPNext v16
          s_warehouse: fromWarehouse,
          t_warehouse: toWarehouse,
          basic_rate: item?.standard_rate || 5.0
        };
      });

    if (itemsToTransfer.length === 0) return;
    if (fromWarehouse === toWarehouse) {
      setErrorMessage("El almacén de origen y destino no pueden ser el mismo.");
      return;
    }

    setUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      doctype: "Stock Entry",
      purpose: "Material Transfer",
      stock_entry_type: "Material Transfer", // Mandatorio en ERPNext v16
      docstatus: 1, // Auto-submit to update stock ledger immediately
      from_warehouse: fromWarehouse,
      to_warehouse: toWarehouse,
      company: saasConfig?.client_name || "La Paletixa",
      items: itemsToTransfer
    };

    try {
      await createDoc("Stock Entry", payload);
      setSuccessMessage(
        `¡Traspaso exitoso! Se registraron ${itemsToTransfer.reduce((sum, i) => sum + i.qty, 0)} unidades transferidas de forma segura en ERPNext.`
      );
      handleResetQuantities();
      await mutateBins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error registrando traspaso:", err);
      setErrorMessage(message || "Ocurrió un error al registrar el traspaso de stock.");
    } finally {
      setUpdating(false);
    }
  };

  // Filtrado de Productos por búsqueda y categoría local
  const filteredItems = items?.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "Todos" || item.item_group === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = ["Todos", ...Array.from(new Set(items?.map(item => item.item_group).filter(Boolean) || []))];
  const activeColor = saasConfig?.colors?.primary || "#6366f1"; // Indigo default para logistica

  const totalTransferItemsCount = Object.values(transferQuantities).filter(qty => qty > 0).length;
  const totalTransferQtyCount = Object.values(transferQuantities).reduce((sum, qty) => sum + qty, 0);

  if (authLoading || configLoading || itemsLoading || binsLoading || warehousesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500"></div>
          <p className="text-sm font-medium tracking-wide animate-pulse">Cargando Módulo de Logística...</p>
        </div>
      </div>
    );
  }

  const isSameWarehouse = fromWarehouse === toWarehouse;

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Contenido Principal */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-4 sm:space-y-6 overflow-y-auto flex-1 pb-24">
        
        {/* Panel de Control de Almacenes (GLASSMORPHISM) */}
        <div className="bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl flex flex-col gap-6">
          <div className="space-y-1">
            <p className="text-xs text-slate-450 font-bold uppercase tracking-wider">Traspaso de Stock entre Almacenes</p>
          </div>

          <div className="flex flex-row items-center gap-1.5 md:gap-4 w-full">
            {/* Almacén Origen */}
            <div className="flex-1 flex flex-col space-y-1 bg-slate-900/60 p-2 md:p-4 rounded-2xl border border-slate-800 w-full min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">Desde (Almacén Origen)</label>
              <CustomSelect
                value={fromWarehouse}
                onChange={(val) => {
                  setFromWarehouse(val);
                  handleResetQuantities();
                }}
                options={warehouses
                  .filter(w => w.name !== toWarehouse)
                  .map(w => ({ value: w.name, label: w.label }))}
              />
            </div>

            {/* Botón de Intercambio Táctil (Swap) */}
            <div className="flex items-center justify-center p-0.5 md:p-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleSwapWarehouses}
                title="Intercambiar almacenes (Swap)"
                className="rounded-full bg-indigo-500/10 p-2.5 md:p-3 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-md"
              >
                {/* Icono de Intercambio / Swap */}
                <svg className="h-5 w-5 md:h-6 md:w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
            </div>

            {/* Almacén Destino */}
            <div className="flex-1 flex flex-col space-y-1 bg-slate-900/60 p-2 md:p-4 rounded-2xl border border-slate-800 w-full min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">Hacia (Almacén Destino)</label>
              <CustomSelect
                value={toWarehouse}
                onChange={(val) => {
                  setToWarehouse(val);
                  handleResetQuantities();
                }}
                options={warehouses
                  .filter(w => w.name !== fromWarehouse)
                  .map(w => ({ value: w.name, label: w.label }))}
              />
            </div>
          </div>

          {/* Advertencia de mismo almacén */}
          {isSameWarehouse && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400 leading-normal">
              ⚠️ <strong>Advertencia</strong>: El almacén de origen y destino seleccionado es el mismo. Elegí almacenes distintos para habilitar los traspasos de stock.
            </div>
          )}
        </div>

        {/* Buscador, Categorías y Selector de Lotes */}
        <div className="flex flex-col gap-4 bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full lg:w-auto">
            {/* Buscador */}
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar paleta o boli..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
              />
              <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Categorías */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                      isSelected
                        ? "text-white"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    }`}
                    style={isSelected ? { backgroundColor: activeColor } : {}}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de cantidad de ajuste (Lotes) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Ajustar por:</span>
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
              {[1, 5, 10, 50].map((step) => {
                const isSelected = adjustStep === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setAdjustStep(step)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                      isSelected
                        ? "text-white shadow-md font-black"
                        : "text-slate-400 hover:text-white"
                    }`}
                    style={isSelected ? { backgroundColor: activeColor } : {}}
                  >
                    {step}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mensajes de feedback */}
        {successMessage && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 text-sm text-emerald-400 leading-normal flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-300 font-bold ml-4">✕</button>
          </div>
        )}
        {errorMessage && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm text-red-400 leading-normal flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Grilla Responsiva de Productos */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filteredItems.map((item) => {
            const stockOrigin = getItemStock(item.name, fromWarehouse);
            const stockDest = getItemStock(item.name, toWarehouse);
            const transferQty = transferQuantities[item.name] || 0;
            const isUpdating = updating;

            return (
              <div
                key={item.name}
                className={`relative rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-5 shadow-lg flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-2xl ${
                  isUpdating ? "opacity-60 scale-95" : ""
                }`}
              >
                <div>
                  {/* Foto o Icono */}
                  <CatalogImageTile
                    className="aspect-square w-full mb-4"
                    src={item.image}
                    alt={item.item_name}
                  />

                  <h3 className="font-extrabold text-base text-white leading-snug truncate">{item.item_name}</h3>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">{item.item_group}</p>
                </div>

                {/* Stock Comparativo y Controles */}
                <div className="mt-5 space-y-4">
                  
                  {/* Comparador de Stock en Ambos Almacenes */}
                  <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-900 border border-slate-850 p-2 text-center">
                    <div className="border-r border-slate-800 py-1">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stock Origen</p>
                      <p className="text-sm font-black text-white mt-0.5">{stockOrigin}</p>
                    </div>
                    <div className="py-1">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stock Destino</p>
                      <p className="text-sm font-black text-indigo-400 mt-0.5">{stockDest}</p>
                    </div>
                  </div>

                  {/* Selector Táctil de Cantidad a Traspasar */}
                  <div className="flex items-center justify-between gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-850">
                    <button
                      type="button"
                      disabled={isUpdating || isSameWarehouse || transferQty === 0}
                      onClick={() => updateTransferQty(item.name, -adjustStep)}
                      className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-bold text-lg flex items-center justify-center hover:text-white active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      -
                    </button>
                    
                    <div className="text-center">
                      <p className="text-[8px] text-slate-500 font-bold uppercase">A Mover</p>
                      <span className={`text-sm font-black ${transferQty > 0 ? "text-indigo-400" : "text-slate-500"}`}>
                        {transferQty}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdating || isSameWarehouse || stockOrigin === 0 || transferQty >= stockOrigin}
                      onClick={() => updateTransferQty(item.name, adjustStep)}
                      className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-bold text-lg flex items-center justify-center hover:text-white active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Barra de Checkout Flotante de Logística (STICKY BOTTOM BAR) */}
      {totalTransferQtyCount > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-40 bg-slate-950/90 border border-white/5 shadow-2xl rounded-3xl p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/10">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Resumen de Envío</p>
              <p className="text-xs text-slate-400">
                Se transferirán <strong className="text-slate-200">{totalTransferQtyCount} unidades</strong> de <strong className="text-slate-200">{totalTransferItemsCount} productos</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleResetQuantities}
              disabled={updating}
              className="rounded-xl px-5 py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 transition-all bg-slate-900/60 active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleStockTransferSubmit}
              disabled={updating}
              className="rounded-xl px-6 py-3 text-xs font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: activeColor }}
            >
              {updating ? "Registrando Traspaso..." : "Confirmar Envío de Stock"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
