"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetCall } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { CustomDatePicker } from "../components/custom_date_picker";

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

interface SaasConfig {
  client_name?: string;
  colors?: {
    primary?: string;
  };
  features?: {
    purchasing?: boolean;
  };
}

interface DetailedSale {
  name: string;
  date: string;
  customer: string;
  customer_name: string;
  total: number;
  payment_mode?: string;
  is_pos: number | boolean;
}

interface SalesByBranch {
  warehouse: string;
  branch: string;
  total: number;
}

interface TopProduct {
  item_code: string;
  item_name: string;
  total_qty: number;
  total_amount: number;
}

interface SalesTrendPoint {
  date: string;
  total: number;
}

interface SalesReportData {
  detailed_sales: DetailedSale[];
  sales_by_branch: SalesByBranch[];
  top_products: TopProduct[];
  sales_trend: SalesTrendPoint[];
}

interface StockItem {
  item_code: string;
  item_name: string;
  branch: string;
  actual_qty: number;
}

interface AuditStockMove {
  name: string;
  timestamp: string;
  user: string;
  item_code: string;
  item_name: string;
  branch: string;
  actual_qty: number;
  voucher_no: string;
  voucher_type: string;
}

interface AuditSalesMove {
  name: string;
  timestamp: string;
  user: string;
  customer_name?: string;
  amount: number;
  docstatus: number;
}

interface AuditVersionDiff {
  changed?: Array<[string, string | number | null, string | number | null]>;
  added?: Array<unknown>;
  removed?: Array<unknown>;
}

interface AuditVersionLog {
  name: string;
  timestamp: string;
  user: string;
  voucher_type: string;
  voucher_no: string;
  data_diff?: AuditVersionDiff;
}

interface AuditReportData {
  stock_moves: AuditStockMove[];
  sales_moves: AuditSalesMove[];
  version_logs: AuditVersionLog[];
}

interface ShiftInvoiceItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
}

interface ShiftInvoice {
  name: string;
  creation: string;
  customer_name: string;
  grand_total: number;
  docstatus: number;
  remarks: string;
  usd_amount?: number;
  exchange_rate?: number;
  items?: ShiftInvoiceItem[];
}

interface ShiftClosingDetail {
  mode_of_payment: string;
  opening_amount: number;
  expected_amount: number;
  closing_amount: number;
  difference: number;
}

interface ShiftData {
  opening_entry: string;
  closing_entry: string | null;
  pos_profile: string;
  user: string;
  period_start_date: string;
  period_end_date: string;
  status: "Open" | "Closed";
  grand_total: number;
  sales_count: number;
  sales_total: number;
  usd_sales_count: number;
  usd_amount_collected: number;
  usd_invoices: Array<{
    name: string;
    grand_total: number;
    remarks: string;
    usd_amount: number;
    exchange_rate: number;
  }>;
  closing_details: ShiftClosingDetail[];
  invoices: ShiftInvoice[];
}

interface FrappeError {
  message?: string;
}

interface PurchaseOrder {
  name: string;
  transaction_date: string;
  supplier: string;
  supplier_name?: string;
  net_total?: number;
  total_taxes_and_charges?: number;
  grand_total: number;
  display_status?: string;
  docstatus: number;
}

interface SupplierReportRow {
  name: string;
  supplier_name: string;
  last_purchase_date?: string;
  total_orders: number;
  total_amount: number;
}

interface SupplierExpense {
  supplier: string;
  supplier_name: string;
  count: number;
  total: number;
}

export default function ReportsPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  // Filtros de fecha
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [activeSubTab, setActiveSubTab] = useState<"ventas" | "compras" | "stock" | "auditoria" | "turnos">("ventas");
  const [selectedShift, setSelectedShift] = useState<ShiftData | null>(null);
  const [auditSubTab, setAuditSubTab] = useState<"inventario" | "ventas" | "cambios">("inventario");
  const [saasConfig, setSaasConfig] = useState<SaasConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [purchasePage, setPurchasePage] = useState<number>(1);

  // Reiniciar página de compras durante el renderizado si cambian los filtros o la pestaña activa
  const currentKey = `${startDate}_${endDate}_${activeSubTab}`;
  const [prevKey, setPrevKey] = useState(currentKey);
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setPurchasePage(1);
  }

  // Cargar configuraciones de marca blanca
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

  // Seguridad: Redirigir a no administradores para evitar bucles de recarga
  useEffect(() => {
    if (!authLoading && currentUser) {
      const isCashier = currentUser.startsWith("cajero.");
      const isProdUser = currentUser ? currentUser.startsWith("produccion@") : false;
      const isLogisticaUser = currentUser ? currentUser.startsWith("logistica@") : false;
      const isAdmin = !isCashier && !isProdUser && !isLogisticaUser;

      if (!isAdmin) {
        if (isCashier) {
          router.push("/pos");
        } else if (isProdUser) {
          router.push("/produccion");
        } else if (isLogisticaUser) {
          router.push("/logistica");
        } else {
          router.push("/");
        }
      }
    } else if (!authLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  // Obtener Métricas del Día (capturando error de forma segura)
  const { data: metricsRaw, error: metricsError, isLoading: metricsLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_admin_dashboard_metrics",
    {},
    "saas_admin_metrics"
  );
  const metrics: MetricState | null = (metricsRaw as { message?: { metrics?: MetricState } })?.message?.metrics || null;

  // Obtener Datos de Reportes de Ventas (capturando error de forma segura)
  const { data: salesReportRaw, error: salesReportError, isLoading: salesReportLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_sales_report_data",
    { start_date: startDate, end_date: endDate },
    `saas_sales_report_${startDate}_${endDate}`
  );
  const salesReport = (salesReportRaw as { message?: SalesReportData })?.message || null;

  // Obtener Datos de Stock General (capturando error de forma segura)
  const { data: stockReportRaw, error: stockReportError, isLoading: stockReportLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_stock_report_data",
    {},
    "saas_stock_report"
  );
  const stockReport = (stockReportRaw as { message?: { stock_data?: StockItem[] } })?.message?.stock_data || [];

  // Obtener Datos de Auditoría (capturando error de forma segura)
  const { data: auditReportRaw, error: auditReportError, isLoading: auditReportLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_audit_report_data",
    { start_date: startDate, end_date: endDate },
    `saas_audit_report_${startDate}_${endDate}`
  );
  const auditReport = (auditReportRaw as { message?: AuditReportData })?.message || { stock_moves: [], sales_moves: [], version_logs: [] };

  // Obtener Datos de Control de Turnos (capturando error de forma segura)
  const { data: shiftsRaw, error: shiftsError, isLoading: shiftsLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_pos_shifts",
    { start_date: startDate, end_date: endDate },
    `saas_shifts_${startDate}_${endDate}`
  );
  const shifts = (shiftsRaw as { message?: { shifts?: ShiftData[] } })?.message?.shifts || [];

  // Verificar si existen compras en el historial (independientemente del filtro de fechas)
  const { data: hasAnyPurchasesRaw } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_purchase_history",
    { limit: 1 },
    "saas_check_any_purchase"
  );
  const hasAnyPurchases = ((hasAnyPurchasesRaw as { message?: { orders?: PurchaseOrder[] } })?.message?.orders?.length || 0) > 0;
  const showPurchasingReport = !!(saasConfig?.features?.purchasing || hasAnyPurchases);

  // Obtener Datos de Historial de Compras para Reportes
  const { data: purchaseHistoryRaw, error: purchaseHistoryError, isLoading: purchaseHistoryLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_purchase_history",
    { from_date: startDate, to_date: endDate, limit: 150 },
    showPurchasingReport ? `saas_purchase_report_${startDate}_${endDate}` : null
  );
  const purchaseHistory: PurchaseOrder[] = (purchaseHistoryRaw as { message?: { orders?: PurchaseOrder[] } })?.message?.orders || [];

  const ITEMS_PER_PAGE = 10;
  const totalPurchasePages = Math.ceil(purchaseHistory.length / ITEMS_PER_PAGE);
  const paginatedPurchases = purchaseHistory.slice(
    (purchasePage - 1) * ITEMS_PER_PAGE,
    purchasePage * ITEMS_PER_PAGE
  );

  // Obtener Datos de Proveedores para Reportes
  const { data: suppliersRaw, error: suppliersError, isLoading: suppliersLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_suppliers",
    {},
    showPurchasingReport ? "saas_suppliers_report" : null
  );
  const suppliersReport: SupplierReportRow[] = (suppliersRaw as { message?: SupplierReportRow[] })?.message || [];

  const activeColor = saasConfig?.colors?.primary || "#3498db";

  // Función para exportar a CSV de forma nativa
  const handleExportCSV = () => {
    if (!salesReport || !salesReport.detailed_sales || salesReport.detailed_sales.length === 0) return;

    const headers = ["Factura ID", "Fecha", "Cliente ID", "Cliente Nombre", "Total", "Metodo Pago", "POS"];
    const rows = salesReport.detailed_sales.map((item: DetailedSale) => [
      item.name,
      item.date,
      item.customer,
      item.customer_name,
      item.total.toFixed(2),
      item.payment_mode || "",
      item.is_pos ? "Si" : "No",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e: Array<string | number>) => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ventas_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pantalla de error amigable en lugar de reventar en bucle de refresco
  if (metricsError || salesReportError || stockReportError || auditReportError || shiftsError || (showPurchasingReport && (purchaseHistoryError || suppliersError))) {
    const errorMsg =
      (metricsError as FrappeError)?.message ||
      (salesReportError as FrappeError)?.message ||
      (stockReportError as FrappeError)?.message ||
      (auditReportError as FrappeError)?.message ||
      (shiftsError as FrappeError)?.message ||
      (purchaseHistoryError as FrappeError)?.message ||
      (suppliersError as FrappeError)?.message ||
      "No tenés permisos para acceder a esta sección de reportes o la sesión ha expirado.";

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans p-6">
        <div className="rounded-3xl bg-slate-950 border border-slate-850 p-8 max-w-xl text-center space-y-5 shadow-2xl">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-black text-white">Acceso Denegado o Error de Carga</h3>
          <p className="text-sm text-slate-400 leading-relaxed font-medium">
            {errorMsg}
          </p>
          <div className="pt-4 flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl bg-slate-800 hover:bg-slate-750 px-5 py-2.5 text-xs font-black text-slate-200 border border-slate-800 transition-all active:scale-95 cursor-pointer shadow-md"
            >
              Volver al Panel Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || configLoading || metricsLoading || salesReportLoading || stockReportLoading || auditReportLoading || shiftsLoading || (showPurchasingReport && (purchaseHistoryLoading || suppliersLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500"></div>
          <p className="text-sm font-medium tracking-wide animate-pulse">Cargando Reportes del Sistema...</p>
        </div>
      </div>
    );
  }

  // Helper para generar el Path del gráfico SVG de ventas
  const generateSvgPath = (data: Array<{ date: string; total: number }>, width: number, height: number) => {
    if (!data || data.length === 0) return { linePath: "", areaPath: "", points: [] };

    const maxVal = Math.max(...data.map(d => d.total), 1000);
    const minVal = 0;
    const valRange = maxVal - minVal;

    if (data.length === 1) {
      const d = data[0];
      const y = height - ((d.total - minVal) / valRange) * height;
      const points = [{ x: width / 2, y }];
      const linePath = `M 0 ${y} L ${width} ${y}`;
      const areaPath = `M 0 ${y} L ${width} ${y} L ${width} ${height} L 0 ${height} Z`;
      return { linePath, areaPath, points };
    }

    const points = data.map((d, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((d.total - minVal) / valRange) * height;
      return { x, y };
    });

    const linePath = points.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { linePath, areaPath, points };
  };

  const svgWidth = 800;
  const svgHeight = 240;
  const { linePath, areaPath, points: trendPoints } = generateSvgPath(salesReport?.sales_trend || [], svgWidth, svgHeight);

  // Cálculos para el reporte de compras (derivados del estado)
  const getPurchaseMetrics = () => {
    if (!purchaseHistory || purchaseHistory.length === 0) {
      return { totalSpent: 0, orderCount: 0, activeSuppliers: 0, avgCost: 0 };
    }
    const validOrders = purchaseHistory.filter((po: PurchaseOrder) => po.docstatus !== 2); // Excluir canceladas
    const totalSpent = validOrders.reduce((sum: number, po: PurchaseOrder) => sum + (po.grand_total || 0), 0);
    const orderCount = validOrders.length;
    const activeSuppliers = new Set(validOrders.map((po: PurchaseOrder) => po.supplier)).size;
    const avgCost = orderCount > 0 ? totalSpent / orderCount : 0;
    return { totalSpent, orderCount, activeSuppliers, avgCost };
  };
  const purchaseMetrics = getPurchaseMetrics();

  // Tendencia de compras (agrupado por fecha)
  const getPurchaseTrend = () => {
    if (!purchaseHistory || purchaseHistory.length === 0) return [];
    const map: Record<string, number> = {};
    purchaseHistory.forEach((po: PurchaseOrder) => {
      if (po.docstatus !== 2) {
        const date = po.transaction_date;
        map[date] = (map[date] || 0) + (po.grand_total || 0);
      }
    });
    return Object.keys(map).sort().map(date => ({ date, total: map[date] }));
  };
  const purchaseTrend = getPurchaseTrend();

  const { linePath: pLinePath, areaPath: pAreaPath, points: pTrendPoints } = generateSvgPath(purchaseTrend, svgWidth, svgHeight);

  // Compras por proveedor
  const getPurchasesBySupplier = (): SupplierExpense[] => {
    if (!purchaseHistory || purchaseHistory.length === 0) return [];
    const map: Record<string, SupplierExpense> = {};
    purchaseHistory.forEach((po: PurchaseOrder) => {
      if (po.docstatus !== 2) {
        const sup = po.supplier;
        if (!map[sup]) {
          map[sup] = {
            supplier: sup,
            supplier_name: po.supplier_name || po.supplier,
            count: 0,
            total: 0
          };
        }
        map[sup].count += 1;
        map[sup].total += po.grand_total || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  };
  const purchasesBySupplier = getPurchasesBySupplier();

  const handleExportPurchaseCSV = () => {
    if (!purchaseHistory || purchaseHistory.length === 0) return;

    const headers = ["Orden ID", "Fecha", "Proveedor ID", "Proveedor", "Total Neto", "Impuestos", "Total", "Estado"];
    const rows = purchaseHistory.map((po: PurchaseOrder) => [
      po.name,
      po.transaction_date,
      po.supplier,
      po.supplier_name || po.supplier,
      (po.net_total || 0).toFixed(2),
      (po.total_taxes_and_charges || 0).toFixed(2),
      (po.grand_total || 0).toFixed(2),
      po.display_status || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e: Array<string | number>) => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_compras_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full h-full overflow-y-auto bg-slate-900 text-slate-100 font-sans">
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6 overflow-y-auto">
        
        {/* Filtro Rango de Fechas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-4 rounded-3xl border border-slate-850 shadow-xl">
          <span className="text-xs font-black uppercase text-slate-450 tracking-wider">Filtrar Rango de Análisis:</span>
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto">
            <CustomDatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              className="!py-1.5 !px-2.5 !text-xs"
            />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">A</span>
            <CustomDatePicker
              value={endDate}
              onChange={(val) => setEndDate(val)}
              className="!py-1.5 !px-2.5 !text-xs"
              align="right"
            />
          </div>
        </div>

        {/* METRIC CARDS / KPIs SUPERIORES */}
        {metrics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Ventas Hoy */}
            <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ventas de Hoy</span>
                <h3 className="text-2xl font-black text-white mt-1.5">${metrics.total_sales_today.toFixed(2)}</h3>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-4 pt-4 border-t border-slate-900/60">
                <span>POS: ${metrics.pos_sales_today.toFixed(2)}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-700"></span>
                <span>Mayorista: ${metrics.wholesale_sales_today.toFixed(2)}</span>
              </div>
            </div>

            {/* KPI 2: Pedidos Mayoristas */}
            <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pedidos Mayoristas Activos</span>
                <h3 className="text-2xl font-black text-white mt-1.5">{metrics.pending_wholesale_count} pedidos</h3>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-4 pt-4 border-t border-slate-900/60">
                <span>Valor estimado:</span>
                <span style={{ color: activeColor }} className="font-extrabold">${metrics.pending_wholesale_total.toFixed(2)}</span>
              </div>
            </div>

            {/* KPI 3: Reservas de Eventos */}
            <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reservas de Eventos Activas</span>
                <h3 className="text-2xl font-black text-white mt-1.5">{metrics.pending_events_count} eventos</h3>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-4 pt-4 border-t border-slate-900/60">
                <span>Valor estimado:</span>
                <span style={{ color: activeColor }} className="font-extrabold">${metrics.pending_events_total.toFixed(2)}</span>
              </div>
            </div>

            {/* KPI 4: Stock Crítico */}
            <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Alertas de Stock en Planta</span>
                <h3 className="text-2xl font-black text-white mt-1.5">
                  {metrics.low_stock_alerts?.length || 0} alertas
                </h3>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-4 pt-4 border-t border-slate-900/60">
                {metrics.low_stock_alerts?.length > 0 ? (
                  <span className="text-red-400 animate-pulse font-black">Stock menor a 100 unidades</span>
                ) : (
                  <span className="text-emerald-400 font-black">Todos los productos al día</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTOR DE PESTAÑAS DE VISUALIZACIÓN COHERENTE CON LA APP */}
        <div className="tab-container">
          <button
            onClick={() => {
              setActiveSubTab("ventas");
              setSelectedShift(null);
            }}
            className={`tab-button ${activeSubTab === "ventas" ? "active" : ""}`}
          >
            📊 <span>Análisis de Ventas</span>
          </button>
          {showPurchasingReport && (
            <button
              onClick={() => {
                setActiveSubTab("compras");
                setSelectedShift(null);
              }}
              className={`tab-button ${activeSubTab === "compras" ? "active" : ""}`}
            >
              🛒 <span>Análisis de Compras</span>
            </button>
          )}
          <button
            onClick={() => {
              setActiveSubTab("stock");
              setSelectedShift(null);
            }}
            className={`tab-button ${activeSubTab === "stock" ? "active" : ""}`}
          >
            📦 <span>Inventario General</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab("turnos");
              setSelectedShift(null);
            }}
            className={`tab-button ${activeSubTab === "turnos" ? "active" : ""}`}
          >
            🔑 <span>Control de Turnos / Cajas</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab("auditoria");
              setSelectedShift(null);
            }}
            className={`tab-button ${activeSubTab === "auditoria" ? "active" : ""}`}
          >
            📋 <span>Registro de Auditoría</span>
          </button>
        </div>

        {/* VISTA A: ANALISIS DE VENTAS */}
        {activeSubTab === "ventas" && (
          <div className="space-y-6">
            
            {/* CONTENEDOR 1: Gráfico Tendencia de Ventas */}
            <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Tendencia Histórica de Ventas</h3>
                  <p className="text-xs text-slate-400 mt-1">Ingresos consolidados generados diariamente en el rango seleccionado.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full shadow-md" style={{ backgroundColor: activeColor }}></span>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ingreso Diario ($)</span>
                </div>
              </div>

              {(salesReport?.sales_trend?.length || 0) > 0 ? (
                <div className="relative w-full overflow-hidden">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeColor} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={activeColor} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Guías horizontales de fondo */}
                    <line x1="0" y1={svgHeight * 0.25} x2={svgWidth} y2={svgHeight * 0.25} stroke="#1e293b" strokeDasharray="4 4" />
                    <line x1="0" y1={svgHeight * 0.5} x2={svgWidth} y2={svgHeight * 0.5} stroke="#1e293b" strokeDasharray="4 4" />
                    <line x1="0" y1={svgHeight * 0.75} x2={svgWidth} y2={svgHeight * 0.75} stroke="#1e293b" strokeDasharray="4 4" />
                    <line x1="0" y1={svgHeight} x2={svgWidth} y2={svgHeight} stroke="#1e293b" />

                    {/* Path de área rellena con gradiente */}
                    {areaPath && <path d={areaPath} fill="url(#salesGrad)" />}

                    {/* Línea principal */}
                    {linePath && <path d={linePath} fill="none" stroke={activeColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}

                    {/* Puntos en la serie */}
                    {trendPoints?.map((p, index) => {
                      const item = salesReport?.sales_trend?.[index];
                      if (!item) return null;
                      return (
                        <g key={index} className="group cursor-pointer">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={4}
                            fill={activeColor}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            className="transition-all duration-250 hover:r-6"
                          />
                          <title>
                            {item.date}: ${item.total.toFixed(2)}
                          </title>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Etiquetas de Eje X */}
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest pt-4">
                    {salesReport?.sales_trend?.length === 1 ? (
                      <span className="w-full text-center">{salesReport.sales_trend[0].date}</span>
                    ) : (
                      <>
                        <span>{salesReport?.sales_trend?.[0]?.date}</span>
                        <span>{salesReport?.sales_trend?.[Math.floor((salesReport?.sales_trend?.length || 0) / 2)]?.date}</span>
                        <span>{salesReport?.sales_trend?.[(salesReport?.sales_trend?.length || 1) - 1]?.date}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-2 border border-slate-850 rounded-2xl border-dashed">
                  <svg className="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-xs font-semibold">No se registran transacciones en el período seleccionado.</span>
                </div>
              )}
            </div>

            {/* SECCIÓN DOS: Rendimiento Sucursales y Canales */}
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Contenedor 2: Rendimiento de Sucursales */}
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl space-y-6">
                <div className="text-left">
                  <h3 className="text-base font-black text-white">Ventas por Sucursal</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ingresos acumulados agrupados por almacén operativo.</p>
                </div>

                <div className="space-y-4">
                  {salesReport?.sales_by_branch && salesReport.sales_by_branch.length > 0 ? (
                    salesReport.sales_by_branch.map((branch: SalesByBranch) => {
                      const maxVal = Math.max(...(salesReport?.sales_by_branch?.map((b: SalesByBranch) => b.total) || []), 1);
                      const percent = (branch.total / maxVal) * 100;
                      return (
                        <div key={branch.warehouse} className="space-y-1.5 text-left">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-white">{branch.branch}</span>
                            <span style={{ color: activeColor }} className="font-extrabold">${branch.total.toFixed(2)}</span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-sky-400"
                              style={{ width: `${percent}%`, backgroundColor: activeColor }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-slate-500 text-xs py-8 text-center">Sin datos de sucursal.</div>
                  )}
                </div>
              </div>

              {/* Contenedor 3: Top Productos */}
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl space-y-6">
                <div className="text-left">
                  <h3 className="text-base font-black text-white">Top 5 Productos Más Vendidos</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Listado de productos con mayor volumen físico de salida.</p>
                </div>

                <div className="divide-y divide-slate-900/60">
                  {salesReport?.top_products && salesReport.top_products.length > 0 ? (
                    salesReport.top_products.map((item: TopProduct, idx: number) => (
                      <div key={item.item_code} className="py-3 flex items-center justify-between text-left first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-400 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                            #{idx + 1}
                          </span>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-white leading-tight">{item.item_name}</h4>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cód: {item.item_code}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span style={{ color: activeColor }} className="text-xs font-black">{item.total_qty} pzs</span>
                          <p className="text-[10px] text-slate-500 font-semibold">${item.total_amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-xs py-8 text-center">Sin datos de catálogo de ventas.</div>
                  )}
                </div>
              </div>
            </div>

            {/* TABLA: Detalle de Facturas Recientes */}
            <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl w-full overflow-hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Registro Detallado de Facturación</h3>
                  <p className="text-xs text-slate-400 mt-1">Últimas 100 transacciones procesadas en el período.</p>
                </div>
                {(salesReport?.detailed_sales?.length || 0) > 0 && (
                  <button
                    onClick={handleExportCSV}
                    style={{ backgroundColor: activeColor }}
                    className="hover:brightness-110 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar CSV
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-sm text-left border-collapse text-slate-350">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Factura ID</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Método de Pago</th>
                      <th className="px-6 py-4">Canal</th>
                      <th className="px-6 py-4 text-right">Monto Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {salesReport?.detailed_sales && salesReport.detailed_sales.length > 0 ? (
                      salesReport.detailed_sales.map((item: DetailedSale) => (
                        <tr key={item.name} className="hover:bg-slate-900/35 transition-colors">
                          <td className="px-6 py-4 font-bold text-white text-xs">{item.name}</td>
                          <td className="px-6 py-4 text-xs font-semibold">{item.date}</td>
                          <td className="px-6 py-4 font-semibold text-xs text-slate-200">
                            {item.customer_name || item.customer}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <span className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 font-bold border border-slate-800">
                              {item.payment_mode || "Efectivo"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">
                            {item.is_pos ? (
                              <span className="text-sky-400">Punto de Venta</span>
                            ) : (
                              <span className="text-amber-400">Canal Mayorista</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-xs text-white">
                            ${item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-semibold">
                          Sin transacciones registradas en este período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISTA B: ANALISIS DE COMPRAS */}
        {activeSubTab === "compras" && showPurchasingReport && (
          <div className="space-y-6 animate-fade-in">
            
            {/* KPI Cards de Compras */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gasto Total en Compras</span>
                  <h3 className="text-2xl font-black text-amber-400 mt-1.5">${purchaseMetrics.totalSpent.toFixed(2)}</h3>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 mt-4 pt-4 border-t border-slate-900/60">
                  <span>Período Seleccionado</span>
                </div>
              </div>

              <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Órdenes de Compra</span>
                  <h3 className="text-2xl font-black text-white mt-1.5">{purchaseMetrics.orderCount} OC</h3>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 mt-4 pt-4 border-t border-slate-900/60">
                  <span>Órdenes recibidas y confirmadas</span>
                </div>
              </div>

              <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Proveedores Activos</span>
                  <h3 className="text-2xl font-black text-white mt-1.5">{purchaseMetrics.activeSuppliers} proveedores</h3>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 mt-4 pt-4 border-t border-slate-900/60">
                  <span>Con transacciones en el rango</span>
                </div>
              </div>

              <div className="group rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-700">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Costo Promedio de Compra</span>
                  <h3 className="text-2xl font-black text-white mt-1.5">${purchaseMetrics.avgCost.toFixed(2)}</h3>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 mt-4 pt-4 border-t border-slate-900/60">
                  <span>Promedio por orden de compra</span>
                </div>
              </div>
            </div>

            {/* CONTENEDOR 1: Gráfico Tendencia de Compras */}
            <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Tendencia Histórica de Compras</h3>
                  <p className="text-xs text-slate-400 mt-1">Evolución diaria de los montos invertidos en compras de inventario.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full shadow-md bg-amber-500"></span>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto Diario ($)</span>
                </div>
              </div>

              {purchaseTrend.length > 0 ? (
                <div className="relative w-full overflow-hidden">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
                    <defs>
                      <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Guías horizontales de fondo */}
                    <line x1="0" y1={svgHeight * 0.25} x2={svgWidth} y2={svgHeight * 0.25} stroke="#1e293b" strokeDasharray="4 4" />
                    <line x1="0" y1={svgHeight * 0.5} x2={svgWidth} y2={svgHeight * 0.5} stroke="#1e293b" strokeDasharray="4 4" />
                    <line x1="0" y1={svgHeight * 0.75} x2={svgWidth} y2={svgHeight * 0.75} stroke="#1e293b" strokeDasharray="4 4" />
                    <line x1="0" y1={svgHeight} x2={svgWidth} y2={svgHeight} stroke="#1e293b" />

                    {/* Path de área rellena con gradiente */}
                    {pAreaPath && <path d={pAreaPath} fill="url(#purchasesGrad)" />}

                    {/* Línea principal */}
                    {pLinePath && <path d={pLinePath} fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}

                    {/* Puntos en la serie */}
                    {pTrendPoints?.map((p, index) => {
                      const item = purchaseTrend[index];
                      if (!item) return null;
                      return (
                        <g key={index} className="group cursor-pointer">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={4}
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            className="transition-all duration-250 hover:r-6"
                          />
                          <title>
                            {item.date}: ${item.total.toFixed(2)}
                          </title>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Etiquetas de Eje X */}
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest pt-4">
                    {purchaseTrend.length === 1 ? (
                      <span className="w-full text-center">{purchaseTrend[0].date}</span>
                    ) : (
                      <>
                        <span>{purchaseTrend[0]?.date}</span>
                        <span>{purchaseTrend[Math.floor(purchaseTrend.length / 2)]?.date}</span>
                        <span>{purchaseTrend[purchaseTrend.length - 1]?.date}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-2 border border-slate-850 rounded-2xl border-dashed">
                  <svg className="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-xs font-semibold">No se registran compras en el período seleccionado.</span>
                </div>
              )}
            </div>

            {/* SECCIÓN DOS: Rendimiento Proveedores y Catálogo */}
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Contenedor 2: Compras por Proveedor */}
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl space-y-6">
                <div className="text-left">
                  <h3 className="text-base font-black text-white">Gasto por Proveedor (Rango)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Monto total invertido por cada proveedor en el período.</p>
                </div>

                <div className="space-y-4">
                  {purchasesBySupplier.length > 0 ? (
                    purchasesBySupplier.slice(0, 5).map((row: SupplierExpense) => {
                      const maxVal = Math.max(...purchasesBySupplier.map((b: SupplierExpense) => b.total), 1);
                      const percent = (row.total / maxVal) * 105; // 105 to pad and avoid overflow
                      return (
                        <div key={row.supplier} className="space-y-1.5 text-left">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-white">{row.supplier_name}</span>
                            <span className="text-amber-400 font-extrabold">${row.total.toFixed(2)}</span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 to-orange-400"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-slate-500 text-xs py-8 text-center">Sin transacciones registradas por proveedor.</div>
                  )}
                </div>
              </div>

              {/* Contenedor 3: Proveedores Registrados y sus Stats Históricos */}
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl space-y-6">
                <div className="text-left">
                  <h3 className="text-base font-black text-white">Proveedores Registrados</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Resumen de estadísticas históricas de proveedores en la base de datos.</p>
                </div>

                <div className="divide-y divide-slate-900/60 max-h-[280px] overflow-y-auto pr-1">
                  {suppliersReport.length > 0 ? (
                    suppliersReport.map((row: SupplierReportRow) => (
                      <div key={row.name} className="py-3 flex items-center justify-between text-left first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-xs">
                            {row.supplier_name?.[0]?.toUpperCase() || "P"}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-white leading-tight">{row.supplier_name}</h4>
                            <p className="text-[10px] text-slate-500 font-semibold">Última compra: {row.last_purchase_date || "Nunca"}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className="text-xs font-black text-white">{row.total_orders} compras</span>
                          <p className="text-[10px] text-amber-400 font-bold">${(row.total_amount || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-xs py-8 text-center">No hay proveedores creados en el sistema.</div>
                  )}
                </div>
              </div>
            </div>

            {/* TABLA: Detalle de Órdenes de Compra */}
            <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl w-full overflow-hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Registro de Órdenes de Compra</h3>
                  <p className="text-xs text-slate-400 mt-1">Órdenes emitidas y recepcionadas en el período seleccionado.</p>
                </div>
                {purchaseHistory.length > 0 && (
                  <button
                    onClick={handleExportPurchaseCSV}
                    className="bg-amber-500 hover:brightness-110 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar CSV
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-sm text-left border-collapse text-slate-350">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-550 bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Orden ID</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Proveedor</th>
                      <th className="px-6 py-4">Monto Neto</th>
                      <th className="px-6 py-4">Impuestos</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Gran Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {paginatedPurchases.length > 0 ? (
                      paginatedPurchases.map((po: PurchaseOrder) => (
                        <tr key={po.name} className="hover:bg-slate-900/35 transition-colors">
                          <td className="px-6 py-4 font-bold text-white text-xs">{po.name}</td>
                          <td className="px-6 py-4 text-xs font-semibold">{po.transaction_date}</td>
                          <td className="px-6 py-4 font-semibold text-xs text-slate-200">
                            {po.supplier_name || po.supplier}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">${(po.net_total || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-xs font-semibold">${(po.total_taxes_and_charges || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-xs">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              po.display_status === "Recibida"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                                : po.display_status === "Cancelada"
                                ? "bg-red-500/10 text-red-400 border border-red-500/10"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/10"
                            }`}>
                              {po.display_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-xs text-white">
                            ${po.grand_total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500 font-semibold">
                          Sin órdenes de compra registradas en este período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Controles de Paginación */}
              {totalPurchasePages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-900/60 mt-4">
                  <div className="text-xs text-slate-400 font-medium">
                    Mostrando <span className="text-white font-bold">{Math.min((purchasePage - 1) * ITEMS_PER_PAGE + 1, purchaseHistory.length)}</span> a{" "}
                    <span className="text-white font-bold">{Math.min(purchasePage * ITEMS_PER_PAGE, purchaseHistory.length)}</span> de{" "}
                    <span className="text-white font-bold">{purchaseHistory.length}</span> órdenes
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPurchasePage(p => Math.max(p - 1, 1))}
                      disabled={purchasePage === 1}
                      className="rounded-xl bg-slate-900 hover:bg-slate-850 disabled:opacity-40 disabled:hover:bg-slate-900 disabled:cursor-not-allowed px-3 py-2 text-xs font-black text-slate-200 border border-slate-800 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      Anterior
                    </button>
                    <span className="text-xs font-bold text-slate-400 px-2">
                      Página {purchasePage} de {totalPurchasePages}
                    </span>
                    <button
                      onClick={() => setPurchasePage(p => Math.min(p + 1, totalPurchasePages))}
                      disabled={purchasePage === totalPurchasePages}
                      className="rounded-xl bg-slate-900 hover:bg-slate-850 disabled:opacity-40 disabled:hover:bg-slate-900 disabled:cursor-not-allowed px-3 py-2 text-xs font-black text-slate-200 border border-slate-800 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA B: INVENTARIO GENERAL */}
        {activeSubTab === "stock" && (
          <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl w-full overflow-hidden">
            <div className="text-left mb-6">
              <h3 className="text-lg font-black text-white">Stock Consolidado por Almacén</h3>
              <p className="text-xs text-slate-400 mt-1">Visualización del stock físico disponible a lo largo de toda nuestra red.</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-sm text-left border-collapse text-slate-350">
                <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Código Producto</th>
                    <th className="px-6 py-4">Nombre Producto</th>
                    <th className="px-6 py-4">Sucursal / Almacén</th>
                    <th className="px-6 py-4 text-right">Existencia Física</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {stockReport && stockReport.length > 0 ? (
                    stockReport.map((row: StockItem, index: number) => (
                      <tr key={index} className="hover:bg-slate-900/35 transition-colors">
                        <td className="px-6 py-4 font-bold text-white text-xs">{row.item_code}</td>
                        <td className="px-6 py-4 text-xs font-semibold">{row.item_name}</td>
                        <td className="px-6 py-4 text-xs">
                          <span className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 font-bold border border-slate-800">
                            {row.branch}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-xs text-white">
                          <span
                            className={row.actual_qty < 100 ? "text-red-400 animate-pulse font-black" : "text-emerald-400 font-black"}
                          >
                            {row.actual_qty} pzs
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-semibold">
                        No hay existencias registradas en ningún almacén.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA C: REGISTRO DE AUDITORIA */}
        {activeSubTab === "auditoria" && (
          <div className="space-y-6">
            
            {/* Cabecera y Selector interno de Auditoría */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Sub-pestañas internas de Auditoría con estética premium */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/60 rounded-2xl border border-slate-850/60 w-fit">
                <button
                  onClick={() => setAuditSubTab("inventario")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    auditSubTab === "inventario"
                      ? "bg-slate-900 text-white border border-slate-800 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📦 Movimientos de Stock
                </button>
                <button
                  onClick={() => setAuditSubTab("ventas")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    auditSubTab === "ventas"
                      ? "bg-slate-900 text-white border border-slate-800 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  💰 Historial de Ventas
                </button>
                <button
                  onClick={() => setAuditSubTab("cambios")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    auditSubTab === "cambios"
                      ? "bg-slate-900 text-white border border-slate-800 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ⚙️ Modificaciones de Config
                </button>
              </div>
            </div>

            {/* SECCION 1: MOVIMIENTOS DE STOCK */}
            {auditSubTab === "inventario" && (
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl space-y-4 w-full overflow-hidden">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Libro de Stock en Tiempo Real</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Visualización cronológica de entradas, salidas y transferencias físicas del catálogo en la base de datos.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-sm text-left border-collapse text-slate-350">
                    <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Fecha/Hora</th>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Sucursal</th>
                        <th className="px-6 py-4 text-right">Movimiento</th>
                        <th className="px-6 py-4">Documento Origen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {auditReport.stock_moves && auditReport.stock_moves.length > 0 ? (
                        auditReport.stock_moves.map((row: AuditStockMove) => (
                          <tr key={row.name} className="hover:bg-slate-900/35 transition-colors">
                            <td className="px-6 py-4 text-xs font-semibold">{row.timestamp.split(".")[0]}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-200">{row.user}</td>
                            <td className="px-6 py-4 text-xs">
                              <span className="font-bold text-white block">{row.item_code}</span>
                              <span className="text-[10px] text-slate-400">{row.item_name}</span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <span className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 font-bold border border-slate-800">
                                {row.branch}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-black">
                              <span className={row.actual_qty < 0 ? "text-red-400" : "text-emerald-400"}>
                                {row.actual_qty > 0 ? "+" : ""}{row.actual_qty} pzs
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                              <span className="block font-bold text-slate-300">{row.voucher_no}</span>
                              <span className="text-[9px] uppercase tracking-wide text-slate-500">{row.voucher_type}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-semibold">
                            No se registran movimientos de stock en este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCION 2: HISTORIAL DE VENTAS */}
            {auditSubTab === "ventas" && (
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl space-y-4 w-full overflow-hidden">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Bitácora de Transacciones de Venta</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Auditoría cronológica de creación, confirmación y cancelación de facturas del periodo.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-sm text-left border-collapse text-slate-350">
                    <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Fecha/Hora</th>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Factura ID</th>
                        <th className="px-6 py-4">Cliente</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {auditReport.sales_moves && auditReport.sales_moves.length > 0 ? (
                        auditReport.sales_moves.map((row: AuditSalesMove) => (
                          <tr key={row.name} className="hover:bg-slate-900/35 transition-colors">
                            <td className="px-6 py-4 text-xs font-semibold">{row.timestamp.split(".")[0]}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-200">{row.user}</td>
                            <td className="px-6 py-4 text-xs font-bold text-white">{row.name}</td>
                            <td className="px-6 py-4 text-xs font-semibold">{row.customer_name || "Público General"}</td>
                            <td className="px-6 py-4 text-right text-xs font-black text-white">${row.amount.toFixed(2)}</td>
                            <td className="px-6 py-4 text-center text-xs">
                              {row.docstatus === 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-850 font-bold text-[10px]">
                                  Borrador
                                </span>
                              )}
                              {row.docstatus === 1 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                                  Completado
                                </span>
                              )}
                              {row.docstatus === 2 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-[10px]">
                                  Cancelado
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-semibold">
                            No se registran transacciones de venta en este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCION 3: HISTORIAL DE MODIFICACIONES DE CONFIGURACION */}
            {auditSubTab === "cambios" && (
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl space-y-4 w-full overflow-hidden">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Historial de Modificaciones de Sistema</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Cambios detallados a nivel de campo en catálogos, almacenes y listas de precios (registro nativo Version).
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-sm text-left border-collapse text-slate-350">
                    <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Fecha/Hora</th>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Módulo/DocType</th>
                        <th className="px-6 py-4">Documento ID</th>
                        <th className="px-6 py-4">Cambios Detectados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {auditReport.version_logs && auditReport.version_logs.length > 0 ? (
                        auditReport.version_logs.map((row: AuditVersionLog) => {
                          // Formatear cambios nativos
                          const formatChanges = (dataDiff: AuditVersionDiff | undefined) => {
                            if (!dataDiff) return "Inserción o cambio estructural";
                            const changes: string[] = [];
                            if (dataDiff.changed && dataDiff.changed.length > 0) {
                              dataDiff.changed.forEach((c) => {
                                changes.push(`Cambió ${c[0]} de "${c[1] !== null ? c[1] : ''}" a "${c[2] !== null ? c[2] : ''}"`);
                              });
                            }
                            if (dataDiff.added && dataDiff.added.length > 0) {
                              changes.push(`Filas agregadas en tablas hijas`);
                            }
                            if (dataDiff.removed && dataDiff.removed.length > 0) {
                              changes.push(`Filas eliminadas en tablas hijas`);
                            }
                            return changes.length > 0 ? changes.join(" | ") : "Modificación guardada";
                          };

                          return (
                            <tr key={row.name} className="hover:bg-slate-900/35 transition-colors">
                              <td className="px-6 py-4 text-xs font-semibold">{row.timestamp.split(".")[0]}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-200">{row.user}</td>
                              <td className="px-6 py-4 text-xs font-bold text-white">
                                <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850">
                                  {row.voucher_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-300">{row.voucher_no}</td>
                              <td className="px-6 py-4 text-xs text-slate-300 font-semibold max-w-xs truncate" title={formatChanges(row.data_diff)}>
                                {formatChanges(row.data_diff)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-semibold">
                            No se registran cambios estructurales o de precios en este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* VISTA D: CONTROL DE TURNOS */}
        {activeSubTab === "turnos" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              
              {/* LISTADO DE TURNOS (Columna Izquierda 2/3 de ancho) */}
              <div className="lg:col-span-2 rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl space-y-4 w-full overflow-hidden">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Historial de Turnos de Caja</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Turnos abiertos y cerrados de punto de venta. Los montos de diferencia reflejan descuadres de arqueo.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-sm text-left border-collapse text-slate-350">
                    <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Turno ID / Sucursal</th>
                        <th className="px-6 py-4">Cajero</th>
                        <th className="px-6 py-4">Período</th>
                        <th className="px-6 py-4 text-right">Venta Total</th>
                        <th className="px-6 py-4 text-center">Diferencia</th>
                        <th className="px-6 py-4 text-center">Alertas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {shifts.length > 0 ? (
                        shifts.map((shift: ShiftData) => {
                          const isSelected = selectedShift?.opening_entry === shift.opening_entry;
                          const hasUSD = shift.usd_sales_count > 0;
                          
                          // Calcular descuadre neto sumando diferencias de métodos de pago
                          const netDiff = shift.closing_details?.reduce((sum: number, det: ShiftClosingDetail) => sum + (det.difference || 0), 0) || 0;
                          
                          return (
                            <tr 
                              key={shift.opening_entry} 
                              onClick={() => {
                                setSelectedShift(shift);
                                setExpandedInvoice(null);
                              }}
                              className={`cursor-pointer transition-colors ${
                                isSelected 
                                  ? "bg-indigo-500/10 hover:bg-indigo-500/15 border-l-4 border-indigo-500" 
                                  : "hover:bg-slate-900/35"
                              }`}
                            >
                              <td className="px-6 py-4">
                                <span className="font-bold text-white block text-xs">{shift.closing_entry || shift.opening_entry}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{shift.pos_profile}</span>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-200">{shift.user.split("@")[0]}</td>
                              <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                                <span className="block">{shift.period_start_date.split(".")[0]}</span>
                                <span className="text-[9px] text-slate-500">
                                  {shift.status === "Open" ? "🟢 En curso..." : `🔴 Cerrado: ${shift.period_end_date.split(".")[0]}`}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-black text-xs text-white">
                                ${shift.grand_total.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-black">
                                {shift.status === "Open" ? (
                                  <span className="text-slate-500 font-semibold">—</span>
                                ) : netDiff === 0 ? (
                                  <span className="text-emerald-400">Cuadrado</span>
                                ) : (
                                  <span className={netDiff < 0 ? "text-red-400" : "text-amber-400"}>
                                    {netDiff > 0 ? "+" : ""}${netDiff.toFixed(2)}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center text-xs">
                                {hasUSD && (
                                  <span 
                                    className="px-2 py-0.5 rounded-full font-black text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse"
                                    title={`Contiene ${shift.usd_sales_count} ventas en dólares`}
                                  >
                                    💵 USD
                                  </span>
                                )}
                                {!hasUSD && shift.status === "Open" && (
                                  <span className="px-2 py-0.5 rounded-full font-bold text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Abierto
                                  </span>
                                )}
                                {!hasUSD && shift.status === "Closed" && (
                                  <span className="px-2 py-0.5 rounded-full font-bold text-[9px] bg-slate-900 text-slate-500 border border-slate-800">
                                    Cerrado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-semibold">
                            No se registran turnos de caja en este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DETALLES DEL TURNO SELECCIONADO (Columna Derecha 1/3 de ancho) */}
              <div className="rounded-3xl border border-slate-850 bg-slate-950 p-4 sm:p-6 shadow-xl space-y-6 h-fit w-full overflow-hidden">
                {selectedShift ? (
                  <div className="space-y-6 text-left animate-fade-in">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Detalle de Turno</span>
                      <h3 className="text-lg font-black text-white mt-1">{selectedShift.closing_entry || selectedShift.opening_entry}</h3>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5" style={{ color: activeColor }}>
                        {selectedShift.pos_profile}
                      </p>
                    </div>

                    {/* Información Básica */}
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-850 space-y-2.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Cajero:</span>
                        <span className="text-white font-bold">{selectedShift.user}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Inicio:</span>
                        <span className="text-white font-bold">{selectedShift.period_start_date.split(".")[0]}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Estado:</span>
                        <span className={`font-black uppercase tracking-wider text-[9px] px-2 py-0.5 rounded-full border ${
                          selectedShift.status === "Open" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}>
                          {selectedShift.status === "Open" ? "Abierto" : "Cerrado"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400 pt-2.5 border-t border-slate-850">
                        <span>Total Tickets:</span>
                        <span className="text-white font-black">{selectedShift.sales_count} ventas</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Ventas del Turno:</span>
                        <span className="text-white font-black">${selectedShift.sales_total.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* AUDITORÍA DE DÓLARES (Visible únicamente si hay ventas en USD) */}
                    {selectedShift.usd_sales_count > 0 && (
                      <div className="p-4 bg-sky-950/20 border border-sky-500/20 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-sky-400">
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <h4 className="text-xs font-black uppercase tracking-wider">Auditoría: Caja de Dólares</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal font-medium">
                          Este turno contiene <strong>{selectedShift.usd_sales_count}</strong> transacciones pagadas en dólares. Validá la presencia física de los dólares en el cajón de efectivo:
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                            <span className="text-[8px] font-black uppercase text-slate-500 block leading-none">Billetes en USD:</span>
                            <span className="text-sm font-black text-sky-400 block mt-1">${selectedShift.usd_amount_collected.toFixed(2)} USD</span>
                          </div>
                          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                            <span className="text-[8px] font-black uppercase text-slate-500 block leading-none">Tasa Promedio:</span>
                            <span className="text-sm font-black text-white block mt-1">
                              ${((selectedShift?.usd_invoices?.reduce((sum: number, inv) => sum + inv.exchange_rate, 0) || 0) / (selectedShift?.usd_sales_count || 1)).toFixed(2)} MXN
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RECONCILIACIÓN / ARQUEO GENERAL DE EFECTIVO */}
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2.5">Arqueo de Efectivo</h4>
                      <div className="space-y-2">
                        {selectedShift?.closing_details && selectedShift.closing_details.length > 0 ? (
                          selectedShift.closing_details.map((detail: ShiftClosingDetail) => {
                            const isMismatch = (detail.difference || 0) !== 0;
                            return (
                              <div key={detail.mode_of_payment} className="p-3 bg-slate-900/35 rounded-xl border border-slate-850 space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-white">{detail.mode_of_payment === "Cash" ? "Efectivo (MXN)" : detail.mode_of_payment === "Credit Card" ? "Tarjeta" : detail.mode_of_payment}</span>
                                  {isMismatch && (
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                      detail.difference < 0 
                                        ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" 
                                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    }`}>
                                      Descuadre: {detail.difference > 0 ? "+" : ""}${detail.difference.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-slate-500 uppercase pt-1 border-t border-slate-900/60">
                                  <div>
                                    <span>Inicial:</span>
                                    <span className="block text-slate-300 font-extrabold text-[10px]">${detail.opening_amount.toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span>Esperado:</span>
                                    <span className="block text-slate-300 font-extrabold text-[10px]">${detail.expected_amount.toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span>Declarado:</span>
                                    <span className="block text-white font-extrabold text-[10px]">${(detail.closing_amount || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-slate-500 text-xs py-4 text-center">Sin detalles de reconciliación.</div>
                        )}
                      </div>
                    </div>

                    {/* LISTADO DE TICKETS DEL TURNO */}
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2.5">Facturas Emitidas ({selectedShift?.invoices?.length || 0})</h4>
                      <div className="max-h-48 overflow-y-auto border border-slate-850 rounded-2xl divide-y divide-slate-900/60 bg-slate-950/40">
                        {selectedShift?.invoices && selectedShift.invoices.length > 0 ? (
                          selectedShift.invoices.map((inv: ShiftInvoice) => {
                            const isUsdInvoice = inv.remarks && inv.remarks.includes("[Pago USD]");
                            const isExpanded = expandedInvoice === inv.name;
                            return (
                              <div 
                                key={inv.name} 
                                onClick={() => setExpandedInvoice(isExpanded ? null : inv.name)}
                                className="p-3 hover:bg-slate-900/35 transition-colors cursor-pointer select-none space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-white block">{inv.name}</span>
                                      <svg 
                                        className={`h-3 w-3 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor" 
                                        strokeWidth={3}
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                    <span className="text-[9px] text-slate-500 block font-medium">{inv.creation.split(" ")[1]?.split(".")[0] || ""} - {inv.customer_name || "General"}</span>
                                    {isUsdInvoice && (
                                      <span className="inline-block mt-1 text-[8px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                        Pago USD
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right space-y-0.5">
                                    <span className="text-xs font-black text-white block">${inv.grand_total.toFixed(2)}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-wider ${
                                      inv.docstatus === 0 ? "text-slate-500" : "text-emerald-400"
                                    }`}>
                                      {inv.docstatus === 0 ? "Borrador" : "Completado"}
                                    </span>
                                  </div>
                                </div>

                                {/* LISTA DE PRODUCTOS VENDIDOS */}
                                {isExpanded && (
                                  <div className="pt-2 border-t border-slate-900/60 space-y-1.5 animate-fade-in">
                                    {inv.items && inv.items.length > 0 ? (
                                      inv.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                          <div className="max-w-[70%] truncate">
                                            <span className="text-indigo-400 font-extrabold">{item.qty}x</span>{" "}
                                            <span className="text-slate-300">{item.item_name}</span>
                                          </div>
                                          <div className="text-right text-white">
                                            ${item.amount.toFixed(2)}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-slate-600 text-[10px] text-center italic py-1">Sin detalles de productos.</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-slate-500 text-xs py-6 text-center">Sin tickets en este turno.</div>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-20 px-6 border border-slate-850 border-dashed rounded-3xl">
                    <svg className="h-8 w-8 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <span className="text-xs font-semibold leading-relaxed">Seleccioná un turno del listado para auditar sus detalles y conciliar los montos de caja.</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
