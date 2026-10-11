export type ScreenView = 'login' | 'password_reset' | 'onboarding' | 'chats' | 'status' | 'chat_detail' | 'people' | 'calls' | 'podcast' | 'profile' | 'admin' | 'about';

export type FooterPageTab = 'about' | 'terms' | 'feedback' | 'careers' | 'policy' | 'faq';

export type ContactAccountStatus = 'all' | 'active' | 'blocked';

export type PresentationMode = 'single_phone' | 'showcase' | 'fullscreen';

export type ThemeMode = 'dark' | 'light';

export interface NotificationBellSettings {
  bellIconUrl?: string;
  bellIconFileName?: string;
  bellSoundUrl?: string;
  bellSoundFileName?: string;
  bellTuneName?: string;
  bellVolume?: number;
  bellAlertMode?: 'sound_and_badge' | 'sound_only' | 'silent_badge';
  vibrateOnRing?: boolean;
  ringOnNewMessage?: boolean;
  ringOnFriendInvite?: boolean;
  isAppDefaultBell?: boolean;
}

export interface AppBrandConfig {
  appName: string;
  appDescription?: string;
  faviconUrl: string;
  faviconFileName?: string;
  primaryColor: string;
  primaryColorName: string;
  notificationIconUrl?: string;
  notificationIconFileName?: string;
  notificationSoundUrl?: string;
  notificationSoundFileName?: string;
  notificationTuneName?: string;
  notificationBellSettings?: NotificationBellSettings;
  updatedAt?: string;
}

export interface BannedUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  username?: string;
  reason: string;
  bannedAt: string;
  bannedBy: string;
}

export interface ReportedUser {
  id: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserAvatar: string;
  reporterName: string;
  reporterId?: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  notes?: string;
}

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  bannedUsersCount: number;
  totalMessages: number;
  textMessagesCount: number;
  audioMessagesCount: number;
  mediaMessagesCount: number;
  pendingReportsCount: number;
}

export type SocialPlatform = 'twitter' | 'instagram' | 'github' | 'linkedin' | 'facebook' | 'youtube' | 'tiktok' | 'website';

export interface SocialLinkItem {
  platform: SocialPlatform;
  url: string;
  handle?: string;
}

export interface GroupParticipant {
  id: string;
  name: string;
  avatar: string;
  nativeLanguage?: string;
  online?: boolean;
  role?: 'admin' | 'moderator' | 'member';
  isContributionLocked?: boolean;
  moderationStatus?: 'active' | 'suspended' | 'banned';
  suspendedUntil?: string;
  banReason?: string;
  isVerified?: boolean;
  profileValidatedAt?: string;
}

export interface UserContact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  online: boolean;
  unreadCount?: number;
  nativeLanguage?: string;
  statusText?: string;
  avatarFileName?: string;
  avatarFileSize?: string;
  avatarThumbnailUrl?: string;
  lastMessageStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  status?: 'active' | 'blocked' | 'offline' | string;
  isBlocked?: boolean;
  blockedAt?: string;
  blockedReason?: string;
  isBanned?: boolean;
  bannedReason?: string;
  phoneNumber?: string;
  hidePhoneNumberPublic?: boolean;
  email?: string;
  isImported?: boolean;
  importedFrom?: 'mobile' | 'whatsapp' | 'manual';
  isArchived?: boolean;
  archivedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  isPinned?: boolean;
  lastActivityDate?: string;
  bio?: string;
  username?: string;
  location?: string;
  age?: number | string;
  gender?: 'Female' | 'Male' | string;
  avatarShape?: 'round' | 'squircle';
  socialLinks?: SocialLinkItem[];
  wallpaper?: ChatWallpaperConfig;
  profileCoverUrl?: string;
  profileWallpaperUrl?: string;
  // Group Chat Distinction & Participants
  entityType?: 'individual' | 'group' | 'channel';
  isGroup?: boolean;
  isJoinedGroup?: boolean;
  groupCoverUrl?: string;
  participants?: GroupParticipant[];
  groupAdminId?: string;
  groupTopic?: string;
  // Channel Distinction & Broadcast Settings
  isChannel?: boolean;
  isSubscribedChannel?: boolean;
  channelHandle?: string;
  channelDescription?: string;
  channelCategory?: string;
  channelPrivacy?: 'public' | 'private';
  subscribersCount?: number;
  channelAdminId?: string;
  // User Contribution Lock & Friendship Engagement
  isContributionLocked?: boolean;
  relationshipTier?: 'Best Friend' | 'Close Friend' | 'Language Partner' | 'Teammate' | 'Connected' | string;
  nickname?: string;
  friendshipNotes?: string;
  friendshipStreak?: number;
  friendInviteStatus?: 'none' | 'pending' | 'accepted';
  friendInviteSentAt?: string;
  hideOnlineStatus?: boolean;
  isVerified?: boolean;
  profileValidatedAt?: string;
  idDocumentUrl?: string;
  idDocumentName?: string;
  verifiedByAdmin?: boolean;
  verifiedRewardedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  avatarFileName?: string;
  avatarFileSize?: string;
  avatarThumbnailUrl?: string;
  avatarUpdatedAt?: string;
  profileCoverUrl?: string;
  profileCoverThumbnailUrl?: string;
  profileWallpaperUrl?: string;
  bio?: string;
  location?: string;
  age?: number | string;
  gender?: 'Female' | 'Male' | string;
  motherLanguage?: string;
  isOnline?: boolean;
  hideOnlineStatus?: boolean;
  lastMessage?: string;
  time?: string;
  lastSeen?: string;
  status?: 'active' | 'blocked' | 'offline' | string;
  statusText?: string;
  isBlocked?: boolean;
  blockedAt?: string;
  theme?: ThemeMode;
  phoneNumber?: string;
  hidePhoneNumberPublic?: boolean;
  email?: string;
  updatedAt?: string;
  createdAt?: string;
  autoArchiveInactiveChats?: boolean;
  autoArchiveDaysThreshold?: number;
  lastAutoArchiveRunAt?: string;
  avatarShape?: 'round' | 'squircle';
  socialLinks?: SocialLinkItem[];
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  fingerprintEnabled?: boolean;
  fingerprintCredentialId?: string;
  fingerprintRecordedAt?: string;
  isVerified?: boolean;
  profileValidatedAt?: string;
  idDocumentUrl?: string;
  idDocumentName?: string;
  verifiedByAdmin?: boolean;
  verifiedRewardedAt?: string;
  autoPlayChatVideos?: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userReacted?: boolean;
}

export interface AudioTranscriptionData {
  originalTranscript: string;
  detectedLanguage?: string;
  translatedText: string;
  targetLanguage: string;
  isTranscribing?: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  senderId: 'me' | 'other';
  senderParticipantId?: string;
  senderName?: string;
  senderAvatar?: string;
  senderLanguage?: string;
  text?: string;
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'call' | 'error' | 'sticker';
  audioDuration?: string;
  mediaUrl?: string;
  audioTranscription?: AudioTranscriptionData;
  videoUrl?: string;
  videoThumbnail?: string;
  videoPlatform?: string;
  embedUrl?: string;
  originalVideoUrl?: string;
  documentName?: string;
  documentSize?: string;
  documentType?: string;
  callType?: 'voice' | 'video';
  callDuration?: string;
  callStatus?: 'completed' | 'missed' | 'declined';
  stickerId?: string;
  stickerName?: string;
  stickerCategory?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  dateLabel?: string;
  translation?: {
    original: string;
    translated: string;
    language: string;
  };
  reactions?: MessageReaction[];
  isWhatsAppImported?: boolean;
  whatsappSender?: string;
  isLiked?: boolean;
  likesCount?: number;
  isFavorite?: boolean;
  userRating?: number;
  averageRating?: number;
  totalRatings?: number;
  isForwarded?: boolean;
  forwardedFrom?: string;
  wallpaperLink?: string;
  isContributionLocked?: boolean;
  lockedBy?: string;
  // Channel Live Stream Chat ("live") properties
  isLiveStream?: boolean;
  liveStreamTitle?: string;
  liveStreamId?: string;
  liveStreamCreatorId?: string;
  liveStreamDeleted?: boolean;
}

export interface ChannelLiveChatMessage {
  id: string;
  channelId: string;
  streamId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: string;
}

export interface MediaInteraction {
  id: string;
  mediaUrl?: string;
  likesCount: number;
  isLiked: boolean;
  isFavorite: boolean;
  userRating: number;
  averageRating: number;
  totalRatings: number;
  shareCount?: number;
  seoTags?: string[];
  submittedToSearchEngines?: boolean;
  updatedAt?: string;
}

export interface StickerItem {
  id: string;
  name: string;
  category: 'animals' | 'moods' | 'love' | 'party' | 'freedom' | 'custom' | string;
  emoji: string;
  imageUrl?: string;
  title: string;
  svgBadge?: string;
  bgGradient: string;
  badgeText?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  uploadDate?: string;
}

export interface ActiveMediaItem {
  id?: string;
  type: 'video' | 'audio' | 'image' | 'document';
  title: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  videoPlatform?: string;
  embedUrl?: string;
  originalVideoUrl?: string;
  senderName?: string;
  timestamp?: string;
  duration?: string;
  likesCount?: number;
  isLiked?: boolean;
  isFavorite?: boolean;
  userRating?: number;
  averageRating?: number;
  totalRatings?: number;
  shareCount?: number;
  seoTags?: string[];
  submittedToSearchEngines?: boolean;
}

export interface CallLog {
  id: string;
  contactName: string;
  avatar: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  time: string;
  duration?: string;
  contactId?: string;
  phoneNumber?: string;
  nativeLanguage?: string;
  isSynced?: boolean;
}

export interface ImportedMobileContact {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  avatar: string;
  nativeLanguage: string;
  selected?: boolean;
}

export interface WhatsAppParsedMessage {
  id: string;
  date: string;
  time: string;
  sender: string;
  content: string;
  isMedia?: boolean;
}

export type ApkBuildType = 'release' | 'debug' | 'bundle';

export interface ApkBuild {
  id: string;
  versionName: string;
  versionCode: number;
  buildType: ApkBuildType;
  appName: string;
  packageName: string;
  fileSize: string;
  fileName: string;
  targetSdk: string;
  minSdk: string;
  status: 'ready' | 'building' | 'failed';
  sha256Checksum: string;
  downloadUrl?: string;
  createdAt: string;
  notes?: string;
  architectures: string[];
  featuresIncluded?: string[];
  keystoreAlias?: string;
  logs?: string[];
}

export interface ApkBuildConfig {
  versionName: string;
  versionCode: number;
  buildType: ApkBuildType;
  packageName: string;
  appName: string;
  targetSdk: string;
  minSdk: string;
  architectures: string[];
  features: {
    audioWaveformDsp: boolean;
    geminiTranslation: boolean;
    qrScanner: boolean;
    firebasePush: boolean;
    proguardMinify: boolean;
    offlineCache: boolean;
  };
  keystore: 'production' | 'debug' | 'custom';
  notes: string;
}

export type ApkBuildEngine = 'eas' | 'cordova' | 'gradle';

export interface ChatWallpaperConfig {
  id: string;
  name: string;
  type: 'color' | 'gradient' | 'image' | 'doodle';
  value: string; // hex, gradient class, or image URL
  opacity?: number;
  previewBg?: string;
  backgroundStyle?: string;
  dimness?: number;
  blur?: number;
  isCustomUrl?: boolean;
  sharedWallpaperUrl?: string;
  uploadedByUserId?: string;
  uploadedByUserName?: string;
  participantCustomWallpapers?: Record<string, string>;
  updatedAt?: string;
}

export interface TwoFactorAuthConfig {
  enabled: boolean;
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
  enforceForAdmin: boolean;
  enforceForAllUsers: boolean;
  lastVerifiedAt?: string;
  updatedAt?: string;
}

export interface TwoFactorVerifyResult {
  valid: boolean;
  isBackupCode?: boolean;
  remainingBackupCodes?: string[];
  message: string;
}

export interface EphemeralStatusItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userThumbnailUrl?: string;
  isVerified?: boolean;
  type: 'text' | 'image' | 'video';
  text?: string;
  caption?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  bgColor?: string;
  fontStyle?: 'sans' | 'serif' | 'mono' | 'bold';
  createdAt: number; // epoch ms
  expiresAt: number; // createdAt + 24 * 60 * 60 * 1000
  viewedByUserIds?: string[];
  viewsCount?: number;
  reactions?: { emoji: string; userId: string; userName: string }[];
}



