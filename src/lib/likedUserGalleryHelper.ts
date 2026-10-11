import { notifyChatsIconFriendLikedMedia } from './chatIconNotificationsHelper';

export interface LikedGalleryMediaItem {
  id: string;
  messageId: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  title: string;
  senderName: string;
  timestamp: string;
  likesCount: number;
  likesDisplay: string;
  isLiked: boolean;
  addedAt: string;
  contactId?: string;
}

const LIKED_USER_GALLERY_STORAGE_KEY = 'freedom_liked_user_gallery_v1';

export function formatCompactLikes(count?: number, fallbackDisplay = '120K'): string {
  if (count === undefined || count === null) return fallbackDisplay;
  if (count >= 1000000) {
    const val = (count / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${val}M`;
  }
  if (count >= 1000) {
    const val = (count / 1000).toFixed(1).replace(/\.0$/, '');
    return `${val}K`;
  }
  return String(count);
}

export function getLikedUserGalleryItems(): LikedGalleryMediaItem[] {
  try {
    const raw = localStorage.getItem(LIKED_USER_GALLERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy demo items (ug-portrait-*)
        return parsed.filter(
          (item: LikedGalleryMediaItem) =>
            item && item.id && !String(item.id).startsWith('ug-portrait-')
        );
      }
    }
  } catch {}
  return [];
}

export function saveLikedUserGalleryItems(items: LikedGalleryMediaItem[]): void {
  try {
    const cleaned = items.filter(
      (item) => item && item.id && !String(item.id).startsWith('ug-portrait-')
    );
    localStorage.setItem(LIKED_USER_GALLERY_STORAGE_KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent('freedom-liked-gallery-updated'));
  } catch {}
}

export function addMediaToLikedUserGallery(
  item: Partial<LikedGalleryMediaItem> & { id: string; url: string }
): LikedGalleryMediaItem[] {
  const current = getLikedUserGalleryItems();
  const cleanId = item.messageId || item.id;
  const existingIdx = current.findIndex(
    (x) => x.id === cleanId || x.messageId === cleanId || x.url === item.url
  );

  const nowTime = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const newEntry: LikedGalleryMediaItem = {
    id: cleanId,
    messageId: cleanId,
    type: item.type === 'video' ? 'video' : 'image',
    url: item.url,
    thumbnailUrl: item.thumbnailUrl || item.url,
    title: item.title || 'Liked Media',
    senderName: item.senderName || 'You',
    timestamp: item.timestamp || nowTime,
    likesCount: item.likesCount ?? 1,
    likesDisplay: item.likesDisplay || formatCompactLikes(item.likesCount ?? 1, '1'),
    isLiked: true,
    addedAt: new Date().toISOString(),
    contactId: item.contactId,
  };

  let updated: LikedGalleryMediaItem[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = {
      ...updated[existingIdx],
      ...newEntry,
    };
  } else {
    updated = [newEntry, ...current];
  }

  saveLikedUserGalleryItems(updated);
  try {
    notifyChatsIconFriendLikedMedia({
      friendName: newEntry.senderName && newEntry.senderName !== 'You' ? newEntry.senderName : 'Elena Rodriguez',
      mediaTitle: newEntry.title || 'Liked Media File',
      mediaUrl: newEntry.thumbnailUrl || newEntry.url,
      contactId: newEntry.contactId || 'usr_elena_rodriguez',
    });
  } catch {}
  return updated;
}

export function removeMediaFromLikedUserGallery(messageIdOrId: string): LikedGalleryMediaItem[] {
  const current = getLikedUserGalleryItems();
  const updated = current.filter(
    (x) => x.id !== messageIdOrId && x.messageId !== messageIdOrId
  );
  saveLikedUserGalleryItems(updated);
  return updated;
}

const USER_MEDIA_SESSION_STORAGE_KEY = 'freedom_user_media_session_v1';

export interface UserMediaSessionData {
  sessionId: string;
  savedAt: string;
  itemsCount: number;
  items: LikedGalleryMediaItem[];
  activeAvatarUrl?: string;
  activeCoverUrl?: string;
}

export function saveUserMediaSession(
  customItems?: LikedGalleryMediaItem[],
  activeAvatarUrl?: string,
  activeCoverUrl?: string
): UserMediaSessionData {
  const items = customItems || getLikedUserGalleryItems();
  if (customItems) {
    saveLikedUserGalleryItems(customItems);
  }
  const sessionData: UserMediaSessionData = {
    sessionId: `media-session-${Date.now()}`,
    savedAt: new Date().toISOString(),
    itemsCount: items.length,
    items,
    activeAvatarUrl:
      activeAvatarUrl || localStorage.getItem('freedom_active_user_avatar_v1') || undefined,
    activeCoverUrl:
      activeCoverUrl || localStorage.getItem('freedom_my_profile_cover') || undefined,
  };
  try {
    localStorage.setItem(USER_MEDIA_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    // Also sync to freedom_uploaded_media_items so chat picker & profile gallery share the session
    const uploadedFormat = items.map((item) => ({
      id: item.id,
      type: item.type,
      mediaUrl: item.url,
      thumbnailUrl: item.thumbnailUrl || item.url,
      title: item.title,
      createdAt: Date.now(),
    }));
    localStorage.setItem('freedom_uploaded_media_items', JSON.stringify(uploadedFormat.slice(0, 40)));
    window.dispatchEvent(
      new CustomEvent('freedom-user-media-session-saved', { detail: sessionData })
    );
  } catch {}
  return sessionData;
}

export function getUserMediaSession(): UserMediaSessionData | null {
  try {
    const raw = localStorage.getItem(USER_MEDIA_SESSION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserMediaSessionData;
    }
  } catch {}
  return null;
}

export function setMediaGalleryPictureAsAvatar(
  imageUrl: string,
  userId = 'user_abdullah',
  title = 'Gallery Avatar'
): void {
  if (!imageUrl) return;
  try {
    localStorage.setItem(`freedom_user_avatar_${userId}`, imageUrl);
    localStorage.setItem(`freedom_profile_thumbnail_${userId}`, imageUrl);
    localStorage.setItem('freedom_active_user_thumbnail_v1', imageUrl);
    localStorage.setItem('freedom_active_user_avatar_v1', imageUrl);
    localStorage.setItem(
      `freedom_user_avatar_meta_${userId}`,
      JSON.stringify({
        fileName: title,
        fileSize: 0,
        updatedAt: new Date().toISOString(),
        thumbnailUrl: imageUrl,
      })
    );
    window.dispatchEvent(
      new CustomEvent('freedom-gallery-set-avatar', {
        detail: { avatarUrl: imageUrl, userId, title },
      })
    );
  } catch {}
}

export function setMediaGalleryPictureAsProfileCover(
  imageUrl: string,
  userId = 'user_abdullah',
  contactId?: string
): void {
  if (!imageUrl) return;
  try {
    localStorage.setItem('freedom_my_profile_cover', imageUrl);
    localStorage.setItem(`freedom_profile_cover_thumbnail_${userId}`, imageUrl);
    if (contactId) {
      localStorage.setItem(`freedom_user_cover_${contactId}`, imageUrl);
    }
    window.dispatchEvent(
      new CustomEvent('freedom-gallery-set-cover', {
        detail: { coverUrl: imageUrl, userId, contactId },
      })
    );
  } catch {}
}

