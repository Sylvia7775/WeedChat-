import React, { useState, useEffect, useMemo } from 'react';
import {
  ScreenView,
  PresentationMode,
  ThemeMode,
  UserContact,
  UserProfile,
  ChatMessage,
  CallLog,
  AppBrandConfig,
  BannedUser,
  ReportedUser,
  StickerItem,
  GroupParticipant,
  FooterPageTab,
} from './types';
import {
  INITIAL_CONTACTS,
  INITIAL_KRISTIN_MESSAGES,
  INITIAL_GROUP_MESSAGES,
  INITIAL_CALLS,
  DEFAULT_BRAND_CONFIG,
  INITIAL_BANNED_USERS,
  INITIAL_REPORTED_USERS,
  ADMIN_CREDENTIALS,
} from './data/mockData';
import {
  getInitialsAvatar,
  getCleanAvatar,
  getSavedAvatarRecord,
  saveUserAvatarLocally,
  getPersistentUserThumbnail,
  isUploadedRealAvatar,
} from './lib/avatarHelper';
import { StatusScreen } from './components/StatusScreen';
import {
  detectVideoPlatformFromText,
  stripVideoUrlsFromText,
} from './lib/videoPlatformHelper';
import { OnboardingScreen } from './components/OnboardingScreen';
import { LoginPage } from './components/LoginPage';
import { PasswordResetPage } from './components/PasswordResetPage';
import { playDefaultAppNotificationBell } from './lib/notificationSound';
import {
  FriendInvitationRecord,
  canUserSeeAndAcceptInvitation,
  saveFriendInvitation,
  subscribeFriendInvitationsFromDb,
} from './lib/friendInvitationAccess';
import {
  OFFICIAL_WELCOME_MESSAGE_TEXT,
  sendAutomaticWelcomeNotificationToChatsIcon,
  notifyChatsIconFriendBefriended,
  notifyChatsIconFriendLikedMedia,
} from './lib/chatIconNotificationsHelper';
import { ChatsListScreen } from './components/ChatsListScreen';
import { ActiveChatScreen } from './components/ActiveChatScreen';
import { PeopleScreen } from './components/PeopleScreen';
import { CallsScreen } from './components/CallsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ActiveCallModal } from './components/ActiveCallModal';
import { PhoneFrame } from './components/PhoneFrame';
import { MockupShowcaseView } from './components/MockupShowcaseView';
import { NewChatModal } from './components/NewChatModal';
import { FreedomLogo } from './components/FreedomLogo';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { ImportContactsModal } from './components/ImportContactsModal';
import { ImportWhatsAppModal } from './components/ImportWhatsAppModal';
import { QrCodeScannerModal } from './components/QrCodeScannerModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AdminControlPanel } from './components/AdminControlPanel';
import { AdminAuthModal } from './components/AdminAuthModal';
import { PodcastScreen } from './components/PodcastScreen';
import {
  Smartphone,
  LayoutGrid,
  Maximize2,
  Moon,
  Sun,
  RotateCcw,
  Sparkles,
  Database,
  User,
  Shield,
  ShieldCheck,
  Lock,
  QrCode,
  LogIn,
  LogOut,
} from 'lucide-react';
import {
  seedInitialUsersIfEmpty,
  subscribeUsersFromDb,
  isExampleUserRecord,
  subscribeUserProfile,
  saveUserProfileToDb,
  subscribeAppBrandConfig,
  saveAppBrandConfigToDb,
  subscribeBannedUsers,
  banUserInDb,
  unbanUserInDb,
  blockUserInDb,
  subscribeReportedUsers,
  addReportedUserInDb,
  updateReportStatusInDb,
  subscribeAppStickers,
  uploadAdminStickerToDb,
  getTodayStickersUploadCount,
  deleteAppStickerInDb,
  toggleArchiveUserChatInDb,
  deleteUserChatInDb,
  restoreDeletedChatInDb,
  togglePinUserChatInDb,
  markChatReadStatusInDb,
  saveMediaInteractionInDb,
  getMediaInteractionFromDb,
  syncTypingIndicatorToDb,
  subscribeTypingIndicatorFromDb,
  saveContactOrChannelToDb,
  logoutAdminEverywhereInDb,
} from './lib/firebase';

export default function App() {
  // App initial loading splash screen state: always show loading page first when opening app
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);

  // Force user to login before accessing the chats page (Admin logged out everywhere)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Navigation & View Mode: always start on login page after loading screen until user logs in
  const [currentScreen, setCurrentScreen] = useState<ScreenView>('login');
  const [presentationMode, setPresentationMode] = useState<PresentationMode>('single_phone');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [motherLanguage, setMotherLanguage] = useState<string>('English');
  const [brandConfig, setBrandConfig] = useState<AppBrandConfig>(DEFAULT_BRAND_CONFIG);

  // Global Toast Notification & Admin Auth State (declared at top before any effects or handlers)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>(INITIAL_BANNED_USERS);
  const [reportedUsers, setReportedUsers] = useState<ReportedUser[]>(INITIAL_REPORTED_USERS);
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const adminEmail = ADMIN_CREDENTIALS.email;

  const handleNavigateScreen = (screen: ScreenView, _footerTab?: FooterPageTab) => {
    if (
      !isAuthenticated &&
      screen !== 'login' &&
      screen !== 'password_reset' &&
      screen !== 'onboarding'
    ) {
      setCurrentScreen('login');
      setToastMessage('🔒 Login Required: Please sign in or create an account before accessing Chats.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    if (screen === 'admin' && !isAdminVerified) {
      setIsAdminAuthModalOpen(true);
      return;
    }
    setCurrentScreen(screen);
  };

  // Logout Admin everywhere on startup and enforce Login Page before accessing Chats
  useEffect(() => {
    logoutAdminEverywhereInDb().catch(() => {});
  }, []);

  // Enforce Login Page as Front Page: Force everyone to see login page when logged out or not registered
  useEffect(() => {
    if (
      !isAuthenticated &&
      currentScreen !== 'login' &&
      currentScreen !== 'password_reset' &&
      currentScreen !== 'onboarding'
    ) {
      setCurrentScreen('login');
    }
  }, [isAuthenticated, currentScreen]);

  // Auth Action Handlers
  const handleLoginSuccess = (user?: Partial<UserProfile>, isAdmin?: boolean) => {
    setIsAuthenticated(true);
    localStorage.setItem('freedom_user_authenticated', 'true');
    const isSuperAdmin =
      isAdmin === true ||
      user?.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase();

    if (isSuperAdmin) {
      setIsAdminVerified(true);
      localStorage.setItem('freedom_admin_verified_v4', 'true');
    } else {
      setIsAdminVerified(false);
      localStorage.removeItem('freedom_admin_verified_v4');
    }

    if (user) {
      const cleanName = user.name || 'WeedChat User';
      const cleanUsername = (
        user.username ||
        cleanName.toLowerCase().replace(/\s+/g, '_')
      ).replace(/^@+/, '');
      const resolvedId = user.id || `usr_${cleanUsername}`;
      const resolvedAvatar =
        user.avatar || getInitialsAvatar(cleanName, '#7C3AED');
      const fullSessionUser: UserProfile = {
        id: resolvedId,
        name: cleanName,
        username: cleanUsername,
        email: user.email || `${cleanUsername}@weedchat.app`,
        phoneNumber: user.phoneNumber,
        avatar: resolvedAvatar,
        bio:
          user.bio ||
          `Freedom talk in ${user.motherLanguage || motherLanguage || 'English'} 🕊️`,
        location: user.location || 'New York,NY',
        motherLanguage: user.motherLanguage || motherLanguage || 'English',
        isOnline: true,
        hideOnlineStatus: false,
        avatarShape: 'round',
      };
      setCurrentUser(fullSessionUser);
      if (fullSessionUser.motherLanguage) {
        setMotherLanguage(fullSessionUser.motherLanguage);
      }
      try {
        localStorage.setItem('freedom_current_user_id', resolvedId);
        localStorage.setItem(
          'freedom_current_user_profile',
          JSON.stringify(fullSessionUser)
        );
        localStorage.setItem(
          'freedom_active_user_session_v4',
          JSON.stringify(fullSessionUser)
        );
      } catch {}

      // Ensure new user receives automatic Welcome Message notification on the Chats icon
      const sentWelcomeNotif = sendAutomaticWelcomeNotificationToChatsIcon({
        userId: resolvedId,
        userName: cleanName,
      });
      if (sentWelcomeNotif) {
        setContacts((prev) =>
          prev.map((c, idx) =>
            idx === 0
              ? {
                  ...c,
                  lastMessage: OFFICIAL_WELCOME_MESSAGE_TEXT,
                  time: 'Just now',
                  unreadCount: (c.unreadCount || 0) + 1,
                }
              : c
          )
        );
      }
    }
    // Direct user to their Profile page after login and accepting Terms of Use & Privacy Policy
    setCurrentScreen('profile');
    setToastMessage(`Welcome${user?.name ? `, ${user.name}` : ''}! Directed to your Profile page.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRegisterSuccess = async (newUser: UserProfile) => {
    setIsAuthenticated(true);
    setIsAdminVerified(false);
    localStorage.removeItem('freedom_admin_verified_v4');
    localStorage.setItem('freedom_user_authenticated', 'true');
    localStorage.setItem('freedom_current_user_id', newUser.id);
    try {
      localStorage.setItem('freedom_current_user_profile', JSON.stringify(newUser));
      localStorage.setItem('freedom_active_user_session_v4', JSON.stringify(newUser));
    } catch {}
    setCurrentUser(newUser);
    const chosenLang = newUser.motherLanguage || 'English';
    if (newUser.motherLanguage) {
      setMotherLanguage(newUser.motherLanguage);
    }

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const cleanHandle = (newUser.username || newUser.name.toLowerCase().replace(/\s+/g, '_')).replace(/^@+/, '');
    const welcomeText = OFFICIAL_WELCOME_MESSAGE_TEXT;
    const welcomeTranslations: Record<string, string> = {
      Spanish: `¡Bienvenido a nuestra plataforma de mensajería donde puedes conectarte con tus amigos y familiares!`,
      French: `Bienvenue sur notre plateforme de messagerie où vous pouvez vous connecter avec vos amis et votre famille !`,
      German: `Willkommen auf unserer Messaging-Plattform, auf der Sie sich mit Ihren Freunden und Ihrer Familie verbinden können!`,
      Portuguese: `Bem-vindo à nossa plataforma de mensagens onde você pode se conectar com seus amigos e familiares!`,
      Arabic: `مرحباً بك في منصة المراسلة الخاصة بنا حيث يمكنك التواصل مع أصدقائك وعائلتك!`,
      Bengali: `আমাদের মেসেজিং প্ল্যাটফর্মে স্বাগতম যেখানে আপনি আপনার বন্ধু এবং পরিবারের সাথে সংযুক্ত হতে পারেন!`,
      Japanese: `友人や家族とつながることができるメッセージングプラットフォームへようこそ！`,
    };

    // Send automatic welcome message notification directly to the user's Chats icon
    sendAutomaticWelcomeNotificationToChatsIcon({
      userId: newUser.id,
      userName: newUser.name,
      force: true,
    });

    const autoWelcomeMsg: ChatMessage = {
      id: `msg-auto-welcome-${Date.now()}`,
      senderId: 'other',
      senderParticipantId: 'usr_elena_rodriguez',
      senderName: 'Elena Rodriguez',
      senderAvatar: getInitialsAvatar('Elena Rodriguez', '#10B981'),
      senderLanguage: 'English',
      text: welcomeText,
      type: 'text',
      status: 'read',
      timestamp: nowTimeStr,
      dateLabel: 'Today',
      translation:
        chosenLang !== 'English'
          ? {
              original: welcomeText,
              translated: welcomeTranslations[chosenLang] || `[${chosenLang}]: ${welcomeText}`,
              language: chosenLang,
            }
          : undefined,
    };

    // Deliver automatic Welcome Message into the user's chats & messages history
    const firstContactId = INITIAL_CONTACTS[0]?.id || 'usr_elena_rodriguez';
    const updatedWelcomeMsgs = [...INITIAL_KRISTIN_MESSAGES, autoWelcomeMsg];
    setMessages(updatedWelcomeMsgs);
    setMessagesByChat((prev) => {
      const next = {
        ...prev,
        [firstContactId]: updatedWelcomeMsgs,
        [newUser.id]: [autoWelcomeMsg],
      };
      try {
        localStorage.setItem('freedom_saved_messages_by_chat_v3', JSON.stringify(next));
      } catch {}
      return next;
    });

    // Update contacts list with new user & updated Welcome message preview
    setContacts((prev) => {
      const updatedList = prev
        .filter((c) => c.id !== 'admin_mobilephonesky')
        .map((c) =>
          c.id === firstContactId
            ? {
                ...c,
                lastMessage: welcomeText,
                time: 'Just now',
                unreadCount: (c.unreadCount || 0) + 1,
              }
            : c
        );
      if (updatedList.some((c) => c.id === newUser.id)) return updatedList;
      const contactEntry: UserContact = {
        id: newUser.id,
        name: newUser.name,
        avatar: newUser.avatar,
        lastMessage: welcomeText,
        time: 'Just now',
        online: true,
        unreadCount: 1,
        nativeLanguage: chosenLang,
        statusText: 'Active',
        status: 'active',
        isBlocked: false,
        username: newUser.username,
        phoneNumber: newUser.phoneNumber,
        email: newUser.email,
        bio: newUser.bio,
      };
      return [contactEntry, ...updatedList];
    });

    setSelectedContact((prev) =>
      prev.id === firstContactId
        ? { ...prev, lastMessage: welcomeText, time: 'Just now', unreadCount: 1 }
        : prev
    );

    // Play the Official App Notification Bell Ringtone & show Welcome Message Notification Banner
    playDefaultAppNotificationBell(brandConfig);
    setWelcomeMessageToast({
      userName: newUser.name,
      username: cleanHandle,
      message: welcomeText,
      avatar: getInitialsAvatar('WeedChat', '#7C3AED'),
    });
    setTimeout(() => {
      setWelcomeMessageToast((curr) => (curr?.userName === newUser.name ? null : curr));
    }, 8000);

    try {
      await saveUserProfileToDb(newUser);
    } catch (err) {
      console.warn('Failed to save registered user profile to DB:', err);
    }

    // Direct user to her Profile page after successful registration
    setCurrentScreen('profile');
    setToastMessage(`🎉 Welcome to WeedChat, ${newUser.name}! Your Profile page is ready.`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdminVerified(false);
    try {
      localStorage.setItem('freedom_user_authenticated', 'false');
      localStorage.removeItem('freedom_current_user_id');
      localStorage.removeItem('freedom_active_user_session_v4');
      localStorage.removeItem('freedom_admin_verified_v4');
    } catch {}
    setCurrentScreen('login');
    setToastMessage('You have been logged out. Please sign in or create an account.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const normalizeWeedChatText = (text?: string, fallback: string = '') => {
    const raw = (text || fallback).trim();
    return raw
      .replace(/Freedom Messaging/gi, 'WeedChat')
      .replace(/Freedom Support & Admin/gi, 'WeedChat Support & Admin')
      .replace(/Freedom Admin/gi, 'WeedChat Admin')
      .replace(/Freedom Chat/gi, 'WeedChat')
      .replace(/Welcome to Freedom!/gi, 'Welcome to WeedChat!');
  };

  // Database-backed Current User Profile: User's own profile per device (never defaults to Admin)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const savedSessionRaw = localStorage.getItem('freedom_active_user_session_v4');
      if (savedSessionRaw) {
        const parsed = JSON.parse(savedSessionRaw) as UserProfile;
        if (parsed && parsed.id && !isExampleUserRecord(parsed.id, parsed)) {
          const savedAvatarRec = getSavedAvatarRecord(parsed.id);
          const cleanName = parsed.name || 'WeedChat User';
          const cleanAv = getPersistentUserThumbnail(
            {
              id: parsed.id,
              name: cleanName,
              avatar: savedAvatarRec?.avatar || parsed.avatar,
              avatarThumbnailUrl: savedAvatarRec?.avatarThumbnailUrl || parsed.avatarThumbnailUrl,
            },
            true
          );
          const cleanThumb =
            savedAvatarRec?.avatarThumbnailUrl ||
            parsed.avatarThumbnailUrl ||
            (isUploadedRealAvatar(cleanAv) ? cleanAv : undefined);
          return {
            ...parsed,
            name: cleanName,
            username: (parsed.username || cleanName.toLowerCase().replace(/\s+/g, '_')).replace(
              /^@+/,
              ''
            ),
            avatar: cleanAv,
            avatarThumbnailUrl: cleanThumb,
            avatarFileName: savedAvatarRec?.avatarFileName || parsed.avatarFileName,
            avatarFileSize: savedAvatarRec?.avatarFileSize || parsed.avatarFileSize,
            location: parsed.location || 'New York,NY',
          };
        }
      }
    } catch {}
    return {
      id: 'usr_guest',
      name: 'WeedChat User',
      username: 'weedchat_user',
      email: 'user@weedchat.app',
      avatar: getInitialsAvatar('WeedChat User', '#7C3AED'),
      bio: 'Freedom talk any person of your mother language 🕊️',
      location: 'New York,NY',
      motherLanguage: 'English',
      isOnline: true,
      hideOnlineStatus: false,
      avatarShape: 'round',
    };
  });

  // Automatically persist currentUser profile & avatar whenever updated
  const handleUpdateCurrentUserProfile = (updated: UserProfile) => {
    const cleanAv = getPersistentUserThumbnail(updated, true);
    const cleanThumb =
      updated.avatarThumbnailUrl ||
      (isUploadedRealAvatar(cleanAv) ? cleanAv : currentUser.avatarThumbnailUrl);
    const normalized: UserProfile = {
      ...updated,
      avatar: cleanAv,
      avatarThumbnailUrl: cleanThumb,
    };
    setCurrentUser(normalized);
    try {
      localStorage.setItem('freedom_current_user_profile', JSON.stringify(normalized));
      localStorage.setItem('freedom_active_user_session_v4', JSON.stringify(normalized));
      saveUserAvatarLocally(
        normalized.id || 'usr_guest',
        cleanAv,
        normalized.avatarFileName,
        normalized.avatarFileSize,
        cleanThumb
      );
    } catch {}
    // Also reflect current user's persistent thumbnail in outgoing chat messages ('me')
    setMessages((prev) =>
      prev.map((m) => (m.senderId === 'me' ? { ...m, senderAvatar: cleanThumb || cleanAv } : m))
    );
    // Also reflect current user's avatar in group participants ('me')
    setContacts((prev) =>
      prev.map((c) => {
        if (c.isGroup || c.entityType === 'group') {
          const updatedParts = (c.participants || []).map((p) =>
            p.id === 'me' || p.id === normalized.id
              ? { ...p, name: `${normalized.name} (Admin)`, avatar: cleanThumb || cleanAv }
              : p
          );
          return { ...c, participants: updatedParts };
        }
        if (c.id === normalized.id) {
          return {
            ...c,
            name: normalized.name,
            avatar: cleanThumb || cleanAv,
            avatarThumbnailUrl: cleanThumb,
            email: normalized.email ?? c.email,
            phoneNumber: normalized.phoneNumber ?? c.phoneNumber,
            hidePhoneNumberPublic:
              normalized.hidePhoneNumberPublic ?? c.hidePhoneNumberPublic,
            bio: normalized.bio ?? c.bio,
            location: normalized.location ?? c.location,
            socialLinks: normalized.socialLinks ?? c.socialLinks,
          };
        }
        return c;
      })
    );
    setSelectedContact((prev) =>
      prev.id === normalized.id
        ? {
            ...prev,
            name: normalized.name,
            avatar: cleanAv,
            email: normalized.email ?? prev.email,
            phoneNumber: normalized.phoneNumber ?? prev.phoneNumber,
            hidePhoneNumberPublic:
              normalized.hidePhoneNumberPublic ?? prev.hidePhoneNumberPublic,
            bio: normalized.bio ?? prev.bio,
            location: normalized.location ?? prev.location,
            socialLinks: normalized.socialLinks ?? prev.socialLinks,
          }
        : prev
    );
  };

  // Contacts & Data State (backed by Firestore DB & localStorage for uploaded avatars/media)
  const [contacts, setContacts] = useState<UserContact[]>(() => {
    return INITIAL_CONTACTS.map((c) => {
      const savedAv = getSavedAvatarRecord(c.id);
      return {
        ...c,
        avatar: getCleanAvatar(c.name, savedAv?.avatar || c.avatar, undefined, c.id),
      };
    });
  });
  const [selectedContact, setSelectedContact] = useState<UserContact>(() => {
    const first = INITIAL_CONTACTS[0];
    const savedAv = getSavedAvatarRecord(first.id);
    return {
      ...first,
      avatar: getCleanAvatar(first.name, savedAv?.avatar || first.avatar, undefined, first.id),
    };
  });
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('freedom_saved_messages_by_chat_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            group_global_team: parsed.group_global_team || INITIAL_GROUP_MESSAGES,
            usr_elena_rodriguez: parsed.usr_elena_rodriguez || INITIAL_KRISTIN_MESSAGES,
            ...parsed,
          };
        }
      }
    } catch {}
    return {
      group_global_team: INITIAL_GROUP_MESSAGES,
      usr_elena_rodriguez: INITIAL_KRISTIN_MESSAGES,
    };
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const firstId = INITIAL_CONTACTS[0]?.id || 'usr_elena_rodriguez';
    try {
      const saved = localStorage.getItem('freedom_saved_messages_by_chat_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.[firstId]) return parsed[firstId];
      }
    } catch {}
    return INITIAL_CONTACTS[0]?.isGroup ? INITIAL_GROUP_MESSAGES : INITIAL_KRISTIN_MESSAGES;
  });
  const [calls, setCalls] = useState<CallLog[]>(INITIAL_CALLS);
  const [isDbSynced, setIsDbSynced] = useState<boolean>(false);

  // Keep messagesByChat synced & persisted to localStorage when messages state updates
  useEffect(() => {
    if (selectedContact?.id) {
      setMessagesByChat((prev) => {
        const next = {
          ...prev,
          [selectedContact.id]: messages,
        };
        try {
          localStorage.setItem('freedom_saved_messages_by_chat_v3', JSON.stringify(next));
        } catch (err) {
          console.warn('Could not persist messages to localStorage:', err);
        }
        return next;
      });
    }
  }, [messages, selectedContact?.id]);

  // Cache contacts to localStorage so Photo/Video Editor can list all Friends & Groups for sharing
  useEffect(() => {
    try {
      localStorage.setItem(
        'freedom_cached_contacts_v1',
        JSON.stringify(
          contacts.map((c) => ({
            id: c.id,
            name: c.name,
            avatar: c.avatar,
            isGroup: Boolean(c.isGroup || c.entityType === 'group'),
            isChannel: Boolean(c.isChannel || c.entityType === 'channel'),
            entityType: c.entityType || (c.isGroup ? 'group' : 'individual'),
            nativeLanguage: c.nativeLanguage || 'English',
          }))
        )
      );
    } catch {}
  }, [contacts]);

  // Listen for Photo/Video Editor shares to Friends & Groups with custom messages
  useEffect(() => {
    const handleEditorShareMedia = (e: Event) => {
      const customEv = e as CustomEvent<{
        recipientIds: string[];
        recipientNames: string[];
        mediaType: 'image' | 'video';
        mediaUrl: string;
        thumbnailUrl?: string;
        title: string;
        messageText: string;
      }>;
      if (!customEv.detail) return;
      const {
        recipientIds = [],
        recipientNames = [],
        mediaType,
        mediaUrl,
        thumbnailUrl,
        title,
        messageText,
      } = customEv.detail;
      if (recipientIds.length === 0) return;

      const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const caption =
        messageText && messageText.trim()
          ? messageText.trim()
          : `📸 Shared edited ${mediaType}: ${title || 'Studio Creative'}`;

      const newMsgBase: ChatMessage = {
        id: `msg-editor-share-${Date.now()}`,
        senderId: 'me',
        senderName: currentUser.name || 'You',
        senderAvatar: currentUser.avatar,
        senderLanguage: motherLanguage || 'English',
        text: caption,
        type: mediaType,
        mediaUrl,
        videoUrl: mediaType === 'video' ? mediaUrl : undefined,
        videoThumbnail: thumbnailUrl || mediaUrl,
        status: 'read',
        timestamp: nowStr,
        dateLabel: 'Today',
        translation: {
          original: caption,
          translated: caption,
          language: motherLanguage || 'English',
        },
      };

      setMessagesByChat((prev) => {
        const next = { ...prev };
        recipientIds.forEach((rid, idx) => {
          const existingList = next[rid] || [];
          next[rid] = [
            ...existingList,
            {
              ...newMsgBase,
              id: `msg-editor-share-${Date.now()}-${idx}`,
            },
          ];
        });
        try {
          localStorage.setItem('freedom_saved_messages_by_chat_v2', JSON.stringify(next));
        } catch {}
        return next;
      });

      if (selectedContact?.id && recipientIds.includes(selectedContact.id)) {
        setMessages((prev) => [
          ...prev,
          {
            ...newMsgBase,
            id: `msg-editor-share-active-${Date.now()}`,
          },
        ]);
      }

      setContacts((prev) =>
        prev.map((c) =>
          recipientIds.includes(c.id)
            ? {
                ...c,
                lastMessage: `📸 ${caption}`,
                time: 'Just now',
              }
            : c
        )
      );

      setToastMessage(
        `Shared edited ${mediaType} with ${recipientNames.join(', ')}!`
      );
      setTimeout(() => setToastMessage(null), 3500);
    };

    window.addEventListener('freedom-editor-share-media', handleEditorShareMedia);
    return () =>
      window.removeEventListener('freedom-editor-share-media', handleEditorShareMedia);
  }, [currentUser.name, currentUser.avatar, motherLanguage, selectedContact?.id]);

  // Listen for real-time avatar uploads across ProfileScreen and UserProfileModal
  useEffect(() => {
    const handleAvatarUpdated = (e: Event) => {
      const customEv = e as CustomEvent<{
        userId: string;
        avatar: string;
        avatarThumbnailUrl?: string;
        fileName?: string;
        fileSize?: string;
      }>;
      if (!customEv.detail) return;
      const { userId, avatar, avatarThumbnailUrl, fileName, fileSize } = customEv.detail;

      if (
        userId === currentUser.id ||
        userId === 'admin_mobilephonesky' ||
        userId === 'user_abdullah' ||
        userId === 'current_user' ||
        userId === 'me'
      ) {
        setCurrentUser((prev) => {
          const bestAvatar =
            (isUploadedRealAvatar(avatar) ? avatar : '') ||
            (isUploadedRealAvatar(avatarThumbnailUrl) ? avatarThumbnailUrl! : '') ||
            prev.avatar ||
            avatar;
          const bestThumb =
            (isUploadedRealAvatar(avatarThumbnailUrl) ? avatarThumbnailUrl : undefined) ||
            (isUploadedRealAvatar(avatar) ? avatar : undefined) ||
            prev.avatarThumbnailUrl;
          const next = {
            ...prev,
            avatar: bestAvatar,
            avatarThumbnailUrl: bestThumb,
            avatarFileName: fileName || prev.avatarFileName,
            avatarFileSize: fileSize || prev.avatarFileSize,
          };
          try {
            localStorage.setItem('freedom_current_user_profile', JSON.stringify(next));
            localStorage.setItem('freedom_active_user_session_v4', JSON.stringify(next));
          } catch {}
          return next;
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === 'me'
              ? { ...m, senderAvatar: avatarThumbnailUrl || avatar || m.senderAvatar }
              : m
          )
        );
      }

      setContacts((prev) =>
        prev.map((c) => {
          let updatedContact = c;
          if (c.id === userId) {
            updatedContact = {
              ...updatedContact,
              avatar,
              avatarFileName: fileName || c.avatarFileName,
              avatarFileSize: fileSize || c.avatarFileSize,
            };
          }
          if (c.participants && c.participants.length > 0) {
            const matchMe =
              userId === 'user_abdullah' || userId === 'current_user' || userId === 'me';
            updatedContact = {
              ...updatedContact,
              participants: c.participants.map((p) =>
                p.id === userId || (matchMe && p.id === 'me') ? { ...p, avatar } : p
              ),
            };
          }
          return updatedContact;
        })
      );

      setSelectedContact((prev) => (prev.id === userId ? { ...prev, avatar } : prev));
      setVisitingContact((prev) => (prev && prev.id === userId ? { ...prev, avatar } : prev));
    };

    window.addEventListener('freedom-avatar-updated', handleAvatarUpdated);
    return () => window.removeEventListener('freedom-avatar-updated', handleAvatarUpdated);
  }, [currentUser.id]);

  // Listen for real-time profile details updates (Email, Phone number, About, Location, Social Links)
  useEffect(() => {
    const handleProfileDetailsUpdated = (e: Event) => {
      const customEv = e as CustomEvent<Partial<UserProfile> & { userId: string }>;
      if (!customEv.detail) return;
      const { userId, ...fields } = customEv.detail;

      if (
        userId === currentUser.id ||
        userId === 'admin_mobilephonesky' ||
        userId === 'user_abdullah' ||
        userId === 'current_user' ||
        userId === 'me'
      ) {
        setCurrentUser((prev) => {
          const next = { ...prev, ...fields };
          try {
            localStorage.setItem('freedom_current_user_profile', JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      setContacts((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, ...fields } : c))
      );
      setSelectedContact((prev) =>
        prev.id === userId ? { ...prev, ...fields } : prev
      );
      setVisitingContact((prev) =>
        prev && prev.id === userId ? { ...prev, ...fields } : prev
      );
    };

    window.addEventListener('freedom-user-profile-details-updated', handleProfileDetailsUpdated);
    return () =>
      window.removeEventListener('freedom-user-profile-details-updated', handleProfileDetailsUpdated);
  }, [currentUser.id]);

  // Active Call Modal State
  const [activeCall, setActiveCall] = useState<{
    contactName: string;
    avatar: string;
    type: 'voice' | 'video';
    isGroupCall?: boolean;
    initialParticipants?: GroupParticipant[];
  } | null>(null);

  // Automatic Welcome Message Notification Banner state after registration
  const [welcomeMessageToast, setWelcomeMessageToast] = useState<{
    userName: string;
    username: string;
    message: string;
    avatar: string;
  } | null>(null);

  // Toast Notification state when a new friend request is received
  const [friendRequestReceivedToast, setFriendRequestReceivedToast] = useState<{
    id: string;
    contactId: string;
    senderName: string;
    senderAvatar: string;
    invitedUserName: string;
    invitedUserAvatar: string;
    nativeLanguage?: string;
    invitation: FriendInvitationRecord;
  } | null>(null);

  // Toast Notification state when a friend request sent by the user is accepted by the recipient
  const [friendAcceptedToast, setFriendAcceptedToast] = useState<{
    contactId: string;
    contactName: string;
    contactAvatar: string;
    nativeLanguage?: string;
  } | null>(null);

  useEffect(() => {
    const notifiedPendingIds = new Set<string>();

    const triggerIncomingFriendRequestNotification = (inv: FriendInvitationRecord) => {
      if (!inv || inv.status !== 'pending') return;
      const notifyKey = `${inv.id}_${inv.createdAt}`;
      notifiedPendingIds.add(notifyKey);

      // Update local contact status to pending
      setContacts((prev) =>
        prev.map((c) =>
          c.id === inv.invitedUserId || c.id === inv.senderId
            ? { ...c, friendInviteStatus: 'pending' }
            : c
        )
      );

      // Strict check: ONLY display the "Accept Friend Invite" pop-up to the invited person, NEVER to the person who invited a user
      if (
        !canUserSeeAndAcceptInvitation(
          inv,
          currentUser?.id,
          isAdminVerified,
          currentUser?.name
        )
      ) {
        return;
      }

      const displayContactName = inv.invitedUserName || inv.senderName || 'New Friend';
      const displayAvatar =
        inv.invitedUserAvatar ||
        inv.senderAvatar ||
        getInitialsAvatar(displayContactName, '#7C3AED');

      setFriendRequestReceivedToast({
        id: inv.id,
        contactId: inv.senderId || inv.invitedUserId,
        senderName: inv.senderName || 'WeedChat User',
        senderAvatar: inv.senderAvatar || displayAvatar,
        invitedUserName: inv.invitedUserName || displayContactName,
        invitedUserAvatar: displayAvatar,
        nativeLanguage: inv.nativeLanguage || 'English',
        invitation: inv,
      });

      // Play Official App Notification Bell Ringtone for the invited recipient
      playDefaultAppNotificationBell(brandConfig);

      // Browser Notification API if granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('New Friend Request on WeedChat 🔔', {
            body: `${inv.senderName || 'A user'} sent you a friend invite!`,
            icon: brandConfig.notificationIconUrl || brandConfig.faviconUrl || '/chat-2.svg',
          });
        } catch {}
      }

      setTimeout(() => {
        setFriendRequestReceivedToast((current) =>
          current?.id === inv.id ? null : current
        );
      }, 7500);
    };

    const handleFriendRequestReceived = (e: Event) => {
      const customEvent = e as CustomEvent<FriendInvitationRecord>;
      if (customEvent.detail && customEvent.detail.status === 'pending') {
        triggerIncomingFriendRequestNotification(customEvent.detail);
        // Send Friend Activity notification to user's Chats icon when a friend invite / befriending activity occurs
        notifyChatsIconFriendBefriended({
          friendName: customEvent.detail.senderName || customEvent.detail.invitedUserName || 'A Friend',
          friendAvatar: customEvent.detail.senderAvatar || customEvent.detail.invitedUserAvatar,
          befriendedPersonName: customEvent.detail.invitedUserName || 'a new friend',
          contactId: customEvent.detail.invitedUserId || customEvent.detail.senderId,
        });
      }
    };

    const handleFriendRequestAccepted = (e: Event) => {
      const customEvent = e as CustomEvent<{
        contactId: string;
        contactName: string;
        contactAvatar: string;
        nativeLanguage?: string;
      }>;
      if (customEvent.detail) {
        const { contactId, contactName, contactAvatar, nativeLanguage } = customEvent.detail;
        setFriendRequestReceivedToast(null);
        setFriendAcceptedToast({
          contactId,
          contactName,
          contactAvatar,
          nativeLanguage,
        });
        playDefaultAppNotificationBell(brandConfig);
        // Send Friend Activity notification to the user's Chats icon when someone is befriended
        notifyChatsIconFriendBefriended({
          friendName: contactName || 'Your Friend',
          friendAvatar: contactAvatar,
          befriendedPersonName: currentUser?.name || 'you',
          contactId,
        });
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId
              ? {
                  ...c,
                  friendInviteStatus: 'accepted',
                  lastMessage: `🤝 ${contactName} is now connected as your friend!`,
                  time: 'Just now',
                  unreadCount: (c.unreadCount || 0) + 1,
                }
              : c
          )
        );
        setSelectedContact((prev) =>
          prev.id === contactId ? { ...prev, friendInviteStatus: 'accepted' } : prev
        );
        setTimeout(() => {
          setFriendAcceptedToast((current) =>
            current?.contactId === contactId ? null : current
          );
        }, 5500);
      }
    };

    let isInitialLoad = true;
    const unsubInvites = subscribeFriendInvitationsFromDb((invitations) => {
      if (isInitialLoad) {
        invitations.forEach((inv) => {
          if (inv.status === 'pending') {
            notifiedPendingIds.add(`${inv.id}_${inv.createdAt}`);
          }
        });
        isInitialLoad = false;
        return;
      }
      invitations.forEach((inv) => {
        const key = `${inv.id}_${inv.createdAt}`;
        if (inv.status === 'pending' && !notifiedPendingIds.has(key)) {
          triggerIncomingFriendRequestNotification(inv);
        }
      });
    });

    window.addEventListener('freedom-friend-request-received', handleFriendRequestReceived);
    window.addEventListener('freedom-friend-request-accepted', handleFriendRequestAccepted);
    return () => {
      unsubInvites();
      window.removeEventListener('freedom-friend-request-received', handleFriendRequestReceived);
      window.removeEventListener('freedom-friend-request-accepted', handleFriendRequestAccepted);
    };
  }, [brandConfig, currentUser?.id, currentUser?.name, isAdminVerified]);

  // New Chat / Group / Channel Modal
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatModalMode, setNewChatModalMode] = useState<'individual' | 'group' | 'channel'>('individual');

  // Visiting other user profile modal
  const [visitingContact, setVisitingContact] = useState<UserContact | null>(null);

  // QR Code Scanner Modal
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Mobile Contacts & WhatsApp Import Modals
  const [isContactsImportModalOpen, setIsContactsImportModalOpen] = useState(false);
  const [isWhatsAppImportModalOpen, setIsWhatsAppImportModalOpen] = useState(false);

  // Real-time Contact Typing Indicator State (synced across devices via Firebase Firestore)
  const [isContactTyping, setIsContactTyping] = useState(false);

  // Helper to update local typing state and sync to Firestore
  const handleSetContactTypingSynced = (isTyping: boolean, customChatId?: string, typingName?: string) => {
    const targetChatId = customChatId || selectedContact.id;
    setIsContactTyping(isTyping);
    syncTypingIndicatorToDb(targetChatId, {
      isContactTyping: isTyping,
      typingUserId: targetChatId,
      typingUserName: typingName || selectedContact.name,
    }).catch(() => {});
  };

  // Subscribe to real-time Firestore typing indicators for the active conversation across devices
  useEffect(() => {
    if (!selectedContact?.id) return;
    const unsubTyping = subscribeTypingIndicatorFromDb(selectedContact.id, (isTyping) => {
      setIsContactTyping(isTyping);
    });
    return () => {
      unsubTyping();
    };
  }, [selectedContact.id]);

  // App Custom Stickers State (persisted to Firestore collection `app_stickers`)
  const [customStickers, setCustomStickers] = useState<StickerItem[]>([]);
  const [todayStickersUploadCount, setTodayStickersUploadCount] = useState<number>(0);

  // Metrics: Calculate total real message statistics breakdown
  const totalMessagesCount = useMemo(() => {
    return messages.length;
  }, [messages]);

  const messageBreakdown = useMemo(() => {
    const textMsgs = messages.filter((m) => m.type === 'text').length;
    const audioMsgs = messages.filter((m) => m.type === 'audio').length;
    const mediaMsgs = messages.filter((m) => m.type === 'image' || m.type === 'video').length;
    const errorMsgs = messages.filter((m) => m.type === 'error').length;
    return {
      text: textMsgs,
      audio: audioMsgs,
      media: mediaMsgs,
      error: errorMsgs,
    };
  }, [messages]);

  // Synchronize Browser Favicon, Document Title & Meta Description dynamically with brandConfig
  useEffect(() => {
    document.title = `${brandConfig.appName} - Secure Multilingual Messaging`;

    if (brandConfig.appDescription) {
      let metaDesc = document.querySelector("meta[name='description']") as HTMLMetaElement | null;
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.getElementsByTagName('head')[0].appendChild(metaDesc);
      }
      metaDesc.content = brandConfig.appDescription;
    }

    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    if (brandConfig.faviconUrl) {
      link.type = 'image/x-icon';
      link.href = brandConfig.faviconUrl;
    }
  }, [brandConfig]);

  // Real-time Firestore synchronization for users, current user, brand config, and moderation
  useEffect(() => {
    // 1. Seed initial users into Firestore if collection is empty
    seedInitialUsersIfEmpty().then(() => {
      setIsDbSynced(true);
    });

    // 2. Subscribe to real-time users collection from Firestore (only App Owner / Admin and non-example users)
    const unsubUsers = subscribeUsersFromDb(
      (dbUsers) => {
        const cleanUsers = (dbUsers || []).filter((u) => !isExampleUserRecord(u.id, u));
        if (cleanUsers.length > 0) {
          setContacts(cleanUsers);
          setSelectedContact((prev) => {
            if (!prev || isExampleUserRecord(prev.id, prev)) {
              return cleanUsers[0];
            }
            const found = cleanUsers.find((u) => u.id === prev.id);
            return found || cleanUsers[0];
          });
          setIsDbSynced(true);
        } else {
          setContacts(INITIAL_CONTACTS);
          setSelectedContact(INITIAL_CONTACTS[0]);
          setIsDbSynced(true);
        }
      },
      (err) => {
        console.warn('Users subscription error:', err);
      }
    );

    // 3. Subscribe to the currently signed-in user's own profile in Firestore (never overwrite with Admin unless logged in as Admin)
    const activeUserId = currentUser.id;
    const unsubCurrent =
      activeUserId && activeUserId !== 'usr_guest'
        ? subscribeUserProfile(activeUserId, (profile) => {
            if (profile) {
              setCurrentUser((prev) => {
                if (prev.id !== activeUserId) {
                  return prev;
                }
                const savedAv = getSavedAvatarRecord(activeUserId);
                const cleanName = profile.name || prev.name || 'WeedChat User';
                const resolvedAv = getPersistentUserThumbnail(
                  {
                    id: activeUserId,
                    name: cleanName,
                    avatar: savedAv?.avatar || prev.avatar || profile.avatar,
                    avatarThumbnailUrl:
                      savedAv?.avatarThumbnailUrl ||
                      prev.avatarThumbnailUrl ||
                      profile.avatarThumbnailUrl,
                  },
                  true
                );
                return {
                  ...prev,
                  ...profile,
                  name: cleanName,
                  avatar: resolvedAv,
                  avatarThumbnailUrl:
                    savedAv?.avatarThumbnailUrl ||
                    prev.avatarThumbnailUrl ||
                    profile.avatarThumbnailUrl ||
                    (isUploadedRealAvatar(resolvedAv) ? resolvedAv : undefined),
                };
              });
            }
          })
        : () => {};

    // 4. Subscribe to App Brand Config
    const unsubBrand = subscribeAppBrandConfig((config) => {
      if (config) {
        const activeColor =
          config.primaryColor && config.primaryColor.toLowerCase() !== '#10b981'
            ? config.primaryColor
            : '#7C3AED';
        const activeColorName =
          config.primaryColor && config.primaryColor.toLowerCase() !== '#10b981'
            ? config.primaryColorName || 'WeedChat Purple'
            : 'WeedChat Purple';
        const rawAppName = (config.appName || '').trim();
        const resolvedAppName =
          !rawAppName ||
          rawAppName.toLowerCase().includes('freedom')
            ? 'WeedChat'
            : rawAppName;

        setBrandConfig((prev) => ({
          ...prev,
          ...config,
          appName: resolvedAppName,
          primaryColor: activeColor,
          primaryColorName: activeColorName,
        }));
      }
    });

    // 5. Subscribe to Banned Users
    const unsubBanned = subscribeBannedUsers((bannedList) => {
      if (bannedList && bannedList.length > 0) {
        setBannedUsers(bannedList);
      }
    });

    // 6. Subscribe to Reported Users
    const unsubReports = subscribeReportedUsers((reportList) => {
      if (reportList && reportList.length > 0) {
        setReportedUsers(reportList);
      }
    });

    // 7. Subscribe to App Stickers (Real-time custom stickers for all users)
    const unsubStickers = subscribeAppStickers((stickerList) => {
      setCustomStickers(stickerList);
    });

    // 8. Fetch today's sticker upload count
    getTodayStickersUploadCount().then((count) => {
      setTodayStickersUploadCount(count);
    });

    return () => {
      unsubUsers();
      unsubCurrent();
      unsubBrand();
      unsubBanned();
      unsubReports();
      unsubStickers();
    };
  }, []);

  // Handle selecting a chat from ChatsList or People
  const handleSelectChat = (contact: UserContact) => {
    setSelectedContact(contact);
    const existingMsgs = messagesByChat[contact.id];
    if (existingMsgs && existingMsgs.length > 0) {
      setMessages(existingMsgs);
    } else if (contact.isGroup || contact.entityType === 'group') {
      setMessages(INITIAL_GROUP_MESSAGES);
    } else {
      setMessages(INITIAL_KRISTIN_MESSAGES);
    }
    setCurrentScreen('chat_detail');
  };

  // Update group participants handler
  const handleUpdateGroupParticipants = (groupId: string, updatedParticipants: GroupParticipant[]) => {
    const onlineCount = updatedParticipants.filter((p) => p.online !== false).length;
    const statusSummary = `${updatedParticipants.length} members • ${onlineCount} online`;

    setContacts((prev) =>
      prev.map((c) =>
        c.id === groupId
          ? {
              ...c,
              participants: updatedParticipants,
              statusText: statusSummary,
            }
          : c
      )
    );
    if (selectedContact.id === groupId) {
      setSelectedContact((prev) => ({
        ...prev,
        participants: updatedParticipants,
        statusText: statusSummary,
      }));
    }
    setToastMessage(`Updated group participants (${updatedParticipants.length} members)`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Simulate incoming message from a specific group participant
  const handleSimulateParticipantMessage = (participant: GroupParticipant) => {
    if (participant.isContributionLocked) {
      setToastMessage(`${participant.name}'s contributions are currently locked`);
      setTimeout(() => setToastMessage(null), 2400);
      return;
    }
    const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lang = participant.nativeLanguage || 'Spanish';
    const samplePhrases: Record<string, { original: string; translated: string }> = {
      Spanish: {
        original: '¡Excelente idea equipo! Estoy revisando los detalles ahora.',
        translated: 'Great idea team! I am reviewing the details right now.',
      },
      French: {
        original: 'Super ! Tout est synchronisé de mon côté.',
        translated: 'Awesome! Everything is synced on my side.',
      },
      German: {
        original: 'Perfekt! Die Übersetzung im Gruppenchat klappt wunderbar.',
        translated: 'Perfect! The translation in the group chat works wonderfully.',
      },
      Portuguese: {
        original: 'Perfeito pessoal! Vamos avançar com o projeto.',
        translated: 'Perfect everyone! Let us move forward with the project.',
      },
    };
    const sample = samplePhrases[lang] || {
      original: `Hello everyone from ${participant.name}!`,
      translated: `Hello everyone from ${participant.name}!`,
    };

    const incomingMsg: ChatMessage = {
      id: `grp-sim-${Date.now()}`,
      senderId: 'other',
      senderParticipantId: participant.id,
      senderName: participant.name,
      senderAvatar: participant.avatar,
      senderLanguage: lang,
      text: sample.translated,
      translation: {
        original: sample.original,
        translated: sample.translated,
        language: lang,
      },
      type: 'text',
      status: 'read',
      timestamp: replyTime,
    };

    setMessages((prev) => [...prev, incomingMsg]);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id
          ? {
              ...c,
              lastMessage: `${participant.name.split(' ')[0]}: ${sample.translated}`,
              time: 'Just now',
            }
          : c
      )
    );
  };

  // Handle toggling / cycling message status on demand
  const handleToggleMessageStatus = (messageId: string) => {
    const cycleMap: Record<ChatMessage['status'], ChatMessage['status']> = {
      sent: 'delivered',
      delivered: 'read',
      read: 'failed',
      failed: 'sent',
    };
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: cycleMap[m.status || 'sent'] } : m
      )
    );
  };

  // Handle emoji reactions to individual messages
  const handleReactToMessage = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const currentReactions = msg.reactions || [];
        const existing = currentReactions.find((r) => r.emoji === emoji);

        let updatedReactions;
        if (existing) {
          if (existing.userReacted) {
            // Toggle off user reaction
            if (existing.count <= 1) {
              updatedReactions = currentReactions.filter((r) => r.emoji !== emoji);
            } else {
              updatedReactions = currentReactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, userReacted: false }
                  : r
              );
            }
          } else {
            // Toggle on user reaction
            updatedReactions = currentReactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, userReacted: true }
                : r
            );
          }
        } else {
          // Add new emoji reaction
          updatedReactions = [...currentReactions, { emoji, count: 1, userReacted: true }];
        }

        return {
          ...msg,
          reactions: updatedReactions,
        };
      })
    );
  };

  // Handle locking/unlocking an individual message contribution
  const handleToggleLockMessageContribution = (messageId: string, locked: boolean) => {
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isContributionLocked: locked,
              contributionLockedBy: locked ? 'You' : undefined,
              contributionLockedAt: locked ? now : undefined,
            }
          : m
      )
    );
  };

  // Handle locking/unlocking user contributions for a contact or chat
  const handleToggleLockUserContribution = (contactId: string, locked: boolean) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isContributionLocked: locked,
            }
          : c
      )
    );
    if (selectedContact.id === contactId) {
      setSelectedContact((prev) => ({
        ...prev,
        isContributionLocked: locked,
      }));
    }
  };

  // Block / Unblock contact handler that updates local state and Firestore database
  const handleToggleBlockContact = async (contactId: string, blocked: boolean) => {
    const now = new Date().toISOString();
    // 1. Optimistically update local contacts list
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              status: blocked ? 'blocked' : 'active',
              statusText: blocked ? 'Blocked' : 'Active',
              isBlocked: blocked,
              blockedAt: blocked ? now : undefined,
            }
          : c
      )
    );

    // 2. Update selected contact if currently active
    if (selectedContact.id === contactId) {
      setSelectedContact((prev) => ({
        ...prev,
        status: blocked ? 'blocked' : 'active',
        statusText: blocked ? 'Blocked' : 'Active',
        isBlocked: blocked,
        blockedAt: blocked ? now : undefined,
      }));
    }

    // 3. Persist to Firestore DB (updates /users/{userId} status to 'blocked' & maintains /blocked_users)
    try {
      await blockUserInDb(contactId, blocked, 'Blocked by user in Freedom Chat');
    } catch (err) {
      console.warn('Failed to update blocked status in Firestore database:', err);
    }
  };

  // Handle sending new messages (with interactive reply simulation & realistic status progression)
  const handleSendMessage = (
    text: string,
    type: 'text' | 'audio' | 'image' | 'video' | 'sticker' = 'text',
    mediaUrl?: string,
    stickerData?: { id: string; name: string; category?: string },
    extraVideoMeta?: {
      thumbnailUrl?: string;
      videoPlatform?: string;
      embedUrl?: string;
      originalVideoUrl?: string;
      duration?: string;
    }
  ) => {
    // Prevent sending messages if the contact is blocked
    if (selectedContact.isBlocked || selectedContact.status === 'blocked') {
      console.warn('Cannot send message: Contact is blocked.');
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsgId = `msg-${Date.now()}`;

    // Check if text message contains a YouTube, Vimeo, TikTok, or other video platform link
    const detectedPlatformVideo =
      type === 'text' || type === 'video'
        ? detectVideoPlatformFromText(text || mediaUrl || '')
        : null;

    let newMsg: ChatMessage;

    if (type === 'audio') {
      newMsg = {
        id: newMsgId,
        senderId: 'me',
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        type: 'audio',
        audioDuration: text || '0.37',
        status: 'sent',
        timestamp: timeStr,
        dateLabel: 'Today',
      };
    } else if (type === 'video' || detectedPlatformVideo) {
      const cleanTitle = detectedPlatformVideo
        ? detectedPlatformVideo.cleanCaption || detectedPlatformVideo.defaultTitle
        : stripVideoUrlsFromText(text) || 'Shared Video Clip';
      const resolvedStreamUrl =
        detectedPlatformVideo?.playableStreamUrl ||
        mediaUrl ||
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      const resolvedThumb =
        extraVideoMeta?.thumbnailUrl ||
        detectedPlatformVideo?.thumbnailUrl ||
        'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&auto=format&fit=crop&q=80';

      newMsg = {
        id: newMsgId,
        senderId: 'me',
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text: cleanTitle,
        type: 'video',
        videoUrl: resolvedStreamUrl,
        mediaUrl: resolvedStreamUrl,
        videoThumbnail: resolvedThumb,
        videoPlatform: extraVideoMeta?.videoPlatform || detectedPlatformVideo?.platform || 'Video',
        embedUrl: extraVideoMeta?.embedUrl || detectedPlatformVideo?.embedUrl,
        originalVideoUrl: extraVideoMeta?.originalVideoUrl || detectedPlatformVideo?.originalUrl,
        status: 'sent',
        timestamp: timeStr,
        dateLabel: 'Today',
        likesCount: 1,
        isLiked: false,
        isFavorite: false,
      };
    } else if (type === 'image') {
      const savedImgUrl =
        mediaUrl ||
        'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=600&auto=format&fit=crop&q=80';
      newMsg = {
        id: newMsgId,
        senderId: 'me',
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text: text || 'Uploaded Media Photo',
        type: 'image',
        mediaUrl: savedImgUrl,
        status: 'sent',
        timestamp: timeStr,
        dateLabel: 'Today',
        likesCount: 1,
        isLiked: false,
        isFavorite: false,
      };
    } else if (type === 'sticker') {
      newMsg = {
        id: newMsgId,
        senderId: 'me',
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text: text || 'Sticker',
        type: 'sticker',
        stickerId: stickerData?.id,
        stickerName: stickerData?.name || 'Sticker',
        stickerCategory: stickerData?.category,
        status: 'sent',
        timestamp: timeStr,
        dateLabel: 'Today',
      };
    } else {
      newMsg = {
        id: newMsgId,
        senderId: 'me',
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text,
        type: 'text',
        status: 'sent',
        timestamp: timeStr,
        dateLabel: 'Today',
        translation: {
          original: text,
          translated: `[${selectedContact.nativeLanguage || 'Spanish'}]: ${text}`,
          language: selectedContact.nativeLanguage || 'Spanish',
        },
      };
    }

    setMessages((prev) => [...prev, newMsg]);

    // Update last message in contacts list with status: 'sent' (never show raw video URL)
    const effectiveType = newMsg.type;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id
          ? {
              ...c,
              lastMessage:
                effectiveType === 'audio'
                  ? 'Voice message'
                  : effectiveType === 'image'
                  ? `📷 ${newMsg.text || 'Photo'}`
                  : effectiveType === 'video'
                  ? `🎬 ${newMsg.videoPlatform || 'Video'}: ${newMsg.text || 'Video Clip'}`
                  : effectiveType === 'sticker'
                  ? `🎨 Sticker: ${stickerData?.name || 'Sticker'}`
                  : text,
              time: 'Just now',
              lastMessageStatus: 'sent',
            }
          : c
      )
    );

    // Realistic delivery progression:
    // Step 1: After 1.1s, mark message as 'delivered' (double checkmark)
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMsgId ? { ...m, status: 'delivered' } : m))
      );
      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContact.id ? { ...c, lastMessageStatus: 'delivered' } : c))
      );
    }, 1100);

    // Step 2: After 2.4s, mark message as 'read' (double blue checkmarks)
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMsgId ? { ...m, status: 'read' } : m))
      );
      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContact.id ? { ...c, lastMessageStatus: 'read' } : c))
      );
    }, 2400);

    // Simulate auto-reply from contact with typing indicator after sticker message
    if (type === 'sticker') {
      setTimeout(() => {
        handleSetContactTypingSynced(true, selectedContact.id, selectedContact.name);
      }, 1100);

      setTimeout(() => {
        handleSetContactTypingSynced(false, selectedContact.id, selectedContact.name);
        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const autoReply: ChatMessage = {
          id: `msg-reply-${Date.now()}`,
          senderId: 'other',
          senderName: selectedContact.name,
          senderAvatar: selectedContact.avatar,
          text: `Awesome sticker! Love it ${text}`,
          type: 'text',
          status: 'read',
          timestamp: replyTime,
          translation: {
            original: `Awesome sticker! Love it ${text}`,
            translated: `¡Genial sticker! Me encanta ${text}`,
            language: selectedContact.nativeLanguage || 'Spanish',
          },
        };
        setMessages((prev) => [...prev, autoReply]);
      }, 2600);
    }

    // Simulate auto-reply from contact with typing indicator after text message
    if (type === 'text' && !selectedContact.isContributionLocked) {
      // Step 2b: After 1.2s, contact starts typing (synced to Firestore)
      setTimeout(() => {
        handleSetContactTypingSynced(true, selectedContact.id, selectedContact.name);
      }, 1200);

      // Step 2c: After 3.2s, contact or group participant finishes typing and sends reply
      setTimeout(() => {
        handleSetContactTypingSynced(false, selectedContact.id, selectedContact.name);
        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isGroup = Boolean(selectedContact.isGroup || selectedContact.entityType === 'group');
        const otherMembers = (selectedContact.participants || []).filter(
          (p) => p.id !== 'me' && !p.isContributionLocked
        );
        if (isGroup && otherMembers.length === 0) return;
        const responder =
          isGroup && otherMembers.length > 0
            ? otherMembers[Math.floor(Math.random() * otherMembers.length)]
            : null;

        const responderName = responder ? responder.name : selectedContact.name;
        const responderAvatar = responder ? responder.avatar : selectedContact.avatar;
        const responderLang = responder?.nativeLanguage || selectedContact.nativeLanguage || 'Spanish';

        const replyText = isGroup
          ? `Thanks for the update! Reading this in ${responderLang} via WeedChat Group Translate.`
          : `Got your message in ${motherLanguage}! WeedChat makes communication seamless.`;

        const autoReply: ChatMessage = {
          id: `msg-reply-${Date.now()}`,
          senderId: 'other',
          senderParticipantId: responder?.id,
          senderName: responderName,
          senderAvatar: responderAvatar,
          senderLanguage: responderLang,
          text: replyText,
          type: 'text',
          status: 'read',
          timestamp: replyTime,
          translation: {
            original: replyText,
            translated: `¡Recibí tu mensaje en ${motherLanguage}! WeedChat hace que la comunicación sea fluida.`,
            language: responderLang,
          },
        };
        setMessages((prev) => [...prev, autoReply]);
        if (isGroup) {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === selectedContact.id
                ? {
                    ...c,
                    lastMessage: `${responderName.split(' ')[0]}: ${replyText}`,
                    time: 'Just now',
                  }
                : c
            )
          );
        }
      }, 3200);
    }
  };

  // Handler for importing contacts from mobile phonebook
  const handleImportContacts = (importedList: UserContact[]) => {
    setContacts((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newItems = importedList.filter((c) => !existingIds.has(c.id));
      return [...newItems, ...prev];
    });
  };

  // Handler for importing WhatsApp chat history
  const handleImportWhatsApp = (importedMsgs: ChatMessage[], contactName: string) => {
    setMessages((prev) => [...prev, ...importedMsgs]);
    setContacts((prev) =>
      prev.map((c) =>
        c.name.toLowerCase() === contactName.toLowerCase()
          ? {
              ...c,
              lastMessage: importedMsgs[importedMsgs.length - 1]?.text || c.lastMessage,
              time: 'Imported',
            }
          : c
      )
    );
  };

  // Handler for forwarding a message to one or more contacts
  const handleForwardMessage = (
    targetContactIds: string[],
    messageToForward: ChatMessage,
    note?: string
  ) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const forwardedMsg: ChatMessage = {
      ...messageToForward,
      id: `fwd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: 'me',
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      isForwarded: true,
      forwardedFrom: messageToForward.senderName || selectedContact.name,
      timestamp: timeNow,
      status: 'sent',
    };

    // If currently active chat is in recipient list, append message
    if (targetContactIds.includes(selectedContact.id)) {
      setMessages((prev) => [...prev, forwardedMsg]);
      if (note && note.trim()) {
        const noteMsg: ChatMessage = {
          id: `note-${Date.now()}`,
          senderId: 'me',
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          text: note.trim(),
          type: 'text',
          status: 'sent',
          timestamp: timeNow,
        };
        setMessages((prev) => [...prev, noteMsg]);
      }
    }

    // Update contacts preview
    const previewSummary = messageToForward.text
      ? messageToForward.text.slice(0, 30)
      : `[${messageToForward.type}]`;

    setContacts((prev) =>
      prev.map((c) =>
        targetContactIds.includes(c.id)
          ? {
              ...c,
              lastMessage: `Forwarded: ${previewSummary}`,
              time: 'Just now',
            }
          : c
      )
    );

    const targetNames = contacts
      .filter((c) => targetContactIds.includes(c.id))
      .map((c) => c.name);
    setToastMessage(`Forwarded message to ${targetNames.join(', ')}`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Start Call handler (logs call to Calls tab like WhatsApp & supports Group Voice Calling)
  const handleStartCall = (
    contactName: string = selectedContact.name,
    avatar: string = selectedContact.avatar,
    type: 'voice' | 'video' = 'voice',
    explicitGroupCall?: boolean,
    explicitParticipants?: GroupParticipant[]
  ) => {
    const matchedContact = contacts.find((c) => c.name === contactName) || selectedContact;
    const isGrp =
      explicitGroupCall !== undefined
        ? explicitGroupCall
        : Boolean(matchedContact?.isGroup || matchedContact?.entityType === 'group');
    const resolvedParticipants =
      explicitParticipants ||
      matchedContact?.participants ||
      contacts
        .filter((c) => !c.isGroup && !c.isChannel && c.entityType !== 'group' && c.entityType !== 'channel')
        .slice(0, 3)
        .map((c) => ({
          id: c.id,
          name: c.name,
          avatar: c.avatar,
          nativeLanguage: c.nativeLanguage || 'English',
          online: true,
          role: 'member' as const,
        }));

    setActiveCall({
      contactName,
      avatar,
      type,
      isGroupCall: isGrp,
      initialParticipants: isGrp ? resolvedParticipants : undefined,
    });
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newCallEntry: CallLog = {
      id: `call-${Date.now()}`,
      contactId: matchedContact?.id || `usr_${contactName.toLowerCase().replace(/\s+/g, '_')}`,
      contactName: isGrp && !contactName.toLowerCase().includes('group') ? `${contactName} (Group Call)` : contactName,
      avatar,
      type,
      direction: 'outgoing',
      time: `Today, ${nowTime}`,
      duration: 'Connected',
    };
    setCalls((prev) => [newCallEntry, ...prev]);
  };

  // Add new contact, group, or channel handler - persists to Firestore users database
  const handleAddContact = async (newContact: UserContact) => {
    setContacts((prev) => [newContact, ...prev]);
    setSelectedContact(newContact);

    if (newContact.isChannel || newContact.entityType === 'channel') {
      const initialChannelMsgs: ChatMessage[] = [
        {
          id: `ch-welcome-${Date.now()}`,
          senderId: 'me',
          senderName: newContact.name,
          senderAvatar: newContact.avatar,
          text:
            newContact.lastMessage ||
            `📢 Welcome to ${newContact.name}! Official broadcast channel on WeedChat.`,
          type: 'text',
          status: 'read',
          timestamp: 'Just now',
          dateLabel: 'Today',
        },
      ];
      setMessages(initialChannelMsgs);
      setMessagesByChat((prev) => ({
        ...prev,
        [newContact.id]: initialChannelMsgs,
      }));
      setToastMessage(`📢 Channel "${newContact.name}" created!`);
      setTimeout(() => setToastMessage(null), 3200);
    } else if (newContact.isGroup || newContact.entityType === 'group') {
      const firstMember =
        newContact.participants?.find((p) => p.id !== 'me') || newContact.participants?.[0];
      const initialGroupMsgs: ChatMessage[] = [
        {
          id: `grp-welcome-${Date.now()}`,
          senderId: 'me',
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          text: newContact.lastMessage || `Welcome to ${newContact.name}!`,
          type: 'text',
          status: 'read',
          timestamp: 'Just now',
          dateLabel: 'Today',
        },
        ...(firstMember
          ? [
              {
                id: `grp-member-hello-${Date.now() + 1}`,
                senderId: 'other' as const,
                senderParticipantId: firstMember.id,
                senderName: firstMember.name,
                senderAvatar: firstMember.avatar,
                senderLanguage: firstMember.nativeLanguage || 'Spanish',
                text: `Excited to collaborate in ${newContact.name}!`,
                translation: {
                  original: `¡Emocionado de colaborar en ${newContact.name}!`,
                  translated: `Excited to collaborate in ${newContact.name}!`,
                  language: firstMember.nativeLanguage || 'Spanish',
                },
                type: 'text' as const,
                status: 'read' as const,
                timestamp: 'Just now',
                dateLabel: 'Today',
              },
            ]
          : []),
      ];
      setMessages(initialGroupMsgs);
      setMessagesByChat((prev) => ({
        ...prev,
        [newContact.id]: initialGroupMsgs,
      }));
    } else {
      const initialIndividualMsgs: ChatMessage[] = [
        {
          id: `ind-welcome-${Date.now()}`,
          senderId: 'me',
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          text: newContact.lastMessage || 'Hello from WeedChat!',
          type: 'text',
          status: 'read',
          timestamp: 'Just now',
          dateLabel: 'Today',
        },
      ];
      setMessages(initialIndividualMsgs);
      setMessagesByChat((prev) => ({
        ...prev,
        [newContact.id]: initialIndividualMsgs,
      }));
    }

    setCurrentScreen('chat_detail');

    try {
      await saveContactOrChannelToDb(newContact);
      setIsDbSynced(true);
    } catch (e) {
      console.error('Failed to persist entity to database:', e);
    }
  };

  // Add contact via QR Scanner - handles deduplication/merging and instant chat opening
  const handleAddQrContact = async (scannedContact: UserContact) => {
    setContacts((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          c.id === scannedContact.id ||
          (scannedContact.phoneNumber && c.phoneNumber && c.phoneNumber === scannedContact.phoneNumber) ||
          c.name.toLowerCase() === scannedContact.name.toLowerCase()
      );
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...scannedContact };
        return updated;
      }
      return [scannedContact, ...prev];
    });

    setSelectedContact(scannedContact);
    setCurrentScreen('chat_detail');

    try {
      await saveUserProfileToDb({
        id: scannedContact.id,
        name: scannedContact.name,
        avatar: scannedContact.avatar,
        username: scannedContact.id,
        lastMessage: scannedContact.lastMessage,
        time: scannedContact.time,
        isOnline: scannedContact.online,
        motherLanguage: scannedContact.nativeLanguage,
        bio: scannedContact.statusText,
        phoneNumber: scannedContact.phoneNumber,
        avatarFileName: scannedContact.avatarFileName,
        avatarFileSize: scannedContact.avatarFileSize,
      });
      setIsDbSynced(true);
    } catch (e) {
      console.error('Failed to persist scanned user to database:', e);
    }
  };

  // Admin Action Handlers
  const handleUpdateBrandConfig = async (newConfig: Partial<AppBrandConfig>) => {
    const updated: AppBrandConfig = {
      ...brandConfig,
      ...newConfig,
      updatedAt: new Date().toISOString(),
    };
    setBrandConfig(updated);
    try {
      await saveAppBrandConfigToDb(updated);
    } catch (err) {
      console.warn('Failed to persist brand config to DB:', err);
    }
  };

  const handleBanUser = async (userToBan: Omit<BannedUser, 'id'>) => {
    const newBanRecord: BannedUser = {
      ...userToBan,
      id: `ban_${Date.now()}`,
    };
    setBannedUsers((prev) => [newBanRecord, ...prev]);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === userToBan.userId
          ? { ...c, isBanned: true, bannedReason: userToBan.reason }
          : c
      )
    );
    try {
      await banUserInDb(newBanRecord);
    } catch (err) {
      console.warn('Failed to persist ban to DB:', err);
    }
  };

  const handleUnbanUser = async (banId: string, userId: string) => {
    setBannedUsers((prev) => prev.filter((b) => b.id !== banId && b.userId !== userId));
    setContacts((prev) =>
      prev.map((c) => (c.id === userId ? { ...c, isBanned: false, bannedReason: undefined } : c))
    );
    try {
      await unbanUserInDb(banId, userId);
    } catch (err) {
      console.warn('Failed to remove ban in DB:', err);
    }
  };

  const handleUpdateReportStatus = async (
    reportId: string,
    status: ReportedUser['status'],
    notes?: string
  ) => {
    setReportedUsers((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status, notes: notes || r.notes } : r))
    );
    try {
      await updateReportStatusInDb(reportId, status, notes);
    } catch (err) {
      console.warn('Failed to update report in DB:', err);
    }
  };

  const handleAddReport = async (report: Omit<ReportedUser, 'id' | 'createdAt'>) => {
    const newReport: ReportedUser = {
      ...report,
      id: `rep_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setReportedUsers((prev) => [newReport, ...prev]);
    try {
      await addReportedUserInDb(newReport);
    } catch (err) {
      console.warn('Failed to add report to DB:', err);
    }
  };

  const handleUploadAdminSticker = async (stickerData: Omit<StickerItem, 'uploadedAt' | 'uploadDate'>) => {
    const saved = await uploadAdminStickerToDb(stickerData);
    const count = await getTodayStickersUploadCount();
    setTodayStickersUploadCount(count);
    return saved;
  };

  const handleDeleteAdminSticker = async (stickerId: string) => {
    await deleteAppStickerInDb(stickerId);
    const count = await getTodayStickersUploadCount();
    setTodayStickersUploadCount(count);
  };

  // Chat conversation actions: Archive, Delete, Restore, Pin, Read
  const handleArchiveChat = async (contactId: string, isArchived: boolean = true) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isArchived,
              archivedAt: isArchived ? new Date().toISOString() : undefined,
            }
          : c
      )
    );
    try {
      await toggleArchiveUserChatInDb(contactId, isArchived);
    } catch (err) {
      console.warn('Failed to toggle archive status in DB:', err);
    }
  };

  const handleDeleteChat = async (contactId: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isDeleted: true,
              deletedAt: new Date().toISOString(),
            }
          : c
      )
    );
    try {
      await deleteUserChatInDb(contactId);
    } catch (err) {
      console.warn('Failed to delete chat in DB:', err);
    }
  };

  const handleRestoreChat = async (contactId: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isDeleted: false,
              deletedAt: undefined,
            }
          : c
      )
    );
    try {
      await restoreDeletedChatInDb(contactId);
    } catch (err) {
      console.warn('Failed to restore chat in DB:', err);
    }
  };

  const handlePinChat = async (contactId: string, isPinned: boolean) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, isPinned } : c))
    );
    try {
      await togglePinUserChatInDb(contactId, isPinned);
    } catch (err) {
      console.warn('Failed to pin chat in DB:', err);
    }
  };

  const handleToggleReadChat = async (contactId: string, isRead: boolean) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, unreadCount: isRead ? 0 : 1 } : c))
    );
    try {
      await markChatReadStatusInDb(contactId, isRead);
    } catch (err) {
      console.warn('Failed to toggle read status in DB:', err);
    }
  };

  // Media Preview Interactions: Like, Favourite, Rate Stars
  const handleToggleLikeMedia = async (mediaId: string, isLiked: boolean) => {
    let likedMediaTitle = 'Shared Media File';
    let likedMediaUrl: string | undefined;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === mediaId) {
          const currentCount = m.likesCount ?? 14;
          const newCount = isLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
          likedMediaTitle = m.text || m.documentName || 'Media File';
          likedMediaUrl = m.mediaUrl || m.videoThumbnail;
          return { ...m, isLiked, likesCount: newCount };
        }
        return m;
      })
    );
    if (isLiked) {
      const friendActorName = selectedContact?.name || 'Elena Rodriguez';
      const friendActorAvatar = selectedContact?.avatar;
      notifyChatsIconFriendLikedMedia({
        friendName: friendActorName,
        friendAvatar: friendActorAvatar,
        mediaTitle: likedMediaTitle,
        mediaUrl: likedMediaUrl,
        contactId: selectedContact?.id || 'usr_elena_rodriguez',
      });
      setContacts((prev) =>
        prev.map((c) =>
          c.id === (selectedContact?.id || 'usr_elena_rodriguez')
            ? {
                ...c,
                lastMessage: `❤️ Liked media file: "${likedMediaTitle}"`,
                time: 'Just now',
                unreadCount: (c.unreadCount || 0) + 1,
              }
            : c
        )
      );
    }
    try {
      const existing = await getMediaInteractionFromDb(mediaId);
      const prevLikes = existing?.likesCount ?? 14;
      await saveMediaInteractionInDb({
        id: mediaId,
        isLiked,
        likesCount: isLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1),
        isFavorite: existing?.isFavorite ?? false,
        userRating: existing?.userRating ?? 0,
        averageRating: existing?.averageRating ?? 4.8,
        totalRatings: existing?.totalRatings ?? 24,
      });
    } catch (e) {
      console.warn('Failed to persist media like:', e);
    }
  };

  const handleToggleFavoriteMedia = async (mediaId: string, isFavorite: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, isFavorite } : m))
    );
    try {
      const existing = await getMediaInteractionFromDb(mediaId);
      await saveMediaInteractionInDb({
        id: mediaId,
        isLiked: existing?.isLiked ?? false,
        likesCount: existing?.likesCount ?? 14,
        isFavorite,
        userRating: existing?.userRating ?? 0,
        averageRating: existing?.averageRating ?? 4.8,
        totalRatings: existing?.totalRatings ?? 24,
      });
    } catch (e) {
      console.warn('Failed to persist media favourite:', e);
    }
  };

  const handleRateMedia = async (mediaId: string, rating: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === mediaId) {
          const wasRated = Boolean(m.userRating && m.userRating > 0);
          const currentTotals = m.totalRatings ?? 24;
          const newTotals = wasRated ? currentTotals : currentTotals + 1;
          const currentAvg = m.averageRating ?? 4.8;
          const diff = wasRated ? rating - (m.userRating || 0) : rating - currentAvg;
          const newAvg = Math.round((currentAvg + diff / newTotals) * 10) / 10;
          return {
            ...m,
            userRating: rating,
            averageRating: Math.min(5, Math.max(1, newAvg)),
            totalRatings: newTotals,
          };
        }
        return m;
      })
    );
    try {
      const existing = await getMediaInteractionFromDb(mediaId);
      const wasRated = Boolean(existing?.userRating && existing.userRating > 0);
      const currentTotals = existing?.totalRatings ?? 24;
      const newTotals = wasRated ? currentTotals : currentTotals + 1;
      const currentAvg = existing?.averageRating ?? 4.8;
      const diff = wasRated ? rating - (existing?.userRating || 0) : rating - currentAvg;
      const newAvg = Math.round((currentAvg + diff / newTotals) * 10) / 10;
      await saveMediaInteractionInDb({
        id: mediaId,
        isLiked: existing?.isLiked ?? false,
        likesCount: existing?.likesCount ?? 14,
        isFavorite: existing?.isFavorite ?? false,
        userRating: rating,
        averageRating: Math.min(5, Math.max(1, newAvg)),
        totalRatings: newTotals,
      });
    } catch (e) {
      console.warn('Failed to persist media rating:', e);
    }
  };

  const handleLockAdmin = () => {
    setIsAdminVerified(false);
    try {
      localStorage.setItem('freedom_admin_verified_v4', 'false');
    } catch {}
    if (currentScreen === 'admin') {
      setCurrentScreen('profile');
    }
  };

  const handleVerifyAdmin = () => {
    setIsAdminVerified(true);
    try {
      localStorage.setItem('freedom_admin_verified_v4', 'true');
    } catch {}
    setCurrentScreen('admin');
  };

  // Reset to screenshot defaults
  const handleResetData = () => {
    setContacts(INITIAL_CONTACTS);
    setMessages(INITIAL_KRISTIN_MESSAGES);
    setCalls(INITIAL_CALLS);
    setSelectedContact(INITIAL_CONTACTS[0]);
    setCurrentScreen('chats');
  };

  // Render content according to currentScreen in single phone mode
  const renderCurrentPhoneScreen = () => {
    if (isAppLoading) {
      return (
        <AppLoadingScreen
          appName={brandConfig.appName}
          onFinishLoading={() => setIsAppLoading(false)}
          durationMs={2200}
        />
      );
    }

    // Strict Login Gate: Force user to login or register before accessing Chats or any internal screen
    if (
      !isAuthenticated &&
      currentScreen !== 'login' &&
      currentScreen !== 'password_reset' &&
      currentScreen !== 'onboarding'
    ) {
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
          onOpenPasswordReset={() => setCurrentScreen('password_reset')}
          theme={theme}
          primaryColor={brandConfig.primaryColor}
          brandConfig={brandConfig}
        />
      );
    }

    switch (currentScreen) {
      case 'login':
      case 'onboarding':
        return (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onRegisterSuccess={handleRegisterSuccess}
            onOpenPasswordReset={() => setCurrentScreen('password_reset')}
            theme={theme}
            primaryColor={brandConfig.primaryColor}
            brandConfig={brandConfig}
          />
        );
      case 'password_reset':
        return (
          <PasswordResetPage
            theme={theme}
            primaryColor={brandConfig.primaryColor}
            brandConfig={brandConfig}
            onBackToLogin={() => setCurrentScreen('login')}
            onLoginAfterReset={(user) => handleLoginSuccess(user, false)}
          />
        );
      case 'chats':
        return (
          <ChatsListScreen
            contacts={contacts}
            onSelectChat={handleSelectChat}
            onNavigate={handleNavigateScreen}
            onViewProfile={(c) => setVisitingContact(c)}
            theme={theme}
            onOpenNewChatModal={() => {
              setNewChatModalMode('individual');
              setIsNewChatModalOpen(true);
            }}
            onOpenCreateGroupModal={() => {
              setNewChatModalMode('group');
              setIsNewChatModalOpen(true);
            }}
            onOpenCreateChannelModal={() => {
              setNewChatModalMode('channel');
              setIsNewChatModalOpen(true);
            }}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            primaryColor={brandConfig.primaryColor}
            isAdminVerified={isAdminVerified}
            userAvatar={getPersistentUserThumbnail(currentUser, true)}
            onArchiveChat={handleArchiveChat}
            onDeleteChat={handleDeleteChat}
            onRestoreChat={handleRestoreChat}
            onPinChat={handlePinChat}
            onToggleReadChat={handleToggleReadChat}
          />
        );
      case 'status':
        return (
          <StatusScreen
            currentUser={currentUser}
            contacts={contacts}
            onNavigate={handleNavigateScreen}
            onReplyToStatus={(targetContact, statusItem, replyText) => {
              handleSelectChat(targetContact);
              setTimeout(() => {
                handleSendMessage(
                  `[Status Reply: "${
                    statusItem.type === 'text'
                      ? (statusItem.text || '').slice(0, 36)
                      : statusItem.caption || 'Photo/Video Status'
                  }"] ${replyText}`,
                  'text'
                );
              }, 100);
            }}
            theme={theme}
            primaryColor={brandConfig.primaryColor}
            isAdminVerified={isAdminVerified}
          />
        );
      case 'chat_detail':
        return (
          <ActiveChatScreen
            contact={selectedContact}
            messages={messages}
            onBack={() => setCurrentScreen('chats')}
            onSendMessage={handleSendMessage}
            onStartCall={(type) => handleStartCall(selectedContact.name, selectedContact.avatar, type)}
            theme={theme}
            userMotherLanguage={motherLanguage}
            onToggleMessageStatus={handleToggleMessageStatus}
            onReactToMessage={handleReactToMessage}
            onOpenImportWhatsApp={() => setIsWhatsAppImportModalOpen(true)}
            isContactTyping={isContactTyping}
            onSetContactTyping={handleSetContactTypingSynced}
            primaryColor={brandConfig.primaryColor}
            onToggleBlockUser={handleToggleBlockContact}
            customStickers={customStickers}
            onToggleLikeMedia={handleToggleLikeMedia}
            onToggleFavoriteMedia={handleToggleFavoriteMedia}
            onRateMedia={handleRateMedia}
            contacts={contacts}
            onForwardMessage={handleForwardMessage}
            onUpdateGroupParticipants={handleUpdateGroupParticipants}
            onSimulateParticipantMessage={handleSimulateParticipantMessage}
            onToggleLockMessageContribution={handleToggleLockMessageContribution}
            onToggleLockUserContribution={handleToggleLockUserContribution}
            onDeleteMessage={(messageId) => {
              setMessages((prev) => prev.filter((m) => m.id !== messageId));
            }}
          />
        );
      case 'people':
        return (
          <PeopleScreen
            contacts={contacts}
            onSelectChat={handleSelectChat}
            onNavigate={handleNavigateScreen}
            onStartCall={(contact, type) => handleStartCall(contact.name, contact.avatar, type)}
            onViewProfile={(c) => setVisitingContact(c)}
            theme={theme}
            onOpenNewChatModal={() => {
              setNewChatModalMode('individual');
              setIsNewChatModalOpen(true);
            }}
            onOpenCreateChannelModal={() => {
              setNewChatModalMode('channel');
              setIsNewChatModalOpen(true);
            }}
            onOpenImportContacts={() => setIsContactsImportModalOpen(true)}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            primaryColor={brandConfig.primaryColor}
            isAdminVerified={isAdminVerified}
            userAvatar={currentUser?.avatar}
          />
        );
      case 'calls':
        return (
          <CallsScreen
            calls={calls}
            contacts={contacts}
            onStartCall={(name, avatar, type, isGroupCall) =>
              handleStartCall(name, avatar, type, isGroupCall)
            }
            onOpenChat={handleSelectChat}
            onNavigate={handleNavigateScreen}
            onViewProfile={(c) => setVisitingContact(c)}
            onDeleteCall={(callId) => {
              setCalls((prev) => prev.filter((c) => c.id !== callId));
            }}
            onRestoreCall={(restoredCall) => {
              setCalls((prev) => [restoredCall, ...prev.filter((c) => c.id !== restoredCall.id)]);
            }}
            theme={theme}
            onOpenImportContacts={() => setIsContactsImportModalOpen(true)}
            onSyncContacts={() => setIsContactsImportModalOpen(true)}
            primaryColor={brandConfig.primaryColor}
            isAdminVerified={isAdminVerified}
            userAvatar={currentUser?.avatar}
          />
        );
      case 'podcast':
        return (
          <PodcastScreen
            currentUser={currentUser}
            theme={theme}
            primaryColor={brandConfig.primaryColor}
            onNavigate={handleNavigateScreen}
            isAdminVerified={isAdminVerified}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onNavigate={handleNavigateScreen}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            motherLanguage={motherLanguage}
            onChangeMotherLanguage={setMotherLanguage}
            onLogout={handleLogout}
            currentUser={currentUser}
            onUpdateCurrentUser={handleUpdateCurrentUserProfile}
            isAdminVerified={isAdminVerified}
            onOpenAdminAuth={() => setIsAdminAuthModalOpen(true)}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            primaryColor={brandConfig.primaryColor}
            messages={messages}
            onToggleFavoriteMedia={handleToggleFavoriteMedia}
            onToggleLikeMedia={handleToggleLikeMedia}
            onDeleteMessageMedia={(mediaId) => {
              setMessages((prev) => prev.filter((m) => m.id !== mediaId));
              setToastMessage('Media file deleted from gallery');
              setTimeout(() => setToastMessage(null), 2500);
            }}
            onEditMessageMediaTitle={(mediaId, newTitle) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === mediaId
                    ? {
                        ...m,
                        text: newTitle,
                        documentName: m.type === 'document' ? newTitle : m.documentName,
                      }
                    : m
                )
              );
              setToastMessage('Media title updated');
              setTimeout(() => setToastMessage(null), 2500);
            }}
          />
        );
      case 'admin':
        return (
          <AdminControlPanel
            brandConfig={brandConfig}
            onUpdateBrandConfig={handleUpdateBrandConfig}
            bannedUsers={bannedUsers}
            onBanUser={handleBanUser}
            onUnbanUser={handleUnbanUser}
            reportedUsers={reportedUsers}
            onUpdateReportStatus={handleUpdateReportStatus}
            onAddReport={handleAddReport}
            contacts={contacts}
            totalMessagesCount={totalMessagesCount}
            messageBreakdown={messageBreakdown}
            theme={theme}
            onNavigate={handleNavigateScreen}
            onLockAdmin={handleLockAdmin}
            adminEmail={adminEmail}
            customStickers={customStickers}
            onUploadCustomSticker={handleUploadAdminSticker}
            onDeleteCustomSticker={handleDeleteAdminSticker}
            todayUploadsCount={todayStickersUploadCount}
            onPreviewLoadingPage={() => setIsAppLoading(true)}
            onToggleBlockUser={handleToggleBlockContact}
            onRemoveForbiddenMediaFile={(mediaId) => {
              setMessages((prev) => prev.filter((m) => m.id !== mediaId));
              setToastMessage('Forbidden media file removed from platform by Admin.');
              setTimeout(() => setToastMessage(null), 3200);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-white dark:bg-[#181A20] flex flex-col font-sans antialiased select-none overflow-hidden relative">
      {/* Native App View - Fits device 100% edge-to-edge like WhatsApp */}
      {renderCurrentPhoneScreen()}

      {/* Active Call Sheet overlay (Supports 1-on-1 & Multi-Participant Group Voice Calling Grid) */}
      {activeCall && (
        <ActiveCallModal
          contactName={activeCall.contactName}
          avatar={activeCall.avatar}
          type={activeCall.type}
          isGroupCall={activeCall.isGroupCall}
          initialParticipants={activeCall.initialParticipants}
          availableContacts={contacts}
          currentUser={currentUser}
          primaryColor={brandConfig.primaryColor}
          onEndCall={() => setActiveCall(null)}
        />
      )}

      {/* New Conversation / Create Group Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onAddContact={handleAddContact}
        onOpenQrScanner={() => setIsQrScannerOpen(true)}
        primaryColor={brandConfig.primaryColor}
        existingContacts={contacts}
        initialMode={newChatModalMode}
      />

      {/* Camera-based QR Code Contact Scanner Modal */}
      <QrCodeScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onAddContact={handleAddQrContact}
        currentUser={currentUser}
        primaryColor={brandConfig.primaryColor}
        theme={theme}
      />

      {/* Mobile Contacts Import Modal */}
      <ImportContactsModal
        isOpen={isContactsImportModalOpen}
        onClose={() => setIsContactsImportModalOpen(false)}
        onImportContacts={handleImportContacts}
        existingContacts={contacts}
        theme={theme}
        primaryColor={brandConfig.primaryColor}
      />

      {/* WhatsApp Messages Import Modal */}
      <ImportWhatsAppModal
        isOpen={isWhatsAppImportModalOpen}
        onClose={() => setIsWhatsAppImportModalOpen(false)}
        onImportMessages={handleImportWhatsApp}
        activeContact={selectedContact}
        contacts={contacts}
        theme={theme}
        userMotherLanguage={motherLanguage}
        primaryColor={brandConfig.primaryColor}
      />

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onVerifySuccess={() => {
          setIsAdminAuthModalOpen(false);
          handleVerifyAdmin();
        }}
        adminEmail={adminEmail}
        theme={theme}
        primaryColor={brandConfig.primaryColor}
      />

      {/* Visiting User Profile Modal (Allows users to visit each other's profile, bio & media gallery) */}
      {visitingContact && (
        <UserProfileModal
          isOpen={Boolean(visitingContact)}
          onClose={() => setVisitingContact(null)}
          contact={visitingContact}
          messages={messages}
          onStartCall={(type) => {
            const c = visitingContact;
            setVisitingContact(null);
            handleStartCall(c.name, c.avatar, type);
          }}
          onSendMessage={() => {
            const c = visitingContact;
            setVisitingContact(null);
            handleSelectChat(c);
          }}
          theme={theme}
          primaryColor={brandConfig.primaryColor}
          onToggleBlockUser={handleToggleBlockContact}
          onJoinGroup={(groupId) => {
            setContacts((prev) =>
              prev.map((c) => (c.id === groupId ? { ...c, isJoinedGroup: true } : c))
            );
            setVisitingContact((prev) => (prev ? { ...prev, isJoinedGroup: true } : null));
            setToastMessage(`🎉 You joined "${visitingContact.name}"!`);
            setTimeout(() => setToastMessage(null), 3200);
          }}
          onShareGroupMedia={(media, memberIds) => {
            setToastMessage(
              `📤 Shared "${media.title}" to ${memberIds.length} group member${
                memberIds.length > 1 ? 's' : ''
              } only!`
            );
            setTimeout(() => setToastMessage(null), 3200);
          }}
          onUpdateGroupCover={(groupId, coverUrl) => {
            setContacts((prev) =>
              prev.map((c) => (c.id === groupId ? { ...c, groupCoverUrl: coverUrl } : c))
            );
            setVisitingContact((prev) => (prev ? { ...prev, groupCoverUrl: coverUrl } : null));
            setToastMessage(`🖼️ Group Cover uploaded and saved by Group Admin!`);
            setTimeout(() => setToastMessage(null), 3200);
          }}
          isCurrentUserProfile={visitingContact.id === currentUser.id}
          currentUser={currentUser}
          onDeleteMyAccount={(deletedUserId) => {
            setContacts((prev) => prev.filter((c) => c.id !== deletedUserId));
            setVisitingContact(null);
            if (deletedUserId === currentUser.id) {
              handleLogout();
            } else {
              setToastMessage('🗑️ Account permanently deleted.');
              setTimeout(() => setToastMessage(null), 3000);
            }
          }}
        />
      )}

      {/* Automatic Welcome Message Notification Banner after Registration */}
      {welcomeMessageToast && (
        <div
          id="welcome-message-notification-banner"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[92%] max-w-sm p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#161C28]/95 backdrop-blur-md border border-purple-500/50 text-white shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={welcomeMessageToast.avatar}
                  alt="WeedChat Official"
                  className="w-11 h-11 rounded-full object-cover border-2 border-purple-400 shadow-sm"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-slate-900">
                  🔔
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-extrabold text-purple-300 tracking-tight truncate">
                    Welcome to WeedChat, {welcomeMessageToast.userName}! 🎉
                  </p>
                </div>
                <p className="text-[11px] text-slate-200 font-medium line-clamp-2 leading-snug mt-0.5">
                  {welcomeMessageToast.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeMessageToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              title="Dismiss welcome notification"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <span>🔔</span>
              <span>Official App Notification Bell Ringtone</span>
            </span>
            <button
              id="open-welcome-message-chat-btn"
              type="button"
              onClick={() => {
                const adminContact =
                  contacts.find((c) => c.id === 'admin_mobilephonesky') || INITIAL_CONTACTS[0];
                setWelcomeMessageToast(null);
                if (adminContact) {
                  handleSelectChat(adminContact);
                }
              }}
              style={{ backgroundColor: brandConfig.primaryColor }}
              className="px-3 py-1 rounded-xl text-white text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Read Welcome Message
            </button>
          </div>
        </div>
      )}

      {/* New Friend Request Received Notification Banner — Displayed ONLY to the Invited Person, NEVER to the Sender */}
      {friendRequestReceivedToast &&
        canUserSeeAndAcceptInvitation(
          friendRequestReceivedToast.invitation,
          currentUser?.id,
          isAdminVerified,
          currentUser?.name
        ) && (
        <div
          id="friend-request-received-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[105] w-[92%] max-w-sm p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#161C28]/95 backdrop-blur-md border border-amber-400/50 text-white shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={friendRequestReceivedToast.senderAvatar || friendRequestReceivedToast.invitedUserAvatar}
                alt={friendRequestReceivedToast.senderName}
                className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shadow-sm"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-bold ring-2 ring-slate-900">
                🔔
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-amber-300 tracking-tight">
                New Friend Invite! 🔔
              </p>
              <p className="text-[11px] text-slate-200 font-medium leading-snug">
                <strong>{friendRequestReceivedToast.senderName}</strong> sent you a friend invite.
              </p>
              <p className="text-[9px] text-emerald-400 font-semibold mt-0.5">
                ♪ {brandConfig.notificationTuneName || 'WeedChat Official Bell Ringtone'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="friend-request-toast-accept-btn"
              type="button"
              onClick={() => {
                const inv = friendRequestReceivedToast.invitation;
                const acceptedRec: FriendInvitationRecord = {
                  ...inv,
                  status: 'accepted',
                  respondedAt: new Date().toISOString(),
                  acceptedAt: new Date().toISOString(),
                };
                saveFriendInvitation(acceptedRec);
                setFriendRequestReceivedToast(null);
                window.dispatchEvent(
                  new CustomEvent('freedom-friend-request-accepted', {
                    detail: {
                      contactId: friendRequestReceivedToast.contactId,
                      contactName: friendRequestReceivedToast.invitedUserName,
                      contactAvatar: friendRequestReceivedToast.invitedUserAvatar,
                      nativeLanguage: friendRequestReceivedToast.nativeLanguage || 'English',
                    },
                  })
                );
              }}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
            >
              Accept Friend Invite
            </button>
            <button
              id="friend-request-toast-view-btn"
              type="button"
              onClick={() => {
                const matched = contacts.find(
                  (c) =>
                    c.id === friendRequestReceivedToast.contactId ||
                    c.name === friendRequestReceivedToast.invitedUserName
                );
                setFriendRequestReceivedToast(null);
                if (matched) {
                  setVisitingContact(matched);
                }
              }}
              style={{ backgroundColor: brandConfig.primaryColor }}
              className="px-2.5 py-1.5 rounded-xl text-white text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => setFriendRequestReceivedToast(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Friend Request Accepted by Recipient Toast Notification */}
      {friendAcceptedToast && (
        <div
          id="friend-request-accepted-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#161C28]/95 backdrop-blur-md border border-emerald-500/50 text-white shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={friendAcceptedToast.contactAvatar}
                alt={friendAcceptedToast.contactName}
                className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shadow-sm"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-slate-900">
                ✓
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-emerald-400 tracking-tight">
                Friend Request Accepted! 🎉
              </p>
              <p className="text-[11px] text-slate-200 font-medium leading-snug">
                <strong>{friendAcceptedToast.contactName}</strong> accepted your friend invite.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const matched = contacts.find((c) => c.id === friendAcceptedToast.contactId);
                setFriendAcceptedToast(null);
                setVisitingContact(null);
                if (matched) {
                  handleSelectChat(matched);
                }
              }}
              style={{ backgroundColor: brandConfig.primaryColor }}
              className="px-2.5 py-1.5 rounded-xl text-white text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setFriendAcceptedToast(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          {brandConfig.notificationIconUrl && (
            <img
              src={brandConfig.notificationIconUrl}
              alt="Notification Icon"
              className="w-4 h-4 rounded-sm object-contain shrink-0"
            />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
