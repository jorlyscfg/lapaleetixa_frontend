"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from "react";
import { useFrappeAuth, useFrappeGetDocList, useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useRouter } from "next/navigation";
import { CustomSelect } from "../components/custom_select";
import { useSaaSConfig } from "../providers";

interface FeatureConfig {
  client_name: string;
  colors: {
    primary: string;
  };
  features: {
    pos: boolean;
    production: boolean;
    logistics: boolean;
    reservations?: boolean;
    wholesale?: boolean;
    mexico_taxes?: boolean;
    services?: boolean;
    products?: boolean;
    purchasing?: boolean;
  };
  reservation_item_code?: string;
  max_reservation_assets?: number;
  default_event_items?: string;
  custom_country?: string;
  custom_currency?: string;
  // Campos de marca e identidad agregados
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

interface PreloadedItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
}

export default function ConfiguracionPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();
  const { refreshConfig } = useSaaSConfig();

  const isCashier = currentUser?.startsWith("cajero.");
  const isProdUser = currentUser ? currentUser.startsWith("produccion@") : false;
  const isLogisticaUser = currentUser ? currentUser.startsWith("logistica@") : false;
  const isAdmin = currentUser && !isCashier && !isProdUser && !isLogisticaUser;

  // Configuración original y estados de edición locales
  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "modulos" | "sucursales" | "usuarios">("general");

  // Estados locales editables
  const [primaryColor, setPrimaryColor] = useState("#1abc9c");
  const [hasPos, setHasPos] = useState(false);
  const [hasProduction, setHasProduction] = useState(false);
  const [hasLogistics, setHasLogistics] = useState(false);
  const [hasReservations, setHasReservations] = useState(false);
  const [hasPurchasing, setHasPurchasing] = useState(false);
  const [hasWholesale, setHasWholesale] = useState(true);
  const [hasMexicoTaxes, setHasMexicoTaxes] = useState(false);
  const [hasServices, setHasServices] = useState(true);
  const [hasProducts, setHasProducts] = useState(true);
  const [reservationItemCode, setReservationItemCode] = useState("Carrito Paletero");
  const [maxReservationAssets, setMaxReservationAssets] = useState(10);
  const [defaultEventItems, setDefaultEventItems] = useState<PreloadedItem[]>([]);
  const [country, setCountry] = useState("Mexico");
  const [currency, setCurrency] = useState("MXN");

  // Estados de identidad y ticket
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [ticketHeader, setTicketHeader] = useState("");
  const [ticketFooter, setTicketFooter] = useState("");
  const [printLogo, setPrintLogo] = useState(true);
  const [printTaxId, setPrintTaxId] = useState(true);
  const [printAddress, setPrintAddress] = useState(true);
  const [printContact, setPrintContact] = useState(true);

  const [logoUploading, setLogoUploading] = useState(false);

  // Estados para Sucursales y Cajeros
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [selectedBranchCashiers, setSelectedBranchCashiers] = useState<string[]>([]);
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [deletingBranchName, setDeletingBranchName] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<string | null>(null);

  // Estados para Usuarios y Roles
  const [usersWithRoles, setUsersWithRoles] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userEnabled, setUserEnabled] = useState(true);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [submittingUser, setSubmittingUser] = useState(false);


  // Función para comprimir y redimensionar imagen en el cliente usando HTML5 Canvas
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
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
          if (!ctx) {
            reject(new Error("No se pudo obtener el contexto 2d del canvas."));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Error al comprimir la imagen."));
              }
            },
            "image/jpeg",
            0.8
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Limpiar/Remover el archivo de logotipo seleccionado
  const handleRemoveLogo = () => {
    setSelectedLogoFile(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoPreviewUrl(null);
    setCompanyLogo("");
  };

  // Buscador de productos para el constructor de plantillas
  const [productSearch, setProductSearch] = useState("");

  // Cargar catálogo de helados para preestablecer en la plantilla
  const { data: items } = useFrappeGetDocList("Item", {
    fields: ["name", "item_name", "standard_rate"],
    filters: [
      ["disabled", "=", 0],
      ["item_group", "=", "Products"],
      ["has_variants", "=", 0],
      ["name", "!=", "Carrito Paletero"]
    ],
    limit: 100
  });

  // Cargar configuración inicial
  useEffect(() => {
    if (!currentUser) return;
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
      } finally {
        setConfigLoading(false);
      }
    }
    fetchConfig();
  }, [currentUser]);

  // Declarar hooks de frappe-react-sdk para manejar la comunicación de forma autenticada
  const { data: branchesAndCashiersRaw, error: branchesError, mutate: mutateBranches } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_branches_and_cashiers",
    {},
    currentUser && isAdmin ? undefined : null
  );

  const { call: createNewBranchWithCashiers } = useFrappePostCall(
    "paletixa_saas.paletixa_saas.api.create_new_branch_with_cashiers"
  );

  const { call: deleteBranch } = useFrappePostCall(
    "paletixa_saas.paletixa_saas.api.delete_branch"
  );

  const { data: usersWithRolesRaw, mutate: mutateUsersWithRoles } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_users_with_roles",
    {},
    currentUser && isAdmin ? undefined : null
  );

  const { call: createOrUpdateUser } = useFrappePostCall(
    "paletixa_saas.paletixa_saas.api.create_or_update_user"
  );

  useEffect(() => {
    if (usersWithRolesRaw) {
      const data = (usersWithRolesRaw as any).message || {};
      setUsersWithRoles(data.users || []);
      setAvailableRoles(data.available_roles || []);
      setUsersLoading(false);
    }
  }, [usersWithRolesRaw]);

  // Sincronizar datos de la llamada SWR con nuestros estados
  useEffect(() => {
    if (branchesAndCashiersRaw) {
      const data = (branchesAndCashiersRaw as any).message || {};
      setBranches(data.branches || []);
      setUsers(data.users || []);
      setBranchesLoading(false);
    }
  }, [branchesAndCashiersRaw]);

  useEffect(() => {
    if (branchesError) {
      console.error("Error al cargar sucursales mediante SWR:", branchesError);
      setBranchesLoading(false);
    }
  }, [branchesError]);

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      setErrorMsg("El nombre de la sucursal es obligatorio.");
      return;
    }
    setSubmittingBranch(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const rawRes = await createNewBranchWithCashiers({
        branch_name: newBranchName.trim(),
        cashier_emails: selectedBranchCashiers
      });
      const res = rawRes?.message || rawRes;
      if (res && res.success) {
        setSuccessMsg(res.message || `Sucursal '${newBranchName}' guardada con éxito.`);
        setNewBranchName("");
        setSelectedBranchCashiers([]);
        setShowBranchModal(false);
        setEditingBranch(null);
        mutateBranches(); // Forzar recarga SWR
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.message || "No se pudo guardar la sucursal.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar la sucursal.");
    } finally {
      setSubmittingBranch(false);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    setDeletingBranchName(branchName);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const rawRes = await deleteBranch({ branch_name: branchName });
      const res = rawRes?.message || rawRes;
      if (res && res.success) {
        setSuccessMsg(res.message || `Sucursal '${branchName}' procesada con éxito.`);
        mutateBranches(); // Forzar recarga SWR
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.message || "No se pudo procesar la eliminación de la sucursal.");
        setTimeout(() => setErrorMsg(null), 6000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar la eliminación.");
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setDeletingBranchName(null);
      setShowDeleteConfirmModal(null);
    }
  };

  // Diccionario de Perfiles de Roles Rápidos
  const ROLE_PROFILES: Record<string, { label: string, roles: string[], colorClass: string }> = {
    cajero: {
      label: "Cajero (Caja/POS)",
      roles: ["Sales User", "Accounts User"],
      colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    },
    produccion: {
      label: "Operario de Producción",
      roles: ["Stock Manager", "Manufacturing User", "Stock User"],
      colorClass: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
    },
    logistica: {
      label: "Logística e Inventario",
      roles: ["Stock User"],
      colorClass: "bg-amber-500/10 border-amber-500/20 text-amber-400"
    },
    admin: {
      label: "Administrador de la Franquicia",
      roles: ["System Manager", "Accounts Manager", "Sales Manager", "Stock Manager", "Item Manager"],
      colorClass: "bg-purple-500/10 border-purple-500/20 text-purple-400"
    }
  };

  const getMatchedProfileKey = (userRoles: string[]) => {
    if (userRoles.includes("Sales User") && userRoles.includes("Accounts User")) return "cajero";
    if (userRoles.includes("System Manager")) return "admin";
    if (userRoles.includes("Manufacturing User")) return "produccion";
    if (userRoles.includes("Stock User")) return "logistica";
    return null;
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !userFirstName.trim()) {
      setErrorMsg("El correo y el nombre son obligatorios.");
      return;
    }
    if (!editingUser && !userPassword.trim()) {
      setErrorMsg("La contraseña es obligatoria para nuevos usuarios.");
      return;
    }
    
    setSubmittingUser(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const rawRes = await createOrUpdateUser({
        email: userEmail.trim(),
        first_name: userFirstName.trim(),
        last_name: userLastName.trim(),
        roles: selectedUserRoles,
        password: userPassword.trim() || undefined,
        enabled: userEnabled ? 1 : 0,
        is_new: editingUser ? 0 : 1
      });
      const res = rawRes?.message || rawRes;
      
      if (res && res.success) {
        setSuccessMsg(res.message || "Usuario guardado con éxito.");
        setShowUserModal(false);
        setEditingUser(null);
        mutateUsersWithRoles(); // Refrescar SWR
        mutateBranches(); // Sincronizar cajeros en sucursales
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.message || "No se pudo guardar el usuario.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar el usuario.");
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleToggleUserAccess = async (user: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const rawRes = await createOrUpdateUser({
        email: user.email || user.name,
        first_name: user.first_name,
        last_name: user.last_name || "",
        roles: user.roles || [],
        enabled: user.enabled ? 0 : 1, // toggle
        is_new: 0
      });
      const res = rawRes?.message || rawRes;
      if (res && res.success) {
        setSuccessMsg(res.message || "Acceso de usuario actualizado con éxito.");
        mutateUsersWithRoles();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.message || "No se pudo actualizar el acceso.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al actualizar acceso.");
    }
  };


  // Sincronizar estados locales cuando se carga la configuración SaaS
  useEffect(() => {
    if (saasConfig) {
      setPrimaryColor(saasConfig.colors?.primary || "#1abc9c");
      setHasPos(!!saasConfig.features?.pos);
      setHasProduction(!!saasConfig.features?.production);
      setHasLogistics(!!saasConfig.features?.logistics);
      setHasReservations(!!saasConfig.features?.reservations);
      setHasPurchasing(!!saasConfig.features?.purchasing);
      setHasWholesale(saasConfig.features?.wholesale !== undefined ? !!saasConfig.features.wholesale : true);
      setHasMexicoTaxes(!!saasConfig.features?.mexico_taxes);
      setHasServices(saasConfig.features?.services !== undefined ? !!saasConfig.features.services : true);
      setHasProducts(saasConfig.features?.products !== undefined ? !!saasConfig.features.products : true);
      setReservationItemCode(saasConfig.reservation_item_code || "Carrito Paletero");
      setMaxReservationAssets(saasConfig.max_reservation_assets || 0);
      setCountry(saasConfig.custom_country || "Mexico");
      setCurrency(saasConfig.custom_currency || "MXN");
      
      // Sincronizar campos de identidad y visualización de tickets
      setCompanyName(saasConfig.company_name || saasConfig.client_name || "");
      setCompanyLogo(saasConfig.company_logo || "");
      setCompanyTaxId(saasConfig.company_tax_id || "");
      setCompanyAddress(saasConfig.company_address || "");
      setCompanyPhone(saasConfig.company_phone || "");
      setCompanyEmail(saasConfig.company_email || "");
      setTicketHeader(saasConfig.ticket_header || "");
      setTicketFooter(saasConfig.ticket_footer || "");
      setPrintLogo(saasConfig.print_logo !== undefined ? !!saasConfig.print_logo : true);
      setPrintTaxId(saasConfig.print_tax_id !== undefined ? !!saasConfig.print_tax_id : true);
      setPrintAddress(saasConfig.print_address !== undefined ? !!saasConfig.print_address : true);
      setPrintContact(saasConfig.print_contact !== undefined ? !!saasConfig.print_contact : true);
      
      try {
        const parsed = JSON.parse(saasConfig.default_event_items || "[]");
        setDefaultEventItems(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setDefaultEventItems([]);
      }
    }
  }, [saasConfig]);

  // Redirigir si no es Admin
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/");
    } else if (!authLoading && currentUser && !isAdmin) {
      router.push("/");
    }
  }, [currentUser, authLoading, isAdmin, router]);

  // Guardar configuración general
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      let finalLogoUrl = companyLogo;

      // Si hay un archivo de logotipo seleccionado localmente, subirlo primero
      if (selectedLogoFile) {
        setLogoUploading(true);
        // 1. Comprimir imagen localmente
        let compressedBlob: Blob;
        try {
          compressedBlob = await compressImage(selectedLogoFile);
        } catch (compressErr: any) {
          console.error("Error al comprimir el logo:", compressErr);
          throw new Error("No se pudo comprimir la imagen del logo seleccionada.");
        }

        // 2. Preparar FormData para subir
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const formData = new FormData();
        formData.append("file", compressedBlob, `logo_${Date.now()}.jpg`);
        formData.append("is_private", "0");
        formData.append("folder", "Home/Attachments");

        // 3. Petición POST a upload_file
        const uploadRes = await fetch(`${url}/api/method/upload_file`, {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.message || "Error al subir el logotipo al servidor.");
        }

        const uploadData = await uploadRes.json();
        if (uploadData.message && uploadData.message.file_url) {
          finalLogoUrl = uploadData.message.file_url;
          setCompanyLogo(finalLogoUrl); // Sincronizar en el estado principal
        } else {
          throw new Error("No se recibió una ruta de archivo válida.");
        }
      }

      // 4. Guardar la configuración general
      const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.update_saas_config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          primary_color: primaryColor,
          has_pos: hasPos ? 1 : 0,
          has_production: hasProduction ? 1 : 0,
          has_logistics: hasLogistics ? 1 : 0,
          has_reservations: hasReservations ? 1 : 0,
          has_purchasing: hasPurchasing ? 1 : 0,
          reservation_item_code: reservationItemCode,
          max_reservation_assets: maxReservationAssets,
          default_event_items: JSON.stringify(defaultEventItems),
          custom_country: country,
          custom_currency: currency,
          has_wholesale: hasWholesale ? 1 : 0,
          has_mexico_taxes: hasMexicoTaxes ? 1 : 0,
          has_services: hasServices ? 1 : 0,
          has_products: hasProducts ? 1 : 0,
          // Nuevos campos de marca e identidad comercial
          company_name: companyName,
          company_logo: finalLogoUrl,
          company_tax_id: companyTaxId,
          company_address: companyAddress,
          company_phone: companyPhone,
          company_email: companyEmail,
          ticket_header: ticketHeader,
          ticket_footer: ticketFooter,
          print_logo: printLogo ? 1 : 0,
          print_tax_id: printTaxId ? 1 : 0,
          print_address: printAddress ? 1 : 0,
          print_contact: printContact ? 1 : 0
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message && data.message.success) {
          await refreshConfig();
          setSuccessMsg("¡Configuración general de la plataforma guardada con éxito!");
          
          // Limpiar archivo seleccionado ya subido
          setSelectedLogoFile(null);
          if (logoPreviewUrl) {
            URL.revokeObjectURL(logoPreviewUrl);
          }
          setLogoPreviewUrl(null);

          // Actualizar estado general
          setSaasConfig({
            client_name: saasConfig?.client_name || "La Paletixa",
            colors: { primary: primaryColor },
            features: {
              pos: hasPos,
              production: hasProduction,
              logistics: hasLogistics,
              reservations: hasReservations,
              purchasing: hasPurchasing,
              wholesale: hasWholesale,
              mexico_taxes: hasMexicoTaxes,
              services: hasServices,
              products: hasProducts
            },
            reservation_item_code: reservationItemCode,
            max_reservation_assets: maxReservationAssets,
            default_event_items: JSON.stringify(defaultEventItems),
            custom_country: country,
            custom_currency: currency,
            // Actualizar identidad en local
            company_name: companyName,
            company_logo: finalLogoUrl,
            company_tax_id: companyTaxId,
            company_address: companyAddress,
            company_phone: companyPhone,
            company_email: companyEmail,
            ticket_header: ticketHeader,
            ticket_footer: ticketFooter,
            print_logo: printLogo,
            print_tax_id: printTaxId,
            print_address: printAddress,
            print_contact: printContact
          });
          
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setErrorMsg("No se pudo guardar la configuración.");
        }
      } else {
        setErrorMsg("Error en la respuesta del servidor.");
      }
    } catch (err: any) {
      console.error("Error al guardar la configuración:", err);
      setErrorMsg(err.message || "Ocurrió un error al guardar la configuración.");
    } finally {
      setLogoUploading(false);
      setUpdating(false);
    }
  };

  // Agregar artículo al constructor de plantilla
  const handleAddTemplateItem = (item: any) => {
    setDefaultEventItems(prev => {
      const existing = prev.find(i => i.item_code === item.name);
      if (existing) {
        return prev.map(i => i.item_code === item.name ? { ...i, qty: i.qty + 50 } : i);
      }
      return [...prev, {
        item_code: item.name,
        item_name: item.item_name,
        qty: 50,
        rate: item.standard_rate || 14.0
      }];
    });
    setProductSearch("");
  };

  // Modificar cantidad en constructor de plantilla
  const handleUpdateTemplateItemQty = (itemCode: string, newQty: number) => {
    if (newQty <= 0) {
      setDefaultEventItems(prev => prev.filter(i => i.item_code !== itemCode));
      return;
    }
    setDefaultEventItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, qty: newQty } : i));
  };

  if (authLoading || configLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-500"></div>
          <p className="text-sm font-medium tracking-wide animate-pulse">Cargando Panel de Configuración...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Preajustes de colores corporativos
  const colorPresets = [
    { hex: "#1abc9c", label: "🍦 Menta Dulce" },
    { hex: "#3498db", label: "❄️ Azul Glaciar" },
    { hex: "#e74c3c", label: "🍓 Fresa Intensa" },
    { hex: "#f39c12", label: "🍊 Naranja Cítrico" },
    { hex: "#9b59b6", label: "🍇 Mora Silvestre" },
    { hex: "#2ecc71", label: "🍏 Limón Ácido" }
  ];

  // Filtrar catálogo según buscador del constructor
  const filteredCatalog = items?.filter(item =>
    item.item_name.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];

  const hasChanges = () => {
    if (!saasConfig) return false;
    
    let originalDefaultEventItems = [];
    try {
      const parsed = JSON.parse(saasConfig.default_event_items || "[]");
      originalDefaultEventItems = Array.isArray(parsed) ? parsed : [];
    } catch (e) {}
    
    const defaultEventItemsChanged = JSON.stringify(defaultEventItems) !== JSON.stringify(originalDefaultEventItems);

    return (
      primaryColor !== (saasConfig.colors?.primary || "#1abc9c") ||
      hasPos !== (!!saasConfig.features?.pos) ||
      hasProduction !== (!!saasConfig.features?.production) ||
      hasLogistics !== (!!saasConfig.features?.logistics) ||
      hasReservations !== (!!saasConfig.features?.reservations) ||
      hasPurchasing !== (!!saasConfig.features?.purchasing) ||
      hasWholesale !== (saasConfig.features?.wholesale !== undefined ? !!saasConfig.features.wholesale : true) ||
      hasMexicoTaxes !== (!!saasConfig.features?.mexico_taxes) ||
      hasServices !== (saasConfig.features?.services !== undefined ? !!saasConfig.features.services : true) ||
      hasProducts !== (saasConfig.features?.products !== undefined ? !!saasConfig.features.products : true) ||
      reservationItemCode !== (saasConfig.reservation_item_code || "Carrito Paletero") ||
      maxReservationAssets !== (saasConfig.max_reservation_assets || 0) ||
      country !== (saasConfig.custom_country || "Mexico") ||
      currency !== (saasConfig.custom_currency || "MXN") ||
      companyName !== (saasConfig.company_name || saasConfig.client_name || "") ||
      companyLogo !== (saasConfig.company_logo || "") ||
      companyTaxId !== (saasConfig.company_tax_id || "") ||
      companyAddress !== (saasConfig.company_address || "") ||
      companyPhone !== (saasConfig.company_phone || "") ||
      companyEmail !== (saasConfig.company_email || "") ||
      ticketHeader !== (saasConfig.ticket_header || "") ||
      ticketFooter !== (saasConfig.ticket_footer || "") ||
      printLogo !== (saasConfig.print_logo !== undefined ? !!saasConfig.print_logo : true) ||
      printTaxId !== (saasConfig.print_tax_id !== undefined ? !!saasConfig.print_tax_id : true) ||
      printAddress !== (saasConfig.print_address !== undefined ? !!saasConfig.print_address : true) ||
      printContact !== (saasConfig.print_contact !== undefined ? !!saasConfig.print_contact : true) ||
      defaultEventItemsChanged ||
      selectedLogoFile !== null
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden w-full relative">
      <form 
        id="config-form"
        onSubmit={handleSaveChanges} 
        className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6 sm:space-y-8 overflow-y-auto flex-1 pb-24"
      >

        {/* Notificaciones */}
        {successMsg && (
          <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 text-sm text-emerald-400 font-bold leading-normal flex items-center gap-3 animate-fade-in shadow-lg">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-3xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm text-red-400 font-bold leading-normal flex items-center gap-3 animate-fade-in shadow-lg">
            <span className="h-2 w-2 rounded-full bg-red-400"></span>
            {errorMsg}
          </div>
        )}

        {/* Selector de Pestañas Premium Global */}
        <div className="tab-container flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`tab-button flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${activeTab === "general" ? "active" : ""}`}
          >
            🏢 <span>Identidad y General</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("modulos")}
            className={`tab-button flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${activeTab === "modulos" ? "active" : ""}`}
          >
            ⚙️ <span>Módulos y Funciones</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sucursales")}
            className={`tab-button flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${activeTab === "sucursales" ? "active" : ""}`}
          >
            🏪 <span>Sucursales</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("usuarios")}
            className={`tab-button flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${activeTab === "usuarios" ? "active" : ""}`}
          >
            👤 <span>Usuarios y Accesos</span>
          </button>
        </div>

        {activeTab === "general" && (
          <>
        {/* Tarjeta 1.5: Identidad de la Empresa y Personalización de Ticket con Live Preview */}
        <div className="bg-slate-950/65 backdrop-blur-md rounded-3xl border border-slate-850 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in">
          <div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wider mb-2">🏢 Identidad Comercial y Ticket POS</h2>
            <p className="text-xs text-slate-400 font-medium">Configurá la identidad de tu marca para tickets físicos, facturas y reportes contables.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Formulario de Configuración (Columna Izquierda) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Bloque 1: Datos Comerciales */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-[rgb(var(--primary-rgb))] border-b border-slate-850 pb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                  Información Fiscal y de Marca
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre de la Empresa</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ej. La Paletixa S.A. de C.V."
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Identificación Fiscal (RFC / NIT)</label>
                    <input
                      type="text"
                      value={companyTaxId}
                      onChange={(e) => setCompanyTaxId(e.target.value)}
                      placeholder="Ej. PAL123456XX9"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Logo de la Empresa</label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      
                      {/* Zona de Subida Interactiva (Col 8) */}
                      <div className="md:col-span-8 relative">
                        {logoUploading ? (
                          <div className="h-32 rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center gap-3 animate-pulse">
                            <div className="h-7 w-7 animate-spin rounded-full border-3 border-slate-700 border-t-sky-500"></div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Comprimiendo y subiendo logo...</span>
                          </div>
                        ) : (logoPreviewUrl || companyLogo) ? (
                          <div className="h-32 rounded-3xl border border-slate-800 bg-slate-950 flex items-center justify-between p-4 px-6 shadow-inner gap-4 relative overflow-hidden group">
                            <div className="flex items-center gap-4">
                              <div className="h-20 w-20 rounded-2xl bg-white border border-slate-200/10 flex items-center justify-center p-2.5 overflow-hidden shadow-md">
                                <div
                                  role="img"
                                  aria-label="Logo comercial"
                                  className="h-full w-full bg-contain bg-center bg-no-repeat"
                                  style={{
                                    backgroundImage: `url(${logoPreviewUrl || (companyLogo.startsWith("http") || companyLogo.startsWith("blob:") ? companyLogo : `${process.env.NEXT_PUBLIC_FRAPPE_URL || ""}${companyLogo}`)})`,
                                  }}
                                />
                              </div>
                              <div className="space-y-0.5 max-w-[180px] sm:max-w-[220px]">
                                <span className={`text-[9px] font-black uppercase tracking-widest block ${logoPreviewUrl ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {logoPreviewUrl ? 'Logo Seleccionado (Sin guardar)' : 'Logotipo Activo'}
                                </span>
                                <p className="text-[9px] text-slate-500 truncate font-semibold" title={logoPreviewUrl ? (selectedLogoFile?.name || "Nuevo logo") : companyLogo}>
                                  {logoPreviewUrl ? (selectedLogoFile?.name || "Nuevo logo") : companyLogo.split('/').pop()}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5 z-20">
                              <button
                                type="button"
                                onClick={() => {
                                  const fileInput = document.getElementById("logo-file-input");
                                  fileInput?.click();
                                }}
                                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-slate-200 hover:text-white px-3 py-2 border border-slate-800 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span>Reemplazar</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold px-3 py-2 border border-red-500/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Quitar</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              const fileInput = document.getElementById("logo-file-input");
                              fileInput?.click();
                            }}
                            className="h-32 rounded-3xl border border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/40 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 group"
                          >
                            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-850 text-slate-400 group-hover:text-white transition-all shadow-md group-hover:scale-105">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-white">Subir archivo de logotipo</span>
                            <span className="text-[8px] text-slate-500 font-medium">Formatos aceptados: JPG, PNG, WEBP. Se comprimirá localmente.</span>
                          </div>
                        )}
                        
                        {/* Input File Oculto */}
                        <input
                          id="logo-file-input"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedLogoFile(file);
                              const url = URL.createObjectURL(file);
                              setLogoPreviewUrl(url);
                            }
                          }}
                          className="hidden"
                          disabled={logoUploading}
                        />
                      </div>

                      {/* URL Manual (Col 4) */}
                      <div className="md:col-span-4 space-y-1">
                        <span className="block text-[8px] font-black uppercase tracking-widest text-slate-500">O ingresar URL directamente:</span>
                        <input
                          type="text"
                          value={logoPreviewUrl ? "" : companyLogo}
                          onChange={(e) => {
                            if (logoPreviewUrl) {
                              URL.revokeObjectURL(logoPreviewUrl);
                              setLogoPreviewUrl(null);
                              setSelectedLogoFile(null);
                            }
                            setCompanyLogo(e.target.value);
                          }}
                          placeholder={logoPreviewUrl ? "Quita la imagen para ingresar URL" : "Ej. https://tuservidor.com/logo.png"}
                          disabled={!!logoPreviewUrl}
                          className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none font-medium placeholder-slate-650 shadow-md disabled:opacity-40"
                        />
                      </div>

                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Dirección Comercial / Sucursal Central</label>
                    <textarea
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="Ej. Av. de la Reforma 123, Col. Centro, CDMX"
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none font-medium resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Teléfono Comercial</label>
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="Ej. +52 55 1234 5678"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Email de Contacto</label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="Ej. contacto@empresa.com"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 2: Customización del Ticket */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-[rgb(var(--primary-rgb))] border-b border-slate-850 pb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                  Mensajes y Opciones del Ticket
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Mensaje de Encabezado (Header)</label>
                    <input
                      type="text"
                      value={ticketHeader}
                      onChange={(e) => setTicketHeader(e.target.value)}
                      placeholder="Ej. ¡BIENVENIDOS A LA PALETIXA!"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Mensaje de Pie de Página (Footer)</label>
                    <input
                      type="text"
                      value={ticketFooter}
                      onChange={(e) => setTicketFooter(e.target.value)}
                      placeholder="Ej. ¡GRACIAS POR SU COMPRA! VUELVA PRONTO"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-slate-700 outline-none font-semibold"
                    />
                  </div>
                </div>

                {/* Toggles de Visualización */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-800 transition-colors">
                    <span className="text-[10px] font-bold text-slate-300">Imprimir Logotipo</span>
                    <input
                      type="checkbox"
                      checked={printLogo}
                      onChange={(e) => setPrintLogo(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-800 transition-colors">
                    <span className="text-[10px] font-bold text-slate-300">Imprimir RFC / Tax ID</span>
                    <input
                      type="checkbox"
                      checked={printTaxId}
                      onChange={(e) => setPrintTaxId(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-800 transition-colors">
                    <span className="text-[10px] font-bold text-slate-300">Imprimir Dirección</span>
                    <input
                      type="checkbox"
                      checked={printAddress}
                      onChange={(e) => setPrintAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-850 cursor-pointer hover:border-slate-800 transition-colors">
                    <span className="text-[10px] font-bold text-slate-300">Imprimir Datos de Contacto</span>
                    <input
                      type="checkbox"
                      checked={printContact}
                      onChange={(e) => setPrintContact(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>
                </div>

              </div>

            </div>

            {/* Live Ticket Preview (Columna Derecha) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-900/30 border border-slate-850 rounded-3xl space-y-4 self-stretch">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Live Ticket Preview (Simulación de Impresión)</span>
              
              <div className="w-full max-w-[280px] p-5 rounded-md shadow-2xl font-mono text-[9px] leading-relaxed relative flex flex-col justify-between overflow-hidden" style={{ backgroundColor: 'white', color: '#1e293b' }}>
                {/* Visual Receipt Jagged Edge simulator */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 to-transparent" style={{ opacity: 0.5 }}></div>
                
                <div className="space-y-3 text-center">
                  {/* Logo */}
                  {printLogo && (logoPreviewUrl || companyLogo) && (
                    <div className="flex justify-center mb-1">
                      <div
                        role="img"
                        aria-label="Brand Logo"
                        className="mx-auto h-8 w-full max-w-[120px] bg-contain bg-center bg-no-repeat"
                        style={{
                          backgroundImage: `url(${logoPreviewUrl || (companyLogo.startsWith("http") || companyLogo.startsWith("blob:") ? companyLogo : `${process.env.NEXT_PUBLIC_FRAPPE_URL || ""}${companyLogo}`)})`,
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Company Name */}
                  <h4 className="font-extrabold text-xs leading-tight uppercase" style={{ color: '#0f172a' }}>{companyName || "LA PALETIXA"}</h4>
                  
                  {/* Tax ID */}
                  {printTaxId && companyTaxId && (
                    <p className="text-[8px] leading-none" style={{ color: '#475569' }}>RFC: {companyTaxId}</p>
                  )}

                  {/* Address */}
                  {printAddress && companyAddress && (
                    <p className="text-[8px] leading-snug max-w-[200px] mx-auto whitespace-pre-line" style={{ color: '#475569' }}>{companyAddress}</p>
                  )}

                  {/* Contact */}
                  {printContact && (companyPhone || companyEmail) && (
                    <p className="text-[8px] leading-snug" style={{ color: '#475569' }}>
                      {companyPhone && <span>Tel: {companyPhone}</span>}
                      {companyPhone && companyEmail && <br />}
                      {companyEmail && <span>Email: {companyEmail}</span>}
                    </p>
                  )}

                  {/* Welcome Message */}
                  {ticketHeader && (
                    <p className="font-bold border-y border-dashed py-1.5 my-2 uppercase" style={{ borderColor: '#cbd5e1', color: '#0f172a' }}>{ticketHeader}</p>
                  )}
                </div>

                {/* Dummy Sale Table */}
                <div className="space-y-1.5 my-3.5 border-b border-dashed pb-2 text-left" style={{ borderColor: '#cbd5e1' }}>
                  <div className="flex justify-between font-bold" style={{ color: '#0f172a' }}>
                    <span>Cant / Producto</span>
                    <span>Total</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1 x Paleta Fresa Intensa</span>
                    <span>$15.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2 x Bolis Menta Dulce</span>
                    <span>$24.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1 x Trompito Limón Ácido</span>
                    <span>$14.00</span>
                  </div>
                </div>

                {/* Dummy Totals */}
                <div className="space-y-1 text-right border-b border-dashed pb-2" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>
                  {hasMexicoTaxes ? (
                    <>
                      <div className="flex justify-between">
                        <span>Subtotal (Base):</span>
                        <span>$45.69</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA (16%):</span>
                        <span>$7.31</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>$53.00</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-[10px]" style={{ color: '#0f172a' }}>
                    <span>TOTAL A PAGAR:</span>
                    <span>$53.00</span>
                  </div>
                  <div className="flex justify-between" style={{ color: '#475569' }}>
                    <span>Pago en Efectivo:</span>
                    <span>$100.00</span>
                  </div>
                  <div className="flex justify-between font-bold" style={{ color: '#15803d' }}>
                    <span>Cambio Entregado:</span>
                    <span>$47.00</span>
                  </div>
                </div>

                {/* Invoice Footer Metadata */}
                <div className="text-center text-[7px] my-2 space-y-0.5" style={{ color: '#64748b' }}>
                  <p>Factura: SIN-002345</p>
                  <p>Fecha: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  <p>Cajero: jorlys@gmail.com</p>
                </div>

                {/* Despedida */}
                {ticketFooter && (
                  <div className="text-center mt-2.5 font-bold uppercase border-t border-dashed pt-2 text-[8px]" style={{ borderColor: '#cbd5e1', color: '#0f172a' }}>
                    {ticketFooter}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Tarjeta: Ubicación y Moneda */}
        <div className="bg-slate-950/65 backdrop-blur-md rounded-3xl border border-slate-850 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in">
          <div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wider mb-2">🌍 Ubicación y Moneda</h2>
            <p className="text-xs text-slate-400 font-medium">Configurá el país y la moneda local en la que opera la franquicia para sincronizar automáticamente el sistema contable y evitar conversiones automáticas erróneas.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">País de Operación</label>
              <CustomSelect
                value={country}
                onChange={(val) => setCountry(val)}
                options={[
                  { value: "Mexico", label: "México" },
                  { value: "Argentina", label: "Argentina" },
                  { value: "Colombia", label: "Colombia" },
                  { value: "Chile", label: "Chile" },
                  { value: "United States", label: "Estados Unidos" },
                  { value: "Spain", label: "España" }
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Moneda Local</label>
              <CustomSelect
                value={currency}
                onChange={(val) => setCurrency(val)}
                options={[
                  { value: "MXN", label: "MXN - Peso Mexicano" },
                  { value: "ARS", label: "ARS - Peso Argentino" },
                  { value: "COP", label: "COP - Peso Colombiano" },
                  { value: "CLP", label: "CLP - Peso Chileno" },
                  { value: "USD", label: "USD - Dólar Estadounidense" },
                  { value: "EUR", label: "EUR - Euro" }
                ]}
              />
            </div>
          </div>
        </div>
        </>
        )}

        {activeTab === "modulos" && (
          <>
        {/* Tarjeta 2: Sistema de Habilitación de Módulos Extras */}
        <div className="bg-slate-950/65 backdrop-blur-md rounded-3xl border border-slate-850 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in">
          <div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wider mb-2">⚙️ Sistema de Módulos (Feature Flags)</h2>
            <p className="text-xs text-slate-400 font-medium">Activa o desactiva en caliente las secciones operativas según la necesidad del negocio.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            
            {/* Toggle POS */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-sky-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Punto de Venta (POS)</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita el módulo de cobro rápido para cajeros de sucursal.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasPos}
                onChange={(e) => setHasPos(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
              />
            </div>

            {/* Toggle Production */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-emerald-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Control de Producción</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita el registro rápido de fabricación para el almacén central.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasProduction}
                onChange={(e) => setHasProduction(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-emerald-500 bg-slate-900 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Toggle Logistics */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-indigo-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Logística de Traspaso</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita la gestión de envíos de stock entre sucursales.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasLogistics}
                onChange={(e) => setHasLogistics(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-indigo-500 bg-slate-900 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Toggle Purchasing */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-amber-500 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Módulo de Compras</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita el registro de proveedores, órdenes de compra y recepción de mercancía.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasPurchasing}
                onChange={(e) => setHasPurchasing(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-amber-500 bg-slate-900 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Toggle Reservations */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-teal-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reserva de Eventos</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Módulo para alquilar carritos de paletas con autogestión pública.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasReservations}
                onChange={(e) => setHasReservations(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-teal-500 bg-slate-900 focus:ring-teal-500 cursor-pointer"
              />
            </div>

            {/* Toggle Wholesale */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4 animate-scale-in">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-amber-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Venta Mayorista (Wholesale)</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Portal de auto-servicio con validación por celular y PIN para mayoristas.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasWholesale}
                onChange={(e) => setHasWholesale(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-amber-500 bg-slate-900 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Toggle Mexico Taxation */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4 animate-scale-in">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-red-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Localización de México (Impuestos y SAT)</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita plantillas de IVA (16%), cuentas fiscales y catálogos de RFC, Régimen y Uso CFDI.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasMexicoTaxes}
                onChange={(e) => setHasMexicoTaxes(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-red-500 bg-slate-900 focus:ring-red-500 cursor-pointer"
              />
            </div>

            {/* Toggle Services */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4 animate-scale-in">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-purple-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Servicios (Timesheets, Mantenimiento, Soporte)</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita hojas de horas facturables, visitas técnicas de mantenimiento y tickets de soporte técnico.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasServices}
                onChange={(e) => setHasServices(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-purple-500 bg-slate-900 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {/* Toggle Products */}
            <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-850 flex items-start justify-between gap-4 animate-scale-in">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-slate-950 rounded-xl text-pink-400 border border-slate-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Productos e Inventario</h3>
                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">Habilita artículos inventariables, control de almacenes y transacciones de movimiento físico de stock.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasProducts}
                onChange={(e) => setHasProducts(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 text-pink-500 bg-slate-900 focus:ring-pink-500 cursor-pointer"
              />
            </div>

          </div>
        </div>

        {/* Tarjeta 3: Configuración Avanzada de Reservas (Solo visible si hasReservations está activo) */}
        {hasReservations && (
          <div className="bg-slate-950/65 backdrop-blur-md rounded-3xl border border-slate-850 p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
            <div>
              <h2 className="text-lg font-extrabold text-teal-400 uppercase tracking-wider mb-2">📅 Configuración del Módulo de Reservas</h2>
              <p className="text-xs text-slate-400 font-medium">Establecé los límites y el paquete preestablecido que se precargará para los eventos.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Artículo Reservable (Agnóstico)</label>
                <input
                  type="text"
                  required
                  value={reservationItemCode}
                  onChange={(e) => setReservationItemCode(e.target.value)}
                  placeholder="Ej. Carrito Paletero"
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-slate-700 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Cantidad Total de Carritos / Recursos</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={maxReservationAssets || ""}
                  onChange={(e) => setMaxReservationAssets(parseInt(e.target.value) || 0)}
                  placeholder="Ej. 10"
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-slate-700 outline-none font-bold"
                />
              </div>
            </div>

            {/* Constructor de Plantilla de Productos Pre-cargados */}
            <div className="pt-6 border-t border-slate-850 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">🍭 Plantilla de Productos Pre-cargados</h3>
                <p className="text-[10px] text-slate-450 leading-normal">
                  Define el paquete estándar (sabores y cantidades) que aparecerá en el carrito del cliente de forma inmediata al entrar a reservar.
                </p>
              </div>

              {/* Buscador de productos */}
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar productos del catálogo para agregar a la plantilla..."
                  className="w-full bg-slate-900/60 border border-slate-850 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-slate-700"
                />
                {productSearch.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                    {filteredCatalog.length === 0 ? (
                      <p className="p-3 text-[10px] text-slate-500 text-center">No se encontraron productos.</p>
                    ) : (
                      filteredCatalog.map(p => (
                        <div
                          key={p.name}
                          onClick={() => handleAddTemplateItem(p)}
                          className="px-4 py-2.5 hover:bg-slate-900 text-[10px] text-slate-200 hover:text-white cursor-pointer transition-all border-b border-slate-900 last:border-0 font-bold flex justify-between items-center"
                        >
                          <span>{p.item_name}</span>
                          <span className="text-[9px] text-slate-500">${(p.standard_rate || 14.0).toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Lista actual pre-cargada */}
              <div className="space-y-3 pt-2">
                {defaultEventItems.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
                    No has definido ningún sabor para el paquete preestablecido.
                  </p>
                ) : (
                  defaultEventItems.map((item) => (
                    <div key={item.item_code} className="flex items-center justify-between gap-4 p-3 bg-slate-900/40 rounded-2xl border border-slate-850">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-black text-white truncate block">{item.item_name}</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Precio: ${item.rate.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-950 rounded-xl border border-slate-850 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateTemplateItemQty(item.item_code, item.qty - 50)}
                          className="text-slate-400 hover:text-white font-extrabold text-xs cursor-pointer px-1"
                        >
                          -
                        </button>
                        <span className="text-xs font-black text-white min-w-[24px] text-center">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateTemplateItemQty(item.item_code, item.qty + 50)}
                          className="text-slate-400 hover:text-white font-extrabold text-xs cursor-pointer px-1"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateTemplateItemQty(item.item_code, 0)}
                        className="text-red-400 hover:text-red-300 p-2 bg-slate-950/60 rounded-xl border border-slate-850 hover:border-red-500/20 active:scale-95 transition-all"
                        title="Quitar de la plantilla"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        </>
        )}

        {activeTab === "sucursales" && (
          <>
        {/* Tarjeta 2: Gestión de Sucursales y Asignación de Cajeros */}
        <div className="bg-slate-950/65 backdrop-blur-md rounded-3xl border border-slate-850 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in">
          <div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wider mb-2">🏪 Gestión de Sucursales y Cajeros</h2>
            <p className="text-xs text-slate-400 font-medium font-semibold">
              Administrá tus puntos de venta físicos y asigná qué cajeros tienen autorización para cobrar en cada caja.
            </p>
          </div>

          <div className="space-y-4">
            {/* Cabecera del listado */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sucursales Registradas ({branches.length})</span>
              <button
                type="button"
                onClick={() => {
                  setEditingBranch(null);
                  setNewBranchName("");
                  setSelectedBranchCashiers([]);
                  setShowBranchModal(true);
                }}
                className="rounded-xl px-4 py-2.5 text-[10px] font-black text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nueva Sucursal
              </button>
            </div>

            {/* Listado de Sucursales */}
            {branchesLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500"></div>
              </div>
            ) : branches.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
                No hay sucursales registradas aún. ¡Crea la primera!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((b) => (
                  <div key={b.name} className="flex flex-col justify-between p-4 bg-slate-900/40 rounded-2xl border border-slate-850 hover:border-slate-800 transition-all shadow-md group">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="text-sm font-black text-white group-hover:text-[rgb(var(--primary-rgb))] transition-colors">
                            {b.name.replace("Punto de Venta - ", "")}
                          </h4>
                          <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 block">
                            Bodega: {b.warehouse}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBranch(b);
                              setNewBranchName(b.name.replace("Punto de Venta - ", ""));
                              setSelectedBranchCashiers(b.cashiers.map((c: any) => c.user));
                              setShowBranchModal(true);
                            }}
                            className="text-slate-400 hover:text-white p-2 px-3 bg-slate-950/60 rounded-xl border border-slate-850 hover:border-slate-700 active:scale-95 transition-all text-[9px] font-black cursor-pointer shadow-sm"
                          >
                            Editar Cajeros
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirmModal(b.name.replace("Punto de Venta - ", ""))}
                            className="text-red-400 hover:text-red-300 p-2 bg-slate-950/60 hover:bg-red-500/10 rounded-xl border border-slate-850 hover:border-red-500/30 active:scale-95 transition-all cursor-pointer shadow-sm"
                            title="Eliminar sucursal"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Lista de Cajeros */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-850/40">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">Cajeros Autorizados ({b.cashiers.length}):</span>
                        {b.cashiers.length === 0 ? (
                          <span className="text-[10px] text-slate-600 italic block font-semibold">Sin cajeros asignados</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {b.cashiers.map((c: any) => (
                              <span key={c.user} className="text-[9px] font-black bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-full text-slate-350 flex items-center gap-1 shadow-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                                {c.user}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {activeTab === "usuarios" && (
          <>
        {/* Tarjeta 2.5: Gestión de Usuarios y Control de Accesos */}
        <div className="bg-slate-950/65 backdrop-blur-md rounded-3xl border border-slate-850 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in">
          <div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wider mb-2">👤 Gestión de Usuarios y Accesos</h2>
            <p className="text-xs text-slate-400 font-medium font-semibold">
              Exclusivo Administrador. Crea nuevos usuarios (Cajeros, Logística, Producción), asigna sus roles operativos y bloquea o permite accesos en caliente.
            </p>
          </div>

          <div className="space-y-4">
            {/* Cabecera del listado de usuarios */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Usuarios del Sistema ({usersWithRoles.length})</span>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setUserEmail("");
                  setUserFirstName("");
                  setUserLastName("");
                  setUserPassword("");
                  setUserEnabled(true);
                  setSelectedUserRoles([]);
                  setShowUserModal(true);
                }}
                className="rounded-xl px-4 py-2.5 text-[10px] font-black text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Nuevo Usuario
              </button>
            </div>

            {/* Listado de Usuarios */}
            {usersLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500"></div>
              </div>
            ) : usersWithRoles.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
                No hay otros usuarios registrados en el sistema.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {usersWithRoles.map((u) => {
                  const matchedProfileKey = getMatchedProfileKey(u.roles || []);
                  const profileLabel = matchedProfileKey ? ROLE_PROFILES[matchedProfileKey].label : "Rol Personalizado";
                  const profileColorClass = matchedProfileKey ? ROLE_PROFILES[matchedProfileKey].colorClass : "bg-slate-500/10 border-slate-550/20 text-slate-400";
                  
                  return (
                    <div key={u.name} className={`flex flex-col justify-between p-5 bg-slate-900/40 rounded-2xl border ${u.enabled ? 'border-slate-850' : 'border-red-900/30 opacity-70'} hover:border-slate-800 transition-all shadow-md group`}>
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white group-hover:text-[rgb(var(--primary-rgb))] transition-colors truncate">
                              {u.first_name} {u.last_name || ""}
                            </h4>
                            <span className="text-[9px] text-slate-500 font-bold mt-0.5 block truncate font-mono">
                              {u.email || u.name}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Botón Habilitar/Deshabilitar Rápido */}
                            <button
                              type="button"
                              onClick={() => handleToggleUserAccess(u)}
                              className={`p-2 rounded-xl border active:scale-95 transition-all cursor-pointer shadow-sm ${u.enabled ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 hover:border-emerald-500/20' : 'text-red-400 hover:text-red-350 bg-red-500/5 hover:bg-red-500/10 border-red-500/10 hover:border-red-500/20'}`}
                              title={u.enabled ? "Bloquear acceso de usuario" : "Permitir acceso de usuario"}
                            >
                              {u.enabled ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </button>
                            
                            {/* Botón Editar */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setUserEmail(u.email || u.name);
                                setUserFirstName(u.first_name || "");
                                setUserLastName(u.last_name || "");
                                setUserPassword(""); // vacía en edición
                                setUserEnabled(!!u.enabled);
                                setSelectedUserRoles(u.roles || []);
                                setShowUserModal(true);
                              }}
                              className="text-slate-400 hover:text-white p-2 bg-slate-950/60 rounded-xl border border-slate-850 hover:border-slate-700 active:scale-95 transition-all text-[9px] font-black cursor-pointer shadow-sm"
                            >
                              Editar
                            </button>
                          </div>
                        </div>

                        {/* Perfil Rápido Match */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[8.5px] font-bold border px-2 py-0.5 rounded-md ${profileColorClass}`}>
                            {profileLabel}
                          </span>
                          {!u.enabled && (
                            <span className="text-[8.5px] font-bold border border-red-500/30 bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md">
                              Bloqueado
                            </span>
                          )}
                        </div>

                        {/* Listado de roles específicos */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-850/40">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">Roles Técnicos ({u.roles.length}):</span>
                          {u.roles.length === 0 ? (
                            <span className="text-[10px] text-slate-600 italic block font-semibold">Sin roles asignados</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map((r: string) => (
                                <span key={r} className="text-[9px] font-black bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-full text-slate-350 shadow-sm">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {activeTab === "general" && (
          <>
        {/* Estado del Tenant */}
        <div className="bg-slate-950/40 rounded-3xl border border-slate-850 p-6 sm:p-7 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Estado del Tenant (Inquilino)</h4>
            <p className="text-sm font-extrabold text-white">Dominio Operativo: <span className="text-sky-400 font-bold">{typeof window !== "undefined" ? window.location.hostname : "localhost"}</span></p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 shadow-sm">
            Empresa: {saasConfig?.client_name || "La Paletixa"}
          </span>
        </div>
        </>
        )}
      </form>

      {/* Modals outside the main form to avoid HTML nesting and hydration errors */}
      {/* Modal de Creación / Edición de Sucursal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-white tracking-wide">
                  {editingBranch ? "Editar Cajeros de Sucursal" : "Crear Nueva Sucursal"}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  {editingBranch 
                    ? "Modificá la lista de cajeros autorizados para operar esta caja." 
                    : "Ingresá los detalles físicos y asigná los cajeros iniciales."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBranchModal(false);
                  setEditingBranch(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Nombre de Sucursal */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre de la Sucursal</label>
                <input
                  type="text"
                  required
                  disabled={!!editingBranch}
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Ej. Sucursal Poniente, Sucursal Sur"
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white focus:border-slate-700 outline-none font-black disabled:opacity-50 shadow-md"
                />
              </div>

              {/* Listado de Cajeros Seleccionables */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Cajeros Autorizados</label>
                <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-850 rounded-2xl p-3 space-y-2 shadow-inner">
                  {users.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4 font-semibold">No hay otros usuarios en el sistema.</p>
                  ) : (
                    users.map((u) => {
                      const isChecked = selectedBranchCashiers.includes(u.email);
                      return (
                        <label key={u.email} className="flex items-center justify-between p-2.5 hover:bg-slate-900/40 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-850/40">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBranchCashiers([...selectedBranchCashiers, u.email]);
                                } else {
                                  setSelectedBranchCashiers(selectedBranchCashiers.filter(email => email !== u.email));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                            />
                            <div className="flex flex-col leading-tight">
                              <span className="text-[10px] font-black text-white">{u.first_name} {u.last_name || ""}</span>
                              <span className="text-[8px] text-slate-500 font-semibold mt-0.5">{u.email}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBranchModal(false);
                  setEditingBranch(null);
                }}
                className="flex-1 rounded-2xl bg-slate-800 hover:bg-slate-750 px-4 py-3.5 text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBranchSubmit}
                disabled={submittingBranch}
                className="flex-1 rounded-2xl px-4 py-3.5 text-xs font-black text-white shadow-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: primaryColor }}
              >
                {submittingBranch ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-white"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-wide">
                    ¿Eliminar Sucursal?
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Sucursal a procesar: <span className="text-red-400 font-bold">{showDeleteConfirmModal}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 font-semibold leading-relaxed">
              <p>
                Esta acción eliminará el Punto de Venta y la Bodega asociados de forma física si la sucursal no posee movimientos contables previos.
              </p>
              <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  Consistencia de Datos ERPNext
                </span>
                <p className="text-[10px] text-slate-400 leading-normal font-medium text-left">
                  Si existen facturas, aperturas de caja o movimientos de stock históricos, el sistema conservará los datos de auditoría de forma segura y **desactivará lógicamente** la sucursal. Desaparecerá de tu panel pero la historia del negocio quedará a salvo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={deletingBranchName !== null}
                onClick={() => setShowDeleteConfirmModal(null)}
                className="flex-1 rounded-2xl bg-slate-800 hover:bg-slate-750 px-4 py-3.5 text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingBranchName !== null}
                onClick={() => handleDeleteBranch(showDeleteConfirmModal)}
                className="flex-1 rounded-2xl bg-red-600 hover:bg-red-500 px-4 py-3.5 text-xs font-black text-white shadow-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deletingBranchName !== null ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-white"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición de Usuario */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-white tracking-wide">
                  {editingUser ? "Editar Usuario SaaS" : "Crear Nuevo Usuario"}
                </h3>
                <p className="text-[10px] text-slate-405 font-semibold mt-1">
                  {editingUser 
                    ? "Modificá el nombre, la habilitación, la contraseña o la asignación de roles." 
                    : "Ingresá los accesos y roles iniciales del nuevo operario."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              {/* Email de Usuario */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Ej. cajero.norte@empresa.com"
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white focus:border-slate-700 outline-none font-bold disabled:opacity-50 shadow-md"
                />
              </div>

              {/* Nombre y Apellido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre</label>
                  <input
                    type="text"
                    required
                    value={userFirstName}
                    onChange={(e) => setUserFirstName(e.target.value)}
                    placeholder="Ej. Juan"
                    className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white focus:border-slate-700 outline-none font-bold shadow-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Apellido</label>
                  <input
                    type="text"
                    value={userLastName}
                    onChange={(e) => setUserLastName(e.target.value)}
                    placeholder="Ej. Pérez"
                    className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white focus:border-slate-700 outline-none font-bold shadow-md"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Contraseña {editingUser && "(Dejar en blanco para conservar la actual)"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder={editingUser ? "Nueva contraseña..." : "Contraseña de acceso inicial..."}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white focus:border-slate-700 outline-none font-bold shadow-md"
                />
              </div>

              {/* Estado Activo Toggle */}
              <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-2xl cursor-pointer hover:border-slate-800 transition-colors shadow-sm">
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-bold text-slate-300">Permitir Acceso / Habilitado</span>
                  <span className="text-[8px] text-slate-500 font-semibold mt-0.5">Si se desmarca, el usuario no podrá iniciar sesión en la app.</span>
                </div>
                <input
                  type="checkbox"
                  checked={userEnabled}
                  onChange={(e) => setUserEnabled(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                />
              </label>

              {/* Accesos Rápidos - Perfiles Predefinidos */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Perfiles de Rol Rápidos</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(ROLE_PROFILES).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedUserRoles(value.roles);
                      }}
                      className={`text-left p-3 rounded-2xl border active:scale-95 transition-all text-[10px] font-bold cursor-pointer ${
                        selectedUserRoles.length === value.roles.length && value.roles.every(r => selectedUserRoles.includes(r))
                          ? value.colorClass + " shadow-inner ring-1 ring-sky-500/20"
                          : "bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes de Roles Técnicos Granulares */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Selección Granular de Roles Técnicos</label>
                <div className="max-h-36 overflow-y-auto bg-slate-950 border border-slate-850 rounded-2xl p-3 space-y-1.5 shadow-inner text-left animate-fade-in">
                  {availableRoles.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-2 font-semibold animate-pulse">Cargando roles disponibles...</p>
                  ) : (
                    availableRoles.map((role) => {
                      const isChecked = selectedUserRoles.includes(role);
                      return (
                        <label key={role} className="flex items-center justify-between p-2 hover:bg-slate-900/40 rounded-xl cursor-pointer transition-colors">
                          <span className="text-[10px] font-black text-slate-350">{role}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserRoles([...selectedUserRoles, role]);
                              } else {
                                setSelectedUserRoles(selectedUserRoles.filter(r => r !== role));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-800 text-sky-500 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-850/40">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 rounded-2xl bg-slate-850 hover:bg-slate-750 px-4 py-3.5 text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="flex-1 rounded-2xl px-4 py-3.5 text-xs font-black text-white shadow-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submittingUser ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-white"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    "Guardar Usuario"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {hasChanges() && (
        <button
          type="submit"
          form="config-form"
          disabled={updating}
          className="fixed bottom-8 right-8 z-50 rounded-2xl px-6 py-4 text-sm font-black text-white shadow-2xl transition-all duration-300 hover:brightness-110 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2 animate-fade-in"
          style={{ backgroundColor: primaryColor }}
        >
          {updating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Guardar Cambios</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
