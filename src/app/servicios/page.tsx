"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetDocList, useFrappePostCall } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { useSaaSConfig } from "../providers";

interface ServiceItem {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  description?: string;
  image?: string;
}

interface CartItem {
  service: ServiceItem;
  qty: number;
  rate: number;
  description: string;
}

export default function ServiciosPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const { saasConfig, configLoading } = useSaaSConfig();
  const router = useRouter();

  // Gestión de Pestañas: pos (Punto de Venta), catalog (Catálogo - Admin), history (Historial)
  const [activeTab, setActiveTab] = useState<"pos" | "catalog" | "history">("pos");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados del POS de Servicios
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [editRate, setEditRate] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  // Imagenes Antes y Después (URLs subidas)
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);

  // Modal para Nuevo Cliente Rápido
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Modales de Catálogo (Admin)
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [serviceNameField, setServiceNameField] = useState("");
  const [servicePriceField, setServicePriceField] = useState("");

  // Detectar rol de Administrador
  const isAdmin = currentUser && 
    !currentUser.startsWith("cajero.") && 
    !currentUser.startsWith("produccion@") && 
    !currentUser.startsWith("logistica@");

  // Redirigir si no hay sesión activa
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  const swrNoRetry = { shouldRetryOnError: false, revalidateOnFocus: false };

  // Consultas de datos de Frappe usando hooks estándar SWR
  const { data: rawCustomers, mutate: mutateCustomers } = useFrappeGetDocList(
    "Customer",
    { fields: ["name", "customer_name", "mobile_no"], limit: 200 },
    currentUser ? undefined : null,
    swrNoRetry
  );

  // Usamos el hook nativo de listado sobre Item para evitar fallos de sesión con get_active_services
  const { data: rawServices, mutate: mutateServices } = useFrappeGetDocList(
    "Item",
    {
      fields: ["name", "item_code", "item_name", "item_group", "standard_rate", "description", "image"],
      filters: [
        ["disabled", "=", 0],
        ["is_stock_item", "=", 0],
        ["has_variants", "=", 0]
      ],
      limit: 500
    },
    currentUser ? undefined : null,
    swrNoRetry
  );

  const { data: rawInvoices, mutate: mutateInvoices } = useFrappeGetDocList(
    "Sales Invoice",
    {
      fields: ["name", "customer", "posting_date", "grand_total", "creation", "docstatus"],
      filters: [["update_stock", "=", 0], ["docstatus", "!=", 2]],
      orderBy: { field: "creation", order: "desc" },
      limit: 50
    },
    currentUser ? undefined : null,
    swrNoRetry
  );

  // Consultar todos los archivos vinculados a Sales Invoice para el historial
  const { data: rawFiles, mutate: mutateFiles } = useFrappeGetDocList(
    "File",
    {
      fields: ["attached_to_name", "file_url"],
      filters: [["attached_to_doctype", "=", "Sales Invoice"]],
      limit: 500
    },
    currentUser ? undefined : null,
    swrNoRetry
  );

  // Llamadas de mutación y API
  const { call: createPosCustomer } = useFrappePostCall("paletixa_saas.paletixa_saas.api.create_pos_customer");
  const { call: createServiceInvoice } = useFrappePostCall("paletixa_saas.paletixa_saas.api.create_service_invoice");
  const { call: createServiceItem } = useFrappePostCall("paletixa_saas.paletixa_saas.api.create_service_item");
  const { call: updateServiceItem } = useFrappePostCall("paletixa_saas.paletixa_saas.api.update_service_item");

  const customersList = rawCustomers || [];
  const servicesList: ServiceItem[] = (rawServices as ServiceItem[]) || [];
  const invoicesList = rawInvoices || [];
  const filesList = rawFiles || [];

  // Filtrar clientes por búsqueda de texto
  const filteredCustomers = customersList.filter(c =>
    c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.mobile_no && c.mobile_no.includes(customerSearch))
  );

  // Agregar al carro
  const handleAddToOrder = (service: ServiceItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.service.item_code === service.item_code);
      if (existing) {
        return prev.map(item =>
          item.service.item_code === service.item_code
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { service, qty: 1, rate: service.standard_rate || 0, description: "" }];
    });
  };

  // Remover del carro
  const handleRemoveFromOrder = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    if (editingCartIndex === index) {
      setEditingCartIndex(null);
    }
  };

  // Abrir editor de precio/nota
  const handleOpenCartItemEditor = (index: number) => {
    setEditingCartIndex(index);
    setEditRate(cart[index].rate.toString());
    setEditNotes(cart[index].description);
  };

  // Guardar edición de item del carro
  const handleSaveCartItemEdit = () => {
    if (editingCartIndex === null) return;
    const rateVal = parseFloat(editRate);
    if (isNaN(rateVal) || rateVal < 0) {
      setErrorMsg("El precio debe ser un número positivo.");
      return;
    }
    setCart(prev =>
      prev.map((item, i) =>
        i === editingCartIndex
          ? { ...item, rate: rateVal, description: editNotes }
          : item
      )
    );
    setEditingCartIndex(null);
  };

  // Canvas local para redimensionar y comprimir imágenes antes de subir
  const compressAndUploadImage = async (file: File, isBefore: boolean) => {
    if (isBefore) setUploadingBefore(true);
    else setUploadingAfter(true);
    setErrorMsg(null);

    try {
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Error obteniendo canvas context."));
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => blob ? resolve(blob) : reject(new Error("Error de compresión.")),
              "image/jpeg",
              0.8
            );
          };
          img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
      });

      const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
      const formData = new FormData();
      formData.append("file", compressedBlob, `${isBefore ? "before" : "after"}_${Date.now()}.jpg`);
      formData.append("is_private", "0");
      formData.append("folder", "Home/Attachments");

      const res = await fetch(`${url}/api/method/upload_file`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al subir la imagen al servidor.");
      }

      const data = await res.json();
      if (data.message && data.message.file_url) {
        if (isBefore) setBeforeImage(data.message.file_url);
        else setAfterImage(data.message.file_url);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMsg(message || "No se pudo subir la foto.");
    } finally {
      if (isBefore) setUploadingBefore(false);
      else setUploadingAfter(false);
    }
  };

  // Crear cliente rápido
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createPosCustomer({
        customer_name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined
      });
      const data = res?.message || res;
      if (data && data.name) {
        setSuccessMsg(`Cliente '${data.customer_name}' creado con éxito.`);
        setSelectedCustomer(data.name);
        setCustomerSearch(data.customer_name);
        mutateCustomers();
        setShowCustomerModal(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || "Error al crear el cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Registrar el Cobro del Servicio (POS Checkout)
  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setErrorMsg("Debés seleccionar un cliente para cobrar el servicio.");
      return;
    }
    if (cart.length === 0) {
      setErrorMsg("El carrito está vacío. Agregá al menos un servicio.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const itemsPayload = cart.map(item => ({
      item_code: item.service.item_code,
      qty: item.qty,
      rate: item.rate,
      description: item.description
    }));

    const totalAmount = cart.reduce((acc, item) => acc + (item.rate * item.qty), 0);

    try {
      const res = await createServiceInvoice({
        customer: selectedCustomer,
        items: JSON.stringify(itemsPayload),
        payment_amount: totalAmount,
        payment_mode: paymentMode,
        before_image: beforeImage || undefined,
        after_image: afterImage || undefined
      });

      const data = res?.message || res;
      if (data && data.success) {
        setSuccessMsg(`¡Servicio cobrado con éxito! Factura: ${data.invoice_name}`);
        // Reset POS state
        setCart([]);
        setSelectedCustomer("");
        setCustomerSearch("");
        setBeforeImage(null);
        setAfterImage(null);
        // Refresh invoices and files list
        mutateInvoices();
        mutateFiles();
        setTimeout(() => setSuccessMsg(null), 6000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMsg(message || "Error al registrar el cobro.");
    } finally {
      setSubmitting(false);
    }
  };

  // Crear/Editar Servicio en el Catálogo (Admin)
  const handleCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceNameField.trim()) return;
    const rateVal = parseFloat(servicePriceField);
    if (isNaN(rateVal) || rateVal < 0) {
      setErrorMsg("El precio debe ser un número válido.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingService) {
        // Modo Edición
        const res = await updateServiceItem({
          item_code: editingService.item_code,
          item_name: serviceNameField.trim(),
          standard_rate: rateVal
        });
        const data = res?.message || res;
        if (data && data.success) {
          setSuccessMsg(`Servicio modificado con éxito.`);
        }
      } else {
        // Modo Creación
        const res = await createServiceItem({
          item_name: serviceNameField.trim(),
          standard_rate: rateVal
        });
        const data = res?.message || res;
        if (data && data.success) {
          setSuccessMsg(`Servicio '${serviceNameField}' creado con éxito.`);
        }
      }
      mutateServices();
      setShowCatalogModal(false);
      setEditingService(null);
      setServiceNameField("");
      setServicePriceField("");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || "Error al guardar el servicio.");
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir Modal Catálogo en modo Creación
  const handleOpenCreateCatalog = () => {
    setEditingService(null);
    setServiceNameField("");
    setServicePriceField("");
    setShowCatalogModal(true);
  };

  // Abrir Modal Catálogo en modo Edición
  const handleOpenEditCatalog = (service: ServiceItem) => {
    setEditingService(service);
    setServiceNameField(service.item_name);
    setServicePriceField(service.standard_rate.toString());
    setShowCatalogModal(true);
  };

  if (authLoading || configLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-purple-500"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">Cargando Módulo de Servicios...</p>
        </div>
      </div>
    );
  }

  // Verificar si está activo el módulo
  if (saasConfig && !saasConfig.features?.services) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 font-sans p-6">
        <div className="rounded-3xl bg-slate-950 border border-slate-850 p-8 max-w-xl text-center space-y-4 shadow-2xl">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">Módulo de Servicios Inactivo</h3>
          <p className="text-sm text-slate-400 leading-normal">
            El módulo de prestación de servicios no está activo para esta franquicia. Podés habilitarlo desde el panel de Configuración si tu modelo de negocio lo requiere.
          </p>
          <div className="pt-4 flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all cursor-pointer shadow-md"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const primaryColor = saasConfig?.colors?.primary || "#8b5cf6";
  const cartTotal = cart.reduce((acc, item) => acc + (item.rate * item.qty), 0);

  return (
    <div className="relative h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Degradados decorativos de fondo */}
      <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none animate-pulse"></div>
      <div 
        className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      ></div>

      {/* Header con Pestañas alineado a la barra superior global */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-850 px-4 py-2 gap-2 flex-shrink-0 z-10 bg-slate-950/40 backdrop-blur-md">
        <div className="tab-container flex-shrink-0">
          <button
            onClick={() => setActiveTab("pos")}
            className={`tab-button flex items-center justify-center gap-1.5 ${activeTab === "pos" ? "active" : ""}`}
          >
            ⚡ <span>Registrar Cobro</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("catalog")}
              className={`tab-button flex items-center justify-center gap-1.5 ${activeTab === "catalog" ? "active" : ""}`}
            >
              📖 <span>Catálogo</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab("history")}
            className={`tab-button flex items-center justify-center gap-1.5 ${activeTab === "history" ? "active" : ""}`}
          >
            📊 <span>Historial</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full px-4 py-3 flex flex-col gap-4 overflow-y-auto pb-16 relative z-10">
        
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-bold flex items-center justify-between animate-fade-in shadow-md">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-bold flex items-center justify-between animate-fade-in shadow-md">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {/* TAB 1: POS DE SERVICIOS */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start flex-1 min-h-0">
            
            {/* PANEL IZQUIERDO: SELECCIÓN DE CLIENTE Y SERVICIOS */}
            <div className="lg:col-span-8 flex flex-col gap-4 h-full min-h-0">
              
              {/* Bloque Selección de Cliente */}
              <div className="bg-slate-950 border border-slate-850 p-4 sm:p-5 rounded-3xl shadow-xl relative">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Cliente Receptor</label>
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscá por nombre o celular..."
                      value={customerSearch}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none font-semibold transition-all"
                    />
                    {selectedCustomer && (
                      <button 
                        onClick={() => {
                          setSelectedCustomer("");
                          setCustomerSearch("");
                        }}
                        className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 px-4 py-3 text-xs font-black text-white active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>+ Nuevo</span>
                  </button>

                  {/* Dropdown de clientes filtrados */}
                  {showCustomerDropdown && (
                    <div className="absolute top-[110%] left-0 right-0 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-20 divide-y divide-slate-900">
                      {filteredCustomers.length === 0 ? (
                        <p className="p-3 text-xs text-slate-500 italic">No se encontraron clientes.</p>
                      ) : (
                        filteredCustomers.map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c.name);
                              setCustomerSearch(c.customer_name);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left p-3 hover:bg-slate-900 text-xs text-slate-200 font-semibold transition-colors flex justify-between items-center"
                          >
                            <span>{c.customer_name}</span>
                            {c.mobile_no && <span className="text-[10px] text-slate-500">{c.mobile_no}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Catálogo de Servicios para el técnico */}
              <div className="bg-slate-950 border border-slate-850 p-4 sm:p-5 rounded-3xl shadow-xl flex-1 flex flex-col min-h-[300px]">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
                  ✂️ Servicios Disponibles
                </h2>
                {servicesList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-12 text-center flex-1 flex items-center justify-center border border-dashed border-slate-850 rounded-2xl">
                    No hay servicios creados. Si sos admin, podés agregarlos desde la pestaña &quot;Catálogo&quot;.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-1">
                    {servicesList.map((service) => (
                      <button
                        key={service.name}
                        onClick={() => handleAddToOrder(service)}
                        className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 text-left hover:border-slate-700 hover:bg-slate-900/60 transition-all group flex flex-col justify-between h-32 active:scale-[0.98]"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
                            {service.item_name}
                          </p>
                          {service.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <span className="text-xs font-black text-slate-200">
                            ${(service.standard_rate || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="h-6 w-6 rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center text-xs font-bold group-hover:bg-purple-650 group-hover:text-white transition-all">
                            +
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PANEL DERECHO: DETALLE DEL CARRITO Y COBRO */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-950 border border-slate-850 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col gap-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2">
                  🛒 Resumen de Sesión
                </h3>

                {/* Lista del Carrito */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-6 text-center">Carro vacío. Seleccioná servicios a prestar.</p>
                  ) : (
                    cart.map((item, index) => (
                      <div key={index} className="bg-slate-900/60 border border-slate-850 rounded-2xl p-3 flex flex-col gap-2 relative">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5 max-w-[80%]">
                            <p className="text-xs font-bold text-white truncate">{item.service.item_name}</p>
                            {item.description && (
                              <p className="text-[10px] text-slate-500 italic leading-tight truncate">{item.description}</p>
                            )}
                          </div>
                          <button 
                            onClick={() => handleRemoveFromOrder(index)}
                            className="text-[10px] text-red-500 hover:text-red-400 font-bold"
                          >
                            Quitar
                          </button>
                        </div>
                        
                        <div className="flex justify-between items-center mt-1 border-t border-slate-850 pt-2">
                          <button 
                            onClick={() => handleOpenCartItemEditor(index)}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-bold"
                          >
                            ✏️ Editar Precio
                          </button>
                          <span className="text-xs font-black text-white">
                            ${(item.rate * item.qty).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Evidencia Fotográfica Antes/Después */}
                <div className="space-y-3 border-t border-slate-850 pt-4">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450">Evidencia del Servicio</span>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Foto del Antes */}
                    <div className="relative">
                      {beforeImage ? (
                        <div className="relative rounded-2xl border border-slate-850 overflow-hidden h-24 bg-slate-900">
                          <div
                            role="img"
                            aria-label="Antes"
                            className="h-full w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${beforeImage})` }}
                          />
                          <button 
                            onClick={() => setBeforeImage(null)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="rounded-2xl border border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center h-24 cursor-pointer text-center p-2">
                          <span className="text-[10px] font-bold text-slate-400">📷 Foto Antes</span>
                          {uploadingBefore ? (
                            <span className="text-[8px] text-purple-400 animate-pulse mt-1">Subiendo...</span>
                          ) : (
                            <span className="text-[8px] text-slate-500 mt-1">Formatos JPG/PNG</span>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            disabled={uploadingBefore}
                            onChange={(e) => e.target.files?.[0] && compressAndUploadImage(e.target.files[0], true)}
                          />
                        </label>
                      )}
                    </div>

                    {/* Foto del Después */}
                    <div className="relative">
                      {afterImage ? (
                        <div className="relative rounded-2xl border border-slate-850 overflow-hidden h-24 bg-slate-900">
                          <div
                            role="img"
                            aria-label="Después"
                            className="h-full w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${afterImage})` }}
                          />
                          <button 
                            onClick={() => setAfterImage(null)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="rounded-2xl border border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center h-24 cursor-pointer text-center p-2">
                          <span className="text-[10px] font-bold text-slate-400">📷 Foto Después</span>
                          {uploadingAfter ? (
                            <span className="text-[8px] text-purple-400 animate-pulse mt-1">Subiendo...</span>
                          ) : (
                            <span className="text-[8px] text-slate-500 mt-1">Formatos JPG/PNG</span>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            disabled={uploadingAfter}
                            onChange={(e) => e.target.files?.[0] && compressAndUploadImage(e.target.files[0], false)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Forma de Pago */}
                <div className="space-y-2 border-t border-slate-850 pt-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-450">Medio de Cobro</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Cash", "Credit Card", "Bank Draft"].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                          paymentMode === mode
                            ? "bg-purple-600/10 border-purple-500 text-purple-400"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {mode === "Cash" ? "💵 Efectivo" : mode === "Credit Card" ? "💳 Tarjeta" : "🏦 Transf."}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total y Checkout */}
                <div className="border-t border-slate-850 pt-4 space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-400">Total Cobrado</span>
                    <span className="text-xl font-black text-white">
                      ${cartTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={submitting || cart.length === 0}
                    className="w-full rounded-2xl py-4 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitting ? "Procesando Cobro..." : "Registrar Servicio y Cobrar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CATALOGO DE SERVICIOS (ADMIN) */}
        {activeTab === "catalog" && isAdmin && (
          <div className="bg-slate-950 border border-slate-850 p-4 sm:p-5 rounded-3xl shadow-xl space-y-4 flex flex-col flex-1">
            <div className="flex justify-between items-center border-b border-slate-850 pb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">📖 Tarifas de Servicios</h2>
              <button
                onClick={handleOpenCreateCatalog}
                className="rounded-xl px-4 py-2 text-xs font-black text-white shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                + Crear Servicio
              </button>
            </div>

            {servicesList.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-12 text-center border border-dashed border-slate-850 rounded-2xl">No hay servicios registrados en la base de datos.</p>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Código de Servicio</th>
                      <th className="py-3 px-4">Nombre del Servicio</th>
                      <th className="py-3 px-4 text-right">Precio Base (Tarifa)</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs font-semibold text-slate-300">
                    {servicesList.map((service) => (
                      <tr key={service.name} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-purple-400">{service.name}</td>
                        <td className="py-3 px-4 font-bold text-white">{service.item_name}</td>
                        <td className="py-3 px-4 text-right text-white">
                          ${(service.standard_rate || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEditCatalog(service)}
                            className="text-xs text-purple-400 hover:text-purple-300 font-bold px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg"
                          >
                            Editar Precio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HISTORIAL DE SERVICIOS */}
        {activeTab === "history" && (
          <div className="bg-slate-950 border border-slate-850 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col flex-1 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">📊 Historial de Servicios Prestados</h2>
            
            {invoicesList.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-12 text-center border border-dashed border-slate-850 rounded-2xl">No hay registros de cobros de servicios.</p>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Factura</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4 text-right">Total Cobrado</th>
                      <th className="py-3 px-4 text-center">Imágenes Adjuntas</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs font-semibold text-slate-300">
                    {invoicesList.map((invoice) => {
                      // Filtrar fotos asociadas a esta factura
                      const attachedPics = filesList.filter(f => f.attached_to_name === invoice.name);
                      return (
                        <tr key={invoice.name} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-black text-white">{invoice.name}</td>
                          <td className="py-3 px-4 font-bold text-white">{invoice.customer}</td>
                          <td className="py-3 px-4 text-slate-400">{invoice.posting_date}</td>
                          <td className="py-3 px-4 text-right font-black text-white">
                            ${(invoice.grand_total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-center">
                              {attachedPics.length === 0 ? (
                                <span className="text-[10px] text-slate-650 italic">Sin fotos</span>
                              ) : (
                                attachedPics.map((pic, pIdx) => (
                                  <a 
                                    key={pIdx} 
                                    href={pic.file_url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="h-8 w-8 rounded-lg overflow-hidden border border-slate-800 hover:border-purple-500 transition-all flex bg-slate-900"
                                  >
                                    <div
                                      role="img"
                                      aria-label="Evidencia"
                                      className="h-full w-full bg-cover bg-center"
                                      style={{ backgroundImage: `url(${pic.file_url})` }}
                                    />
                                  </a>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Cobrado
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL 1: EDITAR PRECIO / AÑADIR NOTA DE CARRITO */}
      {editingCartIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-in">
            <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              ✏️ Ajustar Tarifa
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Precio / Tarifa ($)</label>
                <input
                  type="number"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none font-semibold focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Recargos Extras / Notas</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Detallá cargos adicionales o especificaciones..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none font-semibold focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCartIndex(null)}
                className="rounded-xl bg-slate-950/40 border border-slate-800 hover:bg-slate-900/50 text-slate-400 hover:text-white px-4 py-2.5 text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCartItemEdit}
                className="rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREACIÓN / EDICIÓN DE SERVICIOS EN EL CATÁLOGO (ADMIN) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleCatalogSubmit}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-in"
          >
            <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              📋 {editingService ? "Editar Tarifa" : "Nuevo Servicio"}
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  disabled={!!editingService} // Evitamos renombrar directamente el Item Code de ERPNext para simplicidad
                  value={serviceNameField}
                  onChange={(e) => setServiceNameField(e.target.value)}
                  placeholder="Ej. Corte de Cabello, Limpieza de cutis..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none font-semibold focus:border-purple-500 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Precio Base ($)</label>
                <input
                  type="number"
                  required
                  value={servicePriceField}
                  onChange={(e) => setServicePriceField(e.target.value)}
                  placeholder="200.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none font-semibold focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCatalogModal(false);
                  setEditingService(null);
                }}
                className="rounded-xl bg-slate-950/40 border border-slate-800 hover:bg-slate-900/50 text-slate-400 hover:text-white px-4 py-2.5 text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? "Guardando..." : "Guardar Servicio"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: CREACIÓN RÁPIDA DE CLIENTE */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleCreateCustomer}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-scale-in"
          >
            <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              👤 Alta Rápida de Cliente
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ej. María López"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none font-semibold focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Teléfono / Celular</label>
                <input
                  type="text"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="10 dígitos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none font-semibold focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="rounded-xl bg-slate-950/40 border border-slate-800 hover:bg-slate-900/50 text-slate-400 hover:text-white px-4 py-2.5 text-xs font-black transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? "Creando..." : "Crear Cliente"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
