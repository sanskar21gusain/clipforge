'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';
import { ProModal } from './ProModal';

const StudioContext = createContext(null);
const MAX_HANDOFF_BYTES = 250 * 1024 * 1024; // 250 MB safe browser memory cap

function matchesExpectedType(file, expectedType) {
  if (!expectedType) return true;
  const mime = (file?.type || '').toLowerCase();
  const name = (file?.name || '').toLowerCase();
  if (mime.startsWith(`${expectedType}/`)) return true;
  if (expectedType === 'image' && /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(name)) return true;
  if (expectedType === 'video' && /\.(mp4|mov|webm|mkv|avi|m4v)$/.test(name)) return true;
  if (expectedType === 'audio' && /\.(mp3|wav|m4a|ogg|flac|aac|opus)$/.test(name)) return true;
  return false;
}

export function StudioProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPro, setIsPro] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proReason, setProReason] = useState(null);
  const [proOpenKeyForm, setProOpenKeyForm] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const handoffRef = useRef(null);

  // Cancel any unconsumed handoff if the user navigates away to a different route
  useEffect(() => {
    const pending = handoffRef.current;
    if (pending && pathname && pathname !== `/tools/${pending.targetSlug}`) {
      if (Date.now() - pending.createdAt > 1500) {
        handoffRef.current = null;
      }
    }
  }, [pathname]);

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

  const sendFileToTool = useCallback(
    ({ blob, filename, mimeType, targetSlug, expectedType, sourceLabel }) => {
      if (!blob || !targetSlug) {
        showToast('No exported file is ready to send yet.', 4000);
        return false;
      }
      if (blob.size > MAX_HANDOFF_BYTES) {
        showToast(
          'This file is over 250 MB — please download it first and open it directly in the next tool.',
          6000
        );
        return false;
      }
      const file =
        blob instanceof File
          ? blob
          : new File([blob], filename || 'clipforge-output', {
              type: mimeType || blob.type || 'application/octet-stream',
            });

      if (!matchesExpectedType(file, expectedType)) {
        showToast(`Cannot send this file type to ${targetSlug}.`, 5000);
        return false;
      }

      handoffRef.current = {
        file,
        targetSlug,
        expectedType,
        sourceLabel: sourceLabel || 'ClipForge',
        createdAt: Date.now(),
      };
      router.push(`/tools/${targetSlug}`);
      return true;
    },
    [router, showToast]
  );

  const consumeHandoff = useCallback((targetSlug, expectedType) => {
    const pending = handoffRef.current;
    if (!pending) return null;
    if (pending.targetSlug !== targetSlug) return null;
    handoffRef.current = null;
    if (!matchesExpectedType(pending.file, expectedType)) return null;
    return pending;
  }, []);

  const cancelHandoff = useCallback(() => {
    handoffRef.current = null;
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
        sendFileToTool,
        consumeHandoff,
        cancelHandoff,
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
