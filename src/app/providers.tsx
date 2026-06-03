"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { FrappeProvider, useFrappeAuth } from "frappe-react-sdk";

export interface FeatureConfig {
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
    allow_pos_out_of_stock?: boolean;
  };
  reservation_item_code?: string;
  max_reservation_assets?: number;
  default_event_items?: string;
  custom_country?: string;
  custom_currency?: string;
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

interface SaaSConfigContextType {
  saasConfig: FeatureConfig | null;
  configLoading: boolean;
  refreshConfig: () => Promise<void>;
}

const SaaSConfigContext = createContext<SaaSConfigContextType>({
  saasConfig: null,
  configLoading: true,
  refreshConfig: async () => {},
});

export const useSaaSConfig = () => useContext(SaaSConfigContext);

function SaaSConfigLoader({ children }: { children: React.ReactNode }) {
  const [saasConfig, setSaasConfig] = useState<FeatureConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const { currentUser } = useFrappeAuth();

  const fetchConfig = async () => {
    try {
      const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
      const res = await fetch(`${url}/api/method/paletixa_saas.paletixa_saas.api.get_features`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setSaasConfig(data.message);
        }
      }
    } catch (err) {
      console.error("Error loading SaaS config context:", err);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [currentUser]);

  return (
    <SaaSConfigContext.Provider value={{ saasConfig, configLoading, refreshConfig: fetchConfig }}>
      {children}
    </SaaSConfigContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Usamos ruta relativa por defecto para pasar a través del proxy de Next.js
  const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
  
  return (
    <FrappeProvider
      url={url}
      enableSocket={false}
    >
      <SaaSConfigLoader>
        {children}
      </SaaSConfigLoader>
    </FrappeProvider>
  );
}
