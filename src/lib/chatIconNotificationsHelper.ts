// ============================================================================
// CHATS ICON NOTIFICATIONS HELPER
// Sends real-time notifications to the User Chats Icon (#nav-chats-btn) when:
// 1. A new user joins / registers -> Automatic Welcome Message:
//    "Welcome to Our Messaging Platform where you can Connect with Your Friends and Family"
// 2. User's friends make any activity:
//    - Befriend someone (friend_befriended)
//    - Like media files (friend_liked_media)
// ============================================================================

export const OFFICIAL_WELCOME_MESSAGE_TEXT =
  'Welcome to Our Messaging Platform where you can Connect with Your Friends and Family';

export type ChatIconNotificationType =
  | 'welcome_message'
  | 'friend_befriended'
  | 'friend_liked_media';

export interface ChatIconActivityNotification {
  id: string;
  type: ChatIconNotificationType;
  title: string;
  message: string;
  actorName: string;
  actorAvatar?: string;
  contactId?: string;
  mediaTitle?: string;
  mediaUrl?: string;
  createdAt: number;
  timeLabel: string;
  unread: boolean;
}

const STORAGE_KEY = 'freedom_chats_icon_notifications_v1';
const WELCOME_SENT_MAP_KEY = 'freedom_welcome_chat_notif_sent_users_v1';

function getDefaultSeededNotifications(): ChatIconActivityNotification[] {
  const now = Date.now();
  return [
    {
      id: 'notif_welcome_default',
      type: 'welcome_message',
      title: 'Welcome to Our Messaging Platform',
      message: OFFICIAL_WELCOME_MESSAGE_TEXT,
      actorName: 'WeedChat Official',
      contactId: 'usr_elena_rodriguez',
      createdAt: now - 60 * 1000,
      timeLabel: 'Just now',
      unread: true,
    },
    {
      id: 'notif_friend_liked_seed',
      type: 'friend_liked_media',
      title: 'Friend Liked Media File',
      message: 'Elena Rodriguez ❤️ liked your media file in Gallery',
      actorName: 'Elena Rodriguez',
      contactId: 'usr_elena_rodriguez',
      mediaTitle: 'Shared Gallery Photo',
      createdAt: now - 3 * 60 * 1000,
      timeLabel: '2m ago',
      unread: true,
    },
    {
      id: 'notif_friend_befriend_seed',
      type: 'friend_befriended',
      title: 'Friend Activity • New Connection',
      message: 'Elena Rodriguez 🤝 befriended Kristin Watson',
      actorName: 'Elena Rodriguez',
      contactId: 'usr_elena_rodriguez',
      createdAt: now - 8 * 60 * 1000,
      timeLabel: '5m ago',
      unread: true,
    },
  ];
}

export function getChatIconNotifications(): ChatIconActivityNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = getDefaultSeededNotifications();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const seeded = getDefaultSeededNotifications();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return getDefaultSeededNotifications();
  }
}

export function getUnreadChatIconNotificationsCount(): number {
  return getChatIconNotifications().filter((n) => n.unread).length;
}

function saveAndBroadcastNotifications(
  list: ChatIconActivityNotification[],
  latestAdded?: ChatIconActivityNotification
) {
  const trimmed = list.slice(0, 40);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('freedom-chats-icon-notifications-updated', {
        detail: {
          notifications: trimmed,
          unreadCount: trimmed.filter((n) => n.unread).length,
          latestAdded,
        },
      })
    );
  }
}

export function pushChatIconNotification(
  item: Omit<ChatIconActivityNotification, 'id' | 'createdAt' | 'timeLabel' | 'unread'> & {
    id?: string;
    timeLabel?: string;
  }
): ChatIconActivityNotification {
  const current = getChatIconNotifications();
  const now = Date.now();
  const timeStr =
    item.timeLabel ||
    new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newNotif: ChatIconActivityNotification = {
    id: item.id || `chat_icon_notif_${now}_${Math.random().toString(36).slice(2, 7)}`,
    type: item.type,
    title: item.title,
    message: item.message,
    actorName: item.actorName,
    actorAvatar: item.actorAvatar,
    contactId: item.contactId,
    mediaTitle: item.mediaTitle,
    mediaUrl: item.mediaUrl,
    createdAt: now,
    timeLabel: timeStr,
    unread: true,
  };

  const updated = [newNotif, ...current.filter((n) => n.id !== newNotif.id)];
  saveAndBroadcastNotifications(updated, newNotif);
  return newNotif;
}

/**
 * Automatically sends the official welcome message notification to the user's Chats icon
 * for any new user with the exact message:
 * "Welcome to Our Messaging Platform where you can Connect with Your Friends and Family"
 */
export function sendAutomaticWelcomeNotificationToChatsIcon(params?: {
  userId?: string;
  userName?: string;
  force?: boolean;
}): ChatIconActivityNotification | null {
  const userId = params?.userId || 'new_user';
  try {
    const sentMapRaw = localStorage.getItem(WELCOME_SENT_MAP_KEY);
    const sentMap: Record<string, boolean> = sentMapRaw ? JSON.parse(sentMapRaw) : {};
    if (!params?.force && sentMap[userId]) {
      return null;
    }
    sentMap[userId] = true;
    localStorage.setItem(WELCOME_SENT_MAP_KEY, JSON.stringify(sentMap));
  } catch {}

  return pushChatIconNotification({
    id: `notif_welcome_${userId}_${Date.now()}`,
    type: 'welcome_message',
    title: params?.userName
      ? `Welcome, ${params.userName}!`
      : 'Welcome to Our Messaging Platform',
    message: OFFICIAL_WELCOME_MESSAGE_TEXT,
    actorName: 'Official Welcome',
    contactId: 'usr_elena_rodriguez',
    timeLabel: 'Just now',
  });
}

/**
 * Sends a notification to the user's Chats icon when a friend befriends someone
 */
export function notifyChatsIconFriendBefriended(params: {
  friendName: string;
  friendAvatar?: string;
  befriendedPersonName?: string;
  contactId?: string;
}): ChatIconActivityNotification {
  const friendName = params.friendName || 'Your Friend';
  const targetName = params.befriendedPersonName || 'you';
  const msg =
    targetName.toLowerCase() === 'you'
      ? `🤝 ${friendName} befriended you on the platform!`
      : `🤝 Friend Activity: ${friendName} befriended ${targetName}`;

  return pushChatIconNotification({
    type: 'friend_befriended',
    title: 'Friend Activity • New Friend Connection',
    message: msg,
    actorName: friendName,
    actorAvatar: params.friendAvatar,
    contactId: params.contactId || 'usr_elena_rodriguez',
    timeLabel: 'Just now',
  });
}

/**
 * Sends a notification to the user's Chats icon when a friend likes media files
 */
export function notifyChatsIconFriendLikedMedia(params: {
  friendName: string;
  friendAvatar?: string;
  mediaTitle?: string;
  mediaUrl?: string;
  contactId?: string;
}): ChatIconActivityNotification {
  const friendName = params.friendName || 'Your Friend';
  const cleanTitle = params.mediaTitle || 'a media file';
  const msg = `❤️ Friend Activity: ${friendName} liked media file "${cleanTitle}"`;

  return pushChatIconNotification({
    type: 'friend_liked_media',
    title: 'Friend Activity • Liked Media File',
    message: msg,
    actorName: friendName,
    actorAvatar: params.friendAvatar,
    contactId: params.contactId || 'usr_elena_rodriguez',
    mediaTitle: cleanTitle,
    mediaUrl: params.mediaUrl,
    timeLabel: 'Just now',
  });
}

export function markAllChatIconNotificationsRead(): void {
  const current = getChatIconNotifications();
  const updated = current.map((n) => ({ ...n, unread: false }));
  saveAndBroadcastNotifications(updated);
}

export function dismissChatIconNotification(id: string): void {
  const current = getChatIconNotifications();
  const updated = current.filter((n) => n.id !== id);
  saveAndBroadcastNotifications(updated);
}

export function subscribeChatIconNotifications(
  callback: (data: {
    notifications: ChatIconActivityNotification[];
    unreadCount: number;
    latestAdded?: ChatIconActivityNotification;
  }) => void
): () => void {
  const handler = (e: Event) => {
    const customEv = e as CustomEvent<{
      notifications: ChatIconActivityNotification[];
      unreadCount: number;
      latestAdded?: ChatIconActivityNotification;
    }>;
    if (customEv.detail) {
      callback(customEv.detail);
    } else {
      const list = getChatIconNotifications();
      callback({
        notifications: list,
        unreadCount: list.filter((n) => n.unread).length,
      });
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('freedom-chats-icon-notifications-updated', handler);
    return () =>
      window.removeEventListener('freedom-chats-icon-notifications-updated', handler);
  }
  return () => {};
}
