import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { notifyChatsIconFriendBefriended } from './chatIconNotificationsHelper';

export interface FriendInvitationRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  invitedUserId: string;
  invitedUserName: string;
  invitedUserAvatar: string;
  nativeLanguage?: string;
  status: 'pending' | 'accepted' | 'declined' | 'none';
  createdAt: string;
  respondedAt?: string;
  acceptedAt?: string;
}

const INVITATIONS_STORAGE_KEY = 'freedom_friend_invitations_v2';

/**
 * Helper to resolve the currently logged-in user's ID and name from localStorage
 */
export function getLoggedInViewerIdentity(): { id: string; name: string } {
  if (typeof window === 'undefined') {
    return { id: 'me', name: '' };
  }
  try {
    const raw = localStorage.getItem('freedom_active_auth_user_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          id: String(parsed.id || 'me'),
          name: String(parsed.name || ''),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { id: 'me', name: '' };
}

/**
 * Strict Access Control Gate:
 * Returns true ONLY if the viewer is the exact invited user (`invitedUserId`)
 * and is NOT the person who sent the invite (`senderId`), NOT an Admin, and NOT any other uninvited user.
 */
export function canUserSeeAndAcceptInvitation(
  invitation: FriendInvitationRecord | null | undefined,
  viewerUserId?: string | null,
  viewerRoleOrIsAdmin: boolean | 'invited_user' | 'sender' | 'admin' | 'other_user' = false,
  viewerUserName?: string | null
): boolean {
  if (!invitation || invitation.status !== 'pending') return false;

  // Admin or other uninvited users or sender cannot see or accept user friend invitations
  if (
    viewerRoleOrIsAdmin === true ||
    viewerRoleOrIsAdmin === 'admin' ||
    viewerRoleOrIsAdmin === 'other_user' ||
    viewerRoleOrIsAdmin === 'sender'
  ) {
    return false;
  }

  const storedViewer = getLoggedInViewerIdentity();
  const effectiveViewerId = (viewerUserId || storedViewer.id || '').trim();
  const effectiveViewerName = (viewerUserName || storedViewer.name || '').trim().toLowerCase();

  if (
    !effectiveViewerId ||
    effectiveViewerId === 'admin' ||
    effectiveViewerId === 'other_user' ||
    effectiveViewerId === 'sender'
  ) {
    return false;
  }

  const senderId = (invitation.senderId || '').trim();
  const invitedUserId = (invitation.invitedUserId || '').trim();
  const senderNameLower = (invitation.senderName || '').trim().toLowerCase();
  const invitedNameLower = (invitation.invitedUserName || '').trim().toLowerCase();

  // The person who invited a user (the sender) must NEVER see the Accept Friend Invite pop-up or button
  if (
    senderId === effectiveViewerId ||
    ((senderId === 'me' || senderId === 'current_user') && invitedUserId !== effectiveViewerId) ||
    (effectiveViewerName && senderNameLower && senderNameLower === effectiveViewerName)
  ) {
    return false;
  }

  // Only the specific invited person can see the invitation pop-up and click Accept Friend Invite
  if (invitedUserId && effectiveViewerId === invitedUserId) {
    return true;
  }

  if (
    effectiveViewerName &&
    invitedNameLower &&
    effectiveViewerName === invitedNameLower &&
    senderNameLower !== effectiveViewerName
  ) {
    return true;
  }

  return false;
}

/**
 * Load all stored friend invitations from localStorage
 */
export function loadFriendInvitations(): Record<string, FriendInvitationRecord> {
  try {
    const raw = localStorage.getItem(INVITATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

/**
 * Get the invitation record for a specific target contact ID
 */
export function getInvitationForContact(contactId: string): FriendInvitationRecord | null {
  const all = loadFriendInvitations();
  return all[contactId] || null;
}

/**
 * Save or update a friend invitation record in both localStorage and Firestore (`friend_invitations`),
 * and broadcast a window event so notifications and UI update immediately.
 */
export async function saveFriendInvitation(
  invitation: FriendInvitationRecord
): Promise<FriendInvitationRecord> {
  try {
    const all = loadFriendInvitations();
    all[invitation.invitedUserId] = invitation;
    localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(all));
    localStorage.setItem(
      `freedom_friend_invite_${invitation.invitedUserId}`,
      invitation.status === 'declined' ? 'none' : invitation.status
    );
  } catch {
    // ignore localStorage errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('freedom-friend-invitation-updated', {
        detail: invitation,
      })
    );
    if (invitation.status === 'pending') {
      window.dispatchEvent(
        new CustomEvent('freedom-friend-request-received', {
          detail: invitation,
        })
      );
      notifyChatsIconFriendBefriended({
        friendName: invitation.senderName || 'A Friend',
        friendAvatar: invitation.senderAvatar,
        befriendedPersonName: invitation.invitedUserName || 'a new friend',
        contactId: invitation.invitedUserId || invitation.senderId,
      });
    } else if (invitation.status === 'accepted') {
      notifyChatsIconFriendBefriended({
        friendName: invitation.invitedUserName || invitation.senderName || 'Your Friend',
        friendAvatar: invitation.invitedUserAvatar || invitation.senderAvatar,
        befriendedPersonName: invitation.senderName || 'you',
        contactId: invitation.invitedUserId || invitation.senderId,
      });
    }
  }

  try {
    const ref = doc(db, 'friend_invitations', invitation.id);
    await setDoc(ref, invitation, { merge: true });
  } catch {
    // offline or rules fallback handled gracefully
  }

  return invitation;
}

export const saveInvitationForContact = saveFriendInvitation;

/**
 * Subscribe to real-time friend invitations in Firestore (`friend_invitations`)
 */
export function subscribeFriendInvitationsFromDb(
  onUpdate: (invitations: FriendInvitationRecord[]) => void
): () => void {
  try {
    const colRef = collection(db, 'friend_invitations');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: FriendInvitationRecord[] = [];
        const allLocal = loadFriendInvitations();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as FriendInvitationRecord;
          if (data && data.id && data.invitedUserId) {
            list.push(data);
            allLocal[data.invitedUserId] = data;
          }
        });
        try {
          localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(allLocal));
        } catch {}
        onUpdate(list);
      },
      () => {
        // ignore snapshot permission/offline errors
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Return all pending invitations where `viewerUserId` is the exact `invitedUserId`
 * and `isViewerAdmin` is false.
 */
export function getPendingInvitationsForInvitedUser(
  viewerUserId: string | null | undefined,
  isViewerAdmin: boolean = false
): FriendInvitationRecord[] {
  if (!viewerUserId || isViewerAdmin) return [];
  const all = loadFriendInvitations();
  return Object.values(all).filter(
    (inv) =>
      inv.status === 'pending' &&
      canUserSeeAndAcceptInvitation(inv, viewerUserId, isViewerAdmin)
  );
}
