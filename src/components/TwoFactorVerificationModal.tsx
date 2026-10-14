import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Sparkles,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
} from 'lucide-react';
import { UserProfile, ThemeMode } from '../types';
import {
  verifyTwoFactorCode,
  generateTotpCode,
  getRemainingSeconds,
} from '../lib/twoFactorAuth';
import { firebaseSignOut, auth } from '../lib/firebase';

interface TwoFactorVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingUser: Partial<UserProfile>;
  isAdmin: boolean;
  secret: string;
  backupCodes: string[];
  onVerifySuccess: (user: Partial<UserProfile>, isAdmin: boolean) => void;
  primaryColor?: string;
  theme?: ThemeMode;
}

export const TwoFactorVerificationModal: React.FC<TwoFactorVerificationModalProps> = ({
  isOpen,
  onClose,
  pendingUser,
  isAdmin,
  secret,
  backupCodes,
  onVerifySuccess,
  primaryColor = '#7C3AED',
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [backupCodeInput, setBackupCodeInput] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [currentLiveTotp, setCurrentLiveTotp] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first digit when opened and reset state
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setBackupCodeInput('');
      setUseBackupCode(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsVerifying(false);

      const focusTimer = setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
      return () => clearTimeout(focusTimer);
    }
  }, [isOpen]);

  // Live RFC 6238 TOTP timer loop
  useEffect(() => {
    if (!isOpen || !secret) return;

    let timer: NodeJS.Timeout;
    const updateTotp = async () => {
      setRemainingSeconds(getRemainingSeconds());
      try {
        const code = await generateTotpCode(secret);
        setCurrentLiveTotp(code);
      } catch {
        // Ignore
      }
    };

    updateTotp();
    timer = setInterval(updateTotp, 1000);
    return () => clearInterval(timer);
  }, [isOpen, secret]);

  // Handle ESC key to cancel & close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = () => {
    // Cancel 2FA verification and sign out of Firebase Auth to ensure unauthenticated state
    try {
      firebaseSignOut(auth).catch(() => {});
    } catch {}
    onClose();
  };

  const handleOtpChange = (index: number, value: string) => {
    setErrorMessage(null);

    // Multi-digit paste handler
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('');
      const updated = [...digits];
      pasted.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setDigits(updated);
      const nextIdx = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIdx]?.focus();

      if (pasted.length === 6) {
        setTimeout(() => executeVerification(updated.join('')), 100);
      }
      return;
    }

    const single = value.replace(/\D/g, '');
    const updated = [...digits];
    updated[index] = single;
    setDigits(updated);

    if (single && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify once all 6 digits are filled
    if (single && index === 5 && updated.every((d) => d !== '')) {
      setTimeout(() => executeVerification(updated.join('')), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleFillLiveTotp = () => {
    if (currentLiveTotp && currentLiveTotp.length === 6) {
      const splitDigits = currentLiveTotp.split('');
      setDigits(splitDigits);
      setErrorMessage(null);
      setTimeout(() => executeVerification(currentLiveTotp), 100);
    }
  };

  const executeVerification = async (candidateCode?: string) => {
    const inputCode = candidateCode || (useBackupCode ? backupCodeInput.trim() : digits.join(''));

    if (!inputCode) {
      setErrorMessage(
        useBackupCode
          ? 'Please enter an 8-character recovery backup code'
          : 'Please enter all 6 digits of your 2FA code'
      );
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const result = await verifyTwoFactorCode(
        secret,
        inputCode,
        backupCodes,
        pendingUser.id || pendingUser.email
      );

      if (result.valid) {
        setSuccessMessage(result.message || 'Two-Factor Authentication verified! Redirecting...');
        setTimeout(() => {
          setIsVerifying(false);
          onVerifySuccess(pendingUser, isAdmin);
        }, 450);
      } else {
        setIsVerifying(false);
        setErrorMessage(
          result.message || 'Invalid 2FA code. Please check your authenticator app.'
        );
      }
    } catch {
      setIsVerifying(false);
      setErrorMessage('Could not verify 2FA code. Please try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification();
  };

  return (
    <div
      id="two-factor-auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-factor-modal-title"
    >
      <div
        className={`w-full max-w-md rounded-3xl border p-5 sm:p-6 shadow-2xl relative transition-all duration-200 animate-in zoom-in-95 ${
          isDark
            ? 'bg-[#141923] border-slate-800 text-slate-100 shadow-black/60'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        }`}
      >
        {/* Close / Cancel Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Cancel login and close"
          aria-label="Close 2FA modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 mb-4">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-[#141923] animate-ping" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <Lock className="w-3 h-3" />
              <span>Firebase Auth • Step 2 of 2</span>
            </div>
            <h2 id="two-factor-modal-title" className="text-lg font-black tracking-tight">
              Two-Factor Authentication
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Email & Password verified for{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {pendingUser.email || pendingUser.name || 'Account'}
              </span>
            </p>
          </div>

          {/* Time window countdown pill */}
          <div className="flex items-center justify-center pt-0.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
              <RefreshCw
                className={`w-3 h-3 text-emerald-500 ${remainingSeconds < 6 ? 'animate-spin' : ''}`}
              />
              <span>
                Code refreshes in{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{remainingSeconds}s</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!useBackupCode ? (
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-2 text-center uppercase tracking-wider">
                Enter 6-Digit Authenticator Code
              </label>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputRefs.current[index] = el;
                    }}
                    id={`twofactor-modal-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    disabled={isVerifying}
                    className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl font-mono font-black rounded-2xl border-2 transition-all outline-none ${
                      digit
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 ring-2 ring-emerald-500/20'
                        : isDark
                        ? 'bg-[#181D26] border-slate-700 text-white focus:border-emerald-500 focus:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 focus:bg-emerald-50/30'
                    }`}
                  />
                ))}
              </div>

              {/* Quick Test / Auto-fill Helper for Testers */}
              {currentLiveTotp && (
                <div className="mt-3 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleFillLiveTotp}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
                    title="Click to auto-fill current active TOTP code"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      Quick Test: Fill Live Code (<strong>{currentLiveTotp}</strong>)
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Emergency Recovery Code</span>
                <span className="text-[10px] text-slate-400 font-mono">Format: XXXX-XXXX</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={backupCodeInput}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setBackupCodeInput(e.target.value);
                  }}
                  placeholder="e.g. K7M9-P4X2"
                  autoFocus
                  disabled={isVerifying}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-mono uppercase font-semibold border outline-none ${
                    isDark
                      ? 'bg-[#181D26] border-slate-700 text-white focus:border-emerald-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Use one of your 6 emergency one-time recovery backup codes.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              id="submit-2fa-modal-verify-btn"
              type="submit"
              disabled={isVerifying}
              style={{ backgroundColor: primaryColor }}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md shadow-emerald-500/25 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isVerifying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying 2FA Code...</span>
                </span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Complete Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isVerifying}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Cancel Login
            </button>
          </div>

          {/* Toggle between Authenticator app and Backup codes */}
          <div className="flex items-center justify-center text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setErrorMessage(null);
              }}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              {useBackupCode
                ? '← Use 6-digit Authenticator App code'
                : 'Need help? Use emergency recovery backup code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
