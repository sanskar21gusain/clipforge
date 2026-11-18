'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ProModal } from './ProModal';

const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  const [isPro, setIsPro] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proReason, setProReason] = useState(null);

  useEffect(() => {
    try {
      setIsPro(localStorage.getItem('clipforge_pro_annual') === 'true');
    } catch (_) {}
  }, []);

  const openProModal = useCallback((reason = null) => {
    setProReason(reason);
    setProModalOpen(true);
  }, []);

  const closeProModal = useCallback(() => {
    setProModalOpen(false);
  }, []);

  const activatePro = useCallback((key) => {
    try {
      localStorage.setItem('clipforge_pro_annual', 'true');
      localStorage.setItem('clipforge_license_key', key);
      setIsPro(true);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  const deactivatePro = useCallback(() => {
    try {
      localStorage.removeItem('clipforge_pro_annual');
      localStorage.removeItem('clipforge_license_key');
      setIsPro(false);
    } catch (_) {}
  }, []);

  return (
    <StudioContext.Provider
      value={{
        isPro,
        openProModal,
        closeProModal,
        activatePro,
        deactivatePro,
      }}
    >
      {children}
      <ProModal
        isOpen={proModalOpen}
        onClose={closeProModal}
        isPro={isPro}
        onActivate={activatePro}
        onDeactivate={deactivatePro}
        reason={proReason}
      />
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
