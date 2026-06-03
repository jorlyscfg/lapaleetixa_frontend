"use client";

import React, { useState, useEffect } from "react";
import { 
  useFrappeAuth, 
  useFrappeGetDocList, 
  useFrappeCreateDoc, 
  useFrappeUpdateDoc, 
  useFrappeDeleteDoc,
  useFrappePostCall,
  useFrappeGetCall
} from "frappe-react-sdk";
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
  };
}

export default function ProduccionPage() {
  const { currentUser, isLoading: authLoading } = useFrappeAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [adjustStep, setAdjustStep] = useState(1);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showDisabled, setShowDisabled] = useState(false);

  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Determinar roles
  const isProdUser = currentUser === "produccion@lapaletixa.com";
  const isCashier = currentUser?.startsWith("cajero.");
  const isLogisticaUser = currentUser === "logistica@lapaletixa.com";
  const isAdmin = currentUser === "admin@lapaletixa.com" || (currentUser && !isCashier && !isProdUser && !isLogisticaUser);

  // Estado de Pestaña Activa (Solo Administradores pueden cambiar)
  const [activeTab, setActiveTab] = useState<"produccion" | "catalogo" | "variantes">("produccion");

  // Estados de Modales para CRUD
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Estados del Formulario CRUD
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formItemCode, setFormItemCode] = useState("");
  const [formItemName, setFormItemName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formWholesalePrice, setFormWholesalePrice] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [crudImageFile, setCrudImageFile] = useState<File | null>(null);
  const [crudImagePreviewUrl, setCrudImagePreviewUrl] = useState<string | null>(null);

  const [crudSubmitting, setCrudSubmitting] = useState(false);

  // Estados del Formulario de Generador de Variantes
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [varRetailPrice, setVarRetailPrice] = useState<string>("");
  const [varWholesalePrice, setVarWholesalePrice] = useState<string>("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [varBarcode, setVarBarcode] = useState("");

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

  // 1b. Consultar plantillas de ERPNext para el Generador
  const { data: templatesRaw, isLoading: templatesLoading, mutate: mutateTemplates } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_templates",
    {},
    "saas_templates"
  );
  const templates = (templatesRaw as any)?.message || [];

  // 1c. Consultar atributos de la plantilla seleccionada
  const { data: attributesRaw, isLoading: attributesLoading, mutate: mutateAttributes } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_attributes",
    selectedTemplate ? { template_name: selectedTemplate } : {},
    selectedTemplate ? `saas_attrs_${selectedTemplate}` : null
  );
  const attributes = (attributesRaw as any)?.message || [];

  // 1d. Consultar TODOS los atributos globales de ERPNext para el modal de plantillas
  const { data: allAttributesRaw } = useFrappeGetCall(
    "paletixa_saas.paletixa_saas.api.get_all_attributes",
    {},
    "saas_all_attributes"
  );
  const allAttributes = (allAttributesRaw as any)?.message || [];

  // Hooks para creación de plantillas y valores de atributos (sabores)
  const { call: createCustomVariant } = useFrappePostCall(
    "paletixa_saas.paletixa_saas.api.create_custom_variant"
  );
  const { call: createItemTemplate } = useFrappePostCall(
    "paletixa_saas.paletixa_saas.api.create_item_template"
  );
  const { call: addAttributeValue } = useFrappePostCall(
    "paletixa_saas.paletixa_saas.api.add_attribute_value"
  );

  const [varCreating, setVarCreating] = useState(false);

  // Estados de Modales para Creación Simplificada
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [showAddAttrValModal, setShowAddAttrValModal] = useState(false);
  const [selectedAttributeForValue, setSelectedAttributeForValue] = useState<string>("");

  // Formulario Nueva Plantilla
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateAttrs, setNewTemplateAttrs] = useState<string[]>([]);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);

  // Formulario Nuevo Valor de Atributo (Agnóstico)
  const [newAttrValName, setNewAttrValName] = useState("");
  const [newAttrValAbbr, setNewAttrValAbbr] = useState("");
  const [attrValSubmitting, setAttrValSubmitting] = useState(false);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || newTemplateAttrs.length === 0) {
      setErrorMessage("Por favor, ingresá el nombre de la plantilla y seleccioná al menos un atributo.");
      return;
    }

    setTemplateSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await createItemTemplate({
        template_name: newTemplateName,
        attributes_list: newTemplateAttrs
      });

      if (res.success) {
        setSuccessMessage(`¡Plantilla de producto "${res.item_name}" creada con éxito!`);
        setNewTemplateName("");
        setNewTemplateAttrs([]);
        setShowAddTemplateModal(false);
        // Recargar la lista de plantillas de inmediato
        await mutateTemplates();
        // Autoseleccionar la nueva plantilla
        setSelectedTemplate(res.name);
        setSelectedValues({});
      }
    } catch (err: any) {
      console.error("Error al crear plantilla:", err);
      setErrorMessage(err.message || "Ocurrió un error al crear la plantilla en ERPNext.");
    } finally {
      setTemplateSubmitting(false);
    }
  };

  const handleCreateAttrValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttributeForValue || !newAttrValName.trim() || !newAttrValAbbr.trim()) {
      setErrorMessage("Por favor, completá todos los campos requeridos.");
      return;
    }

    setAttrValSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await addAttributeValue({
        attribute_name: selectedAttributeForValue,
        value_name: newAttrValName,
        value_abbr: newAttrValAbbr
      });

      if (res.success) {
        setSuccessMessage(`¡Valor "${res.value}" (${res.abbr}) agregado con éxito a ${res.attribute}!`);
        setNewAttrValName("");
        setNewAttrValAbbr("");
        setShowAddAttrValModal(false);
        
        // Recargar atributos dinámicos de la plantilla actual de inmediato
        await mutateAttributes();
        
        // Autoseleccionar el valor recién creado
        setSelectedValues(prev => ({
          ...prev,
          [selectedAttributeForValue]: res.value
        }));
      }
    } catch (err: any) {
      console.error("Error al crear valor de atributo:", err);
      setErrorMessage(err.message || "Ocurrió un error al registrar el nuevo valor en ERPNext.");
    } finally {
      setAttrValSubmitting(false);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !varRetailPrice) return;

    // Validar que todos los atributos requeridos estén seleccionados
    const missingAttrs = attributes?.filter((a: any) => !selectedValues[a.attribute]);
    if (missingAttrs && missingAttrs.length > 0) {
      setErrorMessage(`Por favor, seleccioná un valor para: ${missingAttrs.map((a: any) => a.attribute).join(", ")}`);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setVarCreating(true);

    try {
      let uploadedImageUrl: string | undefined = undefined;

      if (selectedImageFile) {
        // 1. Comprimir imagen localmente usando canvas
        let compressedBlob: Blob;
        try {
          compressedBlob = await compressImage(selectedImageFile);
        } catch (compressErr: any) {
          console.error("Error al comprimir la imagen:", compressErr);
          throw new Error("No se pudo comprimir la imagen seleccionada.");
        }

        // 2. Subir el blob comprimido a Frappe
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const formData = new FormData();
        formData.append("file", compressedBlob, `${Date.now()}_comprimido.jpg`);
        formData.append("is_private", "0");
        formData.append("folder", "Home/Attachments");

        const uploadRes = await fetch(`${url}/api/method/upload_file`, {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.message || "Error al subir la imagen al servidor.");
        }

        const uploadData = await uploadRes.json();
        if (uploadData.message && uploadData.message.file_url) {
          uploadedImageUrl = uploadData.message.file_url;
        } else {
          throw new Error("La subida de imagen no retornó una ruta válida.");
        }
      }

      // 3. Crear variante en ERPNext con la imagen vinculada
      const res = await createCustomVariant({
        template_name: selectedTemplate,
        attribute_values: selectedValues,
        retail_price: varRetailPrice,
        wholesale_price: varWholesalePrice || null,
        image: uploadedImageUrl || null,
        barcode: varBarcode || null
      });

      if (res.success) {
        setSuccessMessage(`¡Variante "${res.item_name}" (${res.item_code}) creada con éxito con su imagen y precios asociados!`);
        // Limpiar formulario
        setSelectedValues({});
        setVarRetailPrice("");
        setVarWholesalePrice("");
        setVarBarcode("");
        setSelectedImageFile(null);
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        setImagePreviewUrl(null);
        // Mutar datos generales para actualizar el catálogo principal al instante
        mutateItems();
        mutatePrices();
        mutateBarcodes();
      }
    } catch (err: any) {
      console.error("Error al crear variante:", err);
      setErrorMessage(err.message || "Ocurrió un error inesperado al intentar crear la variante.");
    } finally {
      setVarCreating(false);
    }
  };

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

  // 2. Seguridad: Redirigir al login si no hay sesión
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  // 3. Feature Flag: Bloquear acceso si el módulo de producción no está activo
  useEffect(() => {
    if (!configLoading && saasConfig && !saasConfig.features.production) {
      router.push("/");
    }
  }, [saasConfig, configLoading, router]);

  // 4. Consultar artículos del grupo 'Products' en ERPNext (filtrando plantillas con has_variants=0)
  const { data: items, isLoading: itemsLoading, mutate: mutateItems } = useFrappeGetDocList("Item", {
    fields: ["name", "item_name", "item_group", "image", "standard_rate", "has_variants", "disabled"],
    filters: [
      ...(showDisabled ? [] : [["disabled", "=", 0]]),
      ["item_group", "=", "Products"],
      ["has_variants", "=", 0],
      ["name", "!=", "Carrito Paletero"]
    ] as any,
    limit: 150
  });

  // 4b. Consultar precios de los productos en ERPNext (Standard Selling y Standard Wholesale) - 100% dinámico
  const { data: prices, isLoading: pricesLoading, mutate: mutatePrices } = useFrappeGetDocList("Item Price", {
    fields: ["name", "item_code", "price_list", "price_list_rate"],
    filters: [
      ["price_list", "in", ["Standard Selling", "Standard Wholesale"]]
    ],
    limit: 1000
  });

  // 5. Consultar los Bins de stock actuales en 'Fabrica - LP'
  const { data: bins, isLoading: binsLoading, mutate: mutateBins } = useFrappeGetDocList("Bin", {
    fields: ["item_code", "actual_qty"],
    filters: [["warehouse", "=", "Fabrica - LP"]],
    limit: 200
  });

  // 5b. Consultar códigos de barra de los productos (mediante API custom para evitar 403)
  const [itemBarcodes, setItemBarcodes] = useState<any[]>([]);
  const [barcodesLoading, setBarcodesLoading] = useState(true);

  const fetchBarcodes = async () => {
    try {
      const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_item_barcodes`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setItemBarcodes(data.message);
        }
      }
    } catch (err) {
      console.error("Error al cargar códigos de barra:", err);
    } finally {
      setBarcodesLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchBarcodes();
    }
  }, [currentUser]);

  const mutateBarcodes = () => {
    fetchBarcodes();
  };

  const getItemBarcode = (itemCode: string) => {
    const b = itemBarcodes?.find(x => x.parent === itemCode);
    return b ? b.barcode : "";
  };

  const { createDoc } = useFrappeCreateDoc();
  const { updateDoc } = useFrappeUpdateDoc();
  const { deleteDoc } = useFrappeDeleteDoc();

  // Función para obtener stock actual mapeando el item_code
  const getItemStock = (itemCode: string) => {
    const bin = bins?.find(b => b.item_code === itemCode);
    return bin ? bin.actual_qty : 0;
  };

  // Función para obtener precio minorista
  const getItemPrice = (itemCode: string) => {
    const priceDoc = prices?.find(p => p.item_code === itemCode && p.price_list === "Standard Selling");
    return priceDoc ? priceDoc.price_list_rate : 0;
  };

  // Función para obtener precio mayorista
  const getItemWholesalePrice = (itemCode: string) => {
    const priceDoc = prices?.find(p => p.item_code === itemCode && p.price_list === "Standard Wholesale");
    return priceDoc ? priceDoc.price_list_rate : 0;
  };

  const [stockAdjustments, setStockAdjustments] = useState<Record<string, number>>({});
  const [submittingBatchStock, setSubmittingBatchStock] = useState(false);

  const handleAddLocalAdjustment = (itemCode: string, diff: number) => {
    setStockAdjustments(prev => {
      const current = prev[itemCode] || 0;
      const next = current + diff;
      if (next === 0) {
        const { [itemCode]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [itemCode]: next
      };
    });
  };

  const handleSubmitBatchStock = async () => {
    if (Object.keys(stockAdjustments).length === 0) return;

    setSubmittingBatchStock(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const positiveAdjustments: any[] = [];
    const negativeAdjustments: any[] = [];

    for (const [itemCode, qty] of Object.entries(stockAdjustments)) {
      if (qty === 0) continue;
      const price = getItemPrice(itemCode) || 5.0;
      
      const itemRow = {
        item_code: itemCode,
        qty: Math.abs(qty),
        uom: "Unit",
        allow_zero_valuation_rate: 1,
        ...(qty > 0 ? { basic_rate: price } : {}),
        [qty > 0 ? "t_warehouse" : "s_warehouse"]: "Fabrica - LP"
      };

      if (qty > 0) {
        positiveAdjustments.push(itemRow);
      } else {
        negativeAdjustments.push(itemRow);
      }
    }

    try {
      const promises: Promise<any>[] = [];

      // 1. Crear Stock Entry para Incrementos (Material Receipt)
      if (positiveAdjustments.length > 0) {
        promises.push(
          createDoc("Stock Entry", {
            doctype: "Stock Entry",
            purpose: "Material Receipt",
            stock_entry_type: "Material Receipt", // Mandatorio en ERPNext v16
            docstatus: 1, // Auto-submit to update stock ledger immediately
            to_warehouse: "Fabrica - LP",
            items: positiveAdjustments
          })
        );
      }

      // 2. Crear Stock Entry para Decrementos (Material Issue)
      if (negativeAdjustments.length > 0) {
        promises.push(
          createDoc("Stock Entry", {
            doctype: "Stock Entry",
            purpose: "Material Issue",
            stock_entry_type: "Material Issue", // Mandatorio en ERPNext v16
            docstatus: 1, // Auto-submit to update stock ledger immediately
            from_warehouse: "Fabrica - LP",
            items: negativeAdjustments
          })
        );
      }

      await Promise.all(promises);

      setSuccessMessage(
        `¡Ajuste masivo exitoso! Se registraron eficientemente los movimientos de stock en ERPNext.`
      );
      setStockAdjustments({});
      await mutateBins();
    } catch (err: any) {
      console.error("Error al registrar producción masiva:", err);
      setErrorMessage(err.message || "Ocurrió un error al registrar los movimientos de stock en ERPNext.");
    } finally {
      setSubmittingBatchStock(false);
    }
  };

  // Agregar Producto en ERPNext (Item + Item Prices)
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemCode || !formItemName || !formPrice) {
      setErrorMessage("Por favor, completá todos los campos requeridos.");
      return;
    }
    
    setCrudSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const priceVal = parseFloat(formPrice);
    if (isNaN(priceVal) || priceVal < 0) {
      setErrorMessage("El precio menudeo debe ser un número válido mayor o igual a 0.");
      setCrudSubmitting(false);
      return;
    }

    const wholesalePriceVal = formWholesalePrice ? parseFloat(formWholesalePrice) : null;
    if (wholesalePriceVal !== null && (isNaN(wholesalePriceVal) || wholesalePriceVal < 0)) {
      setErrorMessage("El precio mayoreo debe ser un número válido mayor o igual a 0.");
      setCrudSubmitting(false);
      return;
    }

    try {
      let finalImageUrl = formImage || undefined;

      if (crudImageFile) {
        // 1. Comprimir imagen localmente usando canvas
        const compressedBlob = await compressImage(crudImageFile);

        // 2. Subir el blob comprimido a Frappe
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const formData = new FormData();
        formData.append("file", compressedBlob, `${Date.now()}_comprimido.jpg`);
        formData.append("is_private", "0");
        formData.append("folder", "Home/Attachments");

        const uploadRes = await fetch(`${url}/api/method/upload_file`, {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.message || "Error al subir la imagen al servidor.");
        }

        const uploadData = await uploadRes.json();
        if (uploadData.message && uploadData.message.file_url) {
          finalImageUrl = uploadData.message.file_url;
        } else {
          throw new Error("La subida de imagen no retornó una ruta válida.");
        }
      }

      // 1. Crear Item (con UOM correcto "Unit")
      await createDoc("Item", {
        doctype: "Item",
        item_code: formItemCode,
        item_name: formItemName,
        item_group: "Products",
        stock_uom: "Unit",
        image: finalImageUrl,
        disabled: 0,
        barcodes: formBarcode ? [{ barcode: formBarcode, uom: "Unit" }] : []
      });

      // 2. Crear Item Price (Standard Selling - Menudeo)
      await createDoc("Item Price", {
        doctype: "Item Price",
        price_list: "Standard Selling",
        item_code: formItemCode,
        price_list_rate: priceVal
      });

      // 3. Crear Item Price (Standard Wholesale - Mayoreo) si aplica
      if (wholesalePriceVal !== null) {
        await createDoc("Item Price", {
          doctype: "Item Price",
          price_list: "Standard Wholesale",
          item_code: formItemCode,
          price_list_rate: wholesalePriceVal
        });
      }

      setSuccessMessage(`¡Producto "${formItemName}" agregado con éxito al catálogo!`);
      setShowAddModal(false);
      
      // Limpiar formulario
      setFormItemCode("");
      setFormItemName("");
      setFormPrice("");
      setFormWholesalePrice("");
      setFormImage("");
      setFormBarcode("");
      setCrudImageFile(null);
      if (crudImagePreviewUrl) {
        URL.revokeObjectURL(crudImagePreviewUrl);
      }
      setCrudImagePreviewUrl(null);

      // Mutar datos
      await mutateItems();
      await mutatePrices();
      await mutateBarcodes();
    } catch (err: any) {
      console.error("Error al crear producto:", err);
      setErrorMessage(err.message || "Ocurrió un error al crear el producto en ERPNext.");
    } finally {
      setCrudSubmitting(false);
    }
  };

  // Editar Producto en ERPNext (Item + Item Prices)
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !formItemName || !formPrice) {
      setErrorMessage("Por favor, completá todos los campos requeridos.");
      return;
    }
    
    setCrudSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const priceVal = parseFloat(formPrice);
    if (isNaN(priceVal) || priceVal < 0) {
      setErrorMessage("El precio menudeo debe ser un número válido mayor o igual a 0.");
      setCrudSubmitting(false);
      return;
    }

    const wholesalePriceVal = formWholesalePrice ? parseFloat(formWholesalePrice) : null;
    if (wholesalePriceVal !== null && (isNaN(wholesalePriceVal) || wholesalePriceVal < 0)) {
      setErrorMessage("El precio mayoreo debe ser un número válido mayor o igual a 0.");
      setCrudSubmitting(false);
      return;
    }

    try {
      let finalImageUrl = formImage || null;

      if (crudImageFile) {
        // 1. Comprimir imagen localmente usando canvas
        const compressedBlob = await compressImage(crudImageFile);

        // 2. Subir el blob comprimido a Frappe
        const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
        const formData = new FormData();
        formData.append("file", compressedBlob, `${Date.now()}_comprimido.jpg`);
        formData.append("is_private", "0");
        formData.append("folder", "Home/Attachments");

        const uploadRes = await fetch(`${url}/api/method/upload_file`, {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.message || "Error al subir la imagen al servidor.");
        }

        const uploadData = await uploadRes.json();
        if (uploadData.message && uploadData.message.file_url) {
          finalImageUrl = uploadData.message.file_url;
        } else {
          throw new Error("La subida de imagen no retornó una ruta válida.");
        }
      }

      // 1. Actualizar Item
      await updateDoc("Item", selectedItem.name, {
        item_name: formItemName,
        image: finalImageUrl,
        barcodes: formBarcode ? [{ barcode: formBarcode, uom: "Unit" }] : []
      });

      // 2. Actualizar/Crear precio minorista
      const existingRetailDoc = prices?.find(
        p => p.item_code === selectedItem.name && p.price_list === "Standard Selling"
      );
      if (existingRetailDoc) {
        await updateDoc("Item Price", existingRetailDoc.name, {
          price_list_rate: priceVal
        });
      } else {
        await createDoc("Item Price", {
          doctype: "Item Price",
          price_list: "Standard Selling",
          item_code: selectedItem.name,
          price_list_rate: priceVal
        });
      }

      // 3. Actualizar/Crear/Eliminar precio mayorista
      const existingWholesaleDoc = prices?.find(
        p => p.item_code === selectedItem.name && p.price_list === "Standard Wholesale"
      );
      if (wholesalePriceVal !== null) {
        if (existingWholesaleDoc) {
          await updateDoc("Item Price", existingWholesaleDoc.name, {
            price_list_rate: wholesalePriceVal
          });
        } else {
          await createDoc("Item Price", {
            doctype: "Item Price",
            price_list: "Standard Wholesale",
            item_code: selectedItem.name,
            price_list_rate: wholesalePriceVal
          });
        }
      } else if (existingWholesaleDoc) {
        // Eliminar si existía pero ahora no aplica
        await deleteDoc("Item Price", existingWholesaleDoc.name);
      }

      setSuccessMessage(`¡Producto "${formItemName}" actualizado con éxito!`);
      setShowEditModal(false);
      setSelectedItem(null);
      setFormBarcode("");
      setCrudImageFile(null);
      if (crudImagePreviewUrl) {
        URL.revokeObjectURL(crudImagePreviewUrl);
      }
      setCrudImagePreviewUrl(null);
      
      // Mutar datos
      await mutateItems();
      await mutatePrices();
      await mutateBarcodes();
    } catch (err: any) {
      console.error("Error al editar producto:", err);
      setErrorMessage(err.message || "Ocurrió un error al actualizar el producto en ERPNext.");
    } finally {
      setCrudSubmitting(false);
    }
  };

  // Eliminar Producto en ERPNext (Item Prices + Item)
  const handleDeleteProduct = async () => {
    if (!selectedItem) return;
    
    setCrudSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      try {
        // 1. Buscar y borrar todos los precios asociados (minorista y mayorista)
        const associatedPrices = prices?.filter(p => p.item_code === selectedItem.name) || [];
        for (const p of associatedPrices) {
          await deleteDoc("Item Price", p.name);
        }

        // 2. Borrar Item físicamente
        await deleteDoc("Item", selectedItem.name);
        setSuccessMessage(`¡Producto "${selectedItem.item_name}" eliminado físicamente con éxito!`);
      } catch (deleteErr: any) {
        console.warn("Fallo el borrado físico por integridad, desactivándolo lógicamente...", deleteErr);
        
        // Si falla por integridad (transacciones existentes), caemos elegantemente a desactivación lógica (disabled = 1)
        await updateDoc("Item", selectedItem.name, { disabled: 1 });
        setSuccessMessage(`¡Producto "${selectedItem.item_name}" desactivado con éxito debido a que tiene transacciones asociadas!`);
      }

      setShowDeleteConfirm(false);
      setSelectedItem(null);
      
      // Mutar datos
      await mutateItems();
      await mutatePrices();
      await mutateBins();
    } catch (err: any) {
      console.error("Error al eliminar/desactivar producto:", err);
      setErrorMessage(
        err.message || 
        "No se pudo eliminar ni desactivar el producto. Por favor verifique los permisos."
      );
      setShowDeleteConfirm(false);
    } finally {
      setCrudSubmitting(false);
    }
  };

  // Reactivar Producto desactivado
  const handleReactivateProduct = async (item: any) => {
    if (!item) return;
    
    setCrudSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateDoc("Item", item.name, { disabled: 0 });
      setSuccessMessage(`¡Producto "${item.item_name}" reactivado con éxito!`);
      await mutateItems();
    } catch (err: any) {
      console.error("Error al reactivar producto:", err);
      setErrorMessage(err.message || "No se pudo reactivar el producto.");
    } finally {
      setCrudSubmitting(false);
    }
  };

  const activeColor = saasConfig?.colors?.primary || "#3498db";

  // Filtrado reactivo en el buscador (multiterminos)
  const filteredItems = items?.filter(item => {
    if (!searchQuery) return true;
    
    const name = (item.name || "").toLowerCase();
    const itemName = (item.item_name || "").toLowerCase();
    const barcode = (getItemBarcode(item.name) || "").toLowerCase();
    
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    
    return terms.every(term => 
      name.includes(term) || 
      itemName.includes(term) || 
      barcode.includes(term)
    );
  }) || [];

  const totalItemsCount = items?.length || 0;
  const filteredCount = filteredItems.length;

  if (authLoading || configLoading || itemsLoading || binsLoading || pricesLoading || barcodesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500"></div>
          <p className="text-sm font-medium tracking-wide animate-pulse">Cargando Módulo de Planta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Contenido Principal */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-4 sm:space-y-6 overflow-y-auto flex-1">
        
        {/* Selector de Pestañas Premium (Visible solo para administradores) */}
        {isAdmin && (
          <div className="tab-container">
            <button
              onClick={() => {
                setActiveTab("produccion");
                setSearchQuery("");
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className={`tab-button ${activeTab === "produccion" ? "active" : ""}`}
            >
              🛠️ Producción & Movimientos
            </button>
            <button
              onClick={() => {
                setActiveTab("catalogo");
                setSearchQuery("");
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className={`tab-button ${activeTab === "catalogo" ? "active" : ""}`}
            >
              📦 Catálogo de Productos
            </button>
            <button
              onClick={() => {
                setActiveTab("variantes");
                setSearchQuery("");
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className={`tab-button ${activeTab === "variantes" ? "active" : ""}`}
            >
              🏷️ Generador de Variantes
            </button>
          </div>
        )}

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

        {/* VISTA 1: Producción & Movimientos (Para todos, por defecto) */}
        {(activeTab === "produccion" || !isAdmin) && (
          <>
            {/* Barra de Filtros y Controles */}
            <div className="flex flex-col gap-4 bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Gestión Rápida de Inventario</h2>
                <p className="text-xs text-slate-400">Aumentá o disminuí el stock disponible del almacén de la Fábrica con un solo clic.</p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* Buscador */}
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                  />
                  <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Selector de lote/paso de ajuste */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Ajuste por:</span>
                  <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                    {[1, 5, 10, 50].map((step) => {
                      const isSelected = adjustStep === step;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setAdjustStep(step)}
                          className={`rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-all whitespace-nowrap active:scale-95 ${
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
            </div>

            {/* Grilla de Productos */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredItems.map((item) => {
                const stock = getItemStock(item.name);
                const isUpdating = updatingItem === item.name;
                return (
                  <div
                    key={item.name}
                    className={`relative rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-5 shadow-lg flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-2xl ${
                      isUpdating ? "opacity-60 scale-95" : ""
                    }`}
                  >
                    {/* Loader overlay discreto */}
                    {isUpdating && (
                      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500"></div>
                      </div>
                    )}

                    <div>
                      {/* Foto o Icono */}
                      <div className="aspect-square w-full rounded-2xl bg-slate-900 mb-4 flex items-center justify-center text-slate-700 overflow-hidden relative border border-slate-850">
                        {item.image ? (
                          <img 
                            src={item.image.startsWith("http") ? item.image : `${process.env.NEXT_PUBLIC_FRAPPE_URL || ""}${item.image}`} 
                            alt={item.item_name}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <svg className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                      </div>

                      <h3 className="font-extrabold text-base text-white leading-snug truncate">{item.item_name}</h3>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">{item.item_group}</p>
                    </div>

                    {/* Stock Level y Ajustes Rápidos */}
                    <div className="mt-5 space-y-4">
                      {/* Indicador de Stock */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-850">
                        <span className="text-xs text-slate-400 font-bold">Stock actual:</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-extrabold px-3 py-1 rounded-xl ${
                            stock > 0 
                              ? "text-emerald-400 bg-emerald-500/10" 
                              : "text-slate-500 bg-slate-900"
                          }`}>
                            {stock}
                          </span>
                          {stockAdjustments[item.name] && (
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg border animate-pulse ${
                              stockAdjustments[item.name] > 0
                                ? "text-emerald-400 bg-emerald-950/20 border-emerald-500/30"
                                : "text-rose-400 bg-rose-950/20 border-rose-500/30"
                            }`}>
                              {stockAdjustments[item.name] > 0 ? "+" : ""}{stockAdjustments[item.name]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botones de Control Tactil con Input Manual */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddLocalAdjustment(item.name, -adjustStep)}
                          className="w-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 py-3 font-extrabold text-sm hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all active:scale-95 cursor-pointer text-center"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={stockAdjustments[item.name] || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setStockAdjustments(prev => {
                              if (isNaN(val) || val === 0) {
                                const { [item.name]: _, ...rest } = prev;
                                return rest;
                              }
                              return {
                                ...prev,
                                [item.name]: val
                              };
                            });
                          }}
                          className="flex-1 min-w-0 rounded-2xl border border-slate-800 bg-slate-950 px-2 py-3 text-center text-sm font-extrabold text-white outline-none focus:border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddLocalAdjustment(item.name, adjustStep)}
                          className="w-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 py-3 font-extrabold text-sm hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-all active:scale-95 cursor-pointer text-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Panel Flotante de Cambios de Stock Masivos */}
            {Object.keys(stockAdjustments).length > 0 && (
              <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-4xl z-40 bg-slate-905/95 backdrop-blur-md border border-indigo-500/30 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-all duration-500 ease-out translate-y-0 opacity-100">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-505 animate-ping"></span>
                    Ajustes de Producción Pendientes
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Tenés {Object.keys(stockAdjustments).length} productos modificados listos para impactar en ERPNext en lote de forma ultra-eficiente.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setStockAdjustments({})}
                    className="rounded-full bg-slate-800 text-slate-350 px-5 py-2.5 text-xs font-bold hover:bg-slate-750 hover:text-white transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    Descartar Cambios
                  </button>
                  <button
                    type="button"
                    disabled={submittingBatchStock}
                    onClick={handleSubmitBatchStock}
                    className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 text-xs font-black shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submittingBatchStock ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Guardar en ERPNext
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* VISTA 2: Catálogo de Productos (Solo Administradores) */}
        {activeTab === "catalogo" && isAdmin && (
          <div className="flex flex-col space-y-6">
            {/* Header / Top Control */}
            <div className="flex flex-col gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Catálogo General de Productos</h2>
                <p className="text-xs text-slate-400">Creá, editá y eliminá productos directo en el ERPNext desde la planta.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("variantes");
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  className="rounded-2xl px-5 py-3 text-sm font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center gap-2 justify-center shadow-md"
                >
                  <svg className="w-5 h-5 text-sky-450 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Generar Variantes
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormItemCode("");
                    setFormItemName("");
                    setFormPrice("");
                    setFormWholesalePrice("");
                    setFormImage("");
                    setFormBarcode("");
                    setCrudImageFile(null);
                    setCrudImagePreviewUrl(null);
                    setShowAddModal(true);
                  }}
                  className="rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 hover:brightness-110 cursor-pointer flex items-center gap-2 justify-center"
                  style={{ backgroundColor: activeColor }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar Producto
                </button>
              </div>
            </div>

            {/* Buscador y Contador en el catálogo */}
            <div className="flex flex-col gap-4 bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-850 shadow-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full sm:max-w-xl">
                {/* Buscador */}
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto en catálogo..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                  />
                  <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Toggle de Desactivados */}
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDisabled}
                      onChange={(e) => setShowDisabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-655 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-xs font-bold text-slate-400 select-none">Mostrar inactivos</span>
                  </label>
                </div>
              </div>

              {/* Contador */}
              <div className="flex items-center gap-2 bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-850 shadow-inner">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {searchQuery ? (
                  <span className="text-xs font-bold text-slate-300">
                    Encontrados: <strong className="text-white text-sm">{filteredCount}</strong> de <strong className="text-slate-400">{totalItemsCount}</strong> productos
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-350">
                    Total: <strong className="text-white text-sm">{totalItemsCount}</strong> productos registrados
                  </span>
                )}
              </div>
            </div>

            {/* List / Table of Items */}
            <div className="overflow-x-auto rounded-3xl border border-slate-850 bg-slate-950 shadow-xl">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Imagen</th>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Código de Barras</th>
                    <th className="px-6 py-4">Nombre del Producto</th>
                    <th className="px-6 py-4 text-right">Precio Menudeo</th>
                    <th className="px-6 py-4 text-right">Precio Mayoreo</th>
                    <th className="px-6 py-4 text-center">Stock Fábrica</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500 font-medium">
                        No se encontraron productos en el catálogo.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const price = getItemPrice(item.name);
                      const wholesalePrice = getItemWholesalePrice(item.name);
                      const stock = getItemStock(item.name);
                      return (
                        <tr key={item.name} className={`hover:bg-slate-900/35 transition-colors ${item.disabled ? "opacity-50 grayscale" : ""}`}>
                          {/* Image */}
                          <td className="px-6 py-4">
                            <div className="h-12 w-16 rounded-xl bg-slate-900 border border-slate-880 flex items-center justify-center text-slate-700 overflow-hidden relative">
                              {item.image ? (
                                <img
                                  src={item.image.startsWith("http") ? item.image : `${process.env.NEXT_PUBLIC_FRAPPE_URL || ""}${item.image}`}
                                  alt={item.item_name}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              )}
                            </div>
                          </td>

                          {/* Code */}
                          <td className="px-6 py-4 text-sm font-mono font-bold text-slate-300">
                            {item.name}
                          </td>

                          {/* Barcode */}
                          <td className="px-6 py-4 text-sm font-mono text-slate-400">
                            {getItemBarcode(item.name) || <span className="text-slate-700 italic">Sin asignar</span>}
                          </td>

                          {/* Name */}
                          <td className="px-6 py-4 text-sm font-bold text-white">
                            <div className="flex items-center gap-2">
                              {item.item_name}
                              {item.disabled === 1 && (
                                <span className="text-[9px] bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                  Inactivo
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Retail Price */}
                          <td className="px-6 py-4 text-sm font-black text-right text-emerald-400">
                            ${price.toFixed(2)}
                          </td>

                          {/* Wholesale Price */}
                          <td className="px-6 py-4 text-sm font-black text-right text-blue-400">
                            {wholesalePrice > 0 ? `$${wholesalePrice.toFixed(2)}` : <span className="text-slate-600 font-normal">N/A</span>}
                          </td>

                          {/* Factory Stock */}
                          <td className="px-6 py-4 text-center">
                            <span className={`text-sm font-extrabold px-3 py-1 rounded-xl ${
                              stock > 0 
                                ? "text-emerald-400 bg-emerald-500/10" 
                                : "text-slate-500 bg-slate-900"
                            }`}>
                              {stock}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setFormItemName(item.item_name);
                                  setFormPrice(price.toString());
                                  setFormWholesalePrice(wholesalePrice > 0 ? wholesalePrice.toString() : "");
                                  setFormImage(item.image || "");
                                  setFormBarcode(getItemBarcode(item.name));
                                  setCrudImageFile(null);
                                  setCrudImagePreviewUrl(
                                    item.image
                                      ? item.image.startsWith("http")
                                        ? item.image
                                        : `${process.env.NEXT_PUBLIC_FRAPPE_URL || ""}${item.image}`
                                      : null
                                  );
                                  setShowEditModal(true);
                                }}
                                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-all active:scale-95 cursor-pointer"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>

                              {item.disabled === 1 ? (
                                <button
                                  type="button"
                                  onClick={() => handleReactivateProduct(item)}
                                  className="p-2 rounded-xl bg-indigo-950 border border-indigo-900 text-indigo-405 hover:bg-indigo-900 hover:text-white transition-all active:scale-95 cursor-pointer animate-pulse"
                                  title="Activar"
                                  disabled={crudSubmitting}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18V4" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setShowDeleteConfirm(true);
                                  }}
                                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-all active:scale-95 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 3: Generador de Variantes (Solo Administradores) */}
        {activeTab === "variantes" && isAdmin && (
          <div className="flex flex-col space-y-6">
            {/* Header Card */}
            <div className="flex flex-col gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-850 shadow-xl md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Generador Inteligente de Variantes</h2>
                <p className="text-xs text-slate-400">Creá nuevos sabores y combinaciones directo en el catálogo sin salir de la planta.</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(true)}
                  className="rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 px-5 py-2.5 text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all duration-300 active:scale-95 cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Nueva Plantilla de Producto
                </button>
              </div>
            </div>

            {/* Grid layout */}
            <div className="grid gap-6 md:grid-cols-5">
              {/* Formulario de Configuración (3 columnas) */}
              <div className="md:col-span-3 rounded-3xl border border-slate-850 bg-slate-950 p-6 sm:p-8 shadow-xl space-y-6">
                <h3 className="text-base font-bold text-white border-b border-slate-850 pb-3 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center text-xs">1</span>
                  Configuración del Producto
                </h3>

                <form onSubmit={handleCreateVariant} className="space-y-6">
                  {/* Selector de Plantilla */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seleccioná la Plantilla Base*</label>
                    {templatesLoading ? (
                      <div className="h-10 w-full animate-pulse rounded-xl bg-slate-900 border border-slate-850"></div>
                    ) : (
                      <select
                        required
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value);
                          setSelectedValues({});
                        }}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700"
                      >
                        <option value="">-- Seleccionar Plantilla --</option>
                        {templates?.map((t: any) => (
                          <option key={t.name} value={t.name}>
                            {t.item_name} ({t.name})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Atributos Dinámicos */}
                  {selectedTemplate && (
                    <div className="space-y-4 rounded-2xl bg-slate-900/30 border border-slate-850 p-5">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-850/50 pb-2">Atributos Requeridos</h4>
                      
                      {attributesLoading ? (
                        <div className="space-y-3">
                          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-slate-900"></div>
                          <div className="h-10 w-full animate-pulse rounded-xl bg-slate-900 border border-slate-850"></div>
                        </div>
                      ) : attributes && attributes.length > 0 ? (
                        attributes.map((attr: any) => (
                          <div key={attr.attribute} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-400">{attr.attribute}*</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAttributeForValue(attr.attribute);
                                  setShowAddAttrValModal(true);
                                }}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-all flex items-center gap-0.5 cursor-pointer"
                              >
                                + Agregar {attr.attribute}
                              </button>
                            </div>
                            <select
                              required
                              value={selectedValues[attr.attribute] || ""}
                              onChange={(e) => {
                                setSelectedValues(prev => ({
                                  ...prev,
                                  [attr.attribute]: e.target.value
                                }));
                              }}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-slate-700"
                            >
                              <option value="">-- Seleccionar {attr.attribute} --</option>
                              {attr.values.map((val: any) => (
                                <option key={val.value} value={val.value}>
                                  {val.value} ({val.abbr})
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 font-medium">Esta plantilla no tiene atributos dinámicos configurados en ERPNext.</p>
                      )}
                    </div>
                  )}

                  {/* Precios de Venta */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Precio Menudeo ($)*</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ej: 25.00"
                        value={varRetailPrice}
                        onChange={(e) => setVarRetailPrice(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Precio Mayoreo ($ - Opcional)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 20.00"
                        value={varWholesalePrice}
                        onChange={(e) => setVarWholesalePrice(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* Código de Barras de la Variante */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Código de Barras (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: 7501234567890"
                      value={varBarcode}
                      onChange={(e) => setVarBarcode(e.target.value.trim())}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700"
                    />
                  </div>

                  {/* Imagen del Producto */}
                  <div className="space-y-2 rounded-2xl bg-slate-900/30 border border-slate-850 p-5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Imagen del Helado (Opcional)</label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="h-24 w-32 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-700 relative overflow-hidden flex-shrink-0">
                        {imagePreviewUrl ? (
                          <img
                            src={imagePreviewUrl}
                            alt="Previsualización"
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 space-y-2 w-full">
                        <div className="flex gap-2">
                          <label className="flex-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-350 hover:bg-slate-800 hover:text-white px-4 py-3 text-xs font-bold transition-all text-center cursor-pointer select-none">
                            Seleccionar Imagen
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedImageFile(file);
                                  const url = URL.createObjectURL(file);
                                  setImagePreviewUrl(url);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {selectedImageFile && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedImageFile(null);
                                if (imagePreviewUrl) {
                                  URL.revokeObjectURL(imagePreviewUrl);
                                }
                                setImagePreviewUrl(null);
                              }}
                              className="rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-900/30 px-4 py-3 text-xs font-bold transition-all"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-normal">
                          Formatos aceptados: JPG, PNG, WEBP. La imagen será comprimida localmente a menos de 150KB para optimizar el almacenamiento.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botón de Enviar */}
                  <button
                    type="submit"
                    disabled={varCreating || !selectedTemplate || !varRetailPrice}
                    className="w-full rounded-2xl py-4 text-sm font-bold text-white shadow-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                    style={{ backgroundColor: activeColor }}
                  >
                    {varCreating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Generando variantes en ERPNext...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Crear Variante
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Live Preview (2 columnas) */}
              <div className="md:col-span-2 rounded-3xl border border-slate-850 bg-slate-950 p-6 sm:p-8 shadow-xl flex flex-col space-y-6">
                <h3 className="text-base font-bold text-white border-b border-slate-850 pb-3 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">2</span>
                  Vista Previa
                </h3>

                {/* SaaS Variant Card */}
                <div className="flex-1 flex flex-col justify-center items-center">
                  {selectedTemplate ? (
                    <div className="w-full max-w-sm rounded-3xl border border-white/5 bg-slate-900 p-6 shadow-2xl relative overflow-hidden space-y-6">
                      {/* Brand Badge */}
                      <div className="absolute top-4 right-4 h-6 px-2 rounded-lg bg-sky-500/15 text-[10px] font-black text-sky-400 border border-sky-500/10 uppercase tracking-widest flex items-center justify-center">
                        Variante
                      </div>

                      {/* Icon Container */}
                      <div className="h-20 w-24 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-700 relative overflow-hidden flex-shrink-0">
                        {imagePreviewUrl ? (
                          <img
                            src={imagePreviewUrl}
                            alt="Vista Previa"
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <svg className="h-10 w-10 text-slate-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                      </div>

                      {/* Name / Description */}
                      <div className="space-y-1.5">
                        <h4 className="text-lg font-black text-white leading-snug">
                          {selectedTemplate}{Object.values(selectedValues).length > 0 ? ` sabor ${Object.values(selectedValues).join(" ")}` : ""}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">
                          Código: <strong className="text-slate-200">{selectedTemplate}-{Object.keys(selectedValues).map(k => {
                            const attr = attributes?.find((a: any) => a.attribute === k);
                            const valObj = attr?.values.find((v: any) => v.value === selectedValues[k]);
                            return valObj ? valObj.abbr : "?";
                          }).join("-")}</strong>
                        </p>
                      </div>

                      {/* Pricing block */}
                      <div className="flex items-center justify-between border-t border-slate-850/60 pt-4 bg-slate-900/50">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Menudeo</span>
                          <p className="text-xl font-black text-emerald-400">${Number(varRetailPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mayoreo</span>
                          <p className="text-xl font-black text-blue-400">
                            {Number(varWholesalePrice || 0) > 0 ? `$${Number(varWholesalePrice).toFixed(2)}` : <span className="text-slate-600 font-normal text-sm">N/A</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3 max-w-xs py-10">
                      <svg className="mx-auto h-12 w-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                      </svg>
                      <h4 className="text-sm font-bold text-slate-350">Sin Configuración Activa</h4>
                      <p className="text-xs text-slate-500 leading-normal">Seleccioná una plantilla base del formulario de la izquierda para ver la previsualización en tiempo real.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Agregar Producto */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition-all text-lg"
            >
              ✕
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Agregar Nuevo Producto</h3>
              <p className="text-xs text-slate-400">Completá los datos para crear el producto e ingresar sus precios en ERPNext.</p>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Código del Producto (ID Único)*</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: LP-PALETA-FRUTILLA"
                  value={formItemCode}
                  onChange={(e) => setFormItemCode(e.target.value.toUpperCase().replace(/\s+/g, "-"))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Nombre del Producto*</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Paleta de Frutilla con Crema"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Código de Barras (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 7501234567890"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value.trim())}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">P. Menudeo ($)*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Menudeo"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">P. Mayoreo ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Mayoreo"
                    value={formWholesalePrice}
                    onChange={(e) => setFormWholesalePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-slate-955 border border-slate-850 p-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Imagen del Producto (Opcional)</label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-20 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-700 overflow-hidden flex-shrink-0">
                    {crudImagePreviewUrl ? (
                      <img
                        src={crudImagePreviewUrl}
                        alt="Previsualización"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 w-full">
                    <div className="flex gap-2">
                      <label className="flex-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-350 hover:bg-slate-800 hover:text-white px-3 py-2 text-xs font-bold transition-all text-center cursor-pointer select-none">
                        Elegir Imagen
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCrudImageFile(file);
                              const url = URL.createObjectURL(file);
                              setCrudImagePreviewUrl(url);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {(crudImageFile || formImage) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCrudImageFile(null);
                            setFormImage("");
                            if (crudImagePreviewUrl && crudImagePreviewUrl.startsWith("blob:")) {
                              URL.revokeObjectURL(crudImagePreviewUrl);
                            }
                            setCrudImagePreviewUrl(null);
                          }}
                          className="rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-900/30 px-3 py-2 text-xs font-bold transition-all"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl bg-slate-800 text-slate-300 py-3 font-bold text-sm hover:bg-slate-750 transition-all active:scale-95 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crudSubmitting}
                  className="flex-1 rounded-xl text-white py-3 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: activeColor }}
                >
                  {crudSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
                  ) : (
                    "Guardar Producto"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Producto */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedItem(null);
              }}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition-all text-lg"
            >
              ✕
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Editar Producto</h3>
              <p className="text-xs text-slate-400">Modificá los datos del producto seleccionado.</p>
            </div>

            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Código del Producto (No modificable)</label>
                <input
                  type="text"
                  disabled
                  value={selectedItem.name}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Nombre del Producto*</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Paleta de Frutilla con Crema"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Código de Barras (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 7501234567890"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value.trim())}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">P. Menudeo ($)*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Menudeo"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">P. Mayoreo ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Mayoreo"
                    value={formWholesalePrice}
                    onChange={(e) => setFormWholesalePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-slate-955 border border-slate-850 p-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Imagen del Producto</label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-20 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-700 overflow-hidden flex-shrink-0">
                    {crudImagePreviewUrl ? (
                      <img
                        src={crudImagePreviewUrl}
                        alt="Previsualización"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 w-full">
                    <div className="flex gap-2">
                      <label className="flex-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-350 hover:bg-slate-800 hover:text-white px-3 py-2 text-xs font-bold transition-all text-center cursor-pointer select-none">
                        Cambiar Imagen
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCrudImageFile(file);
                              const url = URL.createObjectURL(file);
                              setCrudImagePreviewUrl(url);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {(crudImageFile || formImage) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCrudImageFile(null);
                            setFormImage("");
                            if (crudImagePreviewUrl && crudImagePreviewUrl.startsWith("blob:")) {
                              URL.revokeObjectURL(crudImagePreviewUrl);
                            }
                            setCrudImagePreviewUrl(null);
                          }}
                          className="rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-900/30 px-3 py-2 text-xs font-bold transition-all"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedItem(null);
                  }}
                  className="flex-1 rounded-xl bg-slate-800 text-slate-300 py-3 font-bold text-sm hover:bg-slate-750 transition-all active:scale-95 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crudSubmitting}
                  className="flex-1 rounded-xl text-white py-3 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: activeColor }}
                >
                  {crudSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
                  ) : (
                    "Guardar Cambios"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Eliminación */}
      {showDeleteConfirm && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">¿Eliminar Producto?</h3>
              <p className="text-xs text-slate-400">
                ¿Estás seguro de que querés eliminar el producto <span className="font-bold text-white">"{selectedItem.item_name}"</span> ({selectedItem.name})?<br />
                Esta acción no se puede deshacer y borrará también todos sus precios.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedItem(null);
                }}
                className="flex-1 rounded-xl bg-slate-800 text-slate-300 py-3 font-bold text-sm hover:bg-slate-750 transition-all active:scale-95 cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={crudSubmitting}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white py-3 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                {crudSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
                ) : (
                  "Sí, Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Plantilla de Producto */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setShowAddTemplateModal(false);
                setNewTemplateName("");
                setNewTemplateAttrs([]);
              }}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition-all text-lg cursor-pointer"
            >
              ✕
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Nueva Plantilla de Producto</h3>
              <p className="text-xs text-slate-400">Creá una nueva línea de producto (ej: Bolis de Crema Premium) y definí qué dimensiones utiliza.</p>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Nombre de la Plantilla*</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Bolis de Crema Especial"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">Seleccionar Atributos (Dimensiones)*</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto border border-slate-800 rounded-xl p-3 bg-slate-950/50">
                  {allAttributes.length > 0 ? (
                    allAttributes.map((attr: any) => (
                      <label key={attr.name} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer hover:text-white transition-all select-none">
                        <input
                          type="checkbox"
                          checked={newTemplateAttrs.includes(attr.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewTemplateAttrs(prev => [...prev, attr.name]);
                            } else {
                              setNewTemplateAttrs(prev => prev.filter(name => name !== attr.name));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        {attr.name}
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">No se encontraron atributos en el sistema.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTemplateModal(false);
                    setNewTemplateName("");
                    setNewTemplateAttrs([]);
                  }}
                  className="flex-1 rounded-xl bg-slate-800 text-slate-300 py-3 font-bold text-sm hover:bg-slate-750 transition-all active:scale-95 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={templateSubmitting}
                  className="flex-1 rounded-xl text-white py-3 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: activeColor }}
                >
                  {templateSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
                  ) : (
                    "Guardar Plantilla"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Valor de Atributo (Agnóstico) */}
      {showAddAttrValModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative">
            <button
              type="button"
              onClick={() => {
                setShowAddAttrValModal(false);
                setNewAttrValName("");
                setNewAttrValAbbr("");
              }}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition-all text-lg cursor-pointer"
            >
              ✕
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Agregar Valor a {selectedAttributeForValue}</h3>
              <p className="text-xs text-slate-400">Agregá una nueva opción o dimensión para el catálogo de **{saasConfig?.client_name || "La Paletixa"}**.</p>
            </div>

            <form onSubmit={handleCreateAttrValue} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Nombre de {selectedAttributeForValue}*</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mora Azul o Extra Grande"
                  value={newAttrValName}
                  onChange={(e) => setNewAttrValName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Abreviación (Máx. 3-4 letras)*</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="Ej: MA o XG"
                  value={newAttrValAbbr}
                  onChange={(e) => setNewAttrValAbbr(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-650 outline-none transition-all focus:border-slate-700"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAttrValModal(false);
                    setNewAttrValName("");
                    setNewAttrValAbbr("");
                  }}
                  className="flex-1 rounded-xl bg-slate-800 text-slate-300 py-3 font-bold text-sm hover:bg-slate-750 transition-all active:scale-95 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={attrValSubmitting}
                  className="flex-1 rounded-xl text-white py-3 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: activeColor }}
                >
                  {attrValSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-white"></div>
                  ) : (
                    "Guardar Valor"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
