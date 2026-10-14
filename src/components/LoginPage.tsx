import React, { useState, useEffect, useRef } from 'react';
import { FreedomLogo } from './FreedomLogo';
import { StatusBar } from './StatusBar';
import {
  Globe,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  LogIn,
  UserPlus,
  ArrowRight,
  Shield,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Cookie,
  FileText,
  X,
  Fingerprint,
} from 'lucide-react';
import { AVAILABLE_LANGUAGES, ADMIN_CREDENTIALS } from '../data/mockData';
import { ThemeMode, UserProfile, AppBrandConfig, FooterPageTab } from '../types';
import {
  signInWithGoogleAuth,
  signInWithEmailPasswordAuth,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  auth,
  firebaseSignOut,
} from '../lib/firebase';
import { getInitialsAvatar, getAvatarColorForName } from '../lib/avatarHelper';
import {
  verifyTwoFactorCode,
  generateTotpCode,
  getRemainingSeconds,
  ADMIN_2FA_DEFAULT_SECRET,
  ADMIN_2FA_DEFAULT_BACKUP_CODES,
  getAdminTwoFactorConfig,
  getUserTwoFactorSettings,
} from '../lib/twoFactorAuth';
import { TwoFactorVerificationModal } from './TwoFactorVerificationModal';
import { PasswordResetPage, getSavedUserPassword } from './PasswordResetPage';
import { AboutAndFooterPagesView, AppFooterLinksBar } from './AboutAndFooterPagesModal';
import { FingerprintSetupModal } from './FingerprintSetupModal';
import {
  FingerprintRecord,
  getFingerprintRecord,
} from '../lib/fingerprintAuthHelper';

interface LoginPageProps {
  onLoginSuccess: (user?: Partial<UserProfile>, isAdmin?: boolean) => void;
  onRegisterSuccess: (newUser: UserProfile) => void;
  onOpenAdmin?: () => void;
  onOpenPasswordReset?: (identifier?: string) => void;
  onOpenFooterPage?: (tab: FooterPageTab) => void;
  theme?: ThemeMode;
  primaryColor?: string;
  brandConfig: AppBrandConfig;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onRegisterSuccess,
  onOpenAdmin,
  onOpenPasswordReset,
  onOpenFooterPage,
  theme = 'light',
  primaryColor = '#7C3AED',
  brandConfig,
}) => {
  const isDark = theme === 'dark';

  // Mode: 'signin' | 'register' | '2fa' | 'recovery' | 'info_page'
  const [authMode, setAuthMode] = useState<'signin' | 'register' | '2fa' | 'recovery' | 'info_page'>('signin');
  const [activeFooterTab, setActiveFooterTab] = useState<FooterPageTab>('terms');

  // Sign In Form States: Clean, empty real fields
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInLanguage, setSignInLanguage] = useState('English');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Register Form States: Clean, empty real fields
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmailOrPhone, setRegEmailOrPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLanguage, setRegLanguage] = useState('English');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regCustomAvatar, setRegCustomAvatar] = useState<string | null>(null);
  const regAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const registerRedirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 2FA Challenge States
  const [twoFactorDigits, setTwoFactorDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [backupCodeInput, setBackupCodeInput] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [currentLiveTotp, setCurrentLiveTotp] = useState<string>('');
  const [pendingUserAuth, setPendingUserAuth] = useState<{
    user: Partial<UserProfile>;
    isAdmin: boolean;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);

  // Feedback & Loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registeredWelcomeUser, setRegisteredWelcomeUser] = useState<UserProfile | null>(null);

  // Fingerprint 2FA / MFA Modal State (matching Light_18.webp)
  const [isFingerprintModalOpen, setIsFingerprintModalOpen] = useState<boolean>(false);
  const [fingerprintModalMode, setFingerprintModalMode] = useState<'record' | 'verify'>('record');
  const [fingerprintRecord, setFingerprintRecord] = useState<FingerprintRecord | null>(() =>
    getFingerprintRecord()
  );

  useEffect(() => {
    const syncFp = () => setFingerprintRecord(getFingerprintRecord());
    window.addEventListener('freedom-fingerprint-updated', syncFp);
    return () => window.removeEventListener('freedom-fingerprint-updated', syncFp);
  }, []);

  // Cookie Consent Pop-up State on Login Page
  const [cookiesAccepted, setCookiesAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('freedom_cookie_consent_accepted_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [showCookiePopup, setShowCookiePopup] = useState<boolean>(() => {
    try {
      return localStorage.getItem('freedom_cookie_consent_accepted_v1') !== 'true';
    } catch {
      return true;
    }
  });
  const [showCookieCustomize, setShowCookieCustomize] = useState<boolean>(false);
  const [cookiePrefs, setCookiePrefs] = useState({
    essential: true,
    functional: true,
    analytics: true,
  });

  // Mobile Finger Slide-Up Sheet State for Easy Texting & Login
  const [isSheetSlidUp, setIsSheetSlidUp] = useState<boolean>(false);
  const [touchSlideDeltaY, setTouchSlideDeltaY] = useState<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const loginScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loginFormCardRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStartSlide = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMoveSlide = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || e.touches.length !== 1) return;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    // Clamp live visual drag feedback
    setTouchSlideDeltaY(Math.max(-90, Math.min(90, deltaY)));
  };

  const handleTouchEndSlide = () => {
    if (touchSlideDeltaY < -24) {
      // User slid up with finger -> slide login sheet up for easy texting & login
      setIsSheetSlidUp(true);
      setShowCookiePopup(false);
    } else if (touchSlideDeltaY > 32 && (loginScrollContainerRef.current?.scrollTop || 0) <= 12) {
      // User slid down at top of scroll -> restore full banner
      setIsSheetSlidUp(false);
    }
    touchStartYRef.current = null;
    setTouchSlideDeltaY(0);
  };

  const handleInputFocusSlideUp = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsSheetSlidUp(true);
    setShowCookiePopup(false);
    const targetEl = e.currentTarget;
    setTimeout(() => {
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }, 180);
  };

  // Mandatory Terms of Use & Privacy Policy Reading Gate before proceeding to Profile Page after Login
  const [pendingLegalConsentAuth, setPendingLegalConsentAuth] = useState<{
    mode: 'login' | 'register';
    user: Partial<UserProfile>;
    isAdmin?: boolean;
    fullNewUser?: UserProfile;
  } | null>(null);
  const [legalScrollProgress, setLegalScrollProgress] = useState<number>(0);
  const [hasReadTermsSection, setHasReadTermsSection] = useState<boolean>(false);
  const [hasReadPrivacySection, setHasReadPrivacySection] = useState<boolean>(false);
  const [agreedTermsOfUse, setAgreedTermsOfUse] = useState<boolean>(false);
  const [agreedPrivacyPolicy, setAgreedPrivacyPolicy] = useState<boolean>(false);
  const legalScrollRef = useRef<HTMLDivElement | null>(null);
  const privacySectionRef = useRef<HTMLDivElement | null>(null);

  const handleAcceptCookies = (acceptAll: boolean = true) => {
    const finalPrefs = acceptAll
      ? { essential: true, functional: true, analytics: true }
      : { essential: true, functional: cookiePrefs.functional, analytics: false };
    setCookiePrefs(finalPrefs);
    setCookiesAccepted(true);
    setShowCookiePopup(false);
    setShowCookieCustomize(false);
    try {
      localStorage.setItem('freedom_cookie_consent_accepted_v1', 'true');
      localStorage.setItem(
        'freedom_cookie_consent_prefs_v1',
        JSON.stringify({
          ...finalPrefs,
          acceptedAt: new Date().toISOString(),
        })
      );
    } catch {}
    setSuccessMessage('Cookie preferences saved and accepted ✓');
    setTimeout(() => {
      setSuccessMessage((prev) =>
        prev === 'Cookie preferences saved and accepted ✓' ? null : prev
      );
    }, 2800);
  };

  // Start Mandatory Terms of Use & Privacy Policy Reading Gate before proceeding to Profile Page
  const openMandatoryLegalReadingGate = (payload: {
    mode: 'login' | 'register';
    user: Partial<UserProfile>;
    isAdmin?: boolean;
    fullNewUser?: UserProfile;
  }) => {
    setPendingLegalConsentAuth(payload);
    setLegalScrollProgress(0);
    setHasReadTermsSection(false);
    setHasReadPrivacySection(false);
    setAgreedTermsOfUse(false);
    setAgreedPrivacyPolicy(false);
  };

  const handleLegalContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 10) {
      setLegalScrollProgress(100);
      setHasReadTermsSection(true);
      setHasReadPrivacySection(true);
      return;
    }
    const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
    setLegalScrollProgress((prev) => Math.max(prev, pct));
    if (pct >= 40) {
      setHasReadTermsSection(true);
    }
    if (pct >= 92 || el.scrollHeight - el.scrollTop - el.clientHeight <= 28) {
      setHasReadTermsSection(true);
      setHasReadPrivacySection(true);
      setLegalScrollProgress(100);
    }
  };

  const handleScrollDownLegalReader = () => {
    const el = legalScrollRef.current;
    if (!el) {
      setHasReadTermsSection(true);
      setHasReadPrivacySection(true);
      setLegalScrollProgress(100);
      return;
    }
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (!hasReadTermsSection && privacySectionRef.current) {
      privacySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasReadTermsSection(true);
      setLegalScrollProgress((prev) => Math.max(prev, 55));
    } else {
      el.scrollTo({ top: maxScroll, behavior: 'smooth' });
      setHasReadTermsSection(true);
      setHasReadPrivacySection(true);
      setLegalScrollProgress(100);
    }
  };

  const handleConfirmLegalAndProceedToProfile = () => {
    if (!pendingLegalConsentAuth) return;
    if (!hasReadTermsSection || !hasReadPrivacySection || !agreedTermsOfUse || !agreedPrivacyPolicy) {
      return;
    }
    try {
      localStorage.setItem(
        `freedom_terms_privacy_read_${pendingLegalConsentAuth.user.id || 'user'}`,
        new Date().toISOString()
      );
    } catch {}
    const authPayload = pendingLegalConsentAuth;
    setPendingLegalConsentAuth(null);
    if (authPayload.mode === 'register' && authPayload.fullNewUser) {
      onRegisterSuccess(authPayload.fullNewUser);
    } else {
      onLoginSuccess(authPayload.user, authPayload.isAdmin);
    }
  };

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer loop for TOTP remaining seconds and live hint
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const updateTotp = async () => {
      setRemainingSeconds(getRemainingSeconds());
      const secret = pendingUserAuth?.secret || ADMIN_2FA_DEFAULT_SECRET;
      const code = await generateTotpCode(secret);
      setCurrentLiveTotp(code);
    };

    updateTotp();
    timer = setInterval(updateTotp, 1000);
    return () => clearInterval(timer);
  }, [pendingUserAuth?.secret]);

  // Initiate 2FA verification modal challenge
  const startTwoFactorChallenge = async (user: Partial<UserProfile>, isAdmin: boolean) => {
    let secret = ADMIN_2FA_DEFAULT_SECRET;
    let backupCodes = ADMIN_2FA_DEFAULT_BACKUP_CODES;

    if (isAdmin) {
      const adminConfig = await getAdminTwoFactorConfig();
      secret = adminConfig.secret || ADMIN_2FA_DEFAULT_SECRET;
      backupCodes = adminConfig.backupCodes || ADMIN_2FA_DEFAULT_BACKUP_CODES;
    } else {
      const userConfig = getUserTwoFactorSettings(
        user.id || user.email || user.username || 'user'
      );
      secret = userConfig.secret || ADMIN_2FA_DEFAULT_SECRET;
      backupCodes = userConfig.backupCodes || ADMIN_2FA_DEFAULT_BACKUP_CODES;
    }

    setPendingUserAuth({
      user,
      isAdmin,
      secret,
      backupCodes,
    });
    setTwoFactorDigits(['', '', '', '', '', '']);
    setBackupCodeInput('');
    setUseBackupCode(false);
    setErrorMessage(null);
    setIsLoading(false);

    // Show 2FA modal before the user is fully authenticated and redirected
    setIsTwoFactorModalOpen(true);
  };

  const handleTwoFactorModalSuccess = (user: Partial<UserProfile>, isAdmin: boolean) => {
    setIsTwoFactorModalOpen(false);
    setPendingUserAuth(null);
    setErrorMessage(null);
    setSuccessMessage('Two-Factor Authentication verified successfully! Redirecting...');
    // Fully authenticate the user and redirect to Profile page
    onLoginSuccess(user, isAdmin);
  };

  const handleTwoFactorModalClose = () => {
    setIsTwoFactorModalOpen(false);
    setPendingUserAuth(null);
    try {
      firebaseSignOut(auth).catch(() => {});
    } catch {}
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage('Connecting to Google...');

    try {
      const { user, isAdmin } = await signInWithGoogleAuth();
      const isSuperAdmin =
        isAdmin || user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      setSuccessMessage(null);
      // Proceed to 2FA modal verification before fully authenticating
      await startTwoFactorChallenge(
        {
          id: user.id,
          name: user.name,
          username: user.username || user.email?.split('@')[0] || user.id,
          email: user.email,
          avatar: user.avatar,
          motherLanguage: user.motherLanguage || signInLanguage,
          bio: user.bio,
        },
        isSuperAdmin
      );
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Google sign-in could not be completed';
      setErrorMessage(msg);
      setSuccessMessage(null);
    }
  };

  // Handle Sign In submission via Firebase Auth
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const identifier = signInIdentifier.trim();
    const password = signInPassword.trim();

    if (!identifier) {
      setErrorMessage('Please enter your email, username, or phone number');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Authenticate credentials with Firebase Auth (Email/Password)
      const authResult = await signInWithEmailPasswordAuth(identifier, password);

      // 2. Successful email/password entry -> Challenge user with 2FA modal
      // before fully authenticating and redirecting
      await startTwoFactorChallenge(authResult.user, authResult.isAdmin);
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.message || 'Login failed. Please check your credentials.';
      setErrorMessage(msg);
    }
  };

  // Handle 2FA verification code submission
  const handleVerify2Fa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingUserAuth) return;

    setIsLoading(true);
    setErrorMessage(null);

    const inputCode = useBackupCode
      ? backupCodeInput.trim()
      : twoFactorDigits.join('');

    if (!inputCode) {
      setIsLoading(false);
      setErrorMessage(
        useBackupCode
          ? 'Please enter an 8-character backup code'
          : 'Please enter all 6 digits of your 2FA code'
      );
      return;
    }

    try {
      const result = await verifyTwoFactorCode(
        pendingUserAuth.secret,
        inputCode,
        pendingUserAuth.backupCodes
      );

      if (result.valid) {
        setSuccessMessage(result.message || 'Two-Factor Authentication verified!');
        setTimeout(() => {
          setIsLoading(false);
          openMandatoryLegalReadingGate({
            mode: 'login',
            user: pendingUserAuth.user,
            isAdmin: pendingUserAuth.isAdmin,
          });
        }, 450);
      } else {
        setIsLoading(false);
        setErrorMessage(result.message || 'Invalid 2FA code. Please check your authenticator.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Could not verify 2FA code. Please try again.');
    }
  };

  // OTP Input keyboard navigation & paste handler
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // User pasted multi-char code
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const updated = [...twoFactorDigits];
      digits.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setTwoFactorDigits(updated);
      const nextIdx = Math.min(digits.length, 5);
      otpInputRefs.current[nextIdx]?.focus();

      if (digits.length === 6) {
        setTimeout(() => handleVerify2Fa(), 150);
      }
      return;
    }

    const digit = value.replace(/\D/g, '');
    const updated = [...twoFactorDigits];
    updated[index] = digit;
    setTwoFactorDigits(updated);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on 6th digit
    if (digit && index === 5 && updated.every((d) => d !== '')) {
      setTimeout(() => handleVerify2Fa(), 150);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !twoFactorDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Helper: Quick-fill current live TOTP code for testing
  const handleFillLiveTotp = () => {
    if (currentLiveTotp && currentLiveTotp.length === 6) {
      setTwoFactorDigits(currentLiveTotp.split(''));
      setErrorMessage(null);
      setTimeout(() => handleVerify2Fa(), 100);
    }
  };

  // Handle Registration submission
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    if (!regUsername.trim()) {
      setErrorMessage('Please choose a unique username');
      return;
    }
    if (regPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const newUserId = `usr_${Date.now()}`;
      const cleanName = regName.trim();
      const generatedAvatar =
        regCustomAvatar || getInitialsAvatar(cleanName, getAvatarColorForName(cleanName));

      const newUserProfile: UserProfile = {
        id: newUserId,
        name: cleanName,
        username: regUsername.trim().toLowerCase().replace(/\s+/g, '_'),
        avatar: generatedAvatar,
        motherLanguage: regLanguage,
        bio: `Freedom talk in ${regLanguage} 🕊️`,
        isOnline: true,
        phoneNumber:
          !regEmailOrPhone.includes('@') && regEmailOrPhone.trim()
            ? regEmailOrPhone.trim()
            : undefined,
        email: regEmailOrPhone.includes('@') ? regEmailOrPhone.trim() : undefined,
        twoFactorEnabled: false,
      };

      // Show the Congratulations! Welcome Modal (Light_24.jpg) and then require reading Terms & Privacy before Profile page
      setRegisteredWelcomeUser(newUserProfile);
      if (registerRedirectTimeoutRef.current) {
        clearTimeout(registerRedirectTimeoutRef.current);
      }
      registerRedirectTimeoutRef.current = setTimeout(() => {
        setRegisteredWelcomeUser(null);
        openMandatoryLegalReadingGate({
          mode: 'register',
          user: newUserProfile,
          fullNewUser: newUserProfile,
        });
      }, 2600);
    }, 350);
  };

  if (authMode === 'recovery') {
    return (
      <PasswordResetPage
        initialIdentifier={signInIdentifier}
        theme={theme}
        primaryColor={primaryColor}
        brandConfig={brandConfig}
        onBackToLogin={(prefill) => {
          if (prefill) setSignInIdentifier(prefill);
          setAuthMode('signin');
          setErrorMessage(null);
          setSuccessMessage('You can now sign in with your recovered password.');
        }}
        onLoginAfterReset={(user) => {
          setAuthMode('signin');
          openMandatoryLegalReadingGate({
            mode: 'login',
            user,
            isAdmin: false,
          });
        }}
      />
    );
  }

  if (authMode === 'info_page') {
    return (
      <AboutAndFooterPagesView
        activeTab={activeFooterTab}
        onSelectTab={setActiveFooterTab}
        onClose={() => setAuthMode('signin')}
        brandConfig={brandConfig}
        theme={theme}
        primaryColor={primaryColor}
      />
    );
  }

  return (
    <div
      id="freedom-login-page"
      ref={loginScrollContainerRef}
      onTouchStart={handleTouchStartSlide}
      onTouchMove={handleTouchMoveSlide}
      onTouchEnd={handleTouchEndSlide}
      style={{ WebkitOverflowScrolling: 'touch' }}
      className={`h-full max-h-full w-full overflow-y-auto overscroll-y-contain touch-pan-y scroll-smooth flex flex-col justify-between transition-colors duration-200 ${
        isDark ? 'bg-[#0E121A] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <StatusBar theme={theme} />

      {/* Top Header / Brand Nav */}
      <div className="flex items-center justify-between px-4 sm:px-5 pt-2.5 pb-1.5 z-10 shrink-0">
        <div className="flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-emerald-500" />
          <select
            aria-label="Interface Language"
            value={signInLanguage}
            onChange={(e) => setSignInLanguage(e.target.value)}
            className={`text-xs font-semibold bg-transparent border-none outline-none cursor-pointer ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name} className="text-slate-900">
                {lang.name} ({lang.native})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Cookie Consent Trigger Button in Login Header */}
          <button
            id="open-login-cookie-popup-btn"
            type="button"
            onClick={() => setShowCookiePopup(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
              cookiesAccepted
                ? isDark
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : isDark
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
            title="View or update Cookie Consent Preferences"
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>{cookiesAccepted ? 'Cookies ✓' : 'Cookies'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area — Finger-Slidable Sheet for Easy Mobile Texting & Login */}
      <div
        className={`flex-1 flex flex-col items-center px-4 sm:px-5 w-full max-w-md mx-auto transition-all duration-300 ${
          isSheetSlidUp ? 'justify-start pt-1 pb-44' : 'justify-start sm:justify-center pt-2 pb-36'
        }`}
      >
        {/* Collapsible Brand Banner (slides up compactly when user slides up with finger or focuses input) */}
        <div
          className={`flex flex-col items-center text-center transition-all duration-300 overflow-hidden ${
            isSheetSlidUp ? 'mb-1.5 max-h-14' : 'mb-3 max-h-64'
          }`}
        >
          {isSheetSlidUp ? (
            <div className="flex items-center gap-2 py-1">
              <FreedomLogo
                appName={brandConfig.appName}
                customFavicon={brandConfig.faviconUrl}
                primaryColor={primaryColor}
                size="sm"
                theme={theme}
                showText={false}
              />
              <span className="text-base font-black tracking-tight">{brandConfig.appName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">
                Encrypted Login
              </span>
            </div>
          ) : (
            <>
              <div className="relative mb-1.5 transform hover:scale-105 transition-transform duration-300">
                <div
                  className="absolute inset-0 blur-2xl rounded-full opacity-20 pointer-events-none"
                  style={{ backgroundColor: primaryColor }}
                />
                <FreedomLogo
                  appName={brandConfig.appName}
                  customFavicon={brandConfig.faviconUrl}
                  primaryColor={primaryColor}
                  size="lg"
                  theme={theme}
                  showText={false}
                />
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <span>{brandConfig.appName}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xs font-medium">
                {brandConfig.appDescription ||
                  'Next-generation secure communication with Apache Cordova packaging & 2FA security'}
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Login or Register Required to Access Encrypted Chats</span>
              </div>
            </>
          )}
        </div>

        {/* Interactive Finger Slide-Up Login Sheet Container */}
        <div
          ref={loginFormCardRef}
          id="login-slidable-sheet-card"
          style={{
            transform:
              touchSlideDeltaY !== 0
                ? `translateY(${Math.round(touchSlideDeltaY * 0.35)}px)`
                : undefined,
          }}
          className={`w-full rounded-3xl border p-4 sm:p-5 shadow-xl transition-all duration-200 ${
            isDark
              ? 'bg-[#141923]/95 border-slate-800 shadow-black/40'
              : 'bg-white border-slate-200/90 shadow-slate-900/5'
          }`}
        >
        {/* ============================================================== */}
        {/* STANDARD SIGN IN / REGISTER TABS                              */}
        {/* ============================================================== */}
        <div className="w-full">
          {/* Google Sign In Button */}
            <div className="w-full mb-3">
              <button
                id="google-signin-btn"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-[#181D26] hover:bg-[#202734] border-slate-700 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="w-full flex items-center gap-3 my-1.5">
              <div className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">or sign in with password</span>
              <div className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Tab Toggle: Sign In vs Register */}
            <div
              className={`w-full p-1 rounded-2xl border flex items-center mb-3 ${
                isDark ? 'bg-[#181D26] border-slate-800' : 'bg-slate-200/80 border-slate-300/60'
              }`}
            >
              <button
                id="tab-btn-signin"
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                id="tab-btn-register"
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Feedback messages */}
            {errorMessage && (
              <div className="w-full p-3 mb-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="w-full p-3 mb-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Sign In Form */}
            {authMode === 'signin' ? (
              <form onSubmit={handleSignInSubmit} className="w-full space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Email, Username or Phone
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      id="signin-identifier-input"
                      type="text"
                      value={signInIdentifier}
                      onFocus={handleInputFocusSlideUp}
                      onChange={(e) => setSignInIdentifier(e.target.value)}
                      placeholder="admin or mobilephonesky987@gmail.com"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold border ${
                        isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Password
                    </label>
                    <button
                      id="login-password-recovery-link"
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        if (onOpenPasswordReset) {
                          onOpenPasswordReset(signInIdentifier);
                        } else {
                          setAuthMode('recovery');
                        }
                      }}
                      style={{ color: primaryColor }}
                      className="text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Password Recovery</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      id="signin-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={signInPassword}
                      onFocus={handleInputFocusSlideUp}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="Enter password"
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs font-semibold border ${
                        isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2FA Security & Fingerprint Biometric 2FA Badge */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      2FA Protected {fingerprintRecord?.enabled ? '• Fingerprint Active ✓' : ''}
                    </span>
                  </div>
                  <button
                    id="login-open-set-fingerprint-btn"
                    type="button"
                    onClick={() => {
                      setFingerprintModalMode('record');
                      setIsFingerprintModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-full bg-[#FF5468] hover:bg-[#F24458] text-white text-[10px] font-extrabold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <Fingerprint className="w-3 h-3" />
                    <span>{fingerprintRecord ? 'Fingerprint 2FA ✓' : 'Set Your Fingerprint'}</span>
                  </button>
                </div>

                {/* Remember Me & Lost Password Recovery Link */}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Remember this device</span>
                  </label>

                  <button
                    id="login-lost-password-btn"
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      if (onOpenPasswordReset) {
                        onOpenPasswordReset(signInIdentifier);
                      } else {
                        setAuthMode('recovery');
                      }
                    }}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:text-emerald-500 transition-colors cursor-pointer"
                  >
                    Lost password? Text to recover
                  </button>
                </div>

                {/* Submit Sign In Button */}
                <button
                  id="submit-signin-btn"
                  type="submit"
                  disabled={isLoading}
                  style={{ backgroundColor: primaryColor }}
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md shadow-emerald-500/25 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In & Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegisterSubmit} className="w-full space-y-2.5">
                {/* Circular Avatar Picker with Coral Edit Badge (matching Light_24.jpg) */}
                <div className="flex flex-col items-center justify-center pb-1">
                  <input
                    ref={regAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setRegCustomAvatar(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => regAvatarInputRef.current?.click()}
                    className="relative group cursor-pointer"
                    title="Upload Profile Photo"
                  >
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all ${
                        isDark
                          ? 'bg-[#181D26] border-slate-700'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      {regCustomAvatar || regName.trim() ? (
                        <img
                          src={
                            regCustomAvatar ||
                            getInitialsAvatar(regName || 'User', getAvatarColorForName(regName || 'User'))
                          }
                          alt="Profile Avatar Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-6 h-6 rounded-lg bg-[#FF4D6D] text-white flex items-center justify-center shadow-md shadow-rose-500/30 group-hover:scale-105 transition-transform">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <input
                    id="reg-name-input"
                    type="text"
                    value={regName}
                    onFocus={handleInputFocusSlideUp}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Kristin Watson"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Username
                  </label>
                  <input
                    id="reg-username-input"
                    type="text"
                    value={regUsername}
                    onFocus={handleInputFocusSlideUp}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. kristin_w"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Email or Phone (Optional)
                  </label>
                  <input
                    id="reg-email-phone-input"
                    type="text"
                    value={regEmailOrPhone}
                    onFocus={handleInputFocusSlideUp}
                    onChange={(e) => setRegEmailOrPhone(e.target.value)}
                    placeholder="email@example.com or +1 555-0199"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password-input"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onFocus={handleInputFocusSlideUp}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 4 chars"
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                          isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Confirm
                    </label>
                    <input
                      id="reg-confirm-password-input"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onFocus={handleInputFocusSlideUp}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repeat pass"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                        isDark ? 'bg-[#181D26] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Profile Avatar Preview Note */}
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#181D26]/50 flex items-center gap-3">
                  <img
                    src={getInitialsAvatar(regName || 'User', getAvatarColorForName(regName || 'User'))}
                    alt="Avatar Preview"
                    className="w-8 h-8 rounded-full border border-emerald-400"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                    Clean initials avatar generated automatically. Photos can be uploaded anytime in Profile.
                  </span>
                </div>

                {/* Set Your Fingerprint (2FA) Option in Register Form */}
                <div className="p-2.5 rounded-xl border border-[#FF5468]/30 bg-[#FDECEF]/60 dark:bg-[#FF5468]/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#FF5468] text-white flex items-center justify-center shrink-0">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                        Fingerprint 2FA Authentication
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-300 truncate">
                        {fingerprintRecord
                          ? `Recorded (${fingerprintRecord.fingerLabel}) ✓`
                          : 'Add a fingerprint to make your account more secure'}
                      </p>
                    </div>
                  </div>
                  <button
                    id="register-set-fingerprint-btn"
                    type="button"
                    onClick={() => {
                      setFingerprintModalMode('record');
                      setIsFingerprintModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#FF5468] hover:bg-[#F24458] text-white text-[11px] font-bold shrink-0 cursor-pointer transition-all"
                  >
                    {fingerprintRecord ? 'Update' : 'Set Fingerprint'}
                  </button>
                </div>

                {/* Remember Me Checkbox (matching Light_24.jpg) */}
                <div className="flex items-center justify-center pt-1">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        rememberMe
                          ? 'bg-[#FF4D6D] text-white shadow-sm shadow-rose-500/30'
                          : 'border-2 border-[#FF4D6D] bg-transparent'
                      }`}
                    >
                      {rememberMe && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Remember me
                    </span>
                  </label>
                </div>

                {/* Register Submit Button */}
                <button
                  id="submit-register-btn"
                  type="submit"
                  disabled={isLoading || Boolean(registeredWelcomeUser)}
                  className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-[#FF6B88] via-[#FF5271] to-[#FF4769] text-white font-bold text-xs shadow-lg shadow-rose-500/30 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Registering Account...</span>
                    </span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Sign up</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Already have an account?{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] font-bold text-[#FF4D6D] hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* CONGRATULATIONS! REGISTRATION WELCOME MODAL (Matching Light_24.jpg) */}
      {/* ================================================================== */}
      {registeredWelcomeUser && (
        <div
          id="registration-congratulations-modal"
          onClick={() => {
            if (registerRedirectTimeoutRef.current) {
              clearTimeout(registerRedirectTimeoutRef.current);
              registerRedirectTimeoutRef.current = null;
            }
            const userToRedirect = registeredWelcomeUser;
            setRegisteredWelcomeUser(null);
            openMandatoryLegalReadingGate({
              mode: 'register',
              user: userToRedirect,
              fullNewUser: userToRedirect,
            });
          }}
          className="fixed inset-0 z-[150] bg-[#3C4048]/80 backdrop-blur-[2px] flex items-center justify-center p-6 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (registerRedirectTimeoutRef.current) {
                clearTimeout(registerRedirectTimeoutRef.current);
                registerRedirectTimeoutRef.current = null;
              }
              const userToRedirect = registeredWelcomeUser;
              setRegisteredWelcomeUser(null);
              openMandatoryLegalReadingGate({
                mode: 'register',
                user: userToRedirect,
                fullNewUser: userToRedirect,
              });
            }}
            className="w-full max-w-[315px] rounded-[38px] bg-white px-7 py-10 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
          >
            {/* Top Pink/Coral Circle with Floating Dots & White Shield Checkmark (Exact match to Light_24.jpg) */}
            <div className="relative w-36 h-36 flex items-center justify-center mb-4">
              {/* Decorative Floating Coral/Pink Dots around the circle */}
              <span className="absolute top-1 left-4 w-4 h-4 rounded-full bg-[#FF7B93]" />
              <span className="absolute top-3 right-2 w-3 h-3 rounded-full bg-[#FF7B93]" />
              <span className="absolute top-12 left-0 w-1.5 h-1.5 rounded-full bg-[#FF99AC]" />
              <span className="absolute bottom-6 left-2 w-2.5 h-2.5 rounded-full bg-[#FF7B93]" />
              <span className="absolute bottom-0 left-12 w-1.5 h-1.5 rounded-full bg-[#FF8FA3]" />
              <span className="absolute bottom-9 right-1 w-1.5 h-1.5 rounded-full bg-[#FF7B93]" />
              <span className="absolute bottom-2 right-7 w-1 h-1 rounded-full bg-[#FF99AC]" />

              {/* Main Coral-Pink Gradient Circle */}
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#FF758F] via-[#FF5A79] to-[#FF4769] flex items-center justify-center shadow-lg shadow-rose-500/25">
                {/* White Shield with Coral Checkmark inside */}
                <svg
                  viewBox="0 0 40 44"
                  className="w-11 h-12 drop-shadow-xs"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 2L6 7.6V19.8C6 29.5 11.97 38.45 20 42C28.03 38.45 34 29.5 34 19.8V7.6L20 2Z"
                    fill="#FFFFFF"
                  />
                  <path
                    d="M15.5 21.5L18.6 24.6L25.2 18"
                    stroke="#FF5271"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Congratulations! Heading */}
            <h2 className="text-[22px] font-extrabold text-[#F04868] tracking-tight mb-3">
              Congratulations!
            </h2>

            {/* Welcome Message Body */}
            <p className="text-[13.5px] text-slate-600 font-medium leading-relaxed max-w-[240px] mb-7">
              Your account is ready to use. You will be redirected to the Profile page in a few seconds..
            </p>

            {/* Bottom Coral-Pink Dotted Ring Loader (Exact match to Light_24.jpg) */}
            <div className="relative w-12 h-12 animate-spin" style={{ animationDuration: '1.4s' }}>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#FF5A79]" />
              <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-[#FF8FA3]" />
              <span className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FF758F]" />
              <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF5A79]" />
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#FF5A79]" />
              <span className="absolute bottom-1.5 left-1.5 w-3 h-3 rounded-full bg-[#FF6B88]" />
              <span className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-3 rounded-full bg-[#FF758F]" />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MANDATORY TERMS OF USE & PRIVACY POLICY GATE BEFORE PROFILE PAGE   */}
      {/* ================================================================== */}
      {pendingLegalConsentAuth && (
        <div
          id="mandatory-terms-privacy-modal"
          className="fixed inset-0 z-[160] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
        >
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
              isDark
                ? 'bg-[#141923] border-slate-700/80 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
                isDark ? 'bg-[#181F2C] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: primaryColor }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black tracking-tight">
                      Terms of Use & Privacy Policy
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                      Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Please read both documents completely before proceeding to your Profile page.
                  </p>
                </div>
              </div>
            </div>

            {/* Reading Status & Progress Bar */}
            <div
              className={`px-5 py-2.5 border-b flex flex-col gap-2 shrink-0 ${
                isDark ? 'bg-[#111620] border-slate-800/80' : 'bg-slate-100/70 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      hasReadTermsSection
                        ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>1. Terms of Use: {hasReadTermsSection ? 'Read ✓' : 'Reading...'}</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      hasReadPrivacySection
                        ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    <span>2. Privacy Policy: {hasReadPrivacySection ? 'Read ✓' : 'Unread'}</span>
                  </span>
                </div>
                <span className="text-[11px] font-mono font-extrabold text-emerald-500">
                  {legalScrollProgress}% Read
                </span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                  style={{ width: `${legalScrollProgress}%` }}
                />
              </div>
            </div>

            {/* Scrollable Terms of Use & Privacy Policy Document Content */}
            <div
              ref={legalScrollRef}
              onScroll={handleLegalContainerScroll}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs leading-relaxed"
            >
              {/* PART 1: TERMS OF USE */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-[#181F2E]/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-black uppercase tracking-wide">
                      Part 1 — Terms of Use
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    Mandatory Review
                  </span>
                </div>

                <div className="space-y-2.5 text-[11.5px] text-slate-600 dark:text-slate-300">
                  <p>
                    <strong>1.1 Acceptance of Terms of Use:</strong> By signing in or registering on{' '}
                    <strong>{brandConfig.appName}</strong>, you acknowledge that you have read,
                    understood, and agreed to be bound by these Terms of Use prior to accessing your
                    Profile page, messaging threads, live stream channels, and media studio tools.
                  </p>
                  <p>
                    <strong>1.2 Account Security & Two-Factor Authentication (2FA):</strong> You are
                    responsible for maintaining the confidentiality of your password and 6-digit TOTP
                    Authenticator / backup recovery codes. Any activity performed under your account
                    is your responsibility.
                  </p>
                  <p>
                    <strong>1.3 Community Conduct, Live Streams & Group Chats:</strong> Users must
                    treat all community members respectfully across individual chats, multilingual
                    group chats, live video streams, and podcasts. Harassment, unauthorized spam, or
                    unlawful content will result in immediate account suspension by Administrators.
                  </p>
                  <p>
                    <strong>1.4 Photo & Video Studio & User Gallery:</strong> You retain ownership of
                    photos, videos, custom stickers, and document links you create or edit in your
                    Profile Gallery. By sharing edited media to friends or groups, you grant
                    recipients permission to view that media within {brandConfig.appName}.
                  </p>
                </div>
              </div>

              {/* PART 2: PRIVACY POLICY & COOKIES POLICY */}
              <div
                ref={privacySectionRef}
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-[#181F2E]/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <h3 className="text-sm font-black uppercase tracking-wide">
                      Part 2 — Privacy Policy & Cookie Policy
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    Data & Privacy Protection
                  </span>
                </div>

                <div className="space-y-2.5 text-[11.5px] text-slate-600 dark:text-slate-300">
                  <p>
                    <strong>2.1 Personal Profile & Online Presence Privacy:</strong> Your Profile
                    page lets you manage your display name, avatar, bio, social links, phone number
                    visibility, and <strong>Hide Online Status</strong> setting. We never sell your
                    personal profile data to third-party marketers.
                  </p>
                  <p>
                    <strong>2.2 End-to-End Encryption & Message Security:</strong> Private messages,
                    voice notes, video calls, and shared media are protected using encrypted
                    transport and optional per-message PIN locks.
                  </p>
                  <p>
                    <strong>2.3 Cookies & Local Storage Policy:</strong> We use essential authentication
                    cookies and local storage tokens to keep your session active, remember your 2FA
                    trust state, and store your language and theme settings.
                  </p>
                  <p>
                    <strong>2.4 Right to Delete Account & Data:</strong> You may update or permanently
                    delete your account and associated profile gallery data at any time directly from
                    your Profile page settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Controls: Required Checkboxes & Proceed to Profile Button */}
            <div
              className={`px-5 py-4 border-t space-y-3 shrink-0 ${
                isDark ? 'bg-[#181F2C] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Mandatory Checkboxes */}
              <div className="space-y-2">
                <label
                  onClick={() => {
                    if (!hasReadTermsSection || !hasReadPrivacySection) {
                      handleScrollDownLegalReader();
                    }
                  }}
                  className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none"
                >
                  <input
                    id="checkbox-read-terms-of-use"
                    type="checkbox"
                    checked={agreedTermsOfUse}
                    disabled={!hasReadTermsSection || !hasReadPrivacySection}
                    onChange={(e) => setAgreedTermsOfUse(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  />
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                    I have read and agree to the <strong>Terms of Use</strong>.
                  </span>
                </label>

                <label
                  onClick={() => {
                    if (!hasReadTermsSection || !hasReadPrivacySection) {
                      handleScrollDownLegalReader();
                    }
                  }}
                  className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none"
                >
                  <input
                    id="checkbox-read-privacy-policy"
                    type="checkbox"
                    checked={agreedPrivacyPolicy}
                    disabled={!hasReadTermsSection || !hasReadPrivacySection}
                    onChange={(e) => setAgreedPrivacyPolicy(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  />
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                    I have read and agree to the <strong>Privacy Policy & Cookie Policy</strong>.
                  </span>
                </label>
              </div>

              <button
                id="accept-terms-proceed-profile-btn"
                type="button"
                disabled={
                  !hasReadTermsSection ||
                  !hasReadPrivacySection ||
                  !agreedTermsOfUse ||
                  !agreedPrivacyPolicy
                }
                onClick={handleConfirmLegalAndProceedToProfile}
                style={
                  hasReadTermsSection &&
                  hasReadPrivacySection &&
                  agreedTermsOfUse &&
                  agreedPrivacyPolicy
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
                className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
                  hasReadTermsSection &&
                  hasReadPrivacySection &&
                  agreedTermsOfUse &&
                  agreedPrivacyPolicy
                    ? 'text-white shadow-lg shadow-purple-500/25 hover:brightness-110 active:scale-[0.98] cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept & Proceed to Profile Page</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* POP-UP COOKIES BANNER / MODAL ON LOGIN PAGE WITH ACCEPT OPTION      */}
      {/* ================================================================== */}
      {showCookiePopup && !pendingLegalConsentAuth && !registeredWelcomeUser && (
        <div
          id="login-cookies-popup"
          className="fixed inset-x-0 bottom-0 z-[140] p-3 sm:p-4 flex items-end justify-center pointer-events-none animate-in slide-in-from-bottom-5 duration-200"
        >
          <div
            className={`w-full max-w-md rounded-3xl border p-4 sm:p-5 shadow-2xl pointer-events-auto transition-all ${
              isDark
                ? 'bg-[#161B26]/98 border-slate-700/90 text-slate-100 shadow-black/60'
                : 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-900/20'
            } backdrop-blur-md`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                  <Cookie className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black tracking-tight">
                      Cookies & Privacy Consent
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                      2FA & Session
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {brandConfig.appName} uses cookies to protect your account & preferences
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCookiePopup(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                title="Close cookie notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed mt-2.5">
              We use essential cookies to keep your login session secure, verify Two-Factor
              Authentication (2FA), and remember your mother language & interface settings. Read our{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveFooterTab('terms');
                  setAuthMode('info_page');
                }}
                style={{ color: primaryColor }}
                className="font-bold underline cursor-pointer"
              >
                Terms of Use
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveFooterTab('policy');
                  setAuthMode('info_page');
                }}
                style={{ color: primaryColor }}
                className="font-bold underline cursor-pointer"
              >
                Privacy Policy
              </button>
              .
            </p>

            {/* Optional Cookie Category Toggles */}
            {showCookieCustomize && (
              <div
                className={`mt-3 p-3 rounded-2xl border space-y-2 text-xs ${
                  isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <label className="flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Essential & 2FA Security Cookies</span>
                    <span className="text-[10px] text-slate-400">
                      Required for authentication & session security
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold block">Language & Theme Preferences</span>
                    <span className="text-[10px] text-slate-400">
                      Remembers your mother language & dark/light mode
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cookiePrefs.functional}
                    onChange={(e) =>
                      setCookiePrefs((p) => ({ ...p, functional: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold block">Media & Performance Cache</span>
                    <span className="text-[10px] text-slate-400">
                      Optimizes photo/video studio & live stream loading
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cookiePrefs.analytics}
                    onChange={(e) =>
                      setCookiePrefs((p) => ({ ...p, analytics: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            )}

            {/* Cookie Action Buttons */}
            <div className="mt-3.5 flex items-center gap-2">
              <button
                id="accept-all-cookies-btn"
                type="button"
                onClick={() => handleAcceptCookies(true)}
                style={{ backgroundColor: primaryColor }}
                className="flex-1 py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Accept Cookies</span>
              </button>

              <button
                id="accept-essential-cookies-btn"
                type="button"
                onClick={() => handleAcceptCookies(false)}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                Essential Only
              </button>

              <button
                type="button"
                onClick={() => setShowCookieCustomize(!showCookieCustomize)}
                className="py-2.5 px-2.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showCookieCustomize ? 'Hide' : 'Customize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Page Only Footer with Terms and Conditions, Feedback, Privacy & © Copy Rights Reserved with Year */}
      <AppFooterLinksBar
        onOpenPage={(tab) => {
          setActiveFooterTab(tab);
          setAuthMode('info_page');
        }}
        appName={brandConfig.appName}
        isDark={isDark}
        primaryColor={primaryColor}
      />

      {/* ================================================================== */}
      {/* SET YOUR FINGERPRINT MODAL (Matching Light_18.webp)                 */}
      {/* ================================================================== */}
      <FingerprintSetupModal
        isOpen={isFingerprintModalOpen}
        mode={fingerprintModalMode}
        userId={pendingUserAuth?.user?.id || signInIdentifier || regUsername || 'default_user'}
        userName={pendingUserAuth?.user?.name || regName || signInIdentifier || 'WeedChat User'}
        userEmail={pendingUserAuth?.user?.email || regEmailOrPhone}
        onClose={() => setIsFingerprintModalOpen(false)}
        onSkip={() => setIsFingerprintModalOpen(false)}
        onSuccess={(record) => {
          setFingerprintRecord(record);
          setIsFingerprintModalOpen(false);
          if (authMode === '2fa' && pendingUserAuth) {
            setSuccessMessage('Fingerprint 2FA verified! Proceeding to Terms & Profile...');
            const authData = pendingUserAuth;
            setPendingUserAuth(null);
            setAuthMode('signin');
            openMandatoryLegalReadingGate({
              mode: 'login',
              user: {
                ...authData.user,
                fingerprintEnabled: true,
                fingerprintCredentialId: record.credentialId,
                fingerprintRecordedAt: record.recordedAt,
              },
              isAdmin: authData.isAdmin,
            });
          } else {
            setSuccessMessage(
              `Fingerprint recorded (${record.fingerLabel})! Fingerprint 2FA is now active.`
            );
          }
        }}
      />

      {/* ================================================================== */}
      {/* 2FA VERIFICATION STEP MODAL (Using Firebase Auth)                  */}
      {/* ================================================================== */}
      {pendingUserAuth && (
        <TwoFactorVerificationModal
          isOpen={isTwoFactorModalOpen}
          onClose={handleTwoFactorModalClose}
          pendingUser={pendingUserAuth.user}
          isAdmin={pendingUserAuth.isAdmin}
          secret={pendingUserAuth.secret}
          backupCodes={pendingUserAuth.backupCodes}
          onVerifySuccess={handleTwoFactorModalSuccess}
          primaryColor={primaryColor}
          theme={theme}
        />
      )}
    </div>
  );
};
