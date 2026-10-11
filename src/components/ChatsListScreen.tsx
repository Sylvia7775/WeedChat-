import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StatusBar } from './StatusBar';
import { BottomNav } from './BottomNav';
import {
  Search,
  UserPlus,
  X,
  Check,
  CheckCheck,
  Shield,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertTriangle,
  Pin,
  PinOff,
  RotateCcw,
  Sparkles,
  Inbox,
  ChevronRight,
  Clock,
  MoreVertical,
  QrCode,
  User,
  Users,
  Megaphone,
  Camera,
} from 'lucide-react';
import { UserContact, ScreenView, ThemeMode } from '../types';
import { saveContactOrChannelToDb } from '../lib/firebase';
import { getPersistentUserThumbnail } from '../lib/avatarHelper';
import { SnapFaceFilterCameraModal } from './SnapFaceFilterCameraModal';
import {
  VerifiedCheckmarkBadge,
  isAccountProfileValidated,
} from './VerifiedCheckmarkBadge';
import {
  ChatIconActivityNotification,
  getChatIconNotifications,
  subscribeChatIconNotifications,
  dismissChatIconNotification,
  markAllChatIconNotificationsRead,
} from '../lib/chatIconNotificationsHelper';

interface ChatsListScreenProps {
  contacts: UserContact[];
  onSelectChat: (contact: UserContact) => void;
  onNavigate: (screen: ScreenView) => void;
  onViewProfile?: (contact: UserContact) => void;
  theme?: ThemeMode;
  onOpenNewChatModal?: () => void;
  onOpenCreateGroupModal?: () => void;
  onOpenCreateChannelModal?: () => void;
  onOpenQrScanner?: () => void;
  primaryColor?: string;
  isAdminVerified?: boolean;
  userAvatar?: string;
  onArchiveChat?: (contactId: string, isArchived: boolean) => Promise<void> | void;
  onDeleteChat?: (contactId: string) => Promise<void> | void;
  onRestoreChat?: (contactId: string) => Promise<void> | void;
  onPinChat?: (contactId: string, isPinned: boolean) => Promise<void> | void;
  onToggleReadChat?: (contactId: string, isRead: boolean) => Promise<void> | void;
}

interface ToastMessage {
  id: string;
  text: string;
  actionText?: string;
  onAction?: () => void;
}

export const ChatsListScreen: React.FC<ChatsListScreenProps> = ({
  contacts,
  onSelectChat,
  onNavigate,
  onViewProfile,
  theme = 'light',
  onOpenNewChatModal,
  onOpenCreateGroupModal,
  onOpenCreateChannelModal,
  onOpenQrScanner,
  primaryColor = '#7C3AED',
  isAdminVerified = false,
  userAvatar,
  onArchiveChat,
  onDeleteChat,
  onRestoreChat,
  onPinChat,
  onToggleReadChat,
}) => {
  const [filterTab, setFilterTab] = useState<'recent' | 'channels' | 'groups' | 'active' | 'archived'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSnapCameraOpen, setIsSnapCameraOpen] = useState(false);
  const persistentMyAvatar = getPersistentUserThumbnail({ avatar: userAvatar }, true);
  const [chatIconNotifications, setChatIconNotifications] = useState<
    ChatIconActivityNotification[]
  >(() => getChatIconNotifications());

  useEffect(() => {
    const unsub = subscribeChatIconNotifications(({ notifications }) => {
      setChatIconNotifications(notifications);
    });
    return unsub;
  }, []);

  // Local state overrides for optimistic instant UI response (persisted in localStorage for pinned chats)
  const [localArchivedMap, setLocalArchivedMap] = useState<Record<string, boolean>>({});
  const [localDeletedSet, setLocalDeletedSet] = useState<Set<string>>(new Set());
  const [localPinnedMap, setLocalPinnedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('freedom_pinned_chats_map_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  });
  const [localUnreadMap, setLocalUnreadMap] = useState<Record<string, number>>({});
  const [channelSubscribedMap, setChannelSubscribedMap] = useState<Record<string, boolean>>({});
  const [channelSubscribersCountMap, setChannelSubscribersCountMap] = useState<Record<string, number>>({});

  // Swipe gesture states
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);

  // Drag tracking refs
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean>(false);
  const hasMovedSignificantlyRef = useRef<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);

  // Long-press handling
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef<boolean>(false);
  const [longPressedContact, setLongPressedContact] = useState<UserContact | null>(null);

  // Delete confirmation modal state
  const [contactToDelete, setContactToDelete] = useState<UserContact | null>(null);

  // Toast / Undo notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = theme === 'dark';

  // Helper to show undoable toasts
  const showToast = (text: string, actionText?: string, onAction?: () => void) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    const id = `toast-${Date.now()}`;
    setToast({ id, text, actionText, onAction });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 5000);
  };

  // Helper to compute whether a contact is archived
  const isContactArchived = (contact: UserContact): boolean => {
    if (localArchivedMap[contact.id] !== undefined) {
      return localArchivedMap[contact.id];
    }
    return Boolean(contact.isArchived);
  };

  // Helper to compute whether a contact is deleted
  const isContactDeleted = (contact: UserContact): boolean => {
    if (localDeletedSet.has(contact.id)) return true;
    return Boolean(contact.isDeleted);
  };

  // Helper to compute whether a contact is pinned
  const isContactPinned = (contact: UserContact): boolean => {
    if (localPinnedMap[contact.id] !== undefined) {
      return localPinnedMap[contact.id];
    }
    if ( typeof contact.isPinned === 'boolean') {
      return contact.isPinned;
    }
    return contact.id === 'group_global_team' || contact.id === 'user_kristin';
  };

  // Helper to get unread count
  const getContactUnreadCount = (contact: UserContact): number => {
    if (localUnreadMap[contact.id] !== undefined) {
      return localUnreadMap[contact.id];
    }
    return contact.unreadCount ?? 0;
  };

  // Filter and sort contacts
  const { filteredContacts, archivedCount, activeCount, recentCount, groupsCount, channelsCount, pinnedCount } = useMemo(() => {
    const nonDeleted = (contacts || []).filter((c) => c && !isContactDeleted(c));

    let archivedCount = 0;
    let activeCount = 0;
    let recentCount = 0;
    let groupsCount = 0;
    let channelsCount = 0;
    let pinnedCount = 0;

    nonDeleted.forEach((c) => {
      const archived = isContactArchived(c);
      const isGrp = Boolean(c.isGroup || c.entityType === 'group');
      const isCh = Boolean(c.isChannel || c.entityType === 'channel');
      if (archived) {
        archivedCount++;
      } else {
        recentCount++;
        if (c.online) activeCount++;
        if (isGrp) groupsCount++;
        if (isCh) channelsCount++;
        if (isContactPinned(c)) pinnedCount++;
      }
    });

    const filtered = nonDeleted.filter((contact) => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch =
        (contact.name || '').toLowerCase().includes(q) ||
        (contact.lastMessage || '').toLowerCase().includes(q) ||
        (contact.channelHandle || '').toLowerCase().includes(q) ||
        (contact.channelCategory || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const archived = isContactArchived(contact);
      const isGrp = Boolean(contact.isGroup || contact.entityType === 'group');
      const isCh = Boolean(contact.isChannel || contact.entityType === 'channel');

      if (filterTab === 'archived') {
        return archived;
      }

      // 'recent', 'channels', 'groups', or 'active' tab should hide archived chats
      if (archived) return false;

      if (filterTab === 'channels') {
        return isCh;
      }

      if (filterTab === 'groups') {
        return isGrp;
      }

      if (filterTab === 'active') {
        return contact.online;
      }

      return true;
    });

    // Pinned contacts first, then preserve order
    filtered.sort((a, b) => {
      const pinA = isContactPinned(a) ? 1 : 0;
      const pinB = isContactPinned(b) ? 1 : 0;
      return pinB - pinA;
    });

    return {
      filteredContacts: filtered,
      archivedCount,
      activeCount,
      recentCount,
      groupsCount,
      channelsCount,
      pinnedCount,
    };
  }, [contacts, searchQuery, filterTab, localArchivedMap, localDeletedSet, localPinnedMap]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Action: Archive / Unarchive Contact
  const handleToggleArchive = async (contact: UserContact, customArchivedState?: boolean) => {
    const currentlyArchived = isContactArchived(contact);
    const targetState = customArchivedState !== undefined ? customArchivedState : !currentlyArchived;

    // Optimistic UI update
    setLocalArchivedMap((prev) => ({ ...prev, [contact.id]: targetState }));
    setSwipedChatId(null);
    setActiveDraggingId(null);
    setDragOffset(0);

    // Call upstream handler
    if (onArchiveChat) {
      await onArchiveChat(contact.id, targetState);
    }

    // Show undo toast
    if (targetState) {
      showToast(
        `Chat with ${contact.name} archived`,
        'Undo',
        () => handleToggleArchive(contact, false)
      );
    } else {
      showToast(
        `Chat with ${contact.name} unarchived`,
        'Undo',
        () => handleToggleArchive(contact, true)
      );
    }
  };

  // Action: Delete Chat
  const handleExecuteDelete = async (contact: UserContact) => {
    // Optimistic UI update
    setLocalDeletedSet((prev) => new Set(prev).add(contact.id));
    setContactToDelete(null);
    setLongPressedContact(null);
    setSwipedChatId(null);
    setActiveDraggingId(null);
    setDragOffset(0);

    // Call upstream handler
    if (onDeleteChat) {
      await onDeleteChat(contact.id);
    }

    // Show toast with undo
    showToast(
      `Chat with ${contact.name} deleted`,
      'Undo',
      () => handleRestoreDeleted(contact)
    );
  };

  // Action: Restore Deleted Chat
  const handleRestoreDeleted = async (contact: UserContact) => {
    setLocalDeletedSet((prev) => {
      const next = new Set(prev);
      next.delete(contact.id);
      return next;
    });

    if (onRestoreChat) {
      await onRestoreChat(contact.id);
    }
    showToast(`Chat with ${contact.name} restored`);
  };

  // Action: Toggle Pin Chat
  const handleTogglePin = async (contact: UserContact, explicitPinnedState?: boolean) => {
    const currentlyPinned = isContactPinned(contact);
    const nextPinned = explicitPinnedState !== undefined ? explicitPinnedState : !currentlyPinned;

    setLocalPinnedMap((prev) => {
      const updated = { ...prev, [contact.id]: nextPinned };
      try {
        localStorage.setItem('freedom_pinned_chats_map_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setLongPressedContact(null);
    setSwipedChatId(null);
    setActiveDraggingId(null);
    setDragOffset(0);

    if (onPinChat) {
      await onPinChat(contact.id, nextPinned);
    }
    showToast(
      nextPinned ? `📌 Pinned ${contact.name} to top` : `Unpinned ${contact.name}`,
      'Undo',
      () => handleTogglePin(contact, currentlyPinned)
    );
  };

  // Action: Toggle Read / Unread
  const handleToggleRead = async (contact: UserContact) => {
    const currentUnread = getContactUnreadCount(contact);
    const targetUnread = currentUnread > 0 ? 0 : 1;

    setLocalUnreadMap((prev) => ({ ...prev, [contact.id]: targetUnread }));
    setLongPressedContact(null);

    if (onToggleReadChat) {
      await onToggleReadChat(contact.id, targetUnread === 0);
    }
  };

  // Trigger Long-Press
  const triggerLongPress = (contact: UserContact) => {
    didLongPressRef.current = true;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(45);
      } catch {
        // ignore vibration permissions
      }
    }
    setSwipedChatId(null);
    setActiveDraggingId(null);
    setDragOffset(0);
    setLongPressedContact(contact);
  };

  // ============================================================================
  // Touch Event Handlers for Swipe & Long-Press
  // ============================================================================
  const handleTouchStart = (e: React.TouchEvent, contact: UserContact) => {
    const touch = e.touches[0];
    dragStartXRef.current = touch.clientX;
    dragStartYRef.current = touch.clientY;
    isHorizontalSwipeRef.current = false;
    hasMovedSignificantlyRef.current = false;
    didLongPressRef.current = false;

    // If another row is currently swiped open and we touched a different row, close it
    if (swipedChatId && swipedChatId !== contact.id) {
      setSwipedChatId(null);
    }

    // Start long-press timer
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMovedSignificantlyRef.current) {
        triggerLongPress(contact);
      }
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent, contact: UserContact) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartXRef.current;
    const deltaY = touch.clientY - dragStartYRef.current;

    // Check if user moved enough to cancel long-press
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      hasMovedSignificantlyRef.current = true;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Determine direction on first significant movement
    if (!isHorizontalSwipeRef.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isHorizontalSwipeRef.current = true;
    }

    if (isHorizontalSwipeRef.current) {
      // Swiping left: negative deltaX
      const rawOffset = deltaX;
      // Clamp between -160px and 0px
      const clampedOffset = Math.max(-160, Math.min(0, rawOffset));

      setActiveDraggingId(contact.id);
      setDragOffset(clampedOffset);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, contact: UserContact) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (activeDraggingId === contact.id) {
      // Swipe left triggers delete directly without showing background tray buttons
      if (dragOffset < -65) {
        handleExecuteDelete(contact);
      }
      setSwipedChatId(null);
      setActiveDraggingId(null);
      setDragOffset(0);
    }
  };

  // ============================================================================
  // Desktop Mouse Drag Handlers for Swipe & Long-Press
  // ============================================================================
  const handleMouseDown = (e: React.MouseEvent, contact: UserContact) => {
    // Only handle primary left click for drag
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    isHorizontalSwipeRef.current = false;
    hasMovedSignificantlyRef.current = false;
    didLongPressRef.current = false;

    if (swipedChatId && swipedChatId !== contact.id) {
      setSwipedChatId(null);
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMovedSignificantlyRef.current && isMouseDownRef.current) {
        triggerLongPress(contact);
      }
    }, 450);
  };

  const handleMouseMove = (e: React.MouseEvent, contact: UserContact) => {
    if (!isMouseDownRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const deltaY = e.clientY - dragStartYRef.current;

    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      hasMovedSignificantlyRef.current = true;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (!isHorizontalSwipeRef.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isHorizontalSwipeRef.current = true;
    }

    if (isHorizontalSwipeRef.current) {
      const rawOffset = deltaX;
      const clampedOffset = Math.max(-160, Math.min(0, rawOffset));

      setActiveDraggingId(contact.id);
      setDragOffset(clampedOffset);
    }
  };

  const handleMouseUp = (e: React.MouseEvent, contact: UserContact) => {
    isMouseDownRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (activeDraggingId === contact.id) {
      if (dragOffset < -65) {
        handleExecuteDelete(contact);
      }
      setSwipedChatId(null);
      setActiveDraggingId(null);
      setDragOffset(0);
    }
  };

  // Row click handler (open chat only if user didn't long press or swipe)
  const handleItemClick = (contact: UserContact) => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    // If currently swiped open, click closes it instead of navigating
    if (swipedChatId === contact.id) {
      setSwipedChatId(null);
      return;
    }
    if (swipedChatId) {
      setSwipedChatId(null);
      return;
    }
    if (hasMovedSignificantlyRef.current) {
      return;
    }
    onSelectChat(contact);
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#12161F] text-white' : 'bg-white text-slate-900'
      }`}
      onClick={() => {
        if (swipedChatId && !activeDraggingId) {
          setSwipedChatId(null);
        }
      }}
    >
      {/* Top Header - Matches chat_kit design with emerald green header */}
      <div
        style={{ backgroundColor: primaryColor }}
        className="pt-1 pb-3 px-4 z-10 shrink-0 text-white rounded-b-[24px] shadow-sm transition-colors duration-200"
      >
        {/* Status Bar */}
        <StatusBar time="9:41" theme="green" className="px-0 -mx-1 text-white" />

        {/* Title & Action Bar */}
        <div className="flex items-center justify-between mt-1 mb-2.5">
          <div className="flex items-center gap-2.5">
            <button
              id="chats-header-my-profile-thumb-btn"
              type="button"
              onClick={() => onNavigate('profile')}
              className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white/80 shadow-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform bg-slate-900"
              title="My Profile Thumbnail • Tap to open Profile"
            >
              <img
                src={persistentMyAvatar}
                alt="My Profile Thumbnail"
                className="w-full h-full object-cover"
              />
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Chats</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="chats-header-snap-camera-btn"
              type="button"
              onClick={() => setIsSnapCameraOpen(true)}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
              title="Open Face Filter Camera (Masks, Effects & Filters — Photo & Video)"
            >
              <Camera className="w-4 h-4" />
            </button>

            {onOpenQrScanner && (
              <button
                id="chats-header-scan-qr-btn"
                onClick={onOpenQrScanner}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
                title="Scan contact QR code with camera"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}

            {(onOpenCreateChannelModal || onOpenCreateGroupModal) && (
              <button
                id="chats-header-create-channel-btn"
                onClick={onOpenCreateChannelModal || onOpenCreateGroupModal}
                className="px-2.5 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center gap-1 transition-all cursor-pointer text-white text-[11px] font-bold"
                title="Create new broadcast channel"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Create Channel</span>
              </button>
            )}

            {onOpenCreateGroupModal && (
              <button
                id="chats-header-create-group-btn"
                onClick={onOpenCreateGroupModal}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
                title="Create new group chat"
              >
                <Users className="w-4 h-4" />
              </button>
            )}

            {onOpenNewChatModal && (
              <button
                id="chats-header-new-chat-btn"
                onClick={onOpenNewChatModal}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
                title="New conversation"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Segmented Filter Pills matching Screenshot_20260927-154846.png */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            id="pill-recent-msg"
            onClick={() => {
              setFilterTab('recent');
              setSwipedChatId(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'recent'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
            }`}
          >
            <span>Recent</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterTab === 'recent' ? 'bg-slate-200 text-slate-800' : 'bg-white/30 text-white'
              }`}
            >
              {recentCount}
            </span>
          </button>

          <button
            id="pill-channels-msg"
            onClick={() => {
              setFilterTab('channels');
              setSwipedChatId(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'channels'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
            }`}
          >
            <Megaphone className="w-3 h-3" />
            <span>Channels</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterTab === 'channels' ? 'bg-slate-200 text-slate-800' : 'bg-white/30 text-white'
              }`}
            >
              {channelsCount}
            </span>
          </button>

          <button
            id="pill-groups-msg"
            onClick={() => {
              setFilterTab('groups');
              setSwipedChatId(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'groups'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Groups</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterTab === 'groups' ? 'bg-slate-200 text-slate-800' : 'bg-white/30 text-white'
              }`}
            >
              {groupsCount}
            </span>
          </button>

          <button
            id="pill-active-msg"
            onClick={() => {
              setFilterTab('active');
              setSwipedChatId(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'active'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
            }`}
          >
            <span>Active</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                filterTab === 'active' ? 'bg-emerald-500' : 'bg-emerald-300'
              }`}
            />
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterTab === 'active' ? 'bg-slate-200 text-slate-800' : 'bg-white/30 text-white'
              }`}
            >
              {activeCount || 4}
            </span>
          </button>

          <button
            id="pill-archived-msg"
            onClick={() => {
              setFilterTab('archived');
              setSwipedChatId(null);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterTab === 'archived'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
            }`}
          >
            <Archive className="w-3 h-3" />
            <span>Archive</span>
            {archivedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  filterTab === 'archived' ? 'bg-slate-200 text-slate-800 font-bold' : 'bg-white/30 text-white'
                }`}
              >
                {archivedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Conversations List Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 relative">
        {/* Chats Icon Notifications: Automatic Welcome Message & Friends Activity (Befriend / Like Media) */}
        {filterTab === 'recent' && !searchQuery && chatIconNotifications.length > 0 && (
          <div
            id="chats-icon-notifications-feed"
            className={`p-3 rounded-2xl mb-2 border space-y-2 ${
              isDark
                ? 'bg-[#181E2B] border-purple-500/35 text-slate-100'
                : 'bg-purple-50/70 border-purple-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: primaryColor }}
                  className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                >
                  🔔
                </span>
                <span className="text-xs font-extrabold tracking-tight">
                  Chats Notifications & Friend Activity
                </span>
                {chatIconNotifications.filter((n) => n.unread).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                    {chatIconNotifications.filter((n) => n.unread).length} New
                  </span>
                )}
              </div>
              <button
                id="chats-notifications-mark-read-btn"
                type="button"
                onClick={() => markAllChatIconNotificationsRead()}
                className="text-[10px] font-bold text-emerald-500 hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
              {chatIconNotifications.slice(0, 4).map((notif) => (
                <div
                  key={notif.id}
                  id={`chat-icon-notif-item-${notif.id}`}
                  onClick={() => {
                    const targetContact =
                      contacts.find((c) => c.id === notif.contactId) || contacts[0];
                    if (targetContact) {
                      onSelectChat(targetContact);
                    }
                  }}
                  className={`px-2.5 py-2 rounded-xl border flex items-start justify-between gap-2 cursor-pointer transition-all ${
                    isDark
                      ? 'bg-[#12161F]/90 hover:bg-slate-800/80 border-slate-800'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-sm shrink-0 mt-0.5">
                      {notif.type === 'welcome_message'
                        ? '🎉'
                        : notif.type === 'friend_befriended'
                        ? '🤝'
                        : '❤️'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-extrabold truncate">
                          {notif.title}
                        </span>
                        {notif.unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-snug">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-slate-400 font-mono">{notif.timeLabel}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissChatIconNotification(notif.id);
                      }}
                      className="p-0.5 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Dismiss notification"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Create Channel & Group Bar */}
        {(onOpenCreateChannelModal || onOpenCreateGroupModal) && filterTab !== 'archived' && (
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-2xl mb-1.5 border ${
              isDark
                ? 'bg-[#181D26] border-slate-800 text-slate-200'
                : 'bg-slate-50 border-slate-200/80 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              >
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold block truncate">Broadcast Channels</span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {channelsCount > 0
                    ? `${channelsCount} active ${channelsCount === 1 ? 'channel' : 'channels'}`
                    : 'Create your own public or private channel'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                id="chats-banner-create-channel-btn"
                type="button"
                onClick={onOpenCreateChannelModal || onOpenCreateGroupModal}
                style={{ backgroundColor: primaryColor }}
                className="px-3 py-1.5 rounded-xl text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Megaphone className="w-3 h-3" />
                <span>+ Create Channel</span>
              </button>
            </div>
          </div>
        )}

        {/* If in Recent tab and there are archived chats, show a subtle quick shortcut */}
        {filterTab === 'recent' && archivedCount > 0 && !searchQuery && (
          <div
            id="archived-chats-shortcut-row"
            onClick={() => setFilterTab('archived')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all mb-1 border ${
              isDark
                ? 'bg-[#181D26] hover:bg-slate-800/80 border-slate-800 text-slate-300'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <Archive className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-xs font-bold block">Archived Chats</span>
                <span className="text-[10px] text-slate-400">
                  {archivedCount} {archivedCount === 1 ? 'conversation' : 'conversations'} archived
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs font-mono">
              <span className="font-bold text-emerald-500">{archivedCount}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Archived Banner Info when in Archived tab */}
        {filterTab === 'archived' && (
          <div
            className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 mb-2 ${
              isDark
                ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Archived conversations stay stored here until unarchived. Swipe left or long-press to unarchive.
              </span>
            </div>
            <button
              onClick={() => setFilterTab('recent')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold shrink-0 hover:bg-emerald-600 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {filteredContacts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
            {filterTab === 'archived' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Inbox className="w-7 h-7 stroke-[1.8]" />
                </div>
                <p className="text-sm font-bold">No Archived Chats</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Swipe any conversation left from the recent list to archive it and keep your chats organized.
                </p>
                <button
                  onClick={() => setFilterTab('recent')}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold hover:brightness-110 cursor-pointer transition-all"
                >
                  View Recent Chats
                </button>
              </>
            ) : filterTab === 'channels' ? (
              <>
                <div
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                >
                  <Megaphone className="w-7 h-7 stroke-[1.8]" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  No Channels Created Yet
                </p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Create a public or private broadcast channel to share updates, media, and announcements with unlimited subscribers.
                </p>
                <button
                  id="empty-state-create-channel-btn"
                  type="button"
                  onClick={onOpenCreateChannelModal || onOpenCreateGroupModal}
                  style={{ backgroundColor: primaryColor }}
                  className="mt-4 px-4 py-2.5 rounded-xl text-white text-xs font-bold hover:brightness-110 cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>Create Channel</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-2 text-slate-400">
                  <Search className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold">No chats found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {searchQuery ? `No results matching "${searchQuery}"` : 'Start a new conversation or create a channel above'}
                </p>
              </>
            )}
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isDraggingThis = activeDraggingId === contact.id;
            const currentOffset = isDraggingThis ? dragOffset : 0;
            const pinned = isContactPinned(contact);
            const unread = getContactUnreadCount(contact);

            return (
              <div
                key={contact.id}
                id={`chat-item-container-${contact.id}`}
                className="relative overflow-hidden rounded-2xl transition-all select-none"
              >
                {/* Forefront Chat Item Card (Slides horizontally with touch / mouse drag) */}
                <div
                  id={`chat-item-${contact.id}`}
                  onClick={() => handleItemClick(contact)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    triggerLongPress(contact);
                  }}
                  onTouchStart={(e) => handleTouchStart(e, contact)}
                  onTouchMove={(e) => handleTouchMove(e, contact)}
                  onTouchEnd={(e) => handleTouchEnd(e, contact)}
                  onTouchCancel={() => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    setActiveDraggingId(null);
                  }}
                  onMouseDown={(e) => handleMouseDown(e, contact)}
                  onMouseMove={(e) => handleMouseMove(e, contact)}
                  onMouseUp={(e) => handleMouseUp(e, contact)}
                  onMouseLeave={() => {
                    isMouseDownRef.current = false;
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    if (activeDraggingId === contact.id) {
                      setActiveDraggingId(null);
                    }
                  }}
                  style={{
                    transform: `translateX(${currentOffset}px)`,
                    transition: isDraggingThis ? 'none' : 'transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  }}
                  className={`group relative z-10 flex items-center gap-3 py-3 px-3 rounded-2xl cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[#141923] hover:bg-[#1a2130] border border-slate-800/60'
                      : 'bg-white hover:bg-slate-50 border border-slate-100 shadow-xs'
                  }`}
                >
                  {/* Visual Indicator for Pinned Chats */}
                  {pinned && (
                    <div
                      id={`pinned-chat-badge-${contact.id}`}
                      className="absolute left-1.5 top-1.5 text-amber-500"
                      title="Pinned conversation"
                    >
                      <Pin className="w-3 h-3 fill-current rotate-45" />
                    </div>
                  )}

                  {/* Avatar with Online or Group Indicator (Click to visit profile) */}
                  <div
                    onClick={(e) => {
                      if (onViewProfile) {
                        e.stopPropagation();
                        onViewProfile(contact);
                      }
                    }}
                    className="relative shrink-0 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title={`View ${contact.name}'s profile & media`}
                  >
                    <img
                      src={getPersistentUserThumbnail(contact, false)}
                      alt={contact.name}
                      className={`${
                        contact.isGroup || contact.entityType === 'group'
                          ? 'w-16 h-16'
                          : 'w-15 h-15'
                      } rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-400`}
                    />
                    {contact.isChannel || contact.entityType === 'channel' ? (
                      <span
                        style={{ backgroundColor: primaryColor }}
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-2 border-white dark:border-[#141923] rounded-full flex items-center justify-center text-white shadow-xs"
                        title={`Channel (${contact.subscribersCount || 1} subscribers)`}
                      >
                        <Megaphone className="w-3 h-3" />
                      </span>
                    ) : contact.isGroup || contact.entityType === 'group' ? (
                      <span
                        style={{ backgroundColor: primaryColor }}
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-2 border-white dark:border-[#141923] rounded-full flex items-center justify-center text-white shadow-xs"
                        title={`Group chat (${contact.participants?.length || 1} participants)`}
                      >
                        <Users className="w-3 h-3" />
                      </span>
                    ) : contact.online ? (
                      <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#141923] rounded-full" />
                    ) : null}
                  </div>

                  {/* Contact Info & Message snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        <h2 className="font-bold text-sm tracking-tight truncate">
                          {contact.name}
                        </h2>
                        {isAccountProfileValidated(contact) && (
                          <VerifiedCheckmarkBadge
                            id={`chat-list-verified-badge-${contact.id}`}
                            size="sm"
                            title={`${contact.name} • Account Profile Validation Completed`}
                          />
                        )}
                        {(contact.isChannel || contact.entityType === 'channel') && (
                          <span
                            style={{
                              backgroundColor: `${primaryColor}18`,
                              color: primaryColor,
                              borderColor: `${primaryColor}35`,
                            }}
                            className="text-[9px] px-1.5 py-0.2 rounded-md font-bold flex items-center gap-0.5 shrink-0 border"
                          >
                            <Megaphone className="w-2.5 h-2.5" />
                            <span>CHANNEL • {contact.subscribersCount || 1}</span>
                          </span>
                        )}
                        {(contact.isGroup || contact.entityType === 'group') && (
                          <span
                            style={{
                              backgroundColor: `${primaryColor}18`,
                              color: primaryColor,
                              borderColor: `${primaryColor}35`,
                            }}
                            className="text-[9px] px-1.5 py-0.2 rounded-md font-bold flex items-center gap-0.5 shrink-0 border"
                          >
                            <Users className="w-2.5 h-2.5" />
                            <span>{contact.participants?.length || 1}</span>
                          </span>
                        )}
                        {pinned && (
                          <button
                            id={`pinned-pill-toggle-${contact.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePin(contact);
                            }}
                            title="Pinned chat — click to unpin"
                            className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-extrabold flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors"
                          >
                            <Pin className="w-2.5 h-2.5 fill-current rotate-45" />
                            <span>Pinned</span>
                          </button>
                        )}
                        {(contact.isBlocked || contact.status === 'blocked') && (
                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/15 text-rose-500 dark:text-rose-400 font-bold text-[9px] shrink-0 border border-rose-500/25">
                            Blocked
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {contact.time}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2 flex items-center gap-1">
                        {contact.lastMessageStatus && unread === 0 && (
                          <span className="shrink-0 inline-flex items-center">
                            {contact.lastMessageStatus === 'sent' && (
                              <span title="Sent (Single checkmark)">
                                <Check className="w-3.5 h-3.5 text-slate-400 stroke-[2.3]" />
                              </span>
                            )}
                            {contact.lastMessageStatus === 'delivered' && (
                              <span title="Delivered (Double checkmarks)">
                                <CheckCheck className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
                              </span>
                            )}
                            {contact.lastMessageStatus === 'read' && (
                              <span title="Read (Double blue checkmarks)">
                                <CheckCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 stroke-[2.4]" />
                              </span>
                            )}
                            {contact.lastMessageStatus === 'failed' && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 mr-0.5" title="Failed" />
                            )}
                          </span>
                        )}
                        <span className="truncate">{contact.lastMessage}</span>
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(contact.isChannel || contact.entityType === 'channel') && (() => {
                            const subKey = `freedom_channel_subscribed_${contact.id}`;
                            let isSubbed =
                              channelSubscribedMap[contact.id] !== undefined
                                ? channelSubscribedMap[contact.id]
                                : Boolean(contact.isSubscribedChannel);
                            try {
                              const savedSub = localStorage.getItem(subKey);
                              if (savedSub === 'true') isSubbed = true;
                              if (savedSub === 'false') isSubbed = false;
                            } catch {}
                            const baseCount = contact.subscribersCount || 1;
                            const countDisplay =
                              channelSubscribersCountMap[contact.id] !== undefined
                                ? channelSubscribersCountMap[contact.id]
                                : baseCount;

                            return (
                              <button
                                id={`channel-page-subscribe-btn-${contact.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextSub = !isSubbed;
                                  const nextCount = nextSub
                                    ? countDisplay + 1
                                    : Math.max(0, countDisplay - 1);
                                  setChannelSubscribedMap((prev) => ({
                                    ...prev,
                                    [contact.id]: nextSub,
                                  }));
                                  setChannelSubscribersCountMap((prev) => ({
                                    ...prev,
                                    [contact.id]: nextCount,
                                  }));
                                  try {
                                    localStorage.setItem(subKey, String(nextSub));
                                  } catch {}
                                  saveContactOrChannelToDb({
                                    ...contact,
                                    isSubscribedChannel: nextSub,
                                    subscribersCount: nextCount,
                                  }).catch(() => {});
                                  showToast(
                                    nextSub
                                      ? `🔔 Subscribed to ${contact.name}!`
                                      : `Unsubscribed from ${contact.name}`
                                  );
                                }}
                                style={isSubbed ? undefined : { backgroundColor: primaryColor }}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                  isSubbed
                                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'text-white hover:brightness-110 active:scale-95'
                                }`}
                                title={isSubbed ? 'Subscribed — click to unsubscribe' : 'Subscribe to channel'}
                              >
                                {isSubbed ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                                    <span>Subscribed ({countDisplay})</span>
                                  </>
                                ) : (
                                  <>
                                    <Megaphone className="w-2.5 h-2.5" />
                                    <span>Subscribe to channel</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}

                        {(contact.isGroup || contact.entityType === 'group') && (
                          <button
                            id={`chat-list-join-group-btn-${contact.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const key = `freedom_group_joined_state_${contact.id}`;
                              const currentlyJoined =
                                localStorage.getItem(key) === 'joined' || Boolean(contact.isJoinedGroup);
                              const nextJoined = !currentlyJoined;
                              try {
                                localStorage.setItem(key, nextJoined ? 'joined' : 'not_joined');
                              } catch {}
                              showToast(
                                nextJoined
                                  ? `🎉 Joined ${contact.name}!`
                                  : `Left ${contact.name}`
                              );
                            }}
                            style={{ backgroundColor: primaryColor }}
                            className="px-2.5 py-1 rounded-xl text-white text-[10px] font-extrabold flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-2xs"
                            title="Join Group"
                          >
                            <Users className="w-2.5 h-2.5" />
                            <span>
                              {(() => {
                                try {
                                  return localStorage.getItem(`freedom_group_joined_state_${contact.id}`) === 'joined'
                                    ? 'Joined'
                                    : 'Join Group';
                                } catch {
                                  return 'Join Group';
                                }
                              })()}
                            </span>
                          </button>
                        )}

                        {unread > 0 && (
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button for New Chat */}
      <button
        id="fab-new-chat-btn"
        onClick={() => {
          if (onOpenNewChatModal) {
            onOpenNewChatModal();
          } else {
            onNavigate('people');
          }
        }}
        style={{ backgroundColor: primaryColor }}
        className="absolute right-5 bottom-18 w-13 h-13 rounded-full hover:brightness-105 active:scale-95 text-white shadow-lg shadow-black/20 flex items-center justify-center transition-all z-20 cursor-pointer"
        title="Start new conversation"
      >
        <UserPlus className="w-5 h-5 stroke-[2.2]" />
      </button>

      {/* Undoable Toast Notification Banner */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 border backdrop-blur-md ${
              isDark
                ? 'bg-[#181D26]/95 border-white/10 text-white'
                : 'bg-slate-900/95 border-black/10 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-medium truncate">{toast.text}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.actionText && toast.onAction && (
                <button
                  id="toast-undo-btn"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 active:scale-95 cursor-pointer transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{toast.actionText}</span>
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Long-Press Context Action Sheet / Bottom Sheet Modal */}
      {longPressedContact && (
        <div
          id="longpress-context-sheet-backdrop"
          onClick={() => setLongPressedContact(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-3 animate-in fade-in duration-150"
        >
          <div
            id="longpress-context-sheet-modal"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl p-4 shadow-2xl border transition-all animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 ${
              isDark
                ? 'bg-[#161C26] border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header with Contact Preview */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <img
                src={longPressedContact.avatar}
                alt={longPressedContact.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-300 dark:border-slate-700"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm truncate">{longPressedContact.name}</h3>
                  {isContactPinned(longPressedContact) && (
                    <Pin className="w-3 h-3 text-emerald-500 fill-current" />
                  )}
                  {isContactArchived(longPressedContact) && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {longPressedContact.lastMessage}
                </p>
              </div>
              <button
                onClick={() => setLongPressedContact(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Actions List */}
            <div className="py-2 space-y-1">
              {/* 1. Pin / Unpin Action (Top priority in long-press & menu options) */}
              <button
                id="context-action-pin"
                onClick={() => handleTogglePin(longPressedContact)}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                    {isContactPinned(longPressedContact) ? (
                      <PinOff className="w-4 h-4" />
                    ) : (
                      <Pin className="w-4 h-4 fill-current rotate-45" />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="block font-bold">
                      {isContactPinned(longPressedContact) ? 'Unpin Conversation' : 'Pin to Top'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {isContactPinned(longPressedContact)
                        ? 'Remove priority placement at top'
                        : 'Keep chat always at the top of the list'}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isContactPinned(longPressedContact)
                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      : 'bg-slate-500/15 text-slate-400'
                  }`}
                >
                  {isContactPinned(longPressedContact) ? 'Pinned' : 'Pin'}
                </span>
              </button>

              {/* 2. View Profile / Group Page Action */}
              {onViewProfile && (
                <button
                  id="context-action-view-profile"
                  onClick={() => {
                    const contact = longPressedContact;
                    setLongPressedContact(null);
                    onViewProfile(contact);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                      {longPressedContact.isGroup || longPressedContact.entityType === 'group' ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <div className="text-left">
                      <span className="block font-bold">
                        {longPressedContact.isGroup || longPressedContact.entityType === 'group'
                          ? 'View Group Page & Group Gallery'
                          : 'View User Profile & Bio'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {longPressedContact.isGroup || longPressedContact.entityType === 'group'
                          ? 'Join Group, view Group Cover & shared media gallery'
                          : 'Show description, details & media gallery'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {/* 3. Archive / Unarchive Action */}
              <button
                id="context-action-archive"
                onClick={() => {
                  const contact = longPressedContact;
                  setLongPressedContact(null);
                  handleToggleArchive(contact);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                    {isContactArchived(longPressedContact) ? (
                      <ArchiveRestore className="w-4 h-4" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="block font-bold">
                      {isContactArchived(longPressedContact) ? 'Unarchive Chat' : 'Archive Chat'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {isContactArchived(longPressedContact)
                        ? 'Move back to main conversations list'
                        : 'Hide conversation from chats list'}
                    </span>
                  </div>
                </div>
              </button>

              {/* 3. Mark Read / Unread Action */}
              <button
                id="context-action-read"
                onClick={() => handleToggleRead(longPressedContact)}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center">
                    <CheckCheck className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="block font-bold">
                      {getContactUnreadCount(longPressedContact) > 0 ? 'Mark as Read' : 'Mark as Unread'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {getContactUnreadCount(longPressedContact) > 0
                        ? 'Clear unread notification badge'
                        : 'Flag chat with new message badge'}
                    </span>
                  </div>
                </div>
              </button>

              {/* 4. Delete Chat Action (Destructive) */}
              <button
                id="context-action-delete"
                onClick={() => {
                  const contact = longPressedContact;
                  setLongPressedContact(null);
                  setContactToDelete(contact);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors text-rose-500 hover:bg-rose-500/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-rose-500">Delete Conversation</span>
                    <span className="text-[10px] text-rose-400 font-normal">
                      Permanently remove conversation and messages
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setLongPressedContact(null)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {contactToDelete && (
        <div
          id="delete-chat-confirm-backdrop"
          onClick={() => setContactToDelete(null)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="delete-chat-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border text-center transition-all animate-in zoom-in-95 duration-200 ${
              isDark
                ? 'bg-[#181D26] border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Warning Icon Emblem */}
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-7 h-7 stroke-[2]" />
            </div>

            <h3 className="font-extrabold text-base mb-1">
              Delete chat with {contactToDelete.name}?
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5 leading-relaxed">
              Are you sure you want to delete this conversation? This will remove all messages from your chats list. You can undo this action immediately after deleting.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                id="cancel-delete-chat-btn"
                type="button"
                onClick={() => setContactToDelete(null)}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>

              <button
                id="confirm-delete-chat-btn"
                type="button"
                onClick={() => handleExecuteDelete(contactToDelete)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapchat-Style Face Mask, Effect & Filter Camera Modal */}
      <SnapFaceFilterCameraModal
        isOpen={isSnapCameraOpen}
        onClose={() => setIsSnapCameraOpen(false)}
        recipientName={contacts[0]?.name || 'Chat'}
        primaryColor={primaryColor}
        onSendPhoto={(_photoDataUrl, caption) => {
          showToast(`📸 Snapped filtered photo${caption ? `: "${caption}"` : ''}! Opening chat...`);
          if (contacts[0]) {
            onSelectChat(contacts[0]);
          }
        }}
        onSendVideo={(_videoUrl, _thumb, caption) => {
          showToast(`🎥 Recorded filtered video${caption ? `: "${caption}"` : ''}! Opening chat...`);
          if (contacts[0]) {
            onSelectChat(contacts[0]);
          }
        }}
      />

      {/* Bottom Navigation */}
      <BottomNav
        currentScreen="chats"
        onNavigate={onNavigate}
        theme={theme}
        unreadCount={3}
        isAdminVerified={isAdminVerified}
        primaryColor={primaryColor}
        userAvatar={persistentMyAvatar}
      />

      {/* Device Bottom Home Indicator Bar (iOS style) */}
      <div className="w-full flex justify-center pb-2 pt-0.5 bg-white dark:bg-[#181A20] shrink-0 z-30">
        <div className="w-32 h-1 bg-slate-900/25 dark:bg-white/25 rounded-full pointer-events-none" />
      </div>
    </div>
  );
};
