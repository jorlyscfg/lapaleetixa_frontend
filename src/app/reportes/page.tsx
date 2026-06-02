"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetCall } from "frappe-react-sdk";
import { useRouter } from "next/navigation";

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

  const [activeSubTab, setActiveSubTab] = useState<"ventas" | "stock">("ventas");
  const [saasConfig, setSaasConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);

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
      const isProdUser = currentUser === "produccion@lapaletixa.com";
      const isLogisticaUser = currentUser === "logistica@lapaletixa.com";
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
  const metrics: MetricState | null = (metricsRaw as any)?.message?.metrics || null;

  // Obtener Datos de Reportes de Ventas (capturando error de forma segura)
  const { data: salesReportRaw, error: salesReportError, isLoading: salesReportLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_sales_report_data",
    { start_date: startDate, end_date: endDate },
    `saas_sales_report_${startDate}_${endDate}`
  );
  const salesReport = (salesReportRaw as any)?.message || null;

  // Obtener Datos de Stock General (capturando error de forma segura)
  const { data: stockReportRaw, error: stockReportError, isLoading: stockReportLoading } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_stock_report_data",
    {},
    "saas_stock_report"
  );
  const stockReport = (stockReportRaw as any)?.message?.stock_data || [];

  const activeColor = saasConfig?.colors?.primary || "#3498db";

  // Función para exportar a CSV de forma nativa
  const handleExportCSV = () => {
    if (!salesReport || !salesReport.detailed_sales || salesReport.detailed_sales.length === 0) return;

    const headers = ["Factura ID", "Fecha", "Cliente ID", "Cliente Nombre", "Total", "Metodo Pago", "POS"];
    const rows = salesReport.detailed_sales.map((item: any) => [
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
      [headers.join(","), ...rows.map((e: Array<any>) => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ventas_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pantalla de error amigable en lugar de reventar en bucle de refresco
  if (metricsError || salesReportError || stockReportError) {
    const errorMsg =
      (metricsError as any)?.message ||
      (salesReportError as any)?.message ||
      (stockReportError as any)?.message ||
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

  if (authLoading || configLoading || metricsLoading || salesReportLoading || stockReportLoading) {
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

    const points = data.map((d, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
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

  return (
    <div className="relative w-full h-full overflow-y-auto bg-slate-900 text-slate-100 font-sans">
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6 overflow-y-auto">
        
        {/* Encabezado e Selector de Fechas */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-left">
            <h1 className="text-2xl font-black text-white">
              Reportes Administrativos
            </h1>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Analizá en tiempo real el rendimiento transaccional, stock general y canales de distribución de <strong style={{ color: activeColor }}>{saasConfig?.client_name || "la empresa"}</strong>.
            </p>
          </div>

          {/* Filtro Rango de Fechas */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 px-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 px-2 border-l border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
              />
            </div>
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
            onClick={() => setActiveSubTab("ventas")}
            className={`tab-button ${activeSubTab === "ventas" ? "active" : ""}`}
          >
            📊 Análisis de Ventas
          </button>
          <button
            onClick={() => setActiveSubTab("stock")}
            className={`tab-button ${activeSubTab === "stock" ? "active" : ""}`}
          >
            📦 Inventario General
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

              {salesReport?.sales_trend?.length > 0 ? (
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
                      const item = salesReport.sales_trend[index];
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
                    <span>{salesReport.sales_trend[0]?.date}</span>
                    <span>{salesReport.sales_trend[Math.floor(salesReport.sales_trend.length / 2)]?.date}</span>
                    <span>{salesReport.sales_trend[salesReport.sales_trend.length - 1]?.date}</span>
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
                  {salesReport?.sales_by_branch?.length > 0 ? (
                    salesReport.sales_by_branch.map((branch: any) => {
                      const maxVal = Math.max(...salesReport.sales_by_branch.map((b: any) => b.total), 1);
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
                  {salesReport?.top_products?.length > 0 ? (
                    salesReport.top_products.map((item: any, idx: number) => (
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
            <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Registro Detallado de Facturación</h3>
                  <p className="text-xs text-slate-400 mt-1">Últimas 100 transacciones procesadas en el período.</p>
                </div>
                {salesReport?.detailed_sales?.length > 0 && (
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
                    {salesReport?.detailed_sales?.length > 0 ? (
                      salesReport.detailed_sales.map((item: any) => (
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

        {/* VISTA B: INVENTARIO GENERAL */}
        {activeSubTab === "stock" && (
          <div className="rounded-3xl border border-slate-850 bg-slate-950 p-6 shadow-xl">
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
                  {stockReport?.length > 0 ? (
                    stockReport.map((row: any, index: number) => (
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
      </main>
    </div>
  );
}
