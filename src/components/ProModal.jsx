'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Crown, ShieldCheck, KeyRound, ArrowRight, Sparkles } from 'lucide-react';

const POLAR_ORG_ID = process.env.NEXT_PUBLIC_POLAR_ORG_ID || '';
const POLAR_ANNUAL_PRODUCT_ID = process.env.NEXT_PUBLIC_POLAR_ANNUAL_PRODUCT_ID || '';

export function ProModal({
  isOpen,
  onClose,
  isPro,
  onActivate,
  onDeactivate,
  reason,
  initialShowKeyForm = false,
}) {
  const dialogRef = useRef(null);
  const closeTimerRef = useRef(null);
  const keyInputRef = useRef(null);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Open/close native <dialog> via showModal() / close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      setError('');
      setSuccessMsg('');
      if (initialShowKeyForm) {
        setShowKeyForm(true);
      }
      dialog.showModal();
      if (initialShowKeyForm) {
        setTimeout(() => keyInputRef.current?.focus(), 0);
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, initialShowKeyForm]);

  // Sync React state when browser closes dialog (Esc, light-dismiss, form method="dialog")
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    // Fallback for browsers without native closedby="any" support (e.g. Safari)
    let cleanupFallback = null;
    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e) => { pressedOutside = outside(e); };
      const onUp = (e) => { if (pressedOutside && outside(e)) dialog.close(); };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (cleanupFallback) cleanupFallback();
    };
  }, [onClose]);

  const handleCheckout = () => {
    if (POLAR_ANNUAL_PRODUCT_ID) {
      window.location.href = `/api/checkout?products=${encodeURIComponent(POLAR_ANNUAL_PRODUCT_ID)}`;
      return;
    }
    setShowKeyForm(true);
    setError('Add NEXT_PUBLIC_POLAR_ANNUAL_PRODUCT_ID in .env to enable live checkout, or activate an Annual key below.');
  };

  const handleVerifyKey = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      setError('Enter the annual license key from your receipt email.');
      return;
    }

    if (!POLAR_ORG_ID) {
      setError('License verification is not configured on this deployment yet. Set NEXT_PUBLIC_POLAR_ORG_ID to enable activation.');
      return;
    }

    setChecking(true);
    try {
      const res = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed, organization_id: POLAR_ORG_ID }),
      });
      if (!res.ok) {
        setError('License key not found or expired. Check your Polar receipt email.');
        return;
      }
      const data = await res.json();
      if (data.status !== 'granted') {
        setError('This annual license key is no longer active.');
        return;
      }

      onActivate(trimmed);
      setSuccessMsg('ClipForge Pro Annual unlocked on this browser!');
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setSuccessMsg('');
        dialogRef.current?.close();
      }, 1200);
    } catch (_) {
      setError('Could not verify license key right now. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="pro-modal-title"
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-3xl border border-canvas-300 bg-white p-0 text-ink-900 shadow-modal open:flex open:flex-col max-h-[90dvh] overflow-hidden"
    >
      {/* Top Bright Daylight Header */}
      <div className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50/70 border-b border-canvas-300 px-6 py-5 shrink-0">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close Pro upgrade dialog"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-canvas-300 bg-white text-ink-500 hover:bg-canvas-100 hover:text-ink-900 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 font-mono">
          <Crown size={12} />
          <span>CLIPFORGE PRO · ANNUAL PLAN</span>
        </div>

        <h2 id="pro-modal-title" className="mt-2.5 text-2xl font-extrabold tracking-tight text-ink-900">
          One simple yearly plan. Zero friction.
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {reason || 'Unlock batch processing, 4K exports, and full studio tools across every browser—billed once per year.'}
        </p>
      </div>

      {/* Scrollable Body */}
      <div className="p-6 flex flex-col gap-5 overflow-y-auto">
        {initialShowKeyForm && !isPro && (
          <div
            role="status"
            data-testid="checkout-welcome-banner"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800"
          >
            Payment received! Check your Polar receipt email for your annual license key and paste it below.
          </div>
        )}

        {/* Annual-Only Pricing Card */}
        <div className="rounded-2xl border-2 border-blue-600/20 bg-blue-50/40 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                Annual Subscription
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                SAVE 25%
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-ink-900">$29</span>
              <span className="text-sm font-medium text-ink-500">/ year</span>
              <span className="text-xs font-mono text-ink-500 line-through">$39/yr</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              Just $2.42/month billed annually · Cancel anytime in 1 click
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Sparkles size={20} />
          </div>
        </div>

        {/* Pro Benefits */}
        <ul className="flex flex-col gap-2.5 text-sm text-ink-700">
          {[
            'Unlimited batch image compression & exact-KB ZIP exports',
            'Full HD & 4K high-bitrate video compression, trimming & GIFs',
            'Clean watermark-free waveform audiogram videos (9:16, 1:1, 16:9)',
            '300 DPI printable 4×6 passport photo sheets for all countries',
            'Account-less annual license key—activate on any browser',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>

        {/* Action Area */}
        {!isPro ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleCheckout}
              autoFocus
              className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Subscribe Yearly — $29/year</span>
              <ArrowRight size={16} />
            </button>

            {!showKeyForm ? (
              <button
                type="button"
                onClick={() => setShowKeyForm(true)}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-ink-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <KeyRound size={13} />
                <span>Already have an annual license key? Activate here</span>
              </button>
            ) : (
              <form
                onSubmit={handleVerifyKey}
                className="rounded-xl border border-canvas-300 bg-canvas-100 p-3.5 flex flex-col gap-2"
              >
                <label htmlFor="clipforge-license-input" className="text-xs font-semibold text-ink-700">
                  Enter Annual License Key
                </label>
                <div className="flex gap-2">
                  <input
                    ref={keyInputRef}
                    id="clipforge-license-input"
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="e.g. CLIP-PRO-XXXX"
                    className="flex-1 rounded-lg border border-canvas-300 bg-white px-3 py-2 text-xs font-mono text-ink-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                  <button
                    type="submit"
                    disabled={checking}
                    className="rounded-lg bg-ink-900 hover:bg-ink-700 disabled:opacity-60 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    {checking ? 'Checking...' : 'Activate'}
                  </button>
                </div>
                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
                {successMsg && <p className="text-xs font-semibold text-emerald-600">{successMsg}</p>}
              </form>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
              <Crown size={15} />
              <span>ClipForge Pro Annual is Active</span>
            </div>
            <p className="text-xs text-emerald-700">
              Every Pro tool, batch export, and high-resolution preset is unlocked in this browser.
            </p>
            <button
              type="button"
              onClick={() => {
                onDeactivate();
                dialogRef.current?.close();
              }}
              className="mt-1 text-xs font-medium text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
            >
              Deactivate key on this browser
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>100% On-Device Privacy</span>
          </span>
          <span>·</span>
          <span>Billed Yearly · Cancel Anytime</span>
        </div>
      </div>
    </dialog>
  );
}
