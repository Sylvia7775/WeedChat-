import React, { useState } from 'react';
import {
  Info,
  FileText,
  MessageSquarePlus,
  Briefcase,
  ShieldCheck,
  X,
  ArrowLeft,
  Globe,
  Lock,
  Sparkles,
  Star,
  Send,
  CheckCircle2,
  Users,
  Video,
  Smartphone,
  Heart,
  MapPin,
  Clock,
  ExternalLink,
  Phone,
  Copy,
  Building2,
  Mail,
  Edit2,
  Save,
  Plus,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { AppBrandConfig, FooterPageTab, ThemeMode } from '../types';
import { FreedomLogo } from './FreedomLogo';
import { StatusBar } from './StatusBar';
import { OFFICIAL_MESSAGE_POLICY } from '../lib/messagePolicy';

interface FeedbackItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  message: string;
  createdAt: string;
}

const INITIAL_FEEDBACK_LIST: FeedbackItem[] = [
  {
    id: 'fb_1',
    name: 'Kristin Watson',
    category: 'Translation Quality',
    rating: 5,
    message: 'Real-time mother language translation in group chats works seamlessly across Spanish and English!',
    createdAt: '2 hours ago',
  },
  {
    id: 'fb_2',
    name: 'Jacob Jones',
    category: 'Feature Request',
    rating: 5,
    message: 'Love the new Group Media Gallery and automatic video platform thumbnails without cluttering the chat.',
    createdAt: 'Yesterday',
  },
];

const OPEN_CAREER_ROLES = [
  {
    id: 'role_cordova_android',
    title: 'Senior Android & Apache Cordova Engineer',
    department: 'Mobile Engineering',
    location: 'Remote (Worldwide)',
    type: 'Full-Time',
    compensation: '$145k – $175k + Equity',
    summary:
      'Lead native Android APK build pipelines, WebRTC voice/video media acceleration, and offline-first storage.',
  },
  {
    id: 'role_ai_translation',
    title: 'Real-Time Multilingual NLP Engineer',
    department: 'AI & Translation',
    location: 'Remote (Europe / Americas / Asia)',
    type: 'Full-Time',
    compensation: '$155k – $190k + Equity',
    summary:
      'Optimize low-latency neural translation and voice note transcription across 40+ global languages.',
  },
  {
    id: 'role_product_design',
    title: 'Senior Mobile Product Designer',
    department: 'Design & UX',
    location: 'Remote (Worldwide)',
    type: 'Full-Time',
    compensation: '$130k – $160k + Equity',
    summary:
      'Craft intuitive, accessible messaging, group collaboration, and media player experiences.',
  },
  {
    id: 'role_trust_safety',
    title: 'Community Trust, Privacy & Safety Specialist',
    department: 'Trust & Security',
    location: 'Remote',
    type: 'Full-Time',
    compensation: '$110k – $135k + Equity',
    summary:
      'Champion user privacy, end-to-end encryption standards, and group moderation tooling.',
  },
];

interface AboutAndFooterPagesViewProps {
  activeTab: FooterPageTab;
  onSelectTab: (tab: FooterPageTab) => void;
  onClose: () => void;
  brandConfig: AppBrandConfig;
  theme?: ThemeMode;
  primaryColor?: string;
  isModal?: boolean;
}

export const AboutAndFooterPagesView: React.FC<AboutAndFooterPagesViewProps> = ({
  activeTab,
  onSelectTab,
  onClose,
  brandConfig,
  theme = 'dark',
  primaryColor = '#7C3AED',
  isModal = false,
}) => {
  const isDark = theme === 'dark';
  const currentYear = new Date().getFullYear();

  // Feedback form state
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('General Praise');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmittedToast, setFeedbackSubmittedToast] = useState<string | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(() => {
    try {
      const saved = localStorage.getItem('freedom_user_feedback_submissions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_FEEDBACK_LIST;
  });

  // Careers application state
  const [applyingRoleId, setApplyingRoleId] = useState<string | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPortfolio, setApplicantPortfolio] = useState('');
  const [applicantNote, setApplicantNote] = useState('');
  const [careerSubmittedToast, setCareerSubmittedToast] = useState<string | null>(null);

  // Editable About Page Email, Phone Number & About Links state
  const [aboutEmail, setAboutEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('freedom_about_page_email') || 'MobilePhonesky987@gmail.com';
    } catch {
      return 'MobilePhonesky987@gmail.com';
    }
  });
  const [aboutPhone, setAboutPhone] = useState<string>(() => {
    try {
      return localStorage.getItem('freedom_about_page_phone') || '0818009307';
    } catch {
      return '0818009307';
    }
  });
  const [aboutLinks, setAboutLinks] = useState<{ label: string; url: string }[]>(() => {
    try {
      const saved = localStorage.getItem('freedom_about_page_links');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [
      { label: 'Official Website', url: 'https://weedchat.io' },
      { label: 'Support & Help Center', url: 'https://support.weedchat.io' },
      { label: 'Community Hub', url: 'https://community.weedchat.io' },
    ];
  });
  const [isEditingAboutInfo, setIsEditingAboutInfo] = useState(false);
  const [draftAboutEmail, setDraftAboutEmail] = useState(aboutEmail);
  const [draftAboutPhone, setDraftAboutPhone] = useState(aboutPhone);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [editingAboutLinkIdx, setEditingAboutLinkIdx] = useState<number | null>(null);
  const [aboutSavedToast, setAboutSavedToast] = useState<string | null>(null);

  const handleSaveAboutContactInfo = () => {
    const cleanMail = draftAboutEmail.trim() || 'MobilePhonesky987@gmail.com';
    const cleanTel = draftAboutPhone.trim() || '0818009307';
    setAboutEmail(cleanMail);
    setAboutPhone(cleanTel);
    setIsEditingAboutInfo(false);
    try {
      localStorage.setItem('freedom_about_page_email', cleanMail);
      localStorage.setItem('freedom_about_page_phone', cleanTel);
    } catch {}
    setAboutSavedToast('Saved Email & Phone number!');
    setTimeout(() => setAboutSavedToast(null), 2800);
  };

  const handleSaveAboutLinkItem = () => {
    if (!newLinkUrl.trim()) return;
    const rawUrl = newLinkUrl.trim();
    const formattedUrl =
      rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `https://${rawUrl}`;
    const item = {
      label: newLinkLabel.trim() || rawUrl,
      url: formattedUrl,
    };
    const nextLinks =
      editingAboutLinkIdx !== null
        ? aboutLinks.map((l, idx) => (idx === editingAboutLinkIdx ? item : l))
        : [...aboutLinks, item];
    setAboutLinks(nextLinks);
    setNewLinkLabel('');
    setNewLinkUrl('');
    setEditingAboutLinkIdx(null);
    try {
      localStorage.setItem('freedom_about_page_links', JSON.stringify(nextLinks));
    } catch {}
    setAboutSavedToast(editingAboutLinkIdx !== null ? 'Updated About link!' : 'Added About link!');
    setTimeout(() => setAboutSavedToast(null), 2600);
  };

  const handleDeleteAboutLinkItem = (idxToRemove: number) => {
    const nextLinks = aboutLinks.filter((_, idx) => idx !== idxToRemove);
    setAboutLinks(nextLinks);
    try {
      localStorage.setItem('freedom_about_page_links', JSON.stringify(nextLinks));
    } catch {}
    setAboutSavedToast('Removed About link');
    setTimeout(() => setAboutSavedToast(null), 2400);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    const newItem: FeedbackItem = {
      id: `fb_${Date.now()}`,
      name: feedbackName.trim() || 'Community Member',
      category: feedbackCategory,
      rating: feedbackRating,
      message: feedbackMessage.trim(),
      createdAt: 'Just now',
    };
    const nextList = [newItem, ...feedbackList];
    setFeedbackList(nextList);
    try {
      localStorage.setItem('freedom_user_feedback_submissions', JSON.stringify(nextList.slice(0, 25)));
    } catch {}
    setFeedbackMessage('');
    setFeedbackSubmittedToast('Thank you! Your feedback has been submitted to the Freedom team.');
    setTimeout(() => setFeedbackSubmittedToast(null), 3500);
  };

  const handleCareerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantEmail.trim()) return;
    const role = OPEN_CAREER_ROLES.find((r) => r.id === applyingRoleId);
    setCareerSubmittedToast(
      `Application submitted for ${role?.title || 'Open Role'}! Our recruiting team will reach out to ${applicantEmail.trim()}.`
    );
    setApplyingRoleId(null);
    setApplicantName('');
    setApplicantEmail('');
    setApplicantPortfolio('');
    setApplicantNote('');
    setTimeout(() => setCareerSubmittedToast(null), 4000);
  };

  const TABS: { id: FooterPageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'about', label: 'About', icon: <Info className="w-3.5 h-3.5" /> },
    { id: 'terms', label: 'Terms and Conditions', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquarePlus className="w-3.5 h-3.5" /> },
    { id: 'policy', label: 'Privacy', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  const content = (
    <div
      id="about-and-footer-pages-container"
      className={`w-full h-full flex flex-col select-none transition-colors duration-200 ${
        isDark ? 'bg-[#0E121A] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {!isModal && <StatusBar theme={theme} />}

      {/* Top Navigation Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0 ${
          isDark ? 'bg-[#141923] border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            id="about-page-back-btn"
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold tracking-tight truncate">
              {brandConfig.appName} • Chat-blizz, Inc
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              About, Terms and Conditions, Feedback & Privacy
            </p>
          </div>
        </div>

        <button
          id="about-page-close-btn"
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Horizontal Page Switcher Tabs */}
      <div
        className={`px-4 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 ${
          isDark ? 'bg-[#111620] border-slate-800/80' : 'bg-slate-100/80 border-slate-200'
        }`}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`footer-page-tab-${tab.id}`}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              style={isActive ? { backgroundColor: primaryColor } : undefined}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'text-white shadow-sm'
                  : isDark
                  ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 border border-slate-200/70'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Scrollable Page Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-2xl w-full mx-auto">
        {/* ============================================================ */}
        {/* 1. ABOUT PAGE (Chat-blizz, Inc • Contact 0818009307)         */}
        {/* ============================================================ */}
        {activeTab === 'about' && (
          <div id="page-content-about" className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-5 rounded-3xl border text-center space-y-3 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex justify-center">
                <FreedomLogo
                  appName={brandConfig.appName}
                  customFavicon={brandConfig.faviconUrl}
                  primaryColor={primaryColor}
                  size="lg"
                  theme={theme}
                  showText={false}
                />
              </div>
              <div>
                <span
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                >
                  Official Company Profile
                </span>
                <h1 className="text-xl font-black tracking-tight mt-1.5">
                  Chat-blizz, Inc
                </h1>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  {brandConfig.appDescription ||
                    'Powered by Chat-blizz, Inc — connecting people globally across languages with real-time multilingual messaging, voice & video calling, and secure collaboration.'}
                </p>
              </div>
            </div>

            {/* Official Company & Contact Card: Chat-blizz, Inc • 0818009307 */}
            <div
              id="about-chat-blizz-contact-card"
              className={`p-5 rounded-3xl border space-y-3.5 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black tracking-tight">Chat-blizz, Inc</h2>
                    <p className="text-[11px] text-slate-400">
                      Corporate Headquarters & Official Support Contact
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="about-edit-contact-info-btn"
                    type="button"
                    onClick={() => {
                      setDraftAboutEmail(aboutEmail);
                      setDraftAboutPhone(aboutPhone);
                      setIsEditingAboutInfo(!isEditingAboutInfo);
                    }}
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    className="px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 cursor-pointer hover:brightness-110"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingAboutInfo ? 'Cancel Edit' : 'Edit Email & Phone'}</span>
                  </button>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-extrabold">
                    Verified Organization
                  </span>
                </div>
              </div>

              {aboutSavedToast && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{aboutSavedToast}</span>
                </div>
              )}

              {isEditingAboutInfo && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold" style={{ color: primaryColor }}>
                    Edit Contact Email & Phone Number
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Email Address
                      </label>
                      <input
                        id="about-edit-email-input"
                        type="email"
                        value={draftAboutEmail}
                        onChange={(e) => setDraftAboutEmail(e.target.value)}
                        placeholder="Email address"
                        className={`w-full px-3 py-1.5 rounded-xl text-xs font-mono border outline-none ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Phone Number
                      </label>
                      <input
                        id="about-edit-phone-input"
                        type="tel"
                        value={draftAboutPhone}
                        onChange={(e) => setDraftAboutPhone(e.target.value)}
                        placeholder="Phone number"
                        className={`w-full px-3 py-1.5 rounded-xl text-xs font-mono border outline-none ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingAboutInfo(false)}
                      className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="about-save-contact-info-btn"
                      type="button"
                      onClick={handleSaveAboutContactInfo}
                      style={{ backgroundColor: primaryColor }}
                      className="px-3 py-1 rounded-lg text-white text-xs font-bold flex items-center gap-1 cursor-pointer hover:brightness-110"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Company Name Box */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                      Company
                    </span>
                    <span className="text-xs font-extrabold">Chat-blizz, Inc</span>
                  </div>
                </div>

                {/* Contact Phone Number Box */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                        Phone Number
                      </span>
                      <a
                        id="about-contact-phone-link"
                        href={`tel:${aboutPhone}`}
                        className="text-xs font-mono font-extrabold text-emerald-500 hover:underline truncate block"
                      >
                        {aboutPhone}
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(aboutPhone);
                      } catch {}
                    }}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    title="Copy contact number"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {/* Contact Email Box */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                        Email Address
                      </span>
                      <a
                        id="about-contact-email-link"
                        href={`mailto:${aboutEmail}`}
                        className="text-xs font-mono font-extrabold text-sky-400 hover:underline truncate block"
                      >
                        {aboutEmail}
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(aboutEmail);
                      } catch {}
                    }}
                    className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    title="Copy email address"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Editable About Links Section */}
              <div
                id="about-page-editable-links-card"
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Globe style={{ color: primaryColor }} className="w-4 h-4" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      About Links
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Add, edit or remove official About links
                  </span>
                </div>

                {/* Links List */}
                <div className="flex flex-wrap items-center gap-2">
                  {aboutLinks.map((lnk, idx) => (
                    <div
                      key={`${lnk.label}-${idx}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                        isDark
                          ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <a
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span>{lnk.label}</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAboutLinkIdx(idx);
                          setNewLinkLabel(lnk.label);
                          setNewLinkUrl(lnk.url);
                        }}
                        className="ml-1 p-1 rounded-full hover:bg-purple-500/20 text-purple-400 cursor-pointer"
                        title="Edit link"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAboutLinkItem(idx)}
                        className="p-1 rounded-full hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                        title="Delete link"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add / Edit About Link Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder="Link title (e.g. Official Blog)"
                    className={`px-3 py-1.5 rounded-xl text-xs border outline-none ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <input
                    type="text"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="URL (e.g. https://weedchat.io)"
                    className={`px-3 py-1.5 rounded-xl text-xs border outline-none ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveAboutLinkItem}
                      disabled={!newLinkUrl.trim()}
                      style={newLinkUrl.trim() ? { backgroundColor: primaryColor } : undefined}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                        newLinkUrl.trim()
                          ? 'text-white hover:brightness-110'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingAboutLinkIdx !== null ? 'Update Link' : 'Add Link'}</span>
                    </button>
                    {editingAboutLinkIdx !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAboutLinkIdx(null);
                          setNewLinkLabel('');
                          setNewLinkUrl('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Google Maps & Additional Details Section (Ready for later expansion) */}
              <div
                id="about-google-maps-later-slot"
                className={`p-3.5 rounded-2xl border border-dashed flex items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-slate-900/40 border-slate-700/80 text-slate-300'
                    : 'bg-slate-50/80 border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold block">
                      Location & Google Maps Integration
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Chat-blizz, Inc • Contact: 0818009307 (Google Maps & additional details will be added here)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. TERMS AND CONDITIONS PAGE                                 */}
        {/* ============================================================ */}
        {activeTab === 'terms' && (
          <div id="page-content-terms" className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-5 rounded-3xl border space-y-4 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200 dark:border-slate-800">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-black">Terms and Conditions</h1>
                  <p className="text-[11px] text-slate-400">
                    Effective Date: January 1, {currentYear} • Last Updated: October {currentYear}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-300 dark:text-slate-300">
                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">1. Acceptance of Terms</h3>
                  <p className="text-[11px] text-slate-400">
                    By accessing or using {brandConfig.appName}, you agree to be bound by these Terms and Conditions and our Privacy Policy. Our platform provides real-time multilingual messaging, voice/video calling, and group collaboration.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">2. Account Security & Two-Factor Authentication</h3>
                  <p className="text-[11px] text-slate-400">
                    Users are responsible for safeguarding their login credentials and Two-Factor Authentication (2FA) recovery codes. Administrative portals are strictly restricted to authorized administrators.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">3. Group Conduct & Content Sharing</h3>
                  <p className="text-[11px] text-slate-400">
                    Group media shared inside a group gallery is restricted to members of that group. Group Administrators and Moderators have authority to remove, temporarily suspend, or ban accounts that violate community standards.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">4. Intellectual Property & Copyright</h3>
                  <p className="text-[11px] text-slate-400">
                    All platform branding, logos, custom sticker packs, and software architecture are protected by international copyright laws (© {currentYear} {brandConfig.appName}). Users retain ownership of their personal photos and media uploads.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. FEEDBACK PAGE                                             */}
        {/* ============================================================ */}
        {activeTab === 'feedback' && (
          <div id="page-content-feedback" className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-5 rounded-3xl border space-y-4 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <MessageSquarePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base font-black">User Feedback & Suggestions</h1>
                    <p className="text-[11px] text-slate-400">
                      Help us improve {brandConfig.appName} • Share your ideas or report issues
                    </p>
                  </div>
                </div>
              </div>

              {feedbackSubmittedToast && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{feedbackSubmittedToast}</span>
                </div>
              )}

              <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={feedbackName}
                      onChange={(e) => setFeedbackName(e.target.value)}
                      placeholder="e.g. Abdullah"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Category
                    </label>
                    <select
                      value={feedbackCategory}
                      onChange={(e) => setFeedbackCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="General Praise">General Praise</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="Translation Quality">Translation Quality</option>
                      <option value="Video & Media Player">Video & Media Player</option>
                      <option value="Bug Report">Bug Report</option>
                    </select>
                  </div>
                </div>

                {/* Star Rating */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Rate your experience:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 cursor-pointer hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= feedbackRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Your Feedback Message
                  </label>
                  <textarea
                    rows={3}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Tell us what you love or what features you'd like to see next..."
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium border outline-none ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <button
                  id="submit-feedback-btn"
                  type="submit"
                  style={{ backgroundColor: primaryColor }}
                  className="w-full py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Feedback</span>
                </button>
              </form>
            </div>

            {/* Recent Community Feedback */}
            <div
              className={`p-4 rounded-3xl border space-y-2.5 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Recent Community Feedback ({feedbackList.length})
              </h3>
              <div className="space-y-2">
                {feedbackList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border space-y-1 ${
                      isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{item.name}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-purple-500/15 text-purple-400 font-bold">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold">
                        {'★'.repeat(item.rating)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">{item.message}</p>
                    <span className="text-[10px] text-slate-500 block">{item.createdAt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. CAREERS PAGE                                              */}
        {/* ============================================================ */}
        {activeTab === 'careers' && (
          <div id="page-content-careers" className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-5 rounded-3xl border space-y-3 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                >
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-black">Careers at {brandConfig.appName}</h1>
                  <p className="text-[11px] text-slate-400">
                    Join our global remote team building the future of multilingual communication
                  </p>
                </div>
              </div>

              {careerSubmittedToast && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{careerSubmittedToast}</span>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                {OPEN_CAREER_ROLES.map((role) => (
                  <div
                    key={role.id}
                    className={`p-3.5 rounded-2xl border space-y-2 ${
                      isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-extrabold">{role.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-semibold text-emerald-400">{role.department}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {role.location}
                          </span>
                          <span>•</span>
                          <span>{role.compensation}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setApplyingRoleId(applyingRoleId === role.id ? null : role.id)
                        }
                        style={{ backgroundColor: primaryColor }}
                        className="px-3 py-1.5 rounded-xl text-white text-[11px] font-bold shrink-0 cursor-pointer hover:brightness-110"
                      >
                        {applyingRoleId === role.id ? 'Close' : 'Apply Now'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{role.summary}</p>

                    {applyingRoleId === role.id && (
                      <form
                        onSubmit={handleCareerSubmit}
                        className="pt-2.5 mt-2 border-t border-slate-800 space-y-2 animate-in fade-in"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            value={applicantName}
                            onChange={(e) => setApplicantName(e.target.value)}
                            placeholder="Full Name"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                          <input
                            type="email"
                            required
                            value={applicantEmail}
                            onChange={(e) => setApplicantEmail(e.target.value)}
                            placeholder="Email Address"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={applicantPortfolio}
                          onChange={(e) => setApplicantPortfolio(e.target.value)}
                          placeholder="GitHub / LinkedIn / Portfolio URL (Optional)"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                        <button
                          type="submit"
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Submit Application
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. PRIVACY & SECURITY POLICY PAGE                            */}
        {/* ============================================================ */}
        {activeTab === 'policy' && (
          <div id="page-content-policy" className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-5 rounded-3xl border space-y-4 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200 dark:border-slate-800">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-black">Privacy & Security Policy</h1>
                  <p className="text-[11px] text-slate-400">
                    End-to-End Encryption, Online Status Privacy & Data Protection
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">1. Online Status & Presence Privacy</h3>
                  <p className="text-[11px] text-slate-400">
                    You have full control over your visibility. Using the <strong>"Hide online status"</strong> toggle in App Settings → Privacy, you can conceal your live online indicator from contacts and groups while continuing to use the app seamlessly.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">2. End-to-End Encryption & PIN Locks</h3>
                  <p className="text-[11px] text-slate-400">
                    Private messages, voice notes, and calls are protected with modern cryptographic protocols. Individual messages can also be locked with a personal 4-digit PIN.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60">
                  <h3 className="font-extrabold text-white mb-1">3. Uploaded Avatars & Media Storage</h3>
                  <p className="text-[11px] text-slate-400">
                    Uploaded profile avatars, covers, wallpapers, and shared media are stored securely for your account and synced with your Firebase profile state. We never sell user data or media to third-party advertisers.
                  </p>
                </div>

                {/* Official Message Policy Section */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h2 className="text-sm font-black tracking-tight">Official Message Policy</h2>
                  {OFFICIAL_MESSAGE_POLICY.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-3 rounded-2xl bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800/60 space-y-1.5"
                    >
                      <h3 className="font-extrabold text-white">{sec.title}</h3>
                      <p className="text-[11px] text-slate-400">{sec.summary}</p>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                        {sec.rules.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 6. PUBLIC FAQ PAGE (Accessible to everyone from Login Footer) */}
        {/* ============================================================ */}
        {activeTab === 'faq' && (
          <div id="page-content-faq" className="space-y-4 animate-in fade-in duration-150">
            <div
              className={`p-5 rounded-3xl border space-y-4 ${
                isDark ? 'bg-[#171C28] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200 dark:border-slate-800">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                >
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-black">Frequently Asked Questions (FAQ)</h1>
                  <p className="text-[11px] text-slate-400">
                    Public Guide: Registration, Profile, Message, Channels, Media & Delete Account
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                {/* 1. Registration */}
                <div
                  id="faq-section-registration"
                  className={`p-3.5 rounded-2xl border space-y-1.5 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h3 className="font-extrabold text-sm" style={{ color: primaryColor }}>
                    1. Registration
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    <strong>How do I register a new account?</strong> On the Login page, select the{' '}
                    <strong>Register</strong> tab, enter your Full Name, unique @username, optional email or phone number, and password, or sign in with Google / supported providers. Upon registration, you are automatically directed to your Profile page and receive a welcome notification on your Chats icon.
                  </p>
                </div>

                {/* 2. Profile */}
                <div
                  id="faq-section-profile"
                  className={`p-3.5 rounded-2xl border space-y-1.5 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h3 className="font-extrabold text-sm" style={{ color: primaryColor }}>
                    2. Profile
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    <strong>How do I customize my Profile?</strong> After logging in, you land directly on your Profile page where you can upload your avatar from your device or via an image URL, set your profile cover banner, edit your @username, bio, age, gender, mother language, social links, privacy settings ("Hide online status"), and configure real Authenticator 2FA or Fingerprint biometric security.
                  </p>
                </div>

                {/* 3. Message */}
                <div
                  id="faq-section-message"
                  className={`p-3.5 rounded-2xl border space-y-1.5 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h3 className="font-extrabold text-sm" style={{ color: primaryColor }}>
                    3. Message
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    <strong>How do messages, translations, and chat wallpapers work?</strong> You can send text messages, voice notes with Al Germain voice translation, stickers, and media in real time. From the chat menu, you can search in conversation, view Profile, Friends, Media, toggle "Video auto Play :off", and click "wallpaper" to upload a chat background. When you upload a new wallpaper in a 2-participant chat, it displays as the current wallpaper for both chatting participants—and only shows a different wallpaper to the other participant when she uploads her own different wallpaper picture.
                  </p>
                </div>

                {/* 4. Channels */}
                <div
                  id="faq-section-channels"
                  className={`p-3.5 rounded-2xl border space-y-1.5 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h3 className="font-extrabold text-sm" style={{ color: primaryColor }}>
                    4. Channels
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    <strong>How do Channels and Groups work?</strong> Channels and Groups feature full-bleed cover banners with overlapping circular avatars, subscriber/member counts, live stream chat ("live"), and admin moderation controls. Anyone can subscribe to public channels or join groups to follow broadcasts and media updates.
                  </p>
                </div>

                {/* 5. Media */}
                <div
                  id="faq-section-media"
                  className={`p-3.5 rounded-2xl border space-y-1.5 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h3 className="font-extrabold text-sm" style={{ color: primaryColor }}>
                    5. Media
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    <strong>How do I upload, browse, and share Media?</strong> Use the camera upload icon in your User Media Gallery to upload photos and videos, save your media session automatically, set any gallery picture as your avatar or profile cover, or share media directly into conversations. When friends like media files or befriend someone, you receive an activity notification on your Chats icon.
                  </p>
                </div>

                {/* 6. Delete Account */}
                <div
                  id="faq-section-delete-account"
                  className={`p-3.5 rounded-2xl border space-y-1.5 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h3 className="font-extrabold text-sm text-rose-500">
                    6. Delete Account
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    <strong>How can I permanently delete my account?</strong> Open your Profile page, scroll to the bottom <strong>Delete My Account</strong> section, click <strong>Delete My Account</strong>, type <strong>DELETE</strong> to confirm, and submit. Your profile, session, and account data will be permanently removed from the platform and database.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Bar with Page Links & © Copyright Year */}
      <AppFooterLinksBar
        onOpenPage={(tab) => onSelectTab(tab)}
        activeTab={activeTab}
        appName={brandConfig.appName}
        isDark={isDark}
        primaryColor={primaryColor}
      />
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-2xl h-[92vh] rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

interface AppFooterLinksBarProps {
  onOpenPage: (tab: FooterPageTab) => void;
  activeTab?: FooterPageTab | null;
  appName?: string;
  isDark?: boolean;
  primaryColor?: string;
  compact?: boolean;
}

export const AppFooterLinksBar: React.FC<AppFooterLinksBarProps> = ({
  onOpenPage,
  activeTab = null,
  appName = 'WeedChat',
  isDark = true,
  primaryColor = '#7C3AED',
  compact = false,
}) => {
  const currentYear = new Date().getFullYear();

  const links: { id: FooterPageTab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'terms', label: 'Terms and Conditions' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'policy', label: 'Privacy' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <footer
      id="login-page-only-footer"
      className={`w-full px-4 ${
        compact ? 'py-2' : 'py-3'
      } border-t text-center select-none shrink-0 transition-colors ${
        isDark
          ? 'bg-[#0E121A] border-slate-800/80 text-slate-400'
          : 'bg-slate-50 border-slate-200/80 text-slate-500'
      }`}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-semibold">
        {links.map((link, idx) => (
          <React.Fragment key={link.id}>
            <button
              id={`footer-link-${link.id}`}
              type="button"
              onClick={() => onOpenPage(link.id)}
              style={activeTab === link.id ? { color: primaryColor } : undefined}
              className={`hover:underline cursor-pointer transition-colors ${
                activeTab === link.id
                  ? 'font-extrabold underline'
                  : isDark
                  ? 'text-slate-300 hover:text-emerald-400'
                  : 'text-slate-600 hover:text-emerald-600'
              }`}
            >
              {link.label}
            </button>
            {idx < links.length - 1 && (
              <span className="text-slate-600 dark:text-slate-700 select-none">•</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 flex-wrap">
        <span>
          © {currentYear} {appName} • Copy Rights Reserved
        </span>
      </div>
    </footer>
  );
};
