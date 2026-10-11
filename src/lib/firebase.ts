import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserContact, UserProfile, AppBrandConfig, BannedUser, ReportedUser, StickerItem, MediaInteraction, ApkBuild, ChatWallpaperConfig } from '../types';
import { INITIAL_CONTACTS, ADMIN_CREDENTIALS } from '../data/mockData';
import { getCleanAvatar, getInitialsAvatar, saveUserAvatarLocally, getSavedAvatarRecord } from './avatarHelper';

export const ADMIN_EMAIL = ADMIN_CREDENTIALS.email;
export const ADMIN_PASSWORD = ADMIN_CREDENTIALS.password;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Warning: ', JSON.stringify(errInfo));
  return errInfo;
}

// Validate Connection to Firestore on startup per skill requirements
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline or connecting...');
    }
  }
}
testConnection();

// Format file size helper
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Target user file and optimize into a centered square avatar data URL
 */
export async function targetAndProcessAvatarFile(file: File): Promise<{
  dataUrl: string;
  fileName: string;
  fileSize: string;
  originalSize: number;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file (PNG, JPG, WebP, etc.)');
  }

  const fileName = file.name;
  const fileSize = formatFileSize(file.size);
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected user file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image file'));
      img.onload = () => {
        try {
          // Crop and resize to crisp 256x256 square
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              dataUrl: reader.result as string,
              fileName,
              fileSize,
              originalSize,
            });
            return;
          }

          // Centered crop calculation
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          resolve({
            dataUrl: compressedDataUrl,
            fileName,
            fileSize,
            originalSize,
          });
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * IDs and names of example/demo users to permanently purge from the app and Firebase Firestore
 * so only the App Owner / Admin remains.
 */
export const EXAMPLE_USER_IDS_TO_PURGE = new Set([
  'user_esther',
  'user_jacob',
  'user_jenny',
  'user_kristin',
  'user_ralph',
  'user_wade',
  'user_darrell',
  'user_leslie',
  'user_abdullah',
  'current_user',
  'group_global_team',
  'group_polyglot_club',
  'group_ai_voice_hub',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
]);

export const EXAMPLE_USER_NAMES_TO_PURGE = new Set([
  'esther howard',
  'jacob jones',
  'jenny wilson',
  'kristin watson',
  'ralph edwards',
  'wade warren',
  'darrell steward',
  'leslie alexander',
  'abdullah',
  'sajol',
  'global language & design group',
  'freedom polyglot creators club',
  'global voice & culture community',
]);

export function isExampleUserRecord(id: string, data?: Record<string, any>): boolean {
  if (!id) return false;
  if (EXAMPLE_USER_IDS_TO_PURGE.has(id)) return true;
  const nameLower = String(data?.name || '').trim().toLowerCase();
  if (EXAMPLE_USER_NAMES_TO_PURGE.has(nameLower)) return true;
  const usernameLower = String(data?.username || '').trim().toLowerCase();
  if (EXAMPLE_USER_IDS_TO_PURGE.has(usernameLower)) return true;
  return false;
}

/**
 * Logout Admin everywhere across the app (Firebase Auth, localStorage, sessionStorage, and Firestore status)
 */
export async function logoutAdminEverywhereInDb(): Promise<void> {
  try {
    localStorage.removeItem('freedom_admin_verified');
    localStorage.removeItem('freedom_admin_verified_v4');
    localStorage.removeItem('freedom_user_authenticated');
    const savedProfileRaw = localStorage.getItem('freedom_current_user_profile');
    if (savedProfileRaw) {
      const parsed = JSON.parse(savedProfileRaw);
      if (
        parsed?.id === 'admin_mobilephonesky' ||
        String(parsed?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ) {
        localStorage.removeItem('freedom_current_user_profile');
        localStorage.removeItem('freedom_active_user_session_v4');
        localStorage.removeItem('freedom_current_user_id');
      }
    }
    const savedSessionRaw = localStorage.getItem('freedom_active_user_session_v4');
    if (savedSessionRaw) {
      const parsed = JSON.parse(savedSessionRaw);
      if (
        parsed?.id === 'admin_mobilephonesky' ||
        String(parsed?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ) {
        localStorage.removeItem('freedom_active_user_session_v4');
      }
    }
  } catch {}

  try {
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  } catch {}

  try {
    await setDoc(
      doc(db, 'users', 'admin_mobilephonesky'),
      {
        id: 'admin_mobilephonesky',
        isOnline: false,
        online: false,
        status: 'offline',
        statusText: 'Logged Out',
        time: 'Offline',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {}
}

/**
 * Real-time listener for app users & contacts from Firestore
 * Automatically deletes any legacy example user documents encountered in Firebase
 */
export function subscribeUsersFromDb(
  onUpdate: (users: UserContact[]) => void,
  onError?: (error: unknown) => void
) {
  const usersCol = collection(db, 'users');
  return onSnapshot(
    usersCol,
    (snapshot) => {
      const users: UserContact[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (isExampleUserRecord(docSnap.id, data)) {
          return;
        }
        const isAdminDoc =
          docSnap.id === 'admin_mobilephonesky' ||
          String(data?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
        // Admin is logged out everywhere in the app — do not inject admin into user contacts
        if (isAdminDoc) {
          return;
        }
        const isUserBlocked = data.isBlocked === true || data.status === 'blocked';
        const rawUserName = data.name || 'WeedChat User';
        const userName = rawUserName
          .replace(/Freedom Support & Admin/gi, 'WeedChat User')
          .replace(/Freedom Admin/gi, 'WeedChat User')
          .replace(/Freedom Messaging/gi, 'WeedChat');
        const savedLocal = getSavedAvatarRecord(docSnap.id);
        const cleanAvatar = getCleanAvatar(
          userName,
          savedLocal?.avatar || data.avatar,
          undefined,
          docSnap.id
        );
        const rawLastMsg =
          data.lastMessage ||
          'Hey there! I am using WeedChat.';
        const cleanLastMsg = rawLastMsg
          .replace(/Welcome to Freedom!/gi, 'Welcome to WeedChat!')
          .replace(/Freedom Messaging/gi, 'WeedChat')
          .replace(/Freedom Chat/gi, 'WeedChat');
        const rawBio = data.bio
          ? String(data.bio)
              .replace(/Freedom Messaging/gi, 'WeedChat')
              .replace(/Freedom Support & Admin/gi, 'WeedChat User')
          : undefined;
        users.push({
          id: docSnap.id,
          name: userName,
          avatar: cleanAvatar,
          avatarThumbnailUrl: savedLocal?.avatarThumbnailUrl || data.avatarThumbnailUrl || cleanAvatar,
          lastMessage: cleanLastMsg,
          time: data.time || 'Online',
          online: data.online ?? data.isOnline ?? true,
          unreadCount: data.unreadCount || 0,
          nativeLanguage: data.nativeLanguage || data.motherLanguage || 'English',
          status: data.status || (isUserBlocked ? 'blocked' : 'active'),
          statusText: isUserBlocked
            ? 'Blocked'
            : (data.statusText || rawBio || 'Available on WeedChat').replace(
                /Freedom Messaging/gi,
                'WeedChat'
              ),
          isBlocked: isUserBlocked,
          blockedAt: data.blockedAt,
          isBanned: data.isBanned,
          phoneNumber: data.phoneNumber,
          hidePhoneNumberPublic: Boolean(data.hidePhoneNumberPublic),
          email: data.email,
          username: data.username,
          location: data.location || 'New York,NY',
          age: data.age,
          gender: data.gender,
          bio: rawBio,
          socialLinks: Array.isArray(data.socialLinks) ? data.socialLinks : undefined,
          profileCoverUrl: data.profileCoverUrl,
          profileWallpaperUrl: data.profileWallpaperUrl,
          avatarFileName: savedLocal?.avatarFileName || data.avatarFileName,
          avatarFileSize: savedLocal?.avatarFileSize || data.avatarFileSize,
          isArchived: data.isArchived === true,
          archivedAt: data.archivedAt,
          isDeleted: data.isDeleted === true,
          deletedAt: data.deletedAt,
          isPinned: data.isPinned === true,
          // Group & Channel properties
          entityType: data.entityType || (data.isChannel ? 'channel' : data.isGroup ? 'group' : 'individual'),
          isGroup: Boolean(data.isGroup || data.entityType === 'group'),
          isJoinedGroup: Boolean(data.isJoinedGroup),
          groupCoverUrl: data.groupCoverUrl,
          participants: Array.isArray(data.participants) ? data.participants : undefined,
          groupAdminId: data.groupAdminId,
          groupTopic: data.groupTopic,
          isChannel: Boolean(data.isChannel || data.entityType === 'channel'),
          isSubscribedChannel: data.isSubscribedChannel ?? Boolean(data.isChannel || data.entityType === 'channel'),
          channelHandle: data.channelHandle,
          channelDescription: data.channelDescription,
          channelCategory: data.channelCategory,
          channelPrivacy: data.channelPrivacy,
          subscribersCount: typeof data.subscribersCount === 'number' ? data.subscribersCount : undefined,
          channelAdminId: data.channelAdminId,
          isVerified:
            typeof data.isVerified === 'boolean'
              ? data.isVerified
              : Boolean(
                  data.profileValidatedAt ||
                    (data.name && data.username && data.email && data.phoneNumber && data.bio)
                ),
          profileValidatedAt: data.profileValidatedAt,
        });
      });

      // Merge with default WhatsApp-style contacts so the user's Chats list is always populated
      const existingIds = new Set(users.map((u) => u.id));
      for (const defaultContact of INITIAL_CONTACTS) {
        if (!existingIds.has(defaultContact.id)) {
          users.push(defaultContact);
        }
      }

      onUpdate(users);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  );
}

/**
 * Sign in using Firebase Google Authentication
 * If signing in with MobilePhonesky987@gmail.com, returns isAdmin: true
 */
export async function signInWithGoogleAuth(): Promise<{ user: UserProfile; isAdmin: boolean }> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const fbUser = result.user;
  const isSuperAdmin = fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const userProfile: UserProfile = {
    id: isSuperAdmin ? 'admin_mobilephonesky' : fbUser.uid,
    name: fbUser.displayName || (isSuperAdmin ? 'WeedChat Support & Admin' : 'WeedChat User'),
    email: fbUser.email || undefined,
    avatar: fbUser.photoURL || getInitialsAvatar(fbUser.displayName || (isSuperAdmin ? 'WeedChat Admin' : 'User')),
    motherLanguage: 'English',
    bio: isSuperAdmin ? 'WeedChat Official Administration & User Support Desk' : 'Connected via Google Account',
    location: 'New York,NY',
    isOnline: true,
    phoneNumber: fbUser.phoneNumber || undefined,
  };

  try {
    await saveUserProfileToDb(userProfile);
  } catch (err) {
    console.warn('Could not auto-save Google user to DB:', err);
  }

  return { user: userProfile, isAdmin: isSuperAdmin };
}

/**
 * Ensure Admin is logged out in Firestore and seed initial WhatsApp-style contacts if empty
 */
export async function seedInitialUsersIfEmpty(): Promise<void> {
  try {
    await logoutAdminEverywhereInDb();
  } catch (error) {
    console.warn('Could not sync users in database:', error);
  }

  try {
    await setDoc(
      doc(db, 'app_config', 'branding'),
      {
        appName: 'WeedChat',
        appDescription:
          'WeedChat — A modern, multilingual messaging app with real-time conversations, channels, voice notes, media sharing, and mother language translation.',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {}
}

/**
 * Save a Contact, Group, or Channel entity to Firestore /users/{id}
 */
export async function saveContactOrChannelToDb(contact: UserContact): Promise<void> {
  if (!contact?.id) return;
  if (contact.avatar) {
    saveUserAvatarLocally(
      contact.id,
      contact.avatar,
      contact.avatarFileName,
      contact.avatarFileSize
    );
  }
  const userRef = doc(db, 'users', contact.id);
  const payload: Record<string, any> = {
    id: contact.id,
    name: (contact.name || 'Channel').slice(0, 95),
    avatar: getCleanAvatar(contact.name || 'Channel', contact.avatar, undefined, contact.id),
    lastMessage: (contact.lastMessage || 'Welcome to our channel!').slice(0, 290),
    time: (contact.time || 'Just now').slice(0, 45),
    isOnline: Boolean(contact.online ?? true),
    status: (contact.status || 'active').slice(0, 45),
    statusText: (contact.statusText || '').slice(0, 95),
    motherLanguage: (contact.nativeLanguage || 'English').slice(0, 45),
    bio: (
      contact.channelDescription ||
      contact.groupTopic ||
      contact.bio ||
      contact.statusText ||
      ''
    ).slice(0, 240),
    isArchived: Boolean(contact.isArchived),
    isDeleted: Boolean(contact.isDeleted),
    isPinned: Boolean(contact.isPinned),
    unreadCount: Number(contact.unreadCount || 0),
    updatedAt: new Date().toISOString(),
  };

  if (contact.username) payload.username = contact.username.replace(/^@+/, '').slice(0, 48);
  if (contact.phoneNumber) payload.phoneNumber = contact.phoneNumber.slice(0, 45);
  if (typeof contact.hidePhoneNumberPublic === 'boolean') {
    payload.hidePhoneNumberPublic = contact.hidePhoneNumberPublic;
  }
  if (contact.email) payload.email = contact.email.slice(0, 120);
  if (contact.location) payload.location = contact.location.slice(0, 95);
  if (contact.age !== undefined) payload.age = String(contact.age).slice(0, 20);
  if (contact.gender) payload.gender = String(contact.gender).slice(0, 30);
  if (Array.isArray(contact.socialLinks)) payload.socialLinks = contact.socialLinks;
  if (contact.entityType) payload.entityType = contact.entityType;
  if (typeof contact.isGroup === 'boolean') payload.isGroup = contact.isGroup;
  if (typeof contact.isJoinedGroup === 'boolean') payload.isJoinedGroup = contact.isJoinedGroup;
  if (contact.groupCoverUrl) payload.groupCoverUrl = contact.groupCoverUrl;
  if (contact.participants) payload.participants = contact.participants;
  if (contact.groupAdminId) payload.groupAdminId = contact.groupAdminId;
  if (contact.groupTopic) payload.groupTopic = contact.groupTopic;
  if (typeof contact.isChannel === 'boolean') payload.isChannel = contact.isChannel;
  if (typeof contact.isSubscribedChannel === 'boolean') payload.isSubscribedChannel = contact.isSubscribedChannel;
  if (contact.channelHandle) payload.channelHandle = contact.channelHandle;
  if (contact.channelDescription) payload.channelDescription = contact.channelDescription;
  if (contact.channelCategory) payload.channelCategory = contact.channelCategory;
  if (contact.channelPrivacy) payload.channelPrivacy = contact.channelPrivacy;
  if (typeof contact.subscribersCount === 'number') payload.subscribersCount = contact.subscribersCount;
  if (contact.channelAdminId) payload.channelAdminId = contact.channelAdminId;
  if (contact.profileCoverUrl) payload.profileCoverUrl = contact.profileCoverUrl;
  if (contact.profileWallpaperUrl) payload.profileWallpaperUrl = contact.profileWallpaperUrl;

  try {
    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.warn('Firestore contact/channel sync warning (saved locally):', error);
  }
}

/**
 * Upload and update avatar for a user in localStorage and Firestore database automatically
 */
export async function uploadUserAvatarInDb(
  userId: string,
  file: File,
  userName: string = 'Abdullah'
): Promise<{ avatarUrl: string; fileName: string; fileSize: string }> {
  // 1. Target user file and optimize into crisp square JPEG data URL
  const processed = await targetAndProcessAvatarFile(file);

  // 2. Immediately persist in localStorage and broadcast so UI updates reliably & instantly
  saveUserAvatarLocally(userId, processed.dataUrl, processed.fileName, processed.fileSize);

  // 3. Persist avatar in Firestore database (using schema-compliant fields)
  const cleanPayload = {
    id: userId,
    name: userName || 'Abdullah',
    avatar: processed.dataUrl,
    avatarFileName: processed.fileName.slice(0, 190),
    avatarFileSize: processed.fileSize.slice(0, 45),
    updatedAt: new Date().toISOString(),
  };

  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, cleanPayload, { merge: true });

    if (userId === 'user_abdullah' || userId === 'current_user') {
      const aliasId = userId === 'user_abdullah' ? 'current_user' : 'user_abdullah';
      await setDoc(
        doc(db, 'users', aliasId),
        { ...cleanPayload, id: aliasId },
        { merge: true }
      );
    }
  } catch (error) {
    console.warn('Firestore avatar sync warning (avatar saved locally):', error);
  }

  return {
    avatarUrl: processed.dataUrl,
    fileName: processed.fileName,
    fileSize: processed.fileSize,
  };
}

/**
 * Save or update any user profile in Firestore and localStorage
 */
export async function saveUserProfileToDb(
  profile: Partial<UserProfile> & { id: string; name: string; avatar: string }
) {
  if (profile.avatar || profile.avatarThumbnailUrl) {
    saveUserAvatarLocally(
      profile.id,
      profile.avatar || profile.avatarThumbnailUrl || '',
      profile.avatarFileName,
      profile.avatarFileSize,
      profile.avatarThumbnailUrl
    );
  }

  const savedLocal = getSavedAvatarRecord(profile.id);
  const resolvedAvatar = getCleanAvatar(
    profile.name || 'User',
    savedLocal?.avatar || profile.avatar || profile.avatarThumbnailUrl,
    undefined,
    profile.id
  );
  const resolvedThumb =
    profile.avatarThumbnailUrl || savedLocal?.avatarThumbnailUrl || resolvedAvatar;

  // Keep Firestore document compact while preserving real uploaded thumbnail if full avatar is large
  const firestoreSafeAvatar =
    resolvedAvatar.length > 350000 && resolvedThumb.length <= 350000
      ? resolvedThumb
      : resolvedAvatar;

  const userRef = doc(db, 'users', profile.id);
  const cleanData: Record<string, any> = {
    id: profile.id,
    name: (profile.name || 'User').slice(0, 95),
    avatar: firestoreSafeAvatar,
    updatedAt: new Date().toISOString(),
  };

  if (resolvedThumb && resolvedThumb.length <= 350000) {
    cleanData.avatarThumbnailUrl = resolvedThumb;
  }

  if (profile.username !== undefined) {
    cleanData.username = (profile.username || '').replace(/^@+/, '').slice(0, 48);
  }
  if (profile.bio !== undefined) cleanData.bio = (profile.bio || '').slice(0, 240);
  if (profile.motherLanguage) cleanData.motherLanguage = profile.motherLanguage.slice(0, 48);
  if (typeof profile.hideOnlineStatus === 'boolean') {
    cleanData.hideOnlineStatus = profile.hideOnlineStatus;
    cleanData.isOnline = !profile.hideOnlineStatus;
    cleanData.status = profile.hideOnlineStatus ? 'offline' : 'active';
  } else if (typeof profile.isOnline === 'boolean') {
    cleanData.isOnline = profile.isOnline;
  }
  if (profile.avatarFileName) cleanData.avatarFileName = profile.avatarFileName.slice(0, 190);
  if (profile.avatarFileSize) cleanData.avatarFileSize = profile.avatarFileSize.slice(0, 45);
  if (profile.phoneNumber !== undefined) cleanData.phoneNumber = (profile.phoneNumber || '').slice(0, 45);
  if (typeof profile.hidePhoneNumberPublic === 'boolean') {
    cleanData.hidePhoneNumberPublic = profile.hidePhoneNumberPublic;
  }
  if (profile.email !== undefined) cleanData.email = (profile.email || '').slice(0, 120);
  if (profile.location !== undefined) cleanData.location = (profile.location || '').slice(0, 95);
  if (profile.age !== undefined) cleanData.age = String(profile.age || '').slice(0, 20);
  if (profile.gender !== undefined) cleanData.gender = String(profile.gender || '').slice(0, 30);
  if (Array.isArray(profile.socialLinks)) cleanData.socialLinks = profile.socialLinks;
  if (typeof profile.isVerified === 'boolean') cleanData.isVerified = profile.isVerified;
  if (profile.profileValidatedAt) cleanData.profileValidatedAt = profile.profileValidatedAt;

  try {
    await setDoc(userRef, cleanData, { merge: true });
    if (profile.id === 'user_abdullah' || profile.id === 'current_user') {
      const aliasId = profile.id === 'user_abdullah' ? 'current_user' : 'user_abdullah';
      await setDoc(
        doc(db, 'users', aliasId),
        { ...cleanData, id: aliasId },
        { merge: true }
      );
    }
  } catch (error) {
    console.warn('Firestore profile sync warning (saved locally):', error);
  }
}

/**
 * Delete user account from Firestore and local storage ("Delete My Account")
 */
export async function deleteMyUserAccountFromDb(userId: string): Promise<void> {
  if (!userId) return;
  try {
    localStorage.removeItem('freedom_current_user_profile');
    localStorage.removeItem(`freedom_user_location_${userId}`);
    localStorage.removeItem(`freedom_user_bio_${userId}`);
    localStorage.removeItem(`freedom_user_phone_${userId}`);
    localStorage.removeItem(`freedom_user_email_${userId}`);
    localStorage.removeItem(`freedom_user_username_${userId}`);
    localStorage.removeItem(`freedom_user_age_${userId}`);
    localStorage.removeItem(`freedom_user_gender_${userId}`);
    localStorage.removeItem(`freedom_user_links_${userId}`);
  } catch {}

  try {
    if (userId !== 'admin_mobilephonesky') {
      await deleteDoc(doc(db, 'users', userId));
    }
  } catch (error) {
    console.warn('Firestore delete account warning:', error);
  }
}

/**
 * Update the current user's 'Hide online status' privacy setting in Firebase & localStorage
 */
export async function updateUserOnlinePrivacyInDb(
  userId: string,
  hideOnlineStatus: boolean,
  userName: string = 'Abdullah',
  userAvatar?: string
) {
  try {
    localStorage.setItem(`freedom_privacy_hide_online_${userId}`, String(hideOnlineStatus));
    localStorage.setItem('freedom_privacy_hide_online_current_user', String(hideOnlineStatus));
  } catch {}

  const resolvedAvatar = getCleanAvatar(userName, userAvatar, undefined, userId);
  const payload = {
    id: userId,
    name: (userName || 'Abdullah').slice(0, 95),
    avatar: resolvedAvatar,
    hideOnlineStatus,
    isOnline: !hideOnlineStatus,
    status: hideOnlineStatus ? 'offline' : 'active',
    statusText: hideOnlineStatus ? 'Online status hidden' : 'Online',
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'users', userId), payload, { merge: true });
    if (userId === 'user_abdullah' || userId === 'current_user') {
      const aliasId = userId === 'user_abdullah' ? 'current_user' : 'user_abdullah';
      await setDoc(doc(db, 'users', aliasId), { ...payload, id: aliasId }, { merge: true });
    }
  } catch (error) {
    console.warn('Firestore online privacy sync warning (saved locally):', error);
  }

  return payload;
}

/**
 * Subscribe to single user profile in real-time
 */
export function subscribeUserProfile(
  userId: string,
  onUpdate: (profile: UserProfile | null) => void,
  onError?: (err: unknown) => void
) {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        const savedLocal = getSavedAvatarRecord(userId);
        const resolvedAvatar = getCleanAvatar(
          data.name || 'Abdullah',
          savedLocal?.avatar || data.avatarThumbnailUrl || data.avatar,
          undefined,
          userId
        );
        const resolvedThumb =
          savedLocal?.avatarThumbnailUrl || data.avatarThumbnailUrl || resolvedAvatar;
        onUpdate({
          ...data,
          avatar: resolvedAvatar,
          avatarThumbnailUrl: resolvedThumb,
          avatarFileName: savedLocal?.avatarFileName || data.avatarFileName,
          avatarFileSize: savedLocal?.avatarFileSize || data.avatarFileSize,
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      console.warn('User profile subscription warning:', error);
    }
  );
}

/**
 * Process and optimize uploaded favicon file
 */
export async function targetAndProcessFaviconFile(file: File): Promise<{
  dataUrl: string;
  fileName: string;
  fileSize: string;
}> {
  const allowed = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
  const fileName = file.name;
  const fileSize = formatFileSize(file.size);

  if (!allowed.includes(file.type) && !fileName.endsWith('.ico')) {
    throw new Error('Please select an icon file (ICO, PNG, SVG, WEBP, or JPG)');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected favicon file'));
    reader.onload = () => {
      if (file.type === 'image/svg+xml') {
        resolve({
          dataUrl: reader.result as string,
          fileName,
          fileSize,
        });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({
          dataUrl: reader.result as string,
          fileName,
          fileSize,
        });
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 64, 64);
            const compressed = canvas.toDataURL('image/png');
            resolve({
              dataUrl: compressed,
              fileName,
              fileSize,
            });
            return;
          }
        } catch {
          // fallback to raw dataUrl
        }
        resolve({
          dataUrl: reader.result as string,
          fileName,
          fileSize,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Subscribe to App Branding Config from Firestore
 */
export function subscribeAppBrandConfig(
  onUpdate: (config: AppBrandConfig | null) => void,
  onError?: (err: unknown) => void
) {
  const brandRef = doc(db, 'app_config', 'branding');
  return onSnapshot(
    brandRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as AppBrandConfig);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      console.warn('App brand config load warning:', error);
    }
  );
}

/**
 * Save App Branding Config to Firestore
 */
export async function saveAppBrandConfigToDb(config: Partial<AppBrandConfig>) {
  const brandRef = doc(db, 'app_config', 'branding');
  const payload = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(brandRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'app_config/branding');
  }
}

/**
 * Subscribe to Banned Users from Firestore
 */
export function subscribeBannedUsers(
  onUpdate: (banned: BannedUser[]) => void,
  onError?: (err: unknown) => void
) {
  const bannedCol = collection(db, 'banned_users');
  return onSnapshot(
    bannedCol,
    (snapshot) => {
      const list: BannedUser[] = [];
      snapshot.forEach((snap) => {
        list.push({ id: snap.id, ...(snap.data() as Omit<BannedUser, 'id'>) });
      });
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      console.warn('Banned users subscription warning:', error);
    }
  );
}

/**
 * Ban a user in Firestore
 */
export async function banUserInDb(
  bannedUser: Omit<BannedUser, 'id'> & { id?: string }
): Promise<void> {
  const banId = bannedUser.id || `ban_${bannedUser.userId}`;
  const banRef = doc(db, 'banned_users', banId);
  const userRef = doc(db, 'users', bannedUser.userId);

  try {
    await setDoc(banRef, {
      ...bannedUser,
      id: banId,
      bannedAt: bannedUser.bannedAt || new Date().toISOString(),
    });
    await setDoc(
      userRef,
      {
        isBanned: true,
        bannedReason: bannedUser.reason,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `banned_users/${banId}`);
  }
}

/**
 * Unban a user in Firestore
 */
export async function unbanUserInDb(banId: string, userId: string): Promise<void> {
  const banRef = doc(db, 'banned_users', banId);
  const userRef = doc(db, 'users', userId);

  try {
    await deleteDoc(banRef);
    await setDoc(
      userRef,
      {
        isBanned: false,
        bannedReason: '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `banned_users/${banId}`);
  }
}

/**
 * Block or unblock a contact: updates their status to 'blocked' in the Firestore database
 * and manages /blocked_users collection records.
 */
export async function blockUserInDb(
  userId: string,
  blocked: boolean = true,
  reason: string = 'Blocked by user in Freedom Chat'
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();
  const payload = {
    status: blocked ? 'blocked' : 'active',
    isBlocked: blocked,
    blockedAt: blocked ? now : null,
    statusText: blocked ? 'Blocked' : 'Active',
    updatedAt: now,
  };

  try {
    // 1. Update status on user document directly in Firestore
    await setDoc(userRef, payload, { merge: true });

    // 2. Mirror into blocked_users collection for persistent record
    const blockRef = doc(db, 'blocked_users', `block_${userId}`);
    if (blocked) {
      await setDoc(blockRef, {
        id: `block_${userId}`,
        userId,
        status: 'blocked',
        reason,
        blockedAt: now,
      });
    } else {
      await deleteDoc(blockRef).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Toggle archive status for a chat conversation in Firestore
 */
export async function toggleArchiveUserChatInDb(
  userId: string,
  isArchived: boolean = true
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();
  try {
    await setDoc(
      userRef,
      {
        isArchived,
        archivedAt: isArchived ? now : null,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Delete a user chat (soft delete in Firestore by marking isDeleted: true)
 */
export async function deleteUserChatInDb(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();
  try {
    await setDoc(
      userRef,
      {
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Restore a deleted chat conversation
 */
export async function restoreDeletedChatInDb(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();
  try {
    await setDoc(
      userRef,
      {
        isDeleted: false,
        deletedAt: null,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Toggle pin status for a chat
 */
export async function togglePinUserChatInDb(
  userId: string,
  isPinned: boolean
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(
      userRef,
      {
        isPinned,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Mark chat read status (unreadCount to 0 or 1)
 */
export async function markChatReadStatusInDb(
  userId: string,
  isRead: boolean
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(
      userRef,
      {
        unreadCount: isRead ? 0 : 1,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

/**
 * Subscribe to Blocked Users from Firestore
 */
export function subscribeBlockedUsers(
  onUpdate: (blockedUserIds: string[]) => void,
  onError?: (err: unknown) => void
) {
  const blockedCol = collection(db, 'blocked_users');
  return onSnapshot(
    blockedCol,
    (snapshot) => {
      const list: string[] = [];
      snapshot.forEach((snap) => {
        const data = snap.data();
        if (data.userId) {
          list.push(data.userId);
        } else {
          list.push(snap.id.replace('block_', ''));
        }
      });
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      console.warn('Blocked users subscription warning:', error);
    }
  );
}

/**
 * Subscribe to Reported Users from Firestore
 */
export function subscribeReportedUsers(
  onUpdate: (reports: ReportedUser[]) => void,
  onError?: (err: unknown) => void
) {
  const reportsCol = collection(db, 'reported_users');
  return onSnapshot(
    reportsCol,
    (snapshot) => {
      const list: ReportedUser[] = [];
      snapshot.forEach((snap) => {
        list.push({ id: snap.id, ...(snap.data() as Omit<ReportedUser, 'id'>) });
      });
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      console.warn('Reported users subscription warning:', error);
    }
  );
}

/**
 * Add a new user report
 */
export async function addReportedUserInDb(
  report: Omit<ReportedUser, 'id' | 'createdAt'> & { id?: string }
): Promise<string> {
  const reportId = report.id || `rep_${Date.now()}`;
  const reportRef = doc(db, 'reported_users', reportId);

  const payload: ReportedUser = {
    ...report,
    id: reportId,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(reportRef, payload);
    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `reported_users/${reportId}`);
    return reportId;
  }
}

/**
 * Update report status (e.g., dismissed, resolved, investigating)
 */
export async function updateReportStatusInDb(
  reportId: string,
  status: ReportedUser['status'],
  notes?: string
): Promise<void> {
  const reportRef = doc(db, 'reported_users', reportId);
  try {
    await setDoc(
      reportRef,
      {
        status,
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reported_users/${reportId}`);
  }
}

/**
 * Daily sticker upload limit for admin
 */
export const DAILY_STICKER_UPLOAD_LIMIT = 10;

export function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function getTodayStickersUploadCount(): Promise<number> {
  try {
    const today = getTodayDateKey();
    const querySnapshot = await getDocs(collection(db, 'app_stickers'));
    let count = 0;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.uploadDate === today) {
        count++;
      }
    });
    return count;
  } catch (error) {
    console.warn('Could not query stickers count from server, checking local fallback:', error);
    try {
      const today = getTodayDateKey();
      const local = localStorage.getItem(`freedom_sticker_uploads_${today}`);
      return local ? parseInt(local, 10) : 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Subscribe to custom stickers uploaded by admin in Firestore
 */
export function subscribeAppStickers(
  onSuccess: (stickers: StickerItem[]) => void,
  onError?: (error: unknown) => void
) {
  const stickersCol = collection(db, 'app_stickers');
  return onSnapshot(
    stickersCol,
    (snapshot) => {
      const stickersList: StickerItem[] = [];
      snapshot.forEach((docSnap) => {
        stickersList.push(docSnap.data() as StickerItem);
      });
      onSuccess(stickersList);
    },
    (error) => {
      if (onError) onError(error);
      console.warn('App stickers subscription warning:', error);
    }
  );
}

/**
 * Upload a new sticker from Admin panel with 10 uploads/day limit enforcement
 */
export async function uploadAdminStickerToDb(
  sticker: Omit<StickerItem, 'uploadedAt' | 'uploadDate'> & { id?: string }
): Promise<StickerItem> {
  const today = getTodayDateKey();
  const currentCount = await getTodayStickersUploadCount();

  if (currentCount >= DAILY_STICKER_UPLOAD_LIMIT) {
    throw new Error(
      `Daily upload limit reached: You have uploaded ${currentCount}/${DAILY_STICKER_UPLOAD_LIMIT} stickers today. The limit resets at midnight.`
    );
  }

  const stickerId = sticker.id || `custom-stk-${Date.now()}`;
  const stickerRef = doc(db, 'app_stickers', stickerId);

  const payload: StickerItem = {
    ...sticker,
    id: stickerId,
    uploadDate: today,
    uploadedAt: new Date().toISOString(),
  };

  try {
    await setDoc(stickerRef, payload);
    try {
      localStorage.setItem(`freedom_sticker_uploads_${today}`, String(currentCount + 1));
    } catch {}
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `app_stickers/${stickerId}`);
    return payload;
  }
}

/**
 * Delete a custom sticker (Admin only)
 */
export async function deleteAppStickerInDb(stickerId: string): Promise<void> {
  const stickerRef = doc(db, 'app_stickers', stickerId);
  try {
    await deleteDoc(stickerRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `app_stickers/${stickerId}`);
  }
}

/**
 * Save or update media interaction metrics (likes, favourites, rating stars, share count)
 */
export async function saveMediaInteractionInDb(interaction: MediaInteraction): Promise<void> {
  const mediaRef = doc(db, 'media_interactions', interaction.id);
  const payload = {
    ...interaction,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(mediaRef, payload, { merge: true });
    try {
      localStorage.setItem(`freedom_media_${interaction.id}`, JSON.stringify(payload));
    } catch {}
  } catch (error) {
    console.warn(`Firestore saveMediaInteraction error for ${interaction.id}:`, error);
    try {
      localStorage.setItem(`freedom_media_${interaction.id}`, JSON.stringify(payload));
    } catch {}
  }
}

/**
 * Get media interaction from Firestore with localStorage fallback
 */
export async function getMediaInteractionFromDb(mediaId: string): Promise<MediaInteraction | null> {
  try {
    const cached = localStorage.getItem(`freedom_media_${mediaId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  const mediaRef = doc(db, 'media_interactions', mediaId);
  try {
    const snap = await getDoc(mediaRef);
    if (snap.exists()) {
      const data = snap.data() as MediaInteraction;
      try {
        localStorage.setItem(`freedom_media_${mediaId}`, JSON.stringify(data));
      } catch {}
      return data;
    }
    return null;
  } catch (error) {
    console.warn(`Could not load media interaction for ${mediaId}:`, error);
    return null;
  }
}

/**
 * Initial sample APK build history records
 */
export const INITIAL_APK_BUILDS: ApkBuild[] = [
  {
    id: 'apk-107-v127',
    versionName: 'v1.2.7',
    versionCode: 107,
    buildType: 'release',
    appName: 'Freedom Messaging',
    packageName: 'com.freedom.messaging',
    fileSize: '12.7 MB',
    fileName: 'freedom-messaging-v1.2.7-release.apk',
    targetSdk: 'Android 14 (API 34)',
    minSdk: 'Android 7.0 (API 24)',
    status: 'ready',
    sha256Checksum: '7b4e33918a02c892e8f192b1093f2a0139b4b0e352efc5c8e217d8ef091a13e2',
    downloadUrl: '/downloads/freedom-messaging-v1.2.7-release.apk',
    createdAt: new Date().toISOString(),
    notes: 'Official Android Standalone Release APK. Fixed package parsing structure with verified signed AndroidManifest & compiled bytecode.',
    architectures: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    featuresIncluded: [
      'Voice Note Waveform DSP Visualizer',
      'Multilingual Translation Engine',
      'QR Scanner & Contact Pairing',
      'Message Forwarding & Reactions',
      'Round Profiles & Social Links',
    ],
    keystoreAlias: 'freedom-production-key',
    logs: [
      '[INFO] Android build pipeline initialized for v1.2.7 (Build #107)...',
      '[ENV] Target: Android 14 (API 34), Min: API 24',
      '[SIGN] Signed with Freedom v2+v3 Keystore scheme',
      '[SUCCESS] Verified APK binary ready: freedom-messaging-v1.2.7-release.apk (12.7 MB)',
    ],
  },
  {
    id: 'apk-105-v125',
    versionName: 'v1.2.5',
    versionCode: 105,
    buildType: 'release',
    appName: 'Freedom Messaging',
    packageName: 'com.freedom.messaging',
    fileSize: '12.7 MB',
    fileName: 'imchat-v1.2.5-release.apk',
    targetSdk: 'Android 14 (API 34)',
    minSdk: 'Android 7.0 (API 24)',
    status: 'ready',
    sha256Checksum: '5c2e11894a02c892e8f192b1093f2a0139b4b0e352efc5c8e217d8ef091a98c1',
    downloadUrl: '/downloads/imchat-v1.2.5-release.apk',
    createdAt: '2026-09-27T12:00:00.000Z',
    notes: 'Verified APK package with signed manifest and DEX binaries.',
    architectures: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    featuresIncluded: [
      'Live Voice Messaging',
      'Language Translator',
      'Direct Media Sharing',
    ],
    keystoreAlias: 'freedom-release-key',
    logs: [
      '[INFO] Package compiled & verified.',
      '[SUCCESS] Ready for Android testing.',
    ],
  },
  {
    id: 'apk-104-v124',
    versionName: 'v1.2.4',
    versionCode: 104,
    buildType: 'release',
    appName: 'Freedom Messaging',
    packageName: 'com.freedom.messaging',
    fileSize: '26.4 MB',
    fileName: 'freedom-messaging-v1.2.4-release.apk',
    targetSdk: 'Android 14 (API 34)',
    minSdk: 'Android 7.0 (API 24)',
    status: 'ready',
    sha256Checksum: '9a4f21b7c88e9903e192f941198b10887df2a0139b4b0e352efc5c8e217d8ef0',
    downloadUrl: 'https://ais-dev-ixlwbs3zoaq5ry5ymgcrpe-321081453456.europe-west2.run.app/downloads/freedom-messaging-v1.2.4-release.apk',
    createdAt: '2026-09-27T03:30:00.000Z',
    notes: 'Production Release: Added interactive audio waveform visualizer for voice notes with instant inline scrubbing & high-res playback.',
    architectures: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    featuresIncluded: [
      'Voice Note Waveform DSP Visualizer',
      'Multilingual Gemini Translation Engine',
      'QR Code Scanner & Contact Pairing',
      'Firebase Realtime Firestore Sync',
      'R8 / ProGuard Minification',
    ],
    keystoreAlias: 'freedom-release-key',
    logs: [
      '[INFO] Initializing Android build pipeline v1.2.4 (Build #104)...',
      '[ENV] Target SDK: API 34 (Android 14), Min SDK: API 24 (Android 7.0)',
      '[BUNDLE] Compiling JavaScript bundle & React 19 UI assets...',
      '[ASSETS] Linking audio DSP waveform and svg assets...',
      '[GRADLE] Executing: ./gradlew assembleRelease --no-daemon',
      '[SIGN] Signing APK with Freedom Production Keystore v2+v3 scheme',
      '[SUCCESS] Release APK generated: freedom-messaging-v1.2.4-release.apk (26.4 MB)',
      '[SHA256] 9a4f21b7c88e9903e192f941198b10887df2a0139b4b0e352efc5c8e217d8ef0',
    ],
  },
  {
    id: 'apk-102-v120',
    versionName: 'v1.2.0',
    versionCode: 102,
    buildType: 'debug',
    appName: 'Freedom Messaging',
    packageName: 'com.freedom.messaging',
    fileSize: '28.1 MB',
    fileName: 'freedom-messaging-v1.2.0-debug.apk',
    targetSdk: 'Android 14 (API 34)',
    minSdk: 'Android 7.0 (API 24)',
    status: 'ready',
    sha256Checksum: '1b89ef32a48c909e7421dc009a25b4109f213982cd739b0e352efc11a09d3b14',
    downloadUrl: 'https://ais-dev-ixlwbs3zoaq5ry5ymgcrpe-321081453456.europe-west2.run.app/downloads/freedom-messaging-v1.2.0-debug.apk',
    createdAt: '2026-09-26T18:45:00.000Z',
    notes: 'Debug build with internal React developer tools, network logs inspector, and verbose audio diagnostics.',
    architectures: ['universal'],
    featuresIncluded: [
      'Debug Developer Menu & Logcat Inspector',
      'Multilingual Translation',
      'QR Code Generator',
    ],
    keystoreAlias: 'android-debug-key',
    logs: [
      '[INFO] Debug build started...',
      '[GRADLE] assembleDebug executed successfully.',
      '[SUCCESS] Generated freedom-messaging-v1.2.0-debug.apk (28.1 MB)',
    ],
  },
  {
    id: 'apk-100-v110',
    versionName: 'v1.1.0',
    versionCode: 100,
    buildType: 'bundle',
    appName: 'Freedom Messaging',
    packageName: 'com.freedom.messaging',
    fileSize: '19.8 MB',
    fileName: 'freedom-messaging-v1.1.0-release.aab',
    targetSdk: 'Android 14 (API 34)',
    minSdk: 'Android 7.0 (API 24)',
    status: 'ready',
    sha256Checksum: 'e289ab749c0018d94e21a87e029ba73089d12a94017a02b489c7d1e8473a9032',
    downloadUrl: 'https://ais-dev-ixlwbs3zoaq5ry5ymgcrpe-321081453456.europe-west2.run.app/downloads/freedom-messaging-v1.1.0-release.aab',
    createdAt: '2026-09-25T11:15:00.000Z',
    notes: 'Google Play Store App Bundle (AAB) release for international distribution.',
    architectures: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    featuresIncluded: [
      'Optimized Split APKs Architecture',
      'Dynamic Feature Modules',
      'Multilingual Chat Engine',
    ],
    keystoreAlias: 'google-play-signing-key',
    logs: [
      '[INFO] Building Android App Bundle (AAB)...',
      '[BUNDLE] Generated app-release.aab (19.8 MB)',
      '[SUCCESS] Verified for Google Play Store upload.',
    ],
  },
];

/**
 * Save an APK build record to Firestore with localStorage fallback
 */
export async function saveApkBuildInDb(build: ApkBuild): Promise<void> {
  const buildRef = doc(db, 'apk_builds', build.id);
  try {
    await setDoc(buildRef, build, { merge: true });
  } catch (error) {
    console.warn(`Firestore saveApkBuildInDb error for ${build.id}:`, error);
  }

  try {
    const raw = localStorage.getItem('freedom_apk_builds');
    const existing: ApkBuild[] = raw ? JSON.parse(raw) : INITIAL_APK_BUILDS;
    const index = existing.findIndex((b) => b.id === build.id);
    let updated: ApkBuild[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = build;
    } else {
      updated = [build, ...existing];
    }
    localStorage.setItem('freedom_apk_builds', JSON.stringify(updated));
  } catch {}
}

/**
 * Delete an APK build from Firestore and localStorage
 */
export async function deleteApkBuildInDb(buildId: string): Promise<void> {
  const buildRef = doc(db, 'apk_builds', buildId);
  try {
    await deleteDoc(buildRef);
  } catch (error) {
    console.warn(`Firestore deleteApkBuildInDb error for ${buildId}:`, error);
  }

  try {
    const raw = localStorage.getItem('freedom_apk_builds');
    if (raw) {
      const existing: ApkBuild[] = JSON.parse(raw);
      const filtered = existing.filter((b) => b.id !== buildId);
      localStorage.setItem('freedom_apk_builds', JSON.stringify(filtered));
    }
  } catch {}
}

/**
 * Fetch all APK builds from Firestore or localStorage fallback
 */
export async function getApkBuildsFromDb(): Promise<ApkBuild[]> {
  try {
    const coll = collection(db, 'apk_builds');
    const snapshot = await getDocs(coll);
    if (!snapshot.empty) {
      const list = snapshot.docs.map((d) => d.data() as ApkBuild);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      try {
        localStorage.setItem('freedom_apk_builds', JSON.stringify(list));
      } catch {}
      return list;
    }
  } catch (error) {
    console.warn('Could not fetch APK builds from Firestore, using local fallback:', error);
  }

  try {
    const raw = localStorage.getItem('freedom_apk_builds');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // Return initialized presets
  try {
    localStorage.setItem('freedom_apk_builds', JSON.stringify(INITIAL_APK_BUILDS));
  } catch {}
  return INITIAL_APK_BUILDS;
}

/**
 * Trigger immediate browser download of an authentic Android APK / AAB package
 */
export function triggerApkDownload(build: ApkBuild): void {
  // Use real binary APK file served from public/downloads
  const fallbackUrl = `/downloads/${encodeURIComponent(build.fileName)}`;
  const directUrl = build.downloadUrl && build.downloadUrl.startsWith('http') 
    ? build.downloadUrl 
    : fallbackUrl;

  const a = document.createElement('a');
  a.href = directUrl;
  a.download = build.fileName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Fetch chat wallpaper configuration for a contact
 */
export async function getConversationWallpaperFromDb(contactId: string): Promise<ChatWallpaperConfig | null> {
  try {
    const wpRef = doc(db, 'chat_wallpapers', contactId);
    const snap = await getDoc(wpRef);
    if (snap.exists()) {
      return snap.data() as ChatWallpaperConfig;
    }
  } catch (err) {
    console.warn(`Could not load wallpaper for ${contactId}:`, err);
  }
  try {
    const raw = localStorage.getItem(`freedom_chat_wallpaper_config_${contactId}`);
    if (raw) return JSON.parse(raw) as ChatWallpaperConfig;
  } catch {}
  return null;
}

/**
 * Save chat wallpaper configuration for a conversation between two chatting participants:
 * - When a participant uploads a new wallpaper in chat message, it becomes the current shared wallpaper
 *   for both chatting participants at that time (`sharedWallpaperUrl`), UNLESS the other participant
 *   has already uploaded her own different wallpaper picture (`participantCustomWallpapers[otherId]`).
 * - When a participant uploads her own different wallpaper picture, it is saved in `participantCustomWallpapers[uploaderId]`
 *   and also set as `sharedWallpaperUrl` if no shared wallpaper existed yet (or updated for both if the other participant hasn't uploaded her own custom picture).
 */
export async function saveConversationWallpaperInDb(
  contactId: string,
  wallpaper: ChatWallpaperConfig,
  uploaderUserId?: string,
  uploaderUserName?: string
): Promise<ChatWallpaperConfig> {
  const safeId = contactId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  const existing = await getConversationWallpaperFromDb(safeId);
  const prevCustomMap: Record<string, string> = {
    ...(existing?.participantCustomWallpapers || {}),
    ...(wallpaper.participantCustomWallpapers || {}),
  };

  const uid = (uploaderUserId || wallpaper.uploadedByUserId || 'me').trim();
  const imageUrl = wallpaper.sharedWallpaperUrl || wallpaper.value || '';

  if (uid && imageUrl) {
    prevCustomMap[uid] = imageUrl;
  }

  const mergedConfig: ChatWallpaperConfig = {
    id: safeId,
    name: wallpaper.name || 'Chat Wallpaper',
    type: 'image',
    value: imageUrl,
    sharedWallpaperUrl: imageUrl,
    uploadedByUserId: uid,
    uploadedByUserName: uploaderUserName || wallpaper.uploadedByUserName || 'Participant',
    participantCustomWallpapers: prevCustomMap,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`freedom_chat_wallpaper_config_${safeId}`, JSON.stringify(mergedConfig));
    localStorage.setItem(`freedom_chat_wallpaper_${contactId}`, imageUrl);
    if (uid) {
      localStorage.setItem(`freedom_chat_wallpaper_user_${safeId}_${uid}`, imageUrl);
    }
  } catch {}

  try {
    const wpRef = doc(db, 'chat_wallpapers', safeId);
    await setDoc(wpRef, mergedConfig, { merge: true });
  } catch (err) {
    console.warn(`Could not save wallpaper for ${safeId}:`, err);
  }

  return mergedConfig;
}

/**
 * Resolve which wallpaper URL a participant should see in a 2-participant conversation:
 * - If this participant has uploaded her own different wallpaper picture, show her own wallpaper.
 * - Otherwise, show the current shared wallpaper uploaded by the chatting participant he/she is chatting with.
 */
export function resolveParticipantConversationWallpaper(
  config: ChatWallpaperConfig | null | undefined,
  viewerUserId: string,
  contactId: string
): string {
  const uid = (viewerUserId || 'me').trim();
  if (config) {
    const customMap = config.participantCustomWallpapers || {};
    if (uid && customMap[uid]) {
      return customMap[uid];
    }
    if (config.sharedWallpaperUrl) {
      return config.sharedWallpaperUrl;
    }
    if (config.value) {
      return config.value;
    }
  }
  try {
    const safeId = contactId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
    const ownSaved = localStorage.getItem(`freedom_chat_wallpaper_user_${safeId}_${uid}`);
    if (ownSaved) return ownSaved;
    const rawConfig = localStorage.getItem(`freedom_chat_wallpaper_config_${safeId}`);
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig) as ChatWallpaperConfig;
      if (uid && parsed.participantCustomWallpapers?.[uid]) {
        return parsed.participantCustomWallpapers[uid];
      }
      if (parsed.sharedWallpaperUrl || parsed.value) {
        return parsed.sharedWallpaperUrl || parsed.value;
      }
    }
    const legacy = localStorage.getItem(`freedom_chat_wallpaper_${contactId}`);
    if (legacy && (legacy.startsWith('data:image/') || legacy.startsWith('http'))) {
      return legacy;
    }
  } catch {}
  return '';
}

/**
 * Subscribe in real-time to a conversation's wallpaper in Firestore and localStorage
 * so both chatting participants immediately see the current shared wallpaper (unless the other participant
 * has uploaded her own different wallpaper picture).
 */
export function subscribeConversationWallpaperFromDb(
  contactId: string,
  viewerUserId: string,
  onWallpaperChange: (resolvedUrl: string, config: ChatWallpaperConfig | null) => void
): () => void {
  if (!contactId) return () => {};
  const safeId = contactId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  const wpRef = doc(db, 'chat_wallpapers', safeId);

  const emitFromLocal = () => {
    try {
      const raw = localStorage.getItem(`freedom_chat_wallpaper_config_${safeId}`);
      const parsed = raw ? (JSON.parse(raw) as ChatWallpaperConfig) : null;
      const url = resolveParticipantConversationWallpaper(parsed, viewerUserId, contactId);
      onWallpaperChange(url, parsed);
    } catch {
      onWallpaperChange('', null);
    }
  };

  emitFromLocal();

  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === `freedom_chat_wallpaper_config_${safeId}` ||
      e.key === `freedom_chat_wallpaper_${contactId}` ||
      e.key === `freedom_chat_wallpaper_user_${safeId}_${viewerUserId}`
    ) {
      emitFromLocal();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  const unsub = onSnapshot(
    wpRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ChatWallpaperConfig;
        try {
          localStorage.setItem(`freedom_chat_wallpaper_config_${safeId}`, JSON.stringify(data));
        } catch {}
        const resolved = resolveParticipantConversationWallpaper(data, viewerUserId, contactId);
        onWallpaperChange(resolved, data);
      } else {
        emitFromLocal();
      }
    },
    () => {
      emitFromLocal();
    }
  );

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
    unsub();
  };
}


/**
 * Unique session identifier for the current browser tab / device instance
 * so typing events from another device or tab are recognized as remote contact typing.
 */
export const DEVICE_SESSION_ID = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export interface TypingIndicatorRecord {
  id: string;
  chatId: string;
  isContactTyping?: boolean;
  isUserTyping?: boolean;
  typingUserId?: string;
  typingUserName?: string;
  deviceSessionId?: string;
  updatedAt: string;
}

/**
 * Sync typing indicator state to Firebase Firestore (`/typing_indicators/{chatId}`)
 * so other devices see in real-time when a user or contact is writing.
 */
export async function syncTypingIndicatorToDb(
  chatId: string,
  options: {
    isContactTyping?: boolean;
    isUserTyping?: boolean;
    typingUserId?: string;
    typingUserName?: string;
  }
): Promise<void> {
  if (!chatId) return;
  const safeChatId = chatId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  const nowIso = new Date().toISOString();

  const payload: TypingIndicatorRecord = {
    id: safeChatId,
    chatId: safeChatId,
    ...(options.isContactTyping !== undefined ? { isContactTyping: Boolean(options.isContactTyping) } : {}),
    ...(options.isUserTyping !== undefined ? { isUserTyping: Boolean(options.isUserTyping) } : {}),
    ...(options.typingUserId ? { typingUserId: String(options.typingUserId).slice(0, 120) } : {}),
    ...(options.typingUserName ? { typingUserName: String(options.typingUserName).slice(0, 95) } : {}),
    deviceSessionId: DEVICE_SESSION_ID,
    updatedAt: nowIso,
  };

  // Broadcast locally across tabs immediately and persist to Firestore for cross-device sync
  try {
    localStorage.setItem(`freedom_typing_indicator_${safeChatId}`, JSON.stringify(payload));
  } catch {}

  try {
    const typingRef = doc(db, 'typing_indicators', safeChatId);
    await setDoc(typingRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `typing_indicators/${safeChatId}`);
  }
}

/**
 * Subscribe in real-time to Firestore typing indicator document (`/typing_indicators/{chatId}`)
 * across devices so `isContactTyping` reflects live writing activity.
 */
export function subscribeTypingIndicatorFromDb(
  chatId: string,
  onTypingChange: (isTyping: boolean, typingUserName?: string) => void
): () => void {
  if (!chatId) return () => {};
  const safeChatId = chatId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  const typingRef = doc(db, 'typing_indicators', safeChatId);

  const evaluateTypingRecord = (data: Partial<TypingIndicatorRecord> | null | undefined) => {
    if (!data) {
      onTypingChange(false);
      return;
    }

    // Ignore stale typing states older than 12 seconds
    if (data.updatedAt) {
      const ageMs = Date.now() - new Date(data.updatedAt).getTime();
      if (!Number.isNaN(ageMs) && ageMs > 12000) {
        onTypingChange(false);
        return;
      }
    }

    const isRemoteDeviceUserTyping =
      Boolean(data.isUserTyping) &&
      Boolean(data.deviceSessionId) &&
      data.deviceSessionId !== DEVICE_SESSION_ID;

    const isTypingActive = Boolean(data.isContactTyping) || isRemoteDeviceUserTyping;
    onTypingChange(isTypingActive, data.typingUserName);
  };

  // Listen to storage events for instant multi-tab sync on the same device
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === `freedom_typing_indicator_${safeChatId}` && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as TypingIndicatorRecord;
        evaluateTypingRecord(parsed);
      } catch {}
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  const unsubFirestore = onSnapshot(
    typingRef,
    (snap) => {
      if (snap.exists()) {
        evaluateTypingRecord(snap.data() as TypingIndicatorRecord);
      } else {
        onTypingChange(false);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `typing_indicators/${safeChatId}`);
    }
  );

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
    unsubFirestore();
  };
}

export interface ChannelLiveStreamRecord {
  id: string;
  channelId: string;
  messageId: string;
  title: string;
  creatorId: string;
  creatorName: string;
  active: boolean;
  deleted?: boolean;
  updatedAt: string;
}

export async function saveChannelLiveStreamToDb(record: ChannelLiveStreamRecord): Promise<void> {
  if (!record.id) return;
  const safeId = record.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  try {
    localStorage.setItem(`freedom_channel_live_stream_${safeId}`, JSON.stringify(record));
  } catch {}
  try {
    await setDoc(doc(db, 'channel_live_streams', safeId), record, { merge: true });
  } catch (err) {
    console.warn('Channel live stream sync warning (saved locally):', err);
  }
}

export async function deleteChannelLiveStreamFromDb(streamId: string): Promise<void> {
  if (!streamId) return;
  const safeId = streamId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  try {
    localStorage.removeItem(`freedom_channel_live_stream_${safeId}`);
  } catch {}
  try {
    await deleteDoc(doc(db, 'channel_live_streams', safeId));
  } catch (err) {
    console.warn('Channel live stream delete warning:', err);
  }
}

export async function sendChannelLiveChatMessageToDb(msg: {
  id: string;
  channelId: string;
  streamId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: string;
}): Promise<void> {
  const safeId = msg.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  const storageKey = `freedom_channel_live_chat_msgs_${msg.streamId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.some((m: { id: string }) => m.id === msg.id)) {
      const updated = [...list, msg];
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch {}
  try {
    await setDoc(doc(db, 'channel_live_chats', safeId), msg, { merge: true });
  } catch (err) {
    console.warn('Channel live chat message sync warning (saved locally):', err);
  }
}

export function subscribeChannelLiveChatMessages(
  streamId: string,
  onMessagesChange: (
    messages: Array<{
      id: string;
      channelId: string;
      streamId: string;
      senderId: string;
      senderName: string;
      senderAvatar: string;
      text: string;
      createdAt: string;
    }>
  ) => void
): () => void {
  if (!streamId) return () => {};
  const storageKey = `freedom_channel_live_chat_msgs_${streamId}`;

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  onMessagesChange(loadLocal());

  const unsub = onSnapshot(
    collection(db, 'channel_live_chats'),
    (snap) => {
      const remoteMsgs: Array<{
        id: string;
        channelId: string;
        streamId: string;
        senderId: string;
        senderName: string;
        senderAvatar: string;
        text: string;
        createdAt: string;
      }> = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data && data.streamId === streamId && data.text) {
          remoteMsgs.push({
            id: data.id || d.id,
            channelId: data.channelId || '',
            streamId: data.streamId,
            senderId: data.senderId || 'user',
            senderName: data.senderName || 'Channel Member',
            senderAvatar: data.senderAvatar || '',
            text: data.text,
            createdAt: data.createdAt || new Date().toISOString(),
          });
        }
      });
      const localMsgs = loadLocal();
      const map = new Map<string, any>();
      localMsgs.forEach((m: any) => map.set(m.id, m));
      remoteMsgs.forEach((m) => map.set(m.id, m));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      try {
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {}
      onMessagesChange(merged);
    },
    () => {
      onMessagesChange(loadLocal());
    }
  );

  return () => unsub();
}







