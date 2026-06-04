"use client";

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetDocList, useFrappeCreateDoc } from "frappe-react-sdk";
import { useRouter } from "next/navigation";

interface FeatureConfig {
  client_name: string;
  colors: {
    primary: string;
  };
  features: {
    pos: boolean;
    production: boolean;
    logistics: boolean;
    allow_pos_out_of_stock?: boolean;
    mexico_taxes?: boolean;
  };
  company_name?: string;
  company_logo?: string;
  company_tax_id?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  ticket_header?: string;
  ticket_footer?: string;
  print_logo?: boolean;
  print_tax_id?: boolean;
  print_address?: boolean;
  print_contact?: boolean;
}

interface CartItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  image?: string;
}

export default function POSPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  const isCashier = currentUser?.startsWith("cajero.");
  const isProdUser = currentUser === "produccion@lapaletixa.com";
  const isLogisticaUser = currentUser === "logistica@lapaletixa.com";
  const isAdmin = currentUser && !isCashier && !isProdUser && !isLogisticaUser;

  const getSucursalName = (email: string | null | undefined) => {
    if (!email) return "";
    if (email.includes(".s1.")) return "Sucursal 1";
    if (email.includes(".s2.")) return "Sucursal 2";
    if (email.includes(".s3.")) return "Sucursal 3";
    if (email.includes(".s4.")) return "Sucursal 4";
    return "Sucursal General";
  };

  const sucursalName = getSucursalName(currentUser);

  const getDisplaySucursalName = () => {
    if (posProfile?.pos_profile) {
      return posProfile.pos_profile.replace("Punto de Venta - ", "");
    }
    return sucursalName || "Sucursal General";
  };

  // Almacenes de sucursales habilitados para el Punto de Venta (POS) como fallback de Admin
  const warehouses = [
    { name: "Sucursal 1 - LP", label: "🍦 Sucursal 1" },
    { name: "Sucursal 2 - LP", label: "🍦 Sucursal 2" },
    { name: "Sucursal 3 - LP", label: "🍦 Sucursal 3" },
    { name: "Sucursal 4 - LP", label: "🍦 Sucursal 4" }
  ];

  // Estados del POS
  const [activeWarehouse, setActiveWarehouse] = useState<string>("Sucursal 1 - LP");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [wholesaleOverride, setWholesaleOverride] = useState<boolean | null>(null);
  
  // Estados de Pago
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // === ESTADOS DINÁMICOS DE PERFIL, APERTURA Y CIERRE DE TURNOS ===
  const [posProfile, setPosProfile] = useState<any>(null);
  const [activeOpening, setActiveOpening] = useState<any>(null);
  const [posDataLoading, setPosDataLoading] = useState(true);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  
  // Balances declarados para apertura y cierre
  const [openingBalances, setOpeningBalances] = useState<{[key: string]: number}>({});
  const [closingBalances, setClosingBalances] = useState<{[key: string]: number}>({});

  // === ESTADOS PARA CONVERSIÓN DE MONEDA USD ===
  const [usdExchangeRate, setUsdExchangeRate] = useState<number>(0);
  const [inputUsdRate, setInputUsdRate] = useState<string>("");
  const [payInUsd, setPayInUsd] = useState<boolean>(false);
  const [usdAmountPaid, setUsdAmountPaid] = useState<number>(0);
  const [tempUsdRate, setTempUsdRate] = useState<string>("");

  // === ESTADOS PARA CLIENTES OPCIONALES ===
  const [selectedCustomer, setSelectedCustomer] = useState<string>("Público General");
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerRFC, setNewCustomerRFC] = useState("");
  const [newCustomerRegime, setNewCustomerRegime] = useState("601");
  const [newCustomerCFDIUse, setNewCustomerCFDIUse] = useState("G03");
  const [newCustomerRequiresInvoice, setNewCustomerRequiresInvoice] = useState(false);

  // === ESTADOS PARA IMPRESIÓN DE TICKET ===
  interface PrintedTicketData {
    invoiceId: string;
    customer: string;
    date: string;
    items: Array<{
      item_code: string;
      item_name: string;
      qty: number;
      rate: number;
    }>;
    subtotal: number;
    total: number;
    amountPaid: number;
    changeDue: number;
    paymentMode: string;
    payInUsd?: boolean;
    usdAmountPaid?: number;
    usdExchangeRate?: number;
  }
  const [printedTicket, setPrintedTicket] = useState<PrintedTicketData | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Helper robusto para llamar APIs whitelisteadas en el backend
  const callFrappeAPI = async (method: string, args: any = {}) => {
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
      throw new Error(err._server_messages ? JSON.parse(err._server_messages).join("\n") : err.message || "Error al conectar con la API de Frappe.");
    }
    const data = await response.json();
    return data.message;
  };

  // Carga del perfil POS y estado de turno activo
  const loadPOSProfileAndShift = async (selectedProfileName?: string) => {
    setPosDataLoading(true);
    setErrorMessage(null);
    try {
      const profile = await callFrappeAPI("get_pos_profile", selectedProfileName ? { selected_profile: selectedProfileName } : {});
      setPosProfile(profile);
      
      if (profile.warehouse) {
        setActiveWarehouse(profile.warehouse);
      }
      setSelectedCustomer(profile.customer || "Público General");
      
      const defaultMop = profile.payment_methods.find((p: any) => p.default === 1)?.mode_of_payment || profile.payment_methods[0]?.mode_of_payment;
      if (defaultMop) {
        setPaymentMode(defaultMop);
      }

      // Buscar si el cajero ya tiene un turno abierto
      const opening = await callFrappeAPI("get_active_pos_opening", { pos_profile: profile.pos_profile });
      if (opening) {
        setActiveOpening(opening);
        setShowOpeningModal(false);
        const savedRate = localStorage.getItem(`pos_usd_rate_${opening.name}`);
        if (savedRate) {
          setUsdExchangeRate(parseFloat(savedRate) || 0);
          setInputUsdRate(savedRate);
        } else {
          setUsdExchangeRate(0);
          setInputUsdRate("");
        }
      } else {
        setActiveOpening(null);
        setUsdExchangeRate(0);
        setInputUsdRate("");
        // Preparar balance inicial de apertura
        const initialBalances: {[key: string]: number} = {};
        profile.payment_methods.forEach((pm: any) => {
          initialBalances[pm.mode_of_payment] = 0;
        });
        setOpeningBalances(initialBalances);
        setShowOpeningModal(true);
      }
    } catch (err: any) {
      console.error("Error cargando perfil POS:", err);
      setErrorMessage(err.message || "No tenés un Perfil de Punto de Venta asignado en ERPNext.");
    } finally {
      setPosDataLoading(false);
    }
  };

  // Cargar configuraciones iniciales
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

  // Control de sesión
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  // Cargar perfil al iniciar sesión
  useEffect(() => {
    if (currentUser) {
      loadPOSProfileAndShift();
    }
  }, [currentUser]);

  // Bloqueo por feature flag del POS
  useEffect(() => {
    if (!configLoading && saasConfig && !saasConfig.features.pos) {
      router.push("/");
    }
  }, [saasConfig, configLoading, router]);

  // Debounce para búsqueda de clientes
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
  }, [customerQuery]);



  // Consultar catálogo de productos listos para venta en ERPNext
  const { data: items, isLoading: itemsLoading } = useFrappeGetDocList("Item", {
    fields: ["name", "item_name", "item_group", "image", "standard_rate", "has_variants"],
    filters: [
      ["disabled", "=", 0],
      ["item_group", "=", "Products"],
      ["has_variants", "=", 0],
      ["name", "!=", "Carrito Paletero"]
    ],
    limit: 150
  });

  // Consultar precios de los productos en ERPNext (Standard Selling y Standard Wholesale)
  const { data: prices, isLoading: pricesLoading } = useFrappeGetDocList("Item Price", {
    fields: ["item_code", "price_list", "price_list_rate"],
    filters: [
      ["price_list", "in", ["Standard Selling", "Standard Wholesale"]]
    ],
    limit: 1000
  });

  // Consultar stock en tiempo real para la sucursal activa (Bin)
  const { data: bins, isLoading: binsLoading, mutate: mutateBins } = useFrappeGetDocList("Bin", {
    fields: ["item_code", "warehouse", "actual_qty"],
    filters: [
      ["warehouse", "=", activeWarehouse]
    ],
    limit: 1000
  });

  // Consultar códigos de barra de los productos (mediante API custom para evitar 403)
  const [itemBarcodes, setItemBarcodes] = useState<any[]>([]);
  const [barcodesLoading, setBarcodesLoading] = useState(true);

  useEffect(() => {
    async function fetchBarcodes() {
      try {
        const res = await callFrappeAPI("get_item_barcodes");
        setItemBarcodes(res || []);
      } catch (err) {
        console.error("Error al cargar códigos de barra:", err);
      } finally {
        setBarcodesLoading(false);
      }
    }
    if (currentUser) {
      fetchBarcodes();
    }
  }, [currentUser]);

  const { createDoc } = useFrappeCreateDoc();

  // Escáner de código de barras global (Pistola USB/Bluetooth)
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un input de texto normal
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      const currentTime = Date.now();
      
      // Si pasa mucho tiempo (>50ms) entre teclas, asumimos que es tipeo manual y reiniciamos
      if (currentTime - lastKeyTime > 50) {
        buffer = "";
      }
      
      lastKeyTime = currentTime;

      // Si presionan Enter, se completa el escaneo
      if (e.key === "Enter") {
        if (buffer.trim().length > 2) {
          const barcode = buffer.trim();
          console.log("Código de barras escaneado:", barcode);
          const barcodeDoc = itemBarcodes?.find(b => b.barcode.trim() === barcode);
          if (barcodeDoc) {
            const item = items?.find(i => i.name === barcodeDoc.parent);
            if (item) {
              addToCart(item);
              setSuccessMessage(`Producto "${item.item_name}" agregado por escaneo.`);
              setErrorMessage(null);
              setTimeout(() => setSuccessMessage(null), 3000);
            } else {
              setErrorMessage(`El producto "${barcodeDoc.parent}" no está disponible en el catálogo.`);
            }
          } else {
            setErrorMessage(`El código de barras "${barcode}" no está registrado.`);
          }
          e.preventDefault();
        }
        buffer = "";
        return;
      }

      // Evitar teclas especiales (Shift, Ctrl, Alt, etc.)
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [items, itemBarcodes]);

  // Obtener stock actual de un producto en la sucursal seleccionada
  const getItemStock = (itemCode: string) => {
    const binDoc = bins?.find(b => b.item_code === itemCode && b.warehouse === activeWarehouse);
    return binDoc ? binDoc.actual_qty : 0;
  };

  // Obtener precio real de lista de precios de la DB
  const getItemPrice = (itemCode: string, standardRate: number) => {
    const priceDoc = prices?.find(p => p.item_code === itemCode && p.price_list === "Standard Selling");
    return priceDoc ? priceDoc.price_list_rate : (standardRate || 10.0);
  };

  // Obtener precio mayorista
  const getItemWholesalePrice = (itemCode: string) => {
    const priceDoc = prices?.find(p => p.item_code === itemCode && p.price_list === "Standard Wholesale");
    return priceDoc ? priceDoc.price_list_rate : null;
  };

  // Gestión de Carrito con validaciones estrictas de stock
  const addToCart = (item: any) => {
    const stock = getItemStock(item.name);
    if (stock <= 0) {
      setErrorMessage(`El producto "${item.item_name}" no tiene existencias disponibles en esta sucursal.`);
      return;
    }

    setCart((prevCart = []) => {
      const existing = prevCart.find(i => i.item_code === item.name);
      const rate = getItemPrice(item.name, item.standard_rate);
      
      const currentQty = existing ? existing.qty : 0;
      if (currentQty + 1 > stock) {
        setErrorMessage(`No podés agregar más unidades de "${item.item_name}". Stock disponible: ${stock} unidades.`);
        return prevCart;
      }
      
      setErrorMessage(null);

      if (existing) {
        return prevCart.map(i => 
          i.item_code === item.name ? { ...i, qty: i.qty + 1 } : i
        );
      } else {
        return [...prevCart, {
          item_code: item.name,
          item_name: item.item_name,
          qty: 1,
          rate: rate,
          image: item.image
        }];
      }
    });
  };

  const updateCartQty = (itemCode: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemCode);
      return;
    }

    const stock = getItemStock(itemCode);
    if (newQty > stock) {
      const item = items?.find(i => i.name === itemCode);
      setErrorMessage(`No podés vender más unidades de "${item?.item_name || itemCode}". Stock disponible: ${stock} unidades.`);
      return;
    }

    setErrorMessage(null);
    setCart((prevCart = []) => 
      prevCart.map(i => i.item_code === itemCode ? { ...i, qty: newQty } : i)
    );
  };

  const removeFromCart = (itemCode: string) => {
    setCart((prevCart = []) => prevCart.filter(i => i.item_code !== itemCode));
  };

  const clearCart = () => {
    setCart([]);
    setWholesaleOverride(null);
    setShowCheckout(false);
    setSelectedCustomer(posProfile?.customer || "Público General");
  };

  // Obtener precio activo en tiempo real
  const getActiveItemPrice = (itemCode: string, standardRate: number, itemQty: number = 0) => {
    const retail = getItemPrice(itemCode, standardRate);
    
    if (wholesaleOverride === true) {
      const wholesale = getItemWholesalePrice(itemCode);
      return wholesale && wholesale > 0 ? wholesale : retail;
    }
    if (wholesaleOverride === false) {
      return retail;
    }

    if (itemQty >= 10) {
      const wholesale = getItemWholesalePrice(itemCode);
      return wholesale && wholesale > 0 ? wholesale : retail;
    }

    return retail;
  };

  const hasItemWholesale = cart?.some(item => item.qty >= 10) || false;
  const wholesaleApplied = wholesaleOverride !== null ? wholesaleOverride : hasItemWholesale;

  // Totales
  const cartSubtotal = cart?.reduce((sum, item) => sum + (item.qty * getActiveItemPrice(item.item_code, item.rate, item.qty)), 0) || 0;
  const cartTotal = cartSubtotal;
  const changeDue = amountPaid >= cartTotal ? amountPaid - cartTotal : 0;

  // Acciones de Apertura y Cierre de caja
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posProfile) return;
    setSubmittingInvoice(true);
    setErrorMessage(null);
    try {
      const details = Object.entries(openingBalances).map(([mop, val]) => ({
        mode_of_payment: mop,
        opening_amount: val
      }));
      const res = await callFrappeAPI("create_pos_opening", {
        pos_profile: posProfile.pos_profile,
        company: posProfile.company,
        balance_details: details
      });
      if (res && res.name && inputUsdRate) {
        localStorage.setItem(`pos_usd_rate_${res.name}`, inputUsdRate);
        setUsdExchangeRate(parseFloat(inputUsdRate) || 0);
      }
      setSuccessMessage("¡Turno de caja abierto con éxito!");
      await loadPOSProfileAndShift();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al registrar la apertura de caja.");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOpening) return;
    setSubmittingInvoice(true);
    setErrorMessage(null);
    try {
      const details = Object.entries(closingBalances).map(([mop, val]) => ({
        mode_of_payment: mop,
        closing_amount: val
      }));
      await callFrappeAPI("close_pos_shift", {
        pos_opening_entry: activeOpening.name,
        closing_details: details
      });
      localStorage.removeItem(`pos_usd_rate_${activeOpening.name}`);
      setSuccessMessage("¡Turno cerrado y arqueado con éxito en ERPNext!");
      await loadPOSProfileAndShift();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al registrar el cierre de caja.");
    } finally {
      setSubmittingInvoice(false);
      setShowClosingModal(false);
    }
  };

  // Crear Cliente de forma express
  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    setSubmittingInvoice(true);
    setErrorMessage(null);
    try {
      const res = await callFrappeAPI("create_pos_customer", {
        customer_name: newCustomerName,
        phone: newCustomerPhone,
        rfc: newCustomerRequiresInvoice ? newCustomerRFC : undefined,
        tax_regime: newCustomerRequiresInvoice ? newCustomerRegime : undefined,
        cfdi_use: newCustomerRequiresInvoice ? newCustomerCFDIUse : undefined
      });
      setSelectedCustomer(res.name);
      setSuccessMessage(`Cliente "${res.customer_name}" registrado y seleccionado con éxito.`);
      setShowCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerRFC("");
      setNewCustomerRegime("601");
      setNewCustomerCFDIUse("G03");
      setNewCustomerRequiresInvoice(false);
      setCustomerQuery("");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al dar de alta el cliente.");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Enviar Factura POS a ERPNext
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.length === 0) return;
    
    setSubmittingInvoice(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Payload dinámico conforme a ERPNext v16
    const payload = {
      doctype: "Sales Invoice",
      is_pos: 1,
      update_stock: 1,
      company: posProfile?.company || "La Paletixa",
      customer: selectedCustomer,
      currency: posProfile?.currency || "MXN",
      pos_profile: posProfile?.pos_profile,
      selling_price_list: wholesaleApplied ? "Standard Wholesale" : (posProfile?.selling_price_list || "Standard Selling"),
      due_date: new Date().toISOString().split('T')[0],
      items: cart.map(item => ({
        item_code: item.item_code,
        qty: item.qty,
        rate: getActiveItemPrice(item.item_code, item.rate, item.qty),
        uom: "Unit",
        warehouse: activeWarehouse
      })),
      payments: [
        {
          mode_of_payment: paymentMode,
          amount: cartTotal
        }
      ]
    };

    try {
      const createdInvoice = await createDoc("Sales Invoice", payload);
      
      // Capturar todos los detalles del ticket ANTES de vaciar el carrito
      setPrintedTicket({
        invoiceId: createdInvoice.name || "Factura Temporal",
        customer: selectedCustomer,
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        items: cart.map(item => ({
          item_code: item.item_code,
          item_name: item.item_name,
          qty: item.qty,
          rate: getActiveItemPrice(item.item_code, item.rate, item.qty)
        })),
        subtotal: cartSubtotal,
        total: cartTotal,
        amountPaid: paymentMode === "Cash" ? amountPaid : cartTotal,
        changeDue: paymentMode === "Cash" ? changeDue : 0,
        paymentMode: paymentMode,
        payInUsd: paymentMode === "Cash" ? payInUsd : false,
        usdAmountPaid: paymentMode === "Cash" && payInUsd ? usdAmountPaid : undefined,
        usdExchangeRate: paymentMode === "Cash" && payInUsd ? (usdExchangeRate || parseFloat(tempUsdRate) || 0) : undefined
      });
      
      setSuccessMessage(`¡Venta procesada con éxito! Factura creada y stock actualizado.`);
      clearCart();
      await mutateBins();
      setShowTicketModal(true); // Abrir el modal de ticket automáticamente!
    } catch (err: any) {
      console.error("Error en checkout POS:", err);
      setErrorMessage(err.message || "Ocurrió un error al registrar la venta en ERPNext.");
    } finally {
      setSubmittingInvoice(false);
      setShowCheckout(false);
    }
  };

  // Filtrado de Productos
  const filteredItems = items?.filter(item => {
    const stock = getItemStock(item.name);
    if (stock <= 0) return false;

    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = selectedCategory === "Todos";
    if (selectedCategory === "Bolis") {
      matchesCategory = item.item_name.startsWith("Bolis") || item.name.startsWith("Bolis");
    } else if (selectedCategory === "Paletas") {
      matchesCategory = item.item_name.startsWith("Paleta") || item.name.startsWith("Paleta");
    } else if (selectedCategory === "Trompitos") {
      matchesCategory = item.item_name.startsWith("Trompito") || item.name.startsWith("Trompito");
    } else if (selectedCategory === "Eskimales") {
      matchesCategory = item.item_name.includes("Eskimo") || item.name.includes("Eskimo");
    } else if (selectedCategory === "Nieves") {
      matchesCategory = item.item_name.startsWith("Nieve") || item.name.startsWith("Nieve");
    }
    
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = ["Todos", "Bolis", "Paletas", "Trompitos", "Eskimales", "Nieves"];
  const activeColor = saasConfig?.colors?.primary || "#3498db";

  if (authLoading || configLoading || itemsLoading || pricesLoading || binsLoading || posDataLoading || barcodesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-500"></div>
          <p className="text-sm font-medium tracking-wide animate-pulse">Cargando Caja Registradora...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden print:hidden">
      
      {/* Sleek POS Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-850 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center font-black text-white text-base shadow-md">
            LP
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide">La Paletixa POS</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span>{getDisplaySucursalName()}</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>Turno: {activeOpening?.name || "Sin turno activo"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white leading-none">{currentUser}</p>
            <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Cajero Activo</p>
          </div>
          
          {activeOpening && (
            <button
              onClick={async () => {
                setErrorMessage(null);
                setSuccessMessage(null);
                try {
                  const details = await callFrappeAPI("get_closing_reconciliation_details", {
                    pos_opening_entry: activeOpening.name
                  });
                  const initialClosing: {[key: string]: number} = {};
                  if (!details || details.length === 0) {
                    posProfile.payment_methods.forEach((pm: any) => {
                      initialClosing[pm.mode_of_payment] = 0;
                    });
                  } else {
                    details.forEach((item: any) => {
                      initialClosing[item.mode_of_payment] = item.expected_amount || 0;
                    });
                  }
                  setClosingBalances(initialClosing);
                  setShowClosingModal(true);
                } catch (err: any) {
                  setErrorMessage(err.message || "Error al obtener la reconciliación esperada.");
                }
              }}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar Caja / Turno
            </button>
          )}

          <button
            onClick={() => router.push("/")}
            className="text-slate-400 hover:text-white p-2 rounded-xl border border-slate-850 hover:bg-slate-900 transition-all active:scale-95 cursor-pointer"
            title="Ir al Dashboard"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        </div>
      </header>

      {/* Grid del Layout General */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PANEL IZQUIERDO: Catálogo y Buscador */}
        <main className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          
          {/* Selector de Almacén exclusivo para el Administrador */}
          {isAdmin && (
            <div className="bg-slate-950 p-4 sm:p-5 rounded-3xl border border-slate-850 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse"></span>
                  Panel POS — Modo Administrador
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Tenés privilegios globales. Cambiá de sucursal para cargar su inventario y facturar de forma autónoma.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-900 p-1.5 px-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sucursal Operativa:</span>
                <select
                  value={activeWarehouse}
                  onChange={(e) => {
                    setActiveWarehouse(e.target.value);
                    clearCart();
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none cursor-pointer font-extrabold hover:bg-slate-950/80 transition-all shadow-md"
                >
                  {warehouses.map(w => (
                    <option key={w.name} value={w.name}>{w.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Buscador */}
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const barcode = searchQuery.trim();
                    if (barcode.length > 2) {
                      const barcodeDoc = itemBarcodes?.find(b => b.barcode.trim() === barcode);
                      if (barcodeDoc) {
                        const item = items?.find(i => i.name === barcodeDoc.parent);
                        if (item) {
                          addToCart(item);
                          setSearchQuery("");
                          setSuccessMessage(`Producto "${item.item_name}" agregado por escaneo.`);
                          setErrorMessage(null);
                          setTimeout(() => setSuccessMessage(null), 3000);
                          e.preventDefault();
                        }
                      }
                    }
                  }
                }}
                placeholder="Buscar paleta o sabor..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
              />
              <svg className="absolute left-3.5 top-3 h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                      isSelected
                        ? "text-white"
                        : "bg-slate-950 border border-slate-850 text-slate-400 hover:text-white"
                    }`}
                    style={isSelected ? { backgroundColor: activeColor } : {}}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grilla de Ítems */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredItems.map((item) => {
              const itemStock = getItemStock(item.name);
              const itemPrice = getItemPrice(item.name, item.standard_rate);
              const isAvailable = itemStock > 0;

              return (
                <div
                  key={item.name}
                  onClick={() => addToCart(item)}
                  className={`group rounded-2xl border bg-slate-950 p-4 transition-all duration-200 flex flex-col justify-between ${
                    isAvailable
                      ? "cursor-pointer border-slate-800 hover:scale-[1.02] hover:border-slate-750"
                      : "cursor-not-allowed border-slate-900/60 opacity-50"
                  }`}
                >
                  <div>
                    {/* Foto de Ítem */}
                    <div className="aspect-square w-full rounded-xl bg-slate-900 mb-3 flex items-center justify-center text-slate-700 overflow-hidden relative border border-slate-850/20">
                      
                      {/* Stock Badge flotante */}
                      <span className={`absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full border z-20 shadow-md ${
                        isAvailable
                          ? "bg-slate-950/90 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                      }`}>
                        {isAvailable ? `${itemStock} disp.` : "Agotado"}
                      </span>

                      {item.image ? (
                        <img 
                          src={item.image.startsWith("http") ? item.image : `${process.env.NEXT_PUBLIC_FRAPPE_URL || ""}${item.image}`} 
                          alt={item.item_name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-white leading-snug truncate group-hover:text-sky-400 transition-colors duration-200">{item.item_name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">{item.item_group}</p>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">${itemPrice.toFixed(2)}</span>
                    <span 
                      className={`h-7 w-7 rounded-lg flex items-center justify-center text-white transition-all ${
                        isAvailable
                          ? "group-hover:scale-105 group-hover:brightness-115"
                          : "opacity-30"
                      }`}
                      style={{ backgroundColor: activeColor }}
                    >
                      +
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* PANEL DERECHO: Carrito de Compras */}
        <aside className="w-80 sm:w-96 border-l border-slate-800 bg-slate-950 flex flex-col">
          
          {/* Customer Search and Registration Area */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente Facturación:</span>
              {selectedCustomer !== (posProfile?.customer || "Público General") && (
                <button
                  onClick={() => {
                    setSelectedCustomer(posProfile?.customer || "Público General");
                    setCustomerQuery("");
                  }}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                >
                  Restablecer
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder={selectedCustomer || "Público General"}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-400 focus:border-slate-700 outline-none"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-2.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500"></div>
                )}
                
                {/* Search Results Dropdown Overlay */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto animate-fade-in">
                    {searchResults.map((cust) => (
                      <div
                        key={cust.name}
                        onClick={() => {
                          setSelectedCustomer(cust.name);
                          setSearchResults([]);
                          setCustomerQuery("");
                        }}
                        className="px-4 py-2.5 hover:bg-slate-900 text-xs text-slate-200 hover:text-white cursor-pointer transition-all border-b border-slate-900 last:border-0 font-medium"
                      >
                        {cust.customer_name} ({cust.name})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="bg-slate-900 hover:bg-slate-850 text-sky-400 hover:text-sky-300 border border-slate-850 hover:border-slate-750 px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center whitespace-nowrap"
                title="Nuevo Cliente Express"
              >
                + Nuevo
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Carrito de Compra
            </h3>
            {cart && cart.length > 0 && (
              <button 
                onClick={clearCart}
                className="text-xs text-red-400 hover:text-red-300 font-semibold"
              >
                Vaciar
              </button>
            )}
          </div>

          {/* Listado de Ítems en Carrito */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {successMessage && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 leading-normal">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 leading-normal">
                {errorMessage}
              </div>
            )}

            {cart && cart.length > 0 && (
              <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-850 flex items-center justify-between shadow-inner animate-fade-in">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-300">Tarifa de Compra</span>
                  <p className="text-[10px] text-slate-500">
                    {wholesaleApplied 
                      ? "🏷️ Mayoreo activo" 
                      : "🛒 Minorista (Llevá 10 pz del mismo helado para mayoreo)"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWholesaleOverride(wholesaleApplied ? false : true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-300 active:scale-95 flex items-center gap-1 cursor-pointer ${
                    wholesaleApplied 
                      ? "bg-blue-600 text-white shadow-md font-black"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {wholesaleApplied ? "Mayoreo" : "Menudeo"}
                </button>
              </div>
            )}

            {!cart || cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center px-6 py-10">
                <svg className="h-12 w-12 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm font-semibold">El carrito está vacío</p>
                <p className="text-xs text-slate-600 mt-1">Hacé clic en cualquier paleta o boli de la izquierda para agregar.</p>
              </div>
            ) : (
              cart.map((item) => {
                const retailPrice = getItemPrice(item.item_code, item.rate);
                const activePrice = getActiveItemPrice(item.item_code, item.rate, item.qty);
                const isWholesaleActive = (wholesaleOverride === true || (wholesaleOverride === null && item.qty >= 10)) && getItemWholesalePrice(item.item_code) !== null;
                
                return (
                  <div key={item.item_code} className="flex items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-bold text-white truncate">{item.item_name}</h5>
                      {isWholesaleActive ? (
                        <p className="text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                          <span className="line-through text-slate-500">${retailPrice.toFixed(2)}</span>
                          <span className="text-blue-400 font-bold">${activePrice.toFixed(2)} x u.</span>
                          <span className="text-[9px] px-1 bg-blue-500/10 text-blue-400 rounded-md font-bold whitespace-nowrap">Mayoreo</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">${activePrice.toFixed(2)} x u.</p>
                      )}
                    </div>
                    
                    {/* Selector Qty Táctil */}
                    <div className="flex items-center gap-2 bg-slate-950 rounded-lg border border-slate-800 px-1 py-0.5">
                      <button
                        onClick={() => updateCartQty(item.item_code, item.qty - 1)}
                        className="text-slate-400 hover:text-white px-1.5 font-extrabold text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-extrabold text-white min-w-[16px] text-center">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(item.item_code, item.qty + 1)}
                        className="text-slate-400 hover:text-white px-1.5 font-extrabold text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-sm font-extrabold text-white">${(item.qty * activePrice).toFixed(2)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Panel de Cobro */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-4 shadow-2xl">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-1.5 border-t border-slate-900">
                <span>TOTAL A PAGAR</span>
                <span style={{ color: activeColor }}>${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!cart || cart.length === 0}
              onClick={() => {
                setAmountPaid(cartTotal);
                setPayInUsd(false);
                setUsdAmountPaid(0);
                setTempUsdRate("");
                setShowCheckout(true);
              }}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: activeColor }}
            >
              Proceder al Cobro
            </button>
          </div>
        </aside>
      </div>

      {/* MODAL APERTURA DE TURNO (OBLIGATORIO Y BLOQUEANTE) */}
      {showOpeningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 bg-opacity-90 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-6 animate-fade-in relative">
            
            {/* Botón X de Cierre/Cancelación exclusivo para el Administrador */}
            {isAdmin && (
              <button
                onClick={() => router.push("/")}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                title="Volver al Dashboard"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-1">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-lg font-black text-white">Apertura de Turno POS</h4>
              
              {posProfile?.available_profiles && posProfile.available_profiles.length > 1 ? (
                <p className="text-xs text-slate-400">
                  Seleccioná el Perfil de Punto de Venta / Sucursal que deseás abrir y operar:
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  ¡Buenas! Para comenzar a facturar en <span className="text-white font-bold">{getDisplaySucursalName()}</span>, declará el saldo inicial disponible en tu caja registradora.
                </p>
              )}
            </div>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
              
              {/* Selector dinámico de Perfil POS / Sucursal */}
              {posProfile?.available_profiles && posProfile.available_profiles.length > 1 && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Sucursal / Perfil POS Activo</label>
                  <select
                    value={posProfile.pos_profile}
                    onChange={(e) => {
                      loadPOSProfileAndShift(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none cursor-pointer font-extrabold shadow-md"
                  >
                    {posProfile.available_profiles.map((pName: string) => (
                      <option key={pName} value={pName}>{pName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-850">
                {posProfile?.payment_methods?.map((pm: any) => {
                  const mop = pm.mode_of_payment;
                  return (
                    <div key={mop} className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Efectivo Inicial ({mop === "Cash" ? "Efectivo" : mop === "Credit Card" ? "Tarjeta" : mop})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={openingBalances[mop] || ""}
                        onChange={(e) => setOpeningBalances({
                          ...openingBalances,
                          [mop]: parseFloat(e.target.value) || 0
                        })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
                        required
                      />
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Tipo de Cambio USD (Precio de Compra del Turno)
                </label>
                <input
                  type="number"
                  step="any"
                  value={inputUsdRate}
                  onChange={(e) => setInputUsdRate(e.target.value)}
                  placeholder="Ej. 17.50"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
                  required
                />
              </div>

              {errorMessage && (
                <p className="text-xs text-red-400 text-center font-medium bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingInvoice}
                className="w-full rounded-xl py-3.5 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: activeColor }}
              >
                {submittingInvoice ? "Abriendo Turno en ERPNext..." : "Abrir Caja y Comenzar Turno"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE TURNO / RECONCILIACIÓN Y ARQUEO */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-white/5 bg-slate-900 p-6 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-black text-white">Cierre de Turno y Arqueo de Caja</h4>
                <p className="text-[10px] text-slate-400 font-semibold">{activeOpening?.name}</p>
              </div>
              <button 
                onClick={() => setShowClosingModal(false)} 
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-6">
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-normal">
                  Ingresá el efectivo y tarjetas físicas que contaste en caja al finalizar el turno. El sistema calculará la diferencia respecto a las ventas registradas.
                </p>

                <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                  {posProfile?.payment_methods?.map((pm: any) => {
                    const mop = pm.mode_of_payment;
                    const declared = closingBalances[mop] || 0;
                    
                    // Tratamos de buscar la reconciliación esperada o la inicializamos
                    const expected = 0; // ERPNext calcula en el backend, nosotros lo mostramos descriptivo
                    
                    return (
                      <div key={mop} className="p-3 bg-slate-900/40 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <span className="text-xs font-black text-white uppercase tracking-wide">
                            {mop === "Cash" ? "Efectivo" : mop === "Credit Card" ? "Tarjeta" : mop}
                          </span>
                          <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Medio de Pago: {mop}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="space-y-1">
                            <span className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Monto Físico Declarado:</span>
                            <input
                              type="number"
                              step="any"
                              value={closingBalances[mop] || ""}
                              onChange={(e) => setClosingBalances({
                                ...closingBalances,
                                [mop]: parseFloat(e.target.value) || 0
                              })}
                              placeholder="0.00"
                              className="w-32 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white text-right outline-none focus:border-slate-700"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-red-400 text-center font-medium bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingInvoice}
                className="w-full rounded-xl py-3.5 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: activeColor }}
              >
                {submittingInvoice ? "Cerrando Turno en ERPNext..." : "Confirmar Arqueo y Cerrar Caja"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO EXPRES DE NUEVO CLIENTE */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-white/5 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white">Registro de Nuevo Cliente</h4>
              <button 
                onClick={() => setShowCustomerModal(false)} 
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-4">
              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-850">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre Completo / Razón Social</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Ej. +52 55 1234 5678"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
                  />
                </div>

                {saasConfig?.features?.mexico_taxes && (
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                      <span className="text-[10px] font-bold text-slate-350 flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        ¿Requiere Factura SAT? (Datos Fiscales)
                      </span>
                      <input
                        type="checkbox"
                        checked={newCustomerRequiresInvoice}
                        onChange={(e) => setNewCustomerRequiresInvoice(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-850 text-red-500 bg-slate-900 focus:ring-red-500 cursor-pointer"
                      />
                    </label>

                    {newCustomerRequiresInvoice && (
                      <div className="space-y-3 p-3 bg-slate-900/40 rounded-2xl border border-slate-850 animate-scale-in">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">RFC (México)</label>
                          <input
                            type="text"
                            value={newCustomerRFC}
                            onChange={(e) => setNewCustomerRFC(e.target.value)}
                            placeholder="Ej. XAXX010101000"
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
                            required={newCustomerRequiresInvoice}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Régimen Fiscal</label>
                          <select
                            value={newCustomerRegime}
                            onChange={(e) => setNewCustomerRegime(e.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700 cursor-pointer"
                          >
                            <option value="601">601 | General de Ley Personas Morales</option>
                            <option value="603">603 | Personas Morales no Lucrativas</option>
                            <option value="605">605 | Sueldos y Salarios</option>
                            <option value="612">612 | Actividades Empresariales y Profesionales</option>
                            <option value="626">626 | Régimen Simplificado de Confianza (RESICO)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Uso de CFDI</label>
                          <select
                            value={newCustomerCFDIUse}
                            onChange={(e) => setNewCustomerCFDIUse(e.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700 cursor-pointer"
                          >
                            <option value="G01">G01 | Adquisición de mercancías</option>
                            <option value="G03">G03 | Gastos en general</option>
                            <option value="S01">S01 | Sin efectos fiscales</option>
                            <option value="CP01">CP01 | Pagos</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {errorMessage && (
                <p className="text-xs text-red-400 text-center font-medium bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingInvoice || !newCustomerName.trim()}
                className="w-full rounded-xl py-3.5 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: activeColor }}
              >
                {submittingInvoice ? "Creando Cliente..." : "Registrar y Seleccionar Cliente"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / PANTALLA DE COBRO EN EFECTIVO (GLASSMORPHISM) */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-white/5 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-lg font-bold text-white">Detalle del Cobro</h4>
              <button 
                onClick={() => setShowCheckout(false)} 
                className="text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-6">
              {/* Selección de Método de Pago */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {posProfile?.payment_methods?.map((pm: any) => {
                    const mode = pm.mode_of_payment;
                    const isSelected = paymentMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`rounded-xl py-2.5 text-xs font-bold transition-all border active:scale-95 ${
                          isSelected
                            ? "text-white"
                            : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
                        }`}
                        style={isSelected ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
                      >
                        {mode === "Cash" ? "Efectivo" : mode === "Credit Card" ? "Tarjeta" : mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalle de Montos */}
              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-850">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Monto Total</span>
                  <span className="font-bold text-white">${cartTotal.toFixed(2)}</span>
                </div>

                {paymentMode === "Cash" && (
                  <>
                    {/* Opción de Pago en USD */}
                    <div className="flex items-center gap-2 mb-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                      <input
                        type="checkbox"
                        id="payInUsd"
                        checked={payInUsd}
                        onChange={(e) => {
                          setPayInUsd(e.target.checked);
                          setAmountPaid(0);
                          setUsdAmountPaid(0);
                        }}
                        className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                      <label htmlFor="payInUsd" className="text-xs font-bold text-slate-300 cursor-pointer">
                        Pagar en Dólares (USD)
                      </label>
                    </div>

                    {payInUsd && (
                      <div className="space-y-2 mb-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                        {usdExchangeRate === 0 ? (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Definir Tipo de Cambio USD ($)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={tempUsdRate}
                              onChange={(e) => {
                                setTempUsdRate(e.target.value);
                                setUsdAmountPaid(0);
                                setAmountPaid(0);
                              }}
                              placeholder="Ej. 17.50"
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
                              required={payInUsd && usdExchangeRate === 0}
                            />
                          </div>
                        ) : (
                          <div className="flex justify-between text-xs text-slate-400 font-semibold">
                            <span>Tipo de cambio:</span>
                            <span className="text-white">${usdExchangeRate.toFixed(2)} MXN</span>
                          </div>
                        )}
                        
                        {(usdExchangeRate > 0 || parseFloat(tempUsdRate) > 0) && (
                          <div className="flex justify-between text-xs text-slate-400 font-semibold border-t border-slate-900 pt-2">
                            <span>Total a pagar en USD:</span>
                            <span className="text-sky-400 font-extrabold">
                              ${(cartTotal / (usdExchangeRate || parseFloat(tempUsdRate))).toFixed(2)} USD
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Input de Pago */}
                    <div className="pt-2 border-t border-slate-900">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {payInUsd ? "Dólares Recibidos (USD)" : "Efectivo Recibido"}
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {payInUsd 
                            ? `Total: $${(cartTotal / (usdExchangeRate || parseFloat(tempUsdRate) || 1)).toFixed(2)} USD` 
                            : `Total: $${cartTotal.toFixed(2)}`}
                        </span>
                      </div>
                      {payInUsd ? (
                        <input
                          type="number"
                          step="any"
                          value={usdAmountPaid || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const rate = usdExchangeRate || parseFloat(tempUsdRate) || 0;
                            setUsdAmountPaid(val);
                            setAmountPaid(val * rate);
                          }}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-base font-extrabold text-white outline-none focus:border-slate-700"
                        />
                      ) : (
                        <input
                          type="number"
                          step="any"
                          value={amountPaid || ""}
                          onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-base font-extrabold text-white outline-none focus:border-slate-700"
                        />
                      )}
                    </div>

                    {/* Botones de Efectivo Rápido */}
                    <div className="flex flex-wrap gap-1.5 mt-1 border-t border-slate-950 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (payInUsd) {
                            const rate = usdExchangeRate || parseFloat(tempUsdRate) || 1;
                            const exactUsd = cartTotal / rate;
                            setUsdAmountPaid(exactUsd);
                            setAmountPaid(cartTotal);
                          } else {
                            setAmountPaid(cartTotal);
                          }
                        }}
                        className="rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-[10px] font-bold text-slate-300 px-2.5 py-1.5 transition-all cursor-pointer"
                      >
                        Exacto
                      </button>
                      {payInUsd ? (
                        [1, 5, 10, 20, 50, 100].map((bill) => {
                          const rate = usdExchangeRate || parseFloat(tempUsdRate) || 1;
                          const totalInUsd = cartTotal / rate;
                          if (bill >= totalInUsd) {
                            return (
                              <button
                                key={bill}
                                type="button"
                                onClick={() => {
                                  setUsdAmountPaid(bill);
                                  setAmountPaid(bill * rate);
                                }}
                                className="rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-[10px] font-bold text-slate-300 px-2.5 py-1.5 transition-all cursor-pointer"
                              >
                                ${bill} USD
                              </button>
                            );
                          }
                          return null;
                        })
                      ) : (
                        [20, 50, 100, 200, 500].map((bill) => {
                          if (bill >= cartTotal) {
                            return (
                              <button
                                key={bill}
                                type="button"
                                onClick={() => setAmountPaid(bill)}
                                className="rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-[10px] font-bold text-slate-300 px-2.5 py-1.5 transition-all cursor-pointer"
                              >
                                ${bill}
                              </button>
                            );
                          }
                          return null;
                        })
                      )}
                    </div>

                    {payInUsd && usdAmountPaid > 0 && (
                      <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-900">
                        <span>Equivalente en Pesos:</span>
                        <span className="font-bold text-slate-300">${(usdAmountPaid * (usdExchangeRate || parseFloat(tempUsdRate) || 0)).toFixed(2)} MXN</span>
                      </div>
                    )}

                    {/* Calculadora de Vuelto */}
                    <div className="flex justify-between text-sm text-slate-400 pt-2 border-t border-slate-900">
                      <span>Vuelto a entregar {payInUsd ? "(en Pesos MXN)" : ""}</span>
                      <span className="font-black text-emerald-400 text-lg">${changeDue.toFixed(2)}</span>
                    </div>
                    {payInUsd && changeDue > 0 && (
                      <div className="flex justify-between text-xs text-slate-500 pt-1">
                        <span>Equivalente del vuelto en USD:</span>
                        <span className="font-bold text-slate-400">
                          ${(changeDue / (usdExchangeRate || parseFloat(tempUsdRate) || 1)).toFixed(2)} USD
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Botón de Confirmación */}
              <button
                type="submit"
                disabled={submittingInvoice || (paymentMode === "Cash" && amountPaid < cartTotal)}
                className="w-full rounded-xl py-4 text-sm font-bold text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: activeColor }}
              >
                {submittingInvoice ? "Registrando Factura en ERPNext..." : "Registrar Venta & Ticket"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / VISUALIZADOR DE TICKET DE COMPRA (PREVIEW TÉRMICO) */}
      {showTicketModal && printedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in print:hidden">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh] flex flex-col items-center">
            
            <div className="text-center space-y-1">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-base font-black text-white">¡Cobro Completado con Éxito!</h4>
              <p className="text-xs text-slate-400">El ticket de venta está listo para imprimir.</p>
            </div>

            {/* Simulación física del ticket térmico en pantalla */}
            <div className="w-full bg-slate-50 text-slate-850 p-5 rounded-xl shadow-inner font-mono text-[10px] leading-relaxed relative flex flex-col overflow-hidden text-left border-t-8 border-slate-350">
              
              <div className="text-center space-y-2">
                {/* Logo */}
                {saasConfig?.print_logo && saasConfig?.company_logo && (
                  <div className="flex justify-center mb-1.5">
                    <img 
                      src={saasConfig.company_logo} 
                      alt="Brand Logo" 
                      className="max-h-10 object-contain max-w-full"
                    />
                  </div>
                )}
                
                {/* Company Name */}
                <h4 className="font-extrabold text-xs text-slate-900 leading-tight uppercase">{saasConfig?.company_name || saasConfig?.client_name || "LA PALETIXA"}</h4>
                
                {/* Tax ID */}
                {saasConfig?.print_tax_id && saasConfig?.company_tax_id && (
                  <p className="text-[8px] leading-none text-slate-600">RFC / TAX ID: {saasConfig.company_tax_id}</p>
                )}

                {/* Address */}
                {saasConfig?.print_address && saasConfig?.company_address && (
                  <p className="text-[8px] leading-snug text-slate-600 max-w-[220px] mx-auto whitespace-pre-line">{saasConfig.company_address}</p>
                )}

                {/* Contact */}
                {saasConfig?.print_contact && (saasConfig?.company_phone || saasConfig?.company_email) && (
                  <p className="text-[8px] leading-snug text-slate-600">
                    {saasConfig.company_phone && <span>Tel: {saasConfig.company_phone}</span>}
                    {saasConfig.company_phone && saasConfig.company_email && <br />}
                    {saasConfig.company_email && <span>Email: {saasConfig.company_email}</span>}
                  </p>
                )}

                {/* Welcome Message */}
                {saasConfig?.ticket_header && (
                  <p className="font-bold border-y border-dashed border-slate-400 py-1.5 my-2 uppercase">{saasConfig.ticket_header}</p>
                )}
              </div>

              {/* Detalle de Productos */}
              <div className="space-y-1.5 my-3.5 border-b border-dashed border-slate-350 pb-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Cant / Producto</span>
                  <span>Total</span>
                </div>
                {printedTicket.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.qty} x {item.item_name}</span>
                    <span>${(item.qty * item.rate).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="space-y-1 text-right text-slate-900 border-b border-dashed border-slate-350 pb-2">
                {saasConfig?.features?.mexico_taxes ? (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal (Base):</span>
                      <span>${(printedTicket.total / 1.16).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA (16%):</span>
                      <span>${(printedTicket.total - (printedTicket.total / 1.16)).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${printedTicket.subtotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-xs">
                  <span>TOTAL A PAGAR:</span>
                  <span>${printedTicket.total.toFixed(2)}</span>
                </div>
                {printedTicket.payInUsd ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Recibido (USD):</span>
                      <span>${printedTicket.usdAmountPaid?.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Tipo de Cambio:</span>
                      <span>${printedTicket.usdExchangeRate?.toFixed(2)} MXN</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Equivalente Recibido:</span>
                      <span>${printedTicket.amountPaid.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>Pago con ({printedTicket.paymentMode === "Cash" ? "Efectivo" : "Tarjeta"}):</span>
                    <span>${printedTicket.amountPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Cambio Entregado:</span>
                  <span>${printedTicket.changeDue.toFixed(2)}</span>
                </div>
              </div>

              {/* Metadata de Venta */}
              <div className="text-center text-[7px] text-slate-500 my-2 space-y-0.5">
                <p>Factura: {printedTicket.invoiceId}</p>
                <p>Fecha: {printedTicket.date}</p>
                <p>Cajero: {currentUser}</p>
                <p>Cliente: {printedTicket.customer}</p>
              </div>

              {/* Despedida */}
              {saasConfig?.ticket_footer && (
                <div className="text-center mt-2.5 font-bold uppercase border-t border-dashed border-slate-450 pt-2 text-[8px]">
                  {saasConfig.ticket_footer}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full rounded-2xl py-3.5 text-xs font-black text-white shadow-xl transition-all duration-300 hover:brightness-110 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: activeColor }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir Ticket (Físico / PDF)
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowTicketModal(false);
                  setPrintedTicket(null);
                }}
                className="w-full rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 py-3.5 text-xs font-black transition-all active:scale-95 cursor-pointer"
              >
                Iniciar Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* CONTENEDOR EXCLUSIVO PARA IMPRESIÓN FÍSICA (OCULTO EN PANTALLA) */}
      {printedTicket && (
        <>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: 80mm auto !important;
                margin: 0mm !important;
              }
              body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .print-ticket-container {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 12px !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
            }
          `}} />
          <div className="hidden print:block print-ticket-container bg-white text-slate-900 font-mono text-[9px] leading-relaxed p-4 w-[80mm] mx-auto text-left">
          <div className="text-center space-y-1.5 mb-3">
            {saasConfig?.print_logo && saasConfig?.company_logo && (
              <div className="flex justify-center mb-1">
                <img 
                  src={saasConfig.company_logo} 
                  alt="Logo" 
                  className="max-h-12 object-contain"
                />
              </div>
            )}
            
            <h4 className="font-extrabold text-[10px] uppercase tracking-wide leading-tight">{saasConfig?.company_name || saasConfig?.client_name || "LA PALETIXA"}</h4>
            
            {saasConfig?.print_tax_id && saasConfig?.company_tax_id && (
              <p className="text-[8px] leading-none">RFC / TAX ID: {saasConfig.company_tax_id}</p>
            )}
            
            {saasConfig?.print_address && saasConfig?.company_address && (
              <p className="text-[8px] leading-tight whitespace-pre-line">{saasConfig.company_address}</p>
            )}
            
            {saasConfig?.print_contact && (saasConfig?.company_phone || saasConfig?.company_email) && (
              <p className="text-[8px]">
                {saasConfig.company_phone && <span>Tel: {saasConfig.company_phone}</span>}
                {saasConfig.company_phone && saasConfig.company_email && <span> | </span>}
                {saasConfig.company_email && <span>{saasConfig.company_email}</span>}
              </p>
            )}
            
            {saasConfig?.ticket_header && (
              <p className="font-bold border-y border-dashed border-slate-800 py-1.5 my-2 uppercase">{saasConfig.ticket_header}</p>
            )}
          </div>

          <div className="space-y-1 my-3 border-b border-dashed border-slate-800 pb-2">
            <div className="flex justify-between font-bold text-slate-950 text-[9px]">
              <span>Cant / Producto</span>
              <span>Total</span>
            </div>
            {printedTicket.items.map((item, index) => (
              <div key={index} className="flex justify-between text-[8px]">
                <span>{item.qty} x {item.item_name}</span>
                <span>${(item.qty * item.rate).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-right text-slate-950 border-b border-dashed border-slate-800 pb-2 mb-3">
            {saasConfig?.features?.mexico_taxes ? (
              <>
                <div className="flex justify-between text-[8px]">
                  <span>Subtotal (Base):</span>
                  <span>${(printedTicket.total / 1.16).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[8px]">
                  <span>IVA (16%):</span>
                  <span>${(printedTicket.total - (printedTicket.total / 1.16)).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-[8px]">
                <span>Subtotal:</span>
                <span>${printedTicket.subtotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-[9px]">
              <span>TOTAL A PAGAR:</span>
              <span>${printedTicket.total.toFixed(2)}</span>
            </div>
            {printedTicket.payInUsd ? (
              <>
                <div className="flex justify-between text-slate-700 text-[8px]">
                  <span>Recibido (USD):</span>
                  <span>${printedTicket.usdAmountPaid?.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-slate-700 text-[8px]">
                  <span>Tipo de Cambio:</span>
                  <span>${printedTicket.usdExchangeRate?.toFixed(2)} MXN</span>
                </div>
                <div className="flex justify-between text-slate-700 text-[8px]">
                  <span>Equivalente Recibido:</span>
                  <span>${printedTicket.amountPaid.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-700 text-[8px]">
                <span>Pago con ({printedTicket.paymentMode === "Cash" ? "Efectivo" : "Tarjeta"}):</span>
                <span>${printedTicket.amountPaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-bold text-[8px]">
              <span>Cambio Entregado:</span>
              <span>${printedTicket.changeDue.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center text-[7px] text-slate-750 space-y-0.5 my-3 border-b border-dashed border-slate-800 pb-2">
            <p>Factura: {printedTicket.invoiceId}</p>
            <p>Fecha: {printedTicket.date}</p>
            <p>Cajero: {currentUser}</p>
            <p>Cliente: {printedTicket.customer}</p>
            <p>Sucursal: {sucursalName}</p>
          </div>

          {saasConfig?.ticket_footer && (
            <div className="text-center mt-3 font-bold uppercase text-[8px] leading-tight">
              {saasConfig.ticket_footer}
            </div>
          )}
        </div>
        </>
      )}
    </>
  );
}
