import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCurrentCustomer,
  createCustomerAccount,
  loginCustomer,
  logoutCustomer,
  requestCustomerCode,
  verifyCustomerCode,
  requestCustomerPasswordReset,
  confirmCustomerPasswordReset,
} from "@/lib/api";

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const payload = await fetchCurrentCustomer();
      setAccount(payload.account || null);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    account,
    loading,
    refresh,
    requestCode: requestCustomerCode,
    createAccount: async (body) => {
      const payload = await createCustomerAccount(body);
      setAccount(payload.account || null);
      return payload;
    },
    login: async (body) => {
      const payload = await loginCustomer(body);
      setAccount(payload.account || null);
      return payload;
    },
    verifyCode: async (body) => {
      const payload = await verifyCustomerCode(body);
      setAccount(payload.account || null);
      return payload;
    },
    requestPasswordReset: requestCustomerPasswordReset,
    confirmPasswordReset: async (body) => {
      const payload = await confirmCustomerPasswordReset(body);
      setAccount(payload.account || null);
      return payload;
    },
    logout: async () => {
      await logoutCustomer();
      setAccount(null);
    },
  }), [account, loading, refresh]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return context;
}
