import { notifyChatsIconFriendLikedMedia } from './chatIconNotificationsHelper';
import {
  saveUserGalleryItemInDb,
  getUserGalleryFromDb,
  deleteUserGalleryItemFromDb,
  saveUserMediaSessionInDb,
  getUserMediaSessionFromDb,
} from './firebase';

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
  userId?: string;
}

export interface UserMediaSessionData {
  sessionId: string;
  savedAt: string;
  itemsCount: number;
  items: LikedGalleryMediaItem[];
  activeAvatarUrl?: string;
  activeCoverUrl?: string;
  userId?: string;
}

/**
 * Resolves the currently active authenticated user ID.
 * Defaults to 'usr_guest' if unauthenticated.
 */
export function getActiveSessionUserId(): string {
  try {
    const curId = localStorage.getItem('freedom_current_user_id');
    if (curId && curId.trim()) return curId.trim();
    const session = localStorage.getItem('freedom_active_user_session_v4');
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed?.id) return String(parsed.id).trim();
    }
  } catch {}
  return 'usr_guest';
}

/**
 * User-scoped storage keys to guarantee account switching isolates gallery files.
 */
export function getUserGalleryStorageKey(userId?: string): string {
  const resolved = (userId || getActiveSessionUserId()).replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `freedom_user_gallery_${resolved}`;
}

export function getUserMediaSessionStorageKey(userId?: string): string {
  const resolved = (userId || getActiveSessionUserId()).replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `freedom_user_media_session_${resolved}`;
}

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

/**
 * Load gallery items owned by a specific user.
 * During account switching, loads only the current user's gallery without reusing the previous user's gallery.
 */
export function getLikedUserGalleryItems(userId?: string): LikedGalleryMediaItem[] {
  const resolvedUserId = userId || getActiveSessionUserId();
  const key = getUserGalleryStorageKey(resolvedUserId);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item: LikedGalleryMediaItem) =>
            item &&
            item.id &&
            !String(item.id).startsWith('ug-portrait-') &&
            (!item.userId || item.userId === resolvedUserId)
        );
      }
    }
  } catch {}

  return [];
}

/**
 * Persist gallery items under the user's isolated local key and sync to Firestore.
 */
export function saveLikedUserGalleryItems(items: LikedGalleryMediaItem[], userId?: string): void {
  const resolvedUserId = userId || getActiveSessionUserId();
  const key = getUserGalleryStorageKey(resolvedUserId);

  try {
    const cleaned = items
      .filter((item) => item && item.id && !String(item.id).startsWith('ug-portrait-'))
      .map((item) => ({ ...item, userId: resolvedUserId }));

    localStorage.setItem(key, JSON.stringify(cleaned));

    // Also update current active user upload references for the message picker
    localStorage.setItem(
      `freedom_uploaded_media_items_${resolvedUserId}`,
      JSON.stringify(
        cleaned.slice(0, 40).map((i) => ({
          id: i.id,
          type: i.type,
          mediaUrl: i.url,
          thumbnailUrl: i.thumbnailUrl || i.url,
          title: i.title,
          createdAt: Date.now(),
        }))
      )
    );

    window.dispatchEvent(
      new CustomEvent('freedom-liked-gallery-updated', {
        detail: { userId: resolvedUserId, count: cleaned.length },
      })
    );
  } catch {}
}

/**
 * Add a new media file to the specified user's gallery.
 * Saves to user-scoped cache and writes to Firestore with database ownership verification.
 */
export function addMediaToLikedUserGallery(
  item: Partial<LikedGalleryMediaItem> & { id: string; url: string },
  userId?: string
): LikedGalleryMediaItem[] {
  const resolvedUserId = userId || getActiveSessionUserId();
  const current = getLikedUserGalleryItems(resolvedUserId);
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
    userId: resolvedUserId,
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

  saveLikedUserGalleryItems(updated, resolvedUserId);

  // Firestore DB persistence with owner access validation
  try {
    saveUserGalleryItemInDb(resolvedUserId, {
      id: newEntry.id,
      type: newEntry.type,
      url: newEntry.url,
      thumbnailUrl: newEntry.thumbnailUrl,
      title: newEntry.title,
      senderName: newEntry.senderName,
      timestamp: newEntry.timestamp,
      likesCount: newEntry.likesCount,
      isLiked: newEntry.isLiked,
      isFavorite: true,
      createdAt: newEntry.addedAt,
    }).catch((err) => {
      console.warn('Could not save user gallery item to Firestore:', err);
    });
  } catch {}

  try {
    notifyChatsIconFriendLikedMedia({
      friendName:
        newEntry.senderName && newEntry.senderName !== 'You'
          ? newEntry.senderName
          : 'Elena Rodriguez',
      mediaTitle: newEntry.title || 'Liked Media File',
      mediaUrl: newEntry.thumbnailUrl || newEntry.url,
      contactId: newEntry.contactId || 'usr_elena_rodriguez',
    });
  } catch {}

  return updated;
}

/**
 * Remove media from the user's gallery and Firestore DB.
 */
export function removeMediaFromLikedUserGallery(
  messageIdOrId: string,
  userId?: string
): LikedGalleryMediaItem[] {
  const resolvedUserId = userId || getActiveSessionUserId();
  const current = getLikedUserGalleryItems(resolvedUserId);
  const updated = current.filter(
    (x) => x.id !== messageIdOrId && x.messageId !== messageIdOrId
  );
  saveLikedUserGalleryItems(updated, resolvedUserId);

  // Firestore delete with ownership verification
  try {
    deleteUserGalleryItemFromDb(resolvedUserId, messageIdOrId).catch(() => {});
  } catch {}

  return updated;
}

/**
 * Save user media session for the active user.
 */
export function saveUserMediaSession(
  customItems?: LikedGalleryMediaItem[],
  activeAvatarUrl?: string,
  activeCoverUrl?: string,
  userId?: string
): UserMediaSessionData {
  const resolvedUserId = userId || getActiveSessionUserId();
  const items = customItems || getLikedUserGalleryItems(resolvedUserId);
  if (customItems) {
    saveLikedUserGalleryItems(customItems, resolvedUserId);
  }

  const sessionData: UserMediaSessionData = {
    sessionId: `media-session-${Date.now()}`,
    userId: resolvedUserId,
    savedAt: new Date().toISOString(),
    itemsCount: items.length,
    items,
    activeAvatarUrl:
      activeAvatarUrl ||
      localStorage.getItem(`freedom_user_avatar_${resolvedUserId}`) ||
      localStorage.getItem('freedom_active_user_avatar_v1') ||
      undefined,
    activeCoverUrl:
      activeCoverUrl ||
      localStorage.getItem(`freedom_profile_cover_thumbnail_${resolvedUserId}`) ||
      localStorage.getItem('freedom_my_profile_cover') ||
      undefined,
  };

  try {
    const key = getUserMediaSessionStorageKey(resolvedUserId);
    localStorage.setItem(key, JSON.stringify(sessionData));

    // Save to Firestore DB
    saveUserMediaSessionInDb(resolvedUserId, {
      sessionId: sessionData.sessionId,
      savedAt: sessionData.savedAt,
      itemsCount: sessionData.itemsCount,
      activeAvatarUrl: sessionData.activeAvatarUrl,
      activeCoverUrl: sessionData.activeCoverUrl,
    }).catch(() => {});

    window.dispatchEvent(
      new CustomEvent('freedom-user-media-session-saved', {
        detail: { ...sessionData, userId: resolvedUserId },
      })
    );
  } catch {}

  return sessionData;
}

/**
 * Retrieve saved user media session for a given user.
 */
export function getUserMediaSession(userId?: string): UserMediaSessionData | null {
  const resolvedUserId = userId || getActiveSessionUserId();
  try {
    const key = getUserMediaSessionStorageKey(resolvedUserId);
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as UserMediaSessionData;
    }
  } catch {}
  return null;
}

/**
 * Synchronize user gallery from Firestore into the user's scoped local storage.
 * Enforces database security rules: only the authentic user can read their gallery docs.
 */
export async function syncUserGalleryWithFirestore(userId: string): Promise<LikedGalleryMediaItem[]> {
  if (!userId) return [];
  try {
    const dbItems = await getUserGalleryFromDb(userId);
    if (dbItems && dbItems.length > 0) {
      const mapped: LikedGalleryMediaItem[] = dbItems.map((d) => ({
        id: d.id,
        messageId: d.id,
        type: d.type === 'video' ? 'video' : 'image',
        url: d.url,
        thumbnailUrl: d.thumbnailUrl || d.url,
        title: d.title,
        senderName: d.senderName || 'You',
        timestamp: d.timestamp || 'Recent',
        likesCount: d.likesCount ?? 1,
        likesDisplay: formatCompactLikes(d.likesCount ?? 1, '1'),
        isLiked: d.isLiked ?? true,
        addedAt: d.createdAt || new Date().toISOString(),
        userId,
      }));

      saveLikedUserGalleryItems(mapped, userId);
      return mapped;
    }
  } catch (err) {
    console.warn(`Could not sync gallery for user ${userId} from Firestore:`, err);
  }
  return getLikedUserGalleryItems(userId);
}

/**
 * Clean up active gallery references during account logout or switching.
 */
export function clearUserGallerySessionOnSwitch(): void {
  // Dispatches event so active UI views can reset immediately
  window.dispatchEvent(
    new CustomEvent('freedom-account-switched', {
      detail: { switchedAt: new Date().toISOString() },
    })
  );
}

export function setMediaGalleryPictureAsAvatar(
  imageUrl: string,
  userId = 'usr_guest',
  title = 'Gallery Avatar'
): void {
  if (!imageUrl) return;
  const resolvedUserId = userId || getActiveSessionUserId();
  try {
    localStorage.setItem(`freedom_user_avatar_${resolvedUserId}`, imageUrl);
    localStorage.setItem(`freedom_profile_thumbnail_${resolvedUserId}`, imageUrl);
    localStorage.setItem('freedom_active_user_thumbnail_v1', imageUrl);
    localStorage.setItem('freedom_active_user_avatar_v1', imageUrl);
    localStorage.setItem(
      `freedom_user_avatar_meta_${resolvedUserId}`,
      JSON.stringify({
        fileName: title,
        fileSize: 0,
        updatedAt: new Date().toISOString(),
        thumbnailUrl: imageUrl,
      })
    );
    window.dispatchEvent(
      new CustomEvent('freedom-gallery-set-avatar', {
        detail: { avatarUrl: imageUrl, userId: resolvedUserId, title },
      })
    );
  } catch {}
}

export function setMediaGalleryPictureAsProfileCover(
  imageUrl: string,
  userId = 'usr_guest',
  contactId?: string
): void {
  if (!imageUrl) return;
  const resolvedUserId = userId || getActiveSessionUserId();
  try {
    localStorage.setItem('freedom_my_profile_cover', imageUrl);
    localStorage.setItem(`freedom_profile_cover_thumbnail_${resolvedUserId}`, imageUrl);
    if (contactId) {
      localStorage.setItem(`freedom_user_cover_${contactId}`, imageUrl);
    }
    window.dispatchEvent(
      new CustomEvent('freedom-gallery-set-cover', {
        detail: { coverUrl: imageUrl, userId: resolvedUserId, contactId },
      })
    );
  } catch {}
}
