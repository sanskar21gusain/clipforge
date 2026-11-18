'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { ProModal } from './ProModal';

const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  const [isPro, setIsPro] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proReason, setProReason] = useState(null);
  const [proOpenKeyForm, setProOpenKeyForm] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, durationMs = 8000) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (durationMs > 0) {
      toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
    }
  }, []);

  useEffect(() => {
    let proActive = false;
    try {
      proActive = localStorage.getItem('clipforge_pro_annual') === 'true';
      setIsPro(proActive);
    } catch (_) {}

    // Handle Polar checkout return (?checkout=success) without ever auto-unlocking Pro
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('checkout') === 'success') {
        url.searchParams.delete('checkout');
        const nextUrl = `${url.pathname}${url.search ? url.search : ''}${url.hash || ''}`;
        window.history.replaceState({}, '', nextUrl);

        showToast(
          'Welcome to ClipForge Pro Annual! Check your receipt email for your Polar license key to activate this browser.',
          20000
        );
        if (!proActive) {
          setProReason(
            'Payment received! Paste the annual license key from your Polar receipt email below to activate ClipForge Pro.'
          );
          setProOpenKeyForm(true);
          setProModalOpen(true);
        }
      }
    } catch (_) {}

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [showToast]);

  const openProModal = useCallback((reason = null, options = {}) => {
    setProReason(reason);
    setProOpenKeyForm(Boolean(options?.showKeyForm));
    setProModalOpen(true);
  }, []);

  const closeProModal = useCallback(() => {
    setProModalOpen(false);
    setProOpenKeyForm(false);
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
        showToast,
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
        initialShowKeyForm={proOpenKeyForm}
      />
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="studio-toast"
          className="fixed bottom-4 right-4 z-50 max-w-md rounded-2xl border border-emerald-200 bg-white p-4 shadow-modal flex items-start gap-3"
        >
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 size={14} />
          </span>
          <p className="text-xs font-semibold text-ink-900 leading-relaxed flex-1">{toast}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-canvas-100 hover:text-ink-900 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
