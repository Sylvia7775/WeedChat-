import React, { useState, useMemo, useEffect } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Search,
  X,
  Check,
  Play,
  Clock,
  ArrowUpRight,
  Heart,
  Edit2,
  Trash2,
  Share2,
  Users,
  Shield,
  Send,
  Sparkles,
  Globe,
  Tag,
  Link2,
  ExternalLink,
  Sliders,
  Plus,
  Flag,
  EyeOff,
  Eye,
  AlertTriangle,
  Upload,
  Camera,
  Save,
  UserCheck,
} from 'lucide-react';
import { ChatMessage, UserContact, ThemeMode, ActiveMediaItem, GroupParticipant } from '../types';
import { MediaPlayerModal } from './MediaPlayerModal';
import { GalleryPhotoVideoEditorModal } from './GalleryPhotoVideoEditorModal';
import {
  generateVideoFileThumbnail,
  generateProfileThumbnailFile,
} from '../lib/videoPlatformHelper';
import {
  MediaReportCategory,
  MEDIA_REPORT_CATEGORIES,
  ReportedMediaRecord,
  getReportedMediaFiles,
  reportGalleryMediaFile,
  getRemovedForbiddenMediaIds,
  getAdultNudityMediaIds,
  markMediaAsAdultNudity,
  getHideAdultNuditySetting,
  setHideAdultNuditySetting,
  getHideAdultNudityMode,
  setHideAdultNudityMode,
} from '../lib/mediaModerationHelper';
import {
  getMediaSeoTags,
  formatSeoTagsForInput,
  saveAndSubmitMediaSeoToSearchEngines,
  syncHiddenHeadSeoMeta,
  parseSeoTagsInput,
} from '../lib/mediaSeoHelper';
import {
  LikedGalleryMediaItem,
  getLikedUserGalleryItems,
  addMediaToLikedUserGallery,
  removeMediaFromLikedUserGallery,
  saveUserMediaSession,
  setMediaGalleryPictureAsAvatar,
  setMediaGalleryPictureAsProfileCover,
  syncUserGalleryWithFirestore,
  getActiveSessionUserId,
} from '../lib/likedUserGalleryHelper';

export type MediaTabType = 'images' | 'videos' | 'documents' | 'links' | 'all';

export interface UnifiedGalleryItem {
  id: string;
  messageId: string;
  type: 'image' | 'video' | 'document' | 'link' | 'audio';
  url: string;
  title: string;
  senderId: 'me' | 'other';
  senderName: string;
  senderAvatar: string;
  timestamp: string;
  duration?: string;
  fileSize?: string;
  thumbnailUrl?: string;
  documentType?: string;
  documentLink?: string;
  likesCount?: number;
  isLiked?: boolean;
  isFavorite?: boolean;
}

interface MediaPictureGalleryViewProps {
  messages?: ChatMessage[];
  contact?: UserContact;
  currentUserId?: string;
  theme?: ThemeMode;
  primaryColor?: string;
  onSelectMedia?: (media: ActiveMediaItem) => void;
  onJumpToMessage?: (messageId: string) => void;
  onDeleteMessageMedia?: (messageId: string) => void;
  onEditMessageMediaTitle?: (messageId: string, newTitle: string) => void;
  onToggleFavoriteMedia?: (messageId: string, isFavorite: boolean) => void;
  onToggleLikeMedia?: (messageId: string, isLiked: boolean) => void;
  initialTab?: MediaTabType;
  showSearch?: boolean;
  compact?: boolean;
  isGroupGallery?: boolean;
  isAdminVerified?: boolean;
  groupParticipants?: GroupParticipant[];
  onShareWithGroupMembers?: (media: ActiveMediaItem, memberIds: string[], note?: string) => void;
  onShareMediaInMessage?: (media: ActiveMediaItem) => void;
}

export const MediaPictureGalleryView: React.FC<MediaPictureGalleryViewProps> = ({
  messages = [],
  contact,
  currentUserId,
  theme = 'dark',
  primaryColor = '#7C3AED',
  onSelectMedia,
  onJumpToMessage,
  onDeleteMessageMedia,
  onEditMessageMediaTitle,
  onToggleFavoriteMedia,
  onToggleLikeMedia,
  initialTab = 'images',
  showSearch = true,
  compact = false,
  isGroupGallery = false,
  isAdminVerified = false,
  groupParticipants,
  onShareWithGroupMembers,
  onShareMediaInMessage,
}) => {
  const isDark = theme === 'dark';
  const isGroupMode = Boolean(
    isGroupGallery || contact?.isGroup || contact?.entityType === 'group'
  );
  const resolvedGroupParticipants: GroupParticipant[] = useMemo(() => {
    if (groupParticipants && groupParticipants.length > 0) return groupParticipants;
    if (contact?.participants && contact.participants.length > 0) return contact.participants;
    return [
      {
        id: 'user_kristin',
        name: 'Kristin Watson',
        avatar: '/kristin_avatar.jpg',
        nativeLanguage: 'Spanish',
        online: true,
        role: 'member',
      },
      {
        id: 'user_jenny',
        name: 'Jenny Wilson',
        avatar:
          'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
        nativeLanguage: 'French',
        online: true,
        role: 'member',
      },
      {
        id: 'user_jacob',
        name: 'Jacob Jones',
        avatar:
          'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
        nativeLanguage: 'German',
        online: true,
        role: 'member',
      },
    ];
  }, [groupParticipants, contact?.participants]);

  const otherGroupMembers = useMemo(
    () => resolvedGroupParticipants.filter((p) => p.id !== 'me'),
    [resolvedGroupParticipants]
  );

  const [sharingGroupItem, setSharingGroupItem] = useState<UnifiedGalleryItem | null>(null);
  const [selectedShareMemberIds, setSelectedShareMemberIds] = useState<string[]>([]);
  const [shareGroupNote, setShareGroupNote] = useState('');
  const [galleryToast, setGalleryToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [senderFilter] = useState<'all' | 'me' | 'other'>('all');

  // Local state for favourites, likes, custom titles, and deleted items
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});
  const [recentRedPulseMap, setRecentRedPulseMap] = useState<Record<string, boolean>>({});
  const [likeMap, setLikeMap] = useState<Record<string, { isLiked: boolean; likesCount: number }>>({});
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('freedom_deleted_media_ids') || '[]');
    } catch {
      return [];
    }
  });

  // Inline title & hidden SEO media tags editing state on gallery cards
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [editingSeoTagsValue, setEditingSeoTagsValue] = useState('');
  const [isSubmittingGallerySeo, setIsSubmittingGallerySeo] = useState(false);

  // Built-in Media Viewer Modal state when clicking any gallery thumbnail
  const [viewerMediaItem, setViewerMediaItem] = useState<ActiveMediaItem | null>(null);

  // Built-in Photo & Video Studio Editor Modal state
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    mediaType: 'image' | 'video';
    mediaUrl: string;
    mediaTitle: string;
    mediaId?: string;
    thumbnailUrl?: string;
  }>({
    isOpen: false,
    mediaType: 'image',
    mediaUrl: '',
    mediaTitle: '',
  });

  // Persisted edited media URLs and custom Links / Document Links
  const [editedMediaMap, setEditedMediaMap] = useState<
    Record<string, { url: string; thumbnailUrl?: string; title?: string }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem('freedom_edited_gallery_media_v1') || '{}');
    } catch {
      return {};
    }
  });

  const [documentLinksMap, setDocumentLinksMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('freedom_gallery_document_links_v1') || '{}');
    } catch {
      return {};
    }
  });
  const [editingDocLinkId, setEditingDocLinkId] = useState<string | null>(null);
  const [docLinkInputValue, setDocLinkInputValue] = useState<string>('');

  const [customGalleryLinks, setCustomGalleryLinks] = useState<
    Array<{ id: string; url: string; title: string; timestamp: string }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem('freedom_custom_gallery_links_v1') || '[]');
    } catch {
      return [];
    }
  });
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [newLinkTitle, setNewLinkTitle] = useState<string>('');

  // Resolved user ID for the active gallery owner
  const effectiveUserId = useMemo(() => {
    return currentUserId || getActiveSessionUserId();
  }, [currentUserId]);

  // Liked media items synced specifically for the active user (isolated on account switch)
  const [likedGalleryItems, setLikedGalleryItems] = useState<LikedGalleryMediaItem[]>(() =>
    getLikedUserGalleryItems(effectiveUserId)
  );

  // Media Moderation & Adult/Nudity Filter States
  const [reportedMediaList, setReportedMediaList] = useState<ReportedMediaRecord[]>(() =>
    getReportedMediaFiles()
  );
  const [removedForbiddenIds, setRemovedForbiddenIds] = useState<string[]>(() =>
    getRemovedForbiddenMediaIds()
  );
  const [adultNudityIds, setAdultNudityIds] = useState<string[]>(() =>
    getAdultNudityMediaIds()
  );
  const [hideAdultNudity, setHideAdultNudity] = useState<boolean>(() =>
    getHideAdultNuditySetting()
  );
  const [hideAdultMode, setHideAdultMode] = useState<'hide' | 'blur'>(() =>
    getHideAdultNudityMode()
  );
  const [temporarilyUnblurredIds, setTemporarilyUnblurredIds] = useState<string[]>([]);

  // Report Media File Modal States
  const [reportingMediaItem, setReportingMediaItem] = useState<UnifiedGalleryItem | null>(null);
  const [selectedReportCategory, setSelectedReportCategory] =
    useState<MediaReportCategory>('forbidden_platform_content');
  const [reportReasonInput, setReportReasonInput] = useState<string>('');
  const [reportAlsoMarkAdult, setReportAlsoMarkAdult] = useState<boolean>(false);
  const galleryUploadFileRef = React.useRef<HTMLInputElement | null>(null);
  const [isAutoGeneratingGalleryThumb, setIsAutoGeneratingGalleryThumb] = useState<boolean>(false);

  // Account Switching & User Gallery DB Sync
  useEffect(() => {
    // 1. Immediately load this specific user's scoped local gallery without reusing previous user's gallery
    const userLocalItems = getLikedUserGalleryItems(effectiveUserId);
    setLikedGalleryItems(userLocalItems);

    // 2. Query Firestore database with ownership security rules
    syncUserGalleryWithFirestore(effectiveUserId)
      .then((dbItems) => {
        if (dbItems && dbItems.length > 0) {
          setLikedGalleryItems(dbItems);
        }
      })
      .catch((err) => {
        console.warn('Could not sync user gallery from Firestore:', err);
      });
  }, [effectiveUserId]);

  useEffect(() => {
    const syncLikedGallery = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetUserId = customEvent?.detail?.userId;
      if (!targetUserId || targetUserId === effectiveUserId) {
        setLikedGalleryItems(getLikedUserGalleryItems(effectiveUserId));
      }
    };
    const handleAccountSwitched = () => {
      const newUserId = getActiveSessionUserId();
      setLikedGalleryItems(getLikedUserGalleryItems(newUserId));
    };
    const syncModeration = () => {
      setReportedMediaList(getReportedMediaFiles());
      setRemovedForbiddenIds(getRemovedForbiddenMediaIds());
      setAdultNudityIds(getAdultNudityMediaIds());
      setHideAdultNudity(getHideAdultNuditySetting());
      setHideAdultMode(getHideAdultNudityMode());
      try {
        const del = JSON.parse(localStorage.getItem('freedom_deleted_media_ids') || '[]');
        if (Array.isArray(del)) setDeletedIds(del);
      } catch {}
    };

    window.addEventListener('freedom-liked-gallery-updated', syncLikedGallery);
    window.addEventListener('freedom-account-switched', handleAccountSwitched);
    window.addEventListener('freedom-media-moderation-updated', syncModeration);
    return () => {
      window.removeEventListener('freedom-liked-gallery-updated', syncLikedGallery);
      window.removeEventListener('freedom-account-switched', handleAccountSwitched);
      window.removeEventListener('freedom-media-moderation-updated', syncModeration);
    };
  }, [effectiveUserId]);

  // Hydrate persisted overrides from localStorage
  useEffect(() => {
    try {
      const savedTitles = localStorage.getItem('freedom_custom_media_titles');
      if (savedTitles) {
        setCustomTitles(JSON.parse(savedTitles));
      }
      const savedFavs = localStorage.getItem('freedom_favorite_media_map');
      if (savedFavs) {
        setFavoriteMap(JSON.parse(savedFavs));
      }
      syncHiddenHeadSeoMeta();
    } catch {}
  }, []);

  // Extract all media, pictures, videos, and documents
  const allItems = useMemo<UnifiedGalleryItem[]>(() => {
    const list: UnifiedGalleryItem[] = [];

    const isPersonalGallery = !contact;
    const contactName = contact?.name || 'Kristin Watson';
    const contactAvatar =
      contact?.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    const relevantMessages = isPersonalGallery
      ? messages.filter((m) => m.senderId === 'me' || m.senderParticipantId === effectiveUserId)
      : messages;

    relevantMessages.forEach((msg) => {
      const sName = msg.senderId === 'me' ? 'You' : msg.senderName || contactName;
      const sAvatar = msg.senderAvatar || (msg.senderId === 'me' ? '' : contactAvatar);

      // 1. Images
      if (
        msg.type === 'image' ||
        (msg.mediaUrl && !msg.videoUrl && msg.type !== 'audio' && msg.type !== 'document')
      ) {
        list.push({
          id: `img-${msg.id}`,
          messageId: msg.id,
          type: 'image',
          url:
            msg.mediaUrl ||
            'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80',
          title: msg.text || 'Shared Image Photo',
          senderId: msg.senderId,
          senderName: sName,
          senderAvatar: sAvatar,
          timestamp: msg.timestamp,
          fileSize: '1.8 MB',
          likesCount: msg.likesCount ?? 14,
          isLiked: msg.isLiked ?? false,
          isFavorite: msg.isFavorite ?? false,
        });
      }

      // 2. Videos
      if (msg.type === 'video' || msg.videoUrl) {
        list.push({
          id: `vid-${msg.id}`,
          messageId: msg.id,
          type: 'video',
          url:
            msg.videoUrl ||
            msg.mediaUrl ||
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnailUrl:
            msg.videoThumbnail ||
            'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&auto=format&fit=crop&q=80',
          title: msg.text || 'Video Recording Clip',
          senderId: msg.senderId,
          senderName: sName,
          senderAvatar: sAvatar,
          timestamp: msg.timestamp,
          duration: '0:48',
          fileSize: '8.4 MB',
          likesCount: msg.likesCount ?? 15,
          isLiked: msg.isLiked ?? false,
          isFavorite: msg.isFavorite ?? false,
        });
      }

      // 3. Documents
      if (
        msg.type === 'document' ||
        msg.documentName ||
        (msg.isWhatsAppImported && !msg.mediaUrl)
      ) {
        const docUrl =
          msg.mediaUrl ||
          'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        list.push({
          id: `doc-${msg.id}`,
          messageId: msg.id,
          type: 'document',
          url: docUrl,
          title: msg.documentName || msg.text || 'Document_Attachment.pdf',
          documentType: msg.documentType || 'PDF Document',
          documentLink: documentLinksMap[msg.id] || docUrl,
          senderId: msg.senderId,
          senderName: sName,
          senderAvatar: sAvatar,
          timestamp: msg.timestamp,
          fileSize: msg.documentSize || '2.4 MB',
          likesCount: msg.likesCount ?? 4,
          isLiked: msg.isLiked ?? false,
          isFavorite: msg.isFavorite ?? false,
        });
      }

      // 4. Shared URLs / Links extracted from chat messages
      if (msg.text && /https?:\/\/[^\s]+/i.test(msg.text)) {
        const urlMatch = msg.text.match(/https?:\/\/[^\s]+/i);
        if (urlMatch && urlMatch[0]) {
          const cleanLink = urlMatch[0];
          const linkTitle =
            msg.text.replace(cleanLink, '').trim() ||
            cleanLink.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] ||
            'Shared Web Link';
          list.push({
            id: `lnk-${msg.id}`,
            messageId: `lnk-${msg.id}`,
            type: 'link',
            url: cleanLink,
            title: linkTitle,
            senderId: msg.senderId,
            senderName: sName,
            senderAvatar: sAvatar,
            timestamp: msg.timestamp,
            likesCount: msg.likesCount ?? 3,
            isLiked: msg.isLiked ?? false,
            isFavorite: msg.isFavorite ?? false,
          });
        }
      }
    });

    // Include custom added gallery links
    customGalleryLinks.forEach((cl) => {
      list.push({
        id: cl.id,
        messageId: cl.id,
        type: 'link',
        url: cl.url,
        title: cl.title || cl.url,
        senderId: 'me',
        senderName: 'You',
        senderAvatar: '',
        timestamp: cl.timestamp || 'Just now',
        likesCount: 1,
        isLiked: false,
        isFavorite: false,
      });
    });

    // Include any media liked by the user that isn't already in messages
    likedGalleryItems.forEach((likedItem) => {
      const alreadyExists = list.some(
        (existing) =>
          existing.messageId === likedItem.messageId || existing.url === likedItem.url
      );
      if (!alreadyExists && likedItem.url) {
        list.push({
          id: `${likedItem.type === 'video' ? 'vid' : 'img'}-${likedItem.messageId}`,
          messageId: likedItem.messageId,
          type: likedItem.type === 'video' ? 'video' : 'image',
          url: likedItem.url,
          thumbnailUrl: likedItem.thumbnailUrl || likedItem.url,
          title: likedItem.title || 'Liked Media',
          senderId: 'me',
          senderName: likedItem.senderName || 'You',
          senderAvatar: '',
          timestamp: likedItem.timestamp || 'Just now',
          fileSize: '1.8 MB',
          likesCount: likedItem.likesCount ?? 1,
          isLiked: true,
          isFavorite: true,
        });
      }
    });

    // Provide default media showcase items if contact conversation has fewer items
    if (list.length < 3 && contact) {
      list.push(
        {
          id: 'def-img-1',
          messageId: 'msg-9',
          type: 'image',
          url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80',
          title: 'Sunset from the studio terrace',
          senderId: 'other',
          senderName: contactName,
          senderAvatar: contactAvatar,
          timestamp: '1:42 PM',
          fileSize: '2.1 MB',
          likesCount: 19,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-img-2',
          messageId: 'msg-def-2',
          type: 'image',
          url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
          title: 'Mountain Lake Landscape',
          senderId: 'me',
          senderName: 'You',
          senderAvatar: '',
          timestamp: 'Yesterday',
          fileSize: '3.4 MB',
          likesCount: 8,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-img-3',
          messageId: 'msg-def-3',
          type: 'image',
          url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=80',
          title: 'City Street Life Photography',
          senderId: 'other',
          senderName: contactName,
          senderAvatar: contactAvatar,
          timestamp: '3d ago',
          fileSize: '1.6 MB',
          likesCount: 14,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-vid-1',
          messageId: 'msg-11',
          type: 'video',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnailUrl:
            'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&auto=format&fit=crop&q=80',
          title: 'Highlight reel from sunset terrace',
          senderId: 'other',
          senderName: contactName,
          senderAvatar: contactAvatar,
          timestamp: '1:45 PM',
          duration: '0:48',
          fileSize: '8.4 MB',
          likesCount: 15,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-vid-2',
          messageId: 'msg-def-vid-2',
          type: 'video',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          thumbnailUrl:
            'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80',
          title: 'App Demo & Screen Walkthrough',
          senderId: 'me',
          senderName: 'You',
          senderAvatar: '',
          timestamp: '2d ago',
          duration: '01:24',
          fileSize: '14.2 MB',
          likesCount: 6,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-doc-1',
          messageId: 'msg-12',
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          title: 'Project_Freedom_Brief.pdf',
          documentType: 'PDF Document',
          documentLink:
            documentLinksMap['msg-12'] ||
            'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          senderId: 'other',
          senderName: contactName,
          senderAvatar: contactAvatar,
          timestamp: '1:46 PM',
          fileSize: '2.4 MB',
          likesCount: 5,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-doc-2',
          messageId: 'msg-def-doc-2',
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          title: 'Mother_Language_Specs_v2.pdf',
          documentType: 'PDF Document',
          documentLink:
            documentLinksMap['msg-def-doc-2'] ||
            'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          senderId: 'me',
          senderName: 'You',
          senderAvatar: '',
          timestamp: '4d ago',
          fileSize: '1.1 MB',
          likesCount: 3,
          isLiked: false,
          isFavorite: false,
        },
        {
          id: 'def-link-1',
          messageId: 'msg-def-link-1',
          type: 'link',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          title: 'Project Freedom Specification Document Link',
          senderId: 'me',
          senderName: 'You',
          senderAvatar: '',
          timestamp: '18:03',
          likesCount: 6,
          isLiked: false,
          isFavorite: false,
        }
      );
    }

    // Apply deleted filter, admin-removed forbidden filter, custom titles, favourite overrides, and like overrides
    const seenMessageIds = new Set<string>();
    return list
      .filter((item) => {
        if (
          deletedIds.includes(item.messageId) ||
          deletedIds.includes(item.id) ||
          removedForbiddenIds.includes(item.messageId) ||
          removedForbiddenIds.includes(item.id)
        ) {
          return false;
        }
        const uniqueKey = `${item.type}-${item.messageId}`;
        if (seenMessageIds.has(uniqueKey)) return false;
        seenMessageIds.add(uniqueKey);
        return true;
      })
      .map((item) => {
        let cachedItem: any = null;
        try {
          const raw = localStorage.getItem(`freedom_media_${item.messageId}`);
          if (raw) cachedItem = JSON.parse(raw);
        } catch {}

        const resolvedTitle =
          customTitles[item.messageId] ||
          customTitles[item.id] ||
          cachedItem?.customTitle ||
          item.title;

        const resolvedFav =
          favoriteMap[item.messageId] !== undefined
            ? favoriteMap[item.messageId]
            : cachedItem?.isFavorite !== undefined
            ? cachedItem.isFavorite
            : item.isFavorite;

        const resolvedLiked =
          likeMap[item.messageId]?.isLiked !== undefined
            ? likeMap[item.messageId].isLiked
            : cachedItem?.isLiked !== undefined
            ? cachedItem.isLiked
            : item.isLiked;

        const resolvedLikesCount =
          likeMap[item.messageId]?.likesCount !== undefined
            ? likeMap[item.messageId].likesCount
            : cachedItem?.likesCount !== undefined
            ? cachedItem.likesCount
            : item.likesCount;

        const editedOverride = editedMediaMap[item.messageId] || editedMediaMap[item.id];

        return {
          ...item,
          url: editedOverride?.url || item.url,
          thumbnailUrl: editedOverride?.thumbnailUrl || item.thumbnailUrl,
          title: editedOverride?.title || resolvedTitle,
          documentLink:
            documentLinksMap[item.messageId] || item.documentLink || item.url,
          isFavorite: resolvedFav,
          isLiked: resolvedLiked,
          likesCount: resolvedLikesCount,
        };
      });
  }, [
    messages,
    contact,
    deletedIds,
    customTitles,
    favoriteMap,
    likeMap,
    likedGalleryItems,
    editedMediaMap,
    documentLinksMap,
    customGalleryLinks,
    removedForbiddenIds,
  ]);

  // Counts by tab type
  const counts = useMemo(() => {
    return {
      all: allItems.length,
      images: allItems.filter((i) => i.type === 'image').length,
      videos: allItems.filter((i) => i.type === 'video').length,
      documents: allItems.filter((i) => i.type === 'document').length,
      links: allItems.filter((i) => i.type === 'link' || (i.type === 'document' && i.documentLink)).length,
    };
  }, [allItems]);

  // Filtered items based on active tab and search
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (activeTab === 'images' && item.type !== 'image') return false;
      if (activeTab === 'videos' && item.type !== 'video') return false;
      if (activeTab === 'documents' && item.type !== 'document') return false;
      if (activeTab === 'links' && item.type !== 'link' && !(item.type === 'document' && item.documentLink)) {
        return false;
      }

      if (senderFilter !== 'all' && item.senderId !== senderFilter) return false;

      // If user enabled "Hide Adult / Nudity Media" and mode is 'hide' (completely hide from gallery)
      const isItemAdult =
        adultNudityIds.includes(item.messageId) || adultNudityIds.includes(item.id);
      if (hideAdultNudity && hideAdultMode === 'hide' && isItemAdult) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.title.toLowerCase().includes(q) ||
          item.senderName.toLowerCase().includes(q) ||
          item.timestamp.toLowerCase().includes(q) ||
          (item.url && item.url.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [allItems, activeTab, senderFilter, searchQuery, adultNudityIds, hideAdultNudity, hideAdultMode]);

  const hiddenAdultCount = useMemo(() => {
    return allItems.filter(
      (i) => adultNudityIds.includes(i.messageId) || adultNudityIds.includes(i.id)
    ).length;
  }, [allItems, adultNudityIds]);

  // Toggle Favourite on Thumbnail (Displays Red when clicked!)
  const handleToggleFavoriteCard = (item: UnifiedGalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextFav = !item.isFavorite;

    setFavoriteMap((prev) => {
      const updated = { ...prev, [item.messageId]: nextFav };
      try {
        localStorage.setItem('freedom_favorite_media_map', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const existing = JSON.parse(
        localStorage.getItem(`freedom_media_${item.messageId}`) || '{}'
      );
      localStorage.setItem(
        `freedom_media_${item.messageId}`,
        JSON.stringify({ ...existing, id: item.messageId, isFavorite: nextFav })
      );
    } catch {}

    if (nextFav) {
      setRecentRedPulseMap((prev) => ({ ...prev, [item.messageId]: true }));
      setTimeout(() => {
        setRecentRedPulseMap((prev) => ({ ...prev, [item.messageId]: false }));
      }, 1500);

      if (item.type === 'image' || item.type === 'video') {
        const updatedLiked = addMediaToLikedUserGallery({
          id: item.messageId,
          messageId: item.messageId,
          type: item.type === 'video' ? 'video' : 'image',
          url: item.url,
          thumbnailUrl: item.thumbnailUrl || item.url,
          title: item.title,
          senderName: item.senderName,
          timestamp: item.timestamp,
          likesCount: 120000,
          likesDisplay: '120K',
        }, effectiveUserId);
        setLikedGalleryItems(updatedLiked);
        setGalleryToast(
          `❤️ Liked "${item.title}" & added to your 3×3 User Gallery (🤍 120K)!`
        );
        setTimeout(() => setGalleryToast(null), 3200);
      }
    }

    if (onToggleFavoriteMedia) {
      onToggleFavoriteMedia(item.messageId, nextFav);
    }
  };

  // Start inline editing title & hidden SEO media tags on card
  const handleStartEditTitle = (item: UnifiedGalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.messageId);
    setEditingTitleValue(item.title);
    const existingTags = getMediaSeoTags(item.messageId);
    setEditingSeoTagsValue(formatSeoTagsForInput(existingTags));
  };

  const handleAutoSuggestCardSeoTags = (item: UnifiedGalleryItem) => {
    const baseWords = (editingTitleValue || item.title || 'media')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const typeTag =
      item.type === 'video'
        ? 'hd video'
        : item.type === 'document'
        ? 'document pdf'
        : 'photo image';
    const combined = Array.from(
      new Set([...baseWords, typeTag, 'freedom messaging', 'seo media'])
    ).slice(0, 8);
    setEditingSeoTagsValue(combined.join(', '));
  };

  // Save edited title & submit hidden SEO media tags to search engines
  const handleSaveTitleForId = async (
    messageId: string,
    newTitle: string,
    seoTagsRaw?: string,
    item?: UnifiedGalleryItem
  ) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setIsSubmittingGallerySeo(true);
    const tagsToSave = seoTagsRaw !== undefined ? seoTagsRaw : editingSeoTagsValue;
    const parsedSeoTags = parseSeoTagsInput(tagsToSave);

    setCustomTitles((prev) => {
      const updated = { ...prev, [messageId]: trimmed };
      try {
        localStorage.setItem('freedom_custom_media_titles', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const existing = JSON.parse(localStorage.getItem(`freedom_media_${messageId}`) || '{}');
      localStorage.setItem(
        `freedom_media_${messageId}`,
        JSON.stringify({
          ...existing,
          id: messageId,
          customTitle: trimmed,
          seoTags: parsedSeoTags,
          submittedToSearchEngines: true,
        })
      );
    } catch {}

    if (onEditMessageMediaTitle) {
      onEditMessageMediaTitle(messageId, trimmed);
    }

    const seoResult = await saveAndSubmitMediaSeoToSearchEngines({
      mediaId: messageId,
      title: trimmed,
      seoTagsInput: tagsToSave,
      mediaType: item?.type === 'link' ? 'document' : item?.type || 'image',
      mediaUrl: item?.url,
    });

    setIsSubmittingGallerySeo(false);
    setEditingItemId(null);
    setGalleryToast(
      seoResult.message ||
        `Saved "${trimmed}" & submitted hidden SEO tags to Search Engines!`
    );
    setTimeout(() => setGalleryToast(null), 3200);
  };

  // Delete media item
  const handleDeleteMediaById = (messageId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletedIds((prev) => {
      const updated = prev.includes(messageId) ? prev : [...prev, messageId];
      try {
        localStorage.setItem('freedom_deleted_media_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    const updatedLiked = removeMediaFromLikedUserGallery(messageId, effectiveUserId);
    setLikedGalleryItems(updatedLiked);
    if (onDeleteMessageMedia) {
      onDeleteMessageMedia(messageId);
    }
  };

  // Click thumbnail to open Media View (Zoom pictures, Play videos, Like & Share, Edit & Delete)
  const handleClickThumbnail = (item: UnifiedGalleryItem) => {
    const activeMedia: ActiveMediaItem = {
      id: item.messageId,
      type: item.type === 'video' ? 'video' : item.type === 'document' ? 'document' : 'image',
      title: item.title,
      mediaUrl: item.url,
      thumbnailUrl: item.thumbnailUrl,
      senderName: item.senderName,
      timestamp: item.timestamp,
      duration: item.duration,
      likesCount: item.likesCount,
      isLiked: item.isLiked,
      isFavorite: item.isFavorite,
    };

    if (onSelectMedia) {
      onSelectMedia(activeMedia);
    } else {
      setViewerMediaItem(activeMedia);
    }
  };

  return (
    <div className="space-y-4">
      {/* Group Gallery Header Notice when in Group Mode */}
      {isGroupMode && (
        <div
          id="group-gallery-restriction-banner"
          className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
            isDark
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              style={{ backgroundColor: primaryColor }}
              className="w-7 h-7 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs"
            >
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-xs leading-tight">
                Group Gallery • Media Shared in Group Messages
              </p>
              <p className="text-[10px] opacity-85 truncate">
                Click any media to view or share exclusively with other members of{' '}
                <strong>{contact?.name || 'this group'}</strong> ({otherGroupMembers.length} members).
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
            <Shield className="w-3 h-3" />
            <span>Group Members Only</span>
          </span>
        </div>
      )}

      {galleryToast && (
        <div
          id="group-gallery-share-toast"
          className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{galleryToast}</span>
        </div>
      )}

      {/* Tab Switcher: 'Images', 'Videos', 'Documents' */}
      <div
        className={`p-1.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <div className="grid grid-cols-3 sm:flex items-center gap-1">
          {/* Images Tab */}
          <button
            id="gallery-tab-images-btn"
            type="button"
            onClick={() => setActiveTab('images')}
            style={activeTab === 'images' ? { backgroundColor: primaryColor } : undefined}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'images'
                ? 'text-white shadow-sm font-extrabold'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Images</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'images'
                  ? 'bg-black/25 text-white'
                  : isDark
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.images}
            </span>
          </button>

          {/* Videos Tab */}
          <button
            id="gallery-tab-videos-btn"
            type="button"
            onClick={() => setActiveTab('videos')}
            style={activeTab === 'videos' ? { backgroundColor: primaryColor } : undefined}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'videos'
                ? 'text-white shadow-sm font-extrabold'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Videos</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'videos'
                  ? 'bg-black/25 text-white'
                  : isDark
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.videos}
            </span>
          </button>

          {/* Documents Tab */}
          <button
            id="gallery-tab-documents-btn"
            type="button"
            onClick={() => setActiveTab('documents')}
            style={activeTab === 'documents' ? { backgroundColor: primaryColor } : undefined}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'documents'
                ? 'text-white shadow-sm font-extrabold'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Documents</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'documents'
                  ? 'bg-black/25 text-white'
                  : isDark
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.documents}
            </span>
          </button>

          {/* Links Tab (Right next to Documents Tab) */}
          <button
            id="gallery-tab-links-btn"
            type="button"
            onClick={() => setActiveTab('links')}
            style={activeTab === 'links' ? { backgroundColor: primaryColor } : undefined}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'links'
                ? 'text-white shadow-sm font-extrabold'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span>Links</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'links'
                  ? 'bg-black/25 text-white'
                  : isDark
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.links}
            </span>
          </button>
        </div>

        {/* Right Controls: Upload Media (Auto Thumbnail), Photo Editor, Video Editor & Search Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            ref={galleryUploadFileRef}
            id="gallery-upload-media-auto-thumb-input"
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const isVideoFile = file.type.startsWith('video/');
              setIsAutoGeneratingGalleryThumb(true);
              try {
                const newId = `uploaded-gallery-${Date.now()}`;
                if (isVideoFile) {
                  const vidRes = await generateVideoFileThumbnail(file);
                  const updatedLiked = addMediaToLikedUserGallery({
                    id: newId,
                    messageId: newId,
                    type: 'video',
                    url: vidRes.videoUrl,
                    thumbnailUrl: vidRes.thumbnailUrl,
                    title: vidRes.title || 'Uploaded Video',
                    senderName: 'You',
                  }, effectiveUserId);
                  setLikedGalleryItems(updatedLiked);
                  saveUserMediaSession(updatedLiked, undefined, undefined, effectiveUserId);
                  setActiveTab('videos');
                  setGalleryToast(
                    `🎬 Video "${vidRes.title}" uploaded, thumbnail generated & session saved!`
                  );
                } else {
                  const imgRes = await generateProfileThumbnailFile(file, 360, 360, 960);
                  const cleanTitle = file.name.replace(/\.[^/.]+$/, '') || 'Uploaded Photo';
                  const updatedLiked = addMediaToLikedUserGallery({
                    id: newId,
                    messageId: newId,
                    type: 'image',
                    url: imgRes.dataUrl,
                    thumbnailUrl: imgRes.thumbnailDataUrl,
                    title: cleanTitle,
                    senderName: 'You',
                  }, effectiveUserId);
                  setLikedGalleryItems(updatedLiked);
                  saveUserMediaSession(updatedLiked, undefined, undefined, effectiveUserId);
                  setActiveTab('images');
                  setGalleryToast(
                    `📸 Photo "${cleanTitle}" uploaded, thumbnail generated & session saved!`
                  );
                }
                setTimeout(() => setGalleryToast(null), 3500);
              } finally {
                setIsAutoGeneratingGalleryThumb(false);
              }
              e.target.value = '';
            }}
          />
          {/* Upload Camera Icon in User Media Gallery */}
          <button
            id="gallery-camera-upload-icon-btn"
            type="button"
            disabled={isAutoGeneratingGalleryThumb}
            onClick={() => galleryUploadFileRef.current?.click()}
            style={{ backgroundColor: primaryColor }}
            className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs hover:brightness-110 active:scale-95 cursor-pointer transition-all shrink-0"
            title="Upload Photo or Video from Camera / Device to User Media Gallery"
          >
            <Camera className="w-4 h-4 stroke-[2.3]" />
          </button>

          <button
            id="gallery-upload-media-auto-thumb-btn"
            type="button"
            disabled={isAutoGeneratingGalleryThumb}
            onClick={() => galleryUploadFileRef.current?.click()}
            style={{ backgroundColor: primaryColor }}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1 shadow-xs hover:brightness-110 cursor-pointer transition-all"
            title="Upload Photo or Video (Automatically generates thumbnail & saves media session)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isAutoGeneratingGalleryThumb ? 'Uploading...' : 'Upload Media'}</span>
          </button>

          {/* Save User Media Session Button */}
          <button
            id="gallery-save-media-session-btn"
            type="button"
            onClick={() => {
              const session = saveUserMediaSession(likedGalleryItems, undefined, undefined, effectiveUserId);
              setGalleryToast(
                `💾 User Media Session saved (${session.itemsCount || allItems.length} media files persisted)!`
              );
              setTimeout(() => setGalleryToast(null), 3200);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
              isDark
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-400'
                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 shadow-2xs'
            }`}
            title="Save User Media Gallery Session"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Session</span>
          </button>

          <button
            id="gallery-open-photo-editor-btn"
            type="button"
            onClick={() => {
              const firstImg = allItems.find((i) => i.type === 'image');
              setEditorState({
                isOpen: true,
                mediaType: 'image',
                mediaUrl:
                  firstImg?.url ||
                  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80',
                mediaTitle: firstImg?.title || 'Photo Creative',
                mediaId: firstImg?.messageId,
                thumbnailUrl: firstImg?.thumbnailUrl || firstImg?.url,
              });
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
            }`}
            title="Open Photo Editor (60+ Filters, Adjust, Stickers, Text Design & AI)"
          >
            <Sliders className="w-3.5 h-3.5 text-pink-500" />
            <span>Photo Editor</span>
          </button>

          <button
            id="gallery-open-video-editor-btn"
            type="button"
            onClick={() => {
              const firstVid = allItems.find((i) => i.type === 'video');
              setEditorState({
                isOpen: true,
                mediaType: 'video',
                mediaUrl:
                  firstVid?.url ||
                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                mediaTitle: firstVid?.title || 'Video Creative',
                mediaId: firstVid?.messageId,
                thumbnailUrl: firstVid?.thumbnailUrl,
              });
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
            }`}
            title="Open Video Editor (60+ Filters, Adjust, Stickers, Text Design & AI)"
          >
            <VideoIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Video Editor</span>
          </button>

          {/* Hide Adult / Nudity Media Toggle Button */}
          <div className="flex items-center gap-1">
            <button
              id="gallery-hide-adult-nudity-toggle"
              type="button"
              onClick={() => {
                const next = !hideAdultNudity;
                setHideAdultNudity(next);
                setHideAdultNuditySetting(next);
                setGalleryToast(
                  next
                    ? `🔞 Adult & Nudity Media Filter ON (${hideAdultMode === 'hide' ? 'Hidden' : 'Blurred'})`
                    : '👁️ Adult & Nudity Media Filter OFF (Showing all media)'
                );
                setTimeout(() => setGalleryToast(null), 2800);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                hideAdultNudity
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-2xs'
              }`}
              title="Toggle hiding adult media files with nudity"
            >
              {hideAdultNudity ? (
                <EyeOff className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {hideAdultNudity
                  ? `Hide Adult/Nudity: ON${hiddenAdultCount > 0 ? ` (${hiddenAdultCount})` : ''}`
                  : 'Hide Adult/Nudity: OFF'}
              </span>
            </button>

            {hideAdultNudity && (
              <button
                type="button"
                onClick={() => {
                  const nextMode = hideAdultMode === 'hide' ? 'blur' : 'hide';
                  setHideAdultMode(nextMode);
                  setHideAdultNudityMode(nextMode);
                  setGalleryToast(
                    nextMode === 'hide'
                      ? '🔞 Adult media files are now completely hidden from the gallery'
                      : '🔞 Adult media files are now blurred with an 18+ warning shield'
                  );
                  setTimeout(() => setGalleryToast(null), 2600);
                }}
                className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold border cursor-pointer transition-all ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
                title="Switch between Completely Hiding or Blurring adult media"
              >
                {hideAdultMode === 'hide' ? 'Mode: Hidden' : 'Mode: Blur 18+'}
              </button>
            )}
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="relative w-full sm:w-44">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className={`w-full pl-8 pr-7 py-1.5 rounded-xl text-xs border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500'
                    : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-purple-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Link Bar when on Links or Documents Tab */}
      {(activeTab === 'links' || activeTab === 'documents') && (
        <div
          className={`p-2.5 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
            isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 flex-1">
            <Link2 className="w-4 h-4 text-purple-500 shrink-0 ml-1" />
            <input
              type="text"
              value={newLinkTitle}
              onChange={(e) => setNewLinkTitle(e.target.value)}
              placeholder="Link or Document title..."
              className={`w-36 sm:w-44 px-2.5 py-1.5 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
            />
            <input
              type="url"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="https://example.com/document..."
              className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
          <button
            id="gallery-add-link-btn"
            type="button"
            onClick={() => {
              const rawUrl = newLinkUrl.trim();
              if (!rawUrl) return;
              const formattedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
              const nowTime = new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              const entry = {
                id: `custom-lnk-${Date.now()}`,
                url: formattedUrl,
                title: newLinkTitle.trim() || formattedUrl.replace(/^https?:\/\/(www\.)?/i, ''),
                timestamp: nowTime,
              };
              const updated = [entry, ...customGalleryLinks];
              setCustomGalleryLinks(updated);
              try {
                localStorage.setItem('freedom_custom_gallery_links_v1', JSON.stringify(updated));
              } catch {}
              setNewLinkUrl('');
              setNewLinkTitle('');
              setGalleryToast('🔗 Added link to User Profile Gallery!');
              setTimeout(() => setGalleryToast(null), 2400);
            }}
            style={{ backgroundColor: primaryColor }}
            className="px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer hover:brightness-110 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Link</span>
          </button>
        </div>
      )}

      {/* Grid Display */}
      {filteredItems.length === 0 ? (
        <div
          className={`py-12 rounded-2xl border text-center p-6 flex flex-col items-center justify-center ${
            isDark
              ? 'bg-slate-900/40 border-slate-800 text-slate-400'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          {activeTab === 'images' && (
            <ImageIcon style={{ color: primaryColor }} className="w-10 h-10 mb-2 opacity-60" />
          )}
          {activeTab === 'videos' && (
            <VideoIcon style={{ color: primaryColor }} className="w-10 h-10 mb-2 opacity-60" />
          )}
          {activeTab === 'documents' && (
            <FileText style={{ color: primaryColor }} className="w-10 h-10 mb-2 opacity-60" />
          )}
          <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            No {activeTab} found
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? `No ${activeTab} matched "${searchQuery}".`
              : `No ${activeTab} available in this gallery.`}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-3 sm:gap-4 ${
            compact
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}
        >
          {filteredItems.map((item) => {
            const isMe = item.senderId === 'me';
            const isImage = item.type === 'image';
            const isVideo = item.type === 'video';
            const isDocument = item.type === 'document';
            const isEditingThis = editingItemId === item.messageId;
            const isFav = !!item.isFavorite;
            const isPulsingRed = !!recentRedPulseMap[item.messageId];
            const isAdultMedia =
              adultNudityIds.includes(item.messageId) || adultNudityIds.includes(item.id);
            const isBlurredAdult =
              isAdultMedia &&
              hideAdultNudity &&
              hideAdultMode === 'blur' &&
              !temporarilyUnblurredIds.includes(item.messageId);
            const isReportedMedia = reportedMediaList.some(
              (r) =>
                (r.mediaId === item.messageId || r.mediaId === item.id) &&
                r.status !== 'dismissed'
            );

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isBlurredAdult) return;
                  handleClickThumbnail(item);
                }}
                className={`group rounded-2xl border overflow-hidden flex flex-col justify-between transition-all cursor-pointer hover:shadow-md relative ${
                  isDark
                    ? 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/60 hover:border-purple-500/50'
                    : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-purple-500/50 shadow-xs'
                }`}
              >
                {/* Visual Thumbnail Area */}
                <div className="relative aspect-square w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                  {/* Image View */}
                  {isImage && (
                    <img
                      src={item.url}
                      alt={item.title}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        isBlurredAdult
                          ? 'blur-2xl scale-125 brightness-50'
                          : 'group-hover:scale-105'
                      }`}
                    />
                  )}

                  {/* Video View */}
                  {isVideo && (
                    <div className="w-full h-full relative">
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.title}
                        className={`w-full h-full object-cover opacity-85 transition-all duration-300 ${
                          isBlurredAdult
                            ? 'blur-2xl scale-125 brightness-50'
                            : 'group-hover:scale-105'
                        }`}
                      />
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                        <div
                          style={{ backgroundColor: primaryColor }}
                          className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                        >
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                      {item.duration && (
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-mono font-bold text-white">
                          {item.duration}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Adult / Nudity Blurred Shield Overlay */}
                  {isBlurredAdult && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-3 text-center space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                        <EyeOff className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold text-white block">
                          18+ Adult / Nudity Hidden
                        </span>
                        <span className="text-[9.5px] text-slate-300 block">
                          Sensitive media filtered by your settings
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemporarilyUnblurredIds((prev) => [...prev, item.messageId]);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Reveal Once
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHideAdultMode('hide');
                            setHideAdultNudityMode('hide');
                            setGalleryToast('🔞 Adult media file completely hidden from gallery');
                            setTimeout(() => setGalleryToast(null), 2400);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Hide Completely
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reported Status Badge (Admin Only) */}
                  {isAdminVerified && isReportedMedia && (
                    <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full bg-amber-500/90 text-slate-950 text-[9px] font-extrabold flex items-center gap-1 shadow-sm">
                      <Flag className="w-2.5 h-2.5 fill-slate-950" />
                      <span>Reported to Admin</span>
                    </div>
                  )}

                  {/* Document View */}
                  {isDocument && (
                    <div className="w-full h-full p-4 bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center text-center">
                      <div
                        style={{
                          backgroundColor: `${primaryColor}25`,
                          borderColor: `${primaryColor}45`,
                          color: primaryColor,
                        }}
                        className="w-12 h-12 rounded-2xl border flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform"
                      >
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-white truncate max-w-full px-2">
                        {item.title}
                      </span>
                      <span
                        style={{ color: primaryColor }}
                        className="text-[10px] font-mono mt-1 font-semibold"
                      >
                        {item.fileSize}
                      </span>
                      {item.documentLink && (
                        <a
                          href={item.documentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-bold text-emerald-300 flex items-center gap-1 max-w-full truncate"
                          title="Open attached document link"
                        >
                          <Link2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">Open Document Link</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Link View (When in Links Tab) */}
                  {item.type === 'link' && (
                    <div className="w-full h-full p-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center text-center">
                      <div
                        style={{
                          backgroundColor: `${primaryColor}25`,
                          borderColor: `${primaryColor}45`,
                          color: primaryColor,
                        }}
                        className="w-12 h-12 rounded-2xl border flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform"
                      >
                        <Link2 className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-white truncate max-w-full px-2">
                        {item.title}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-bold text-sky-300 flex items-center gap-1 max-w-full truncate"
                      >
                        <span className="truncate">
                          {item.url.replace(/^https?:\/\/(www\.)?/i, '')}
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}

                  {/* Top-Left: Sender Pill Badge matching screenshot ("Kristin", "You") */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <span
                      style={isMe ? { backgroundColor: primaryColor } : undefined}
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-sm ${
                        isMe ? 'text-white' : 'bg-black/65 text-white'
                      }`}
                    >
                      {isMe ? 'You' : item.senderName.split(' ')[0]}
                    </span>
                  </div>

                  {/* Top-Right: Circular White Favourite Heart Button matching screenshot */}
                  <button
                    type="button"
                    id={`gallery-fav-btn-${item.messageId}`}
                    onClick={(e) => handleToggleFavoriteCard(item, e)}
                    title={isFav ? 'Favourited' : 'Click to Favourite'}
                    className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-90 ${
                      isPulsingRed ? 'ring-4 ring-red-500/40 scale-110' : ''
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-all duration-200 ${
                        isFav
                          ? 'fill-red-500 text-red-500 scale-110'
                          : 'text-slate-400 hover:text-red-400'
                      }`}
                    />
                  </button>
                </div>

                {/* Info Footer with Title, Inline Edit Title, and Delete */}
                <div
                  className={`p-2.5 ${isDark ? 'bg-[#151922]' : 'bg-white'}`}
                  onClick={(e) => {
                    if (isEditingThis) e.stopPropagation();
                  }}
                >
                  {isEditingThis ? (
                    <div
                      className="space-y-2 p-2 rounded-xl border border-purple-500/40 bg-slate-900/90 text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          id={`gallery-edit-title-input-${item.messageId}`}
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveTitleForId(
                                item.messageId,
                                editingTitleValue,
                                editingSeoTagsValue,
                                item
                              );
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null);
                            }
                          }}
                          autoFocus
                          placeholder="Media title..."
                          className="w-full px-2 py-1 rounded-lg text-xs font-semibold border border-purple-500 bg-slate-950 text-white outline-none"
                        />
                        <button
                          id={`gallery-save-title-seo-btn-${item.messageId}`}
                          type="button"
                          disabled={isSubmittingGallerySeo}
                          onClick={() =>
                            handleSaveTitleForId(
                              item.messageId,
                              editingTitleValue,
                              editingSeoTagsValue,
                              item
                            )
                          }
                          style={{ backgroundColor: primaryColor }}
                          className="px-2 py-1 rounded-md text-white text-[10px] font-bold hover:brightness-110 cursor-pointer shrink-0 flex items-center gap-1"
                          title="Save Title & Submit Hidden SEO Tags to Search Engines"
                        >
                          <Check className="w-3 h-3" />
                          <span>{isSubmittingGallerySeo ? '...' : 'Save & SEO'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="p-1 rounded-md bg-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Hidden SEO Media Tags Input (Only visible while editing media title; never publicly displayed on media files) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            <span>SEO Media Tags (Hidden • Fetch Index)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAutoSuggestCardSeoTags(item)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold flex items-center gap-0.5 cursor-pointer"
                            title="Auto-suggest SEO tags"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            <span>+ Auto</span>
                          </button>
                        </div>
                        <input
                          id={`gallery-seo-tags-input-${item.messageId}`}
                          type="text"
                          value={editingSeoTagsValue}
                          onChange={(e) => setEditingSeoTagsValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveTitleForId(
                                item.messageId,
                                editingTitleValue,
                                editingSeoTagsValue,
                                item
                              );
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null);
                            }
                          }}
                          placeholder="SEO tags (comma separated, not public)..."
                          className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-emerald-500/40 focus:border-emerald-400 text-[10px] text-emerald-200 placeholder-slate-500 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs font-bold truncate flex-1 ${
                          isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}
                        title={item.title}
                      >
                        {item.title}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isGroupMode && (
                          <button
                            type="button"
                            id={`group-gallery-share-btn-${item.messageId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSharingGroupItem(item);
                              setSelectedShareMemberIds(otherGroupMembers.map((m) => m.id));
                              setShareGroupNote('');
                            }}
                            style={{ color: primaryColor }}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 hover:bg-purple-500/20 flex items-center gap-1 transition-colors cursor-pointer mr-0.5"
                            title="Share to other group members only"
                          >
                            <Share2 className="w-2.5 h-2.5" />
                            <span>Share</span>
                          </button>
                        )}
                        {(isImage || isVideo) && (
                          <>
                            <button
                              type="button"
                              id={`gallery-toggle-adult-btn-${item.messageId}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextAdult = !isAdultMedia;
                                const updatedIds = markMediaAsAdultNudity(
                                  item.messageId,
                                  nextAdult
                                );
                                setAdultNudityIds(updatedIds);
                                if (nextAdult && !hideAdultNudity) {
                                  setHideAdultNudity(true);
                                  setHideAdultNuditySetting(true);
                                }
                                setGalleryToast(
                                  nextAdult
                                    ? `🔞 Marked "${item.title}" as Adult / Nudity & hidden from safe view`
                                    : `👁️ Unmarked "${item.title}" as Adult / Nudity`
                                );
                                setTimeout(() => setGalleryToast(null), 2800);
                              }}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                isAdultMedia
                                  ? 'text-rose-500 bg-rose-500/15'
                                  : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
                              }`}
                              title={
                                isAdultMedia
                                  ? 'Marked as 18+ Adult / Nudity (Click to unmark)'
                                  : 'Hide / Mark as Adult Media with Nudity (18+)'
                              }
                            >
                              <EyeOff className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              id={`gallery-report-media-btn-${item.messageId}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportingMediaItem(item);
                                setSelectedReportCategory('forbidden_platform_content');
                                setReportReasonInput('');
                                setReportAlsoMarkAdult(isAdultMedia);
                              }}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                isReportedMedia
                                  ? 'text-amber-500 bg-amber-500/15'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
                              }`}
                              title="Report Photo / Video to Admin (Forbidden Content or Adult Nudity)"
                            >
                              <Flag className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              id={`gallery-studio-edit-btn-${item.messageId}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditorState({
                                  isOpen: true,
                                  mediaType: isVideo ? 'video' : 'image',
                                  mediaUrl: item.url,
                                  mediaTitle: item.title,
                                  mediaId: item.messageId,
                                  thumbnailUrl: item.thumbnailUrl || item.url,
                                });
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-pink-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={
                                isVideo
                                  ? 'Open in Video Editor (60+ Filters, Adjust, Stickers & Text Design)'
                                  : 'Open in Photo Editor (60+ Filters, Adjust, Stickers & Text Design)'
                              }
                            >
                              <Sliders className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {isDocument && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDocLinkId(
                                editingDocLinkId === item.messageId ? null : item.messageId
                              );
                              setDocLinkInputValue(item.documentLink || item.url || '');
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Add or edit link for this document"
                          >
                            <Link2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleStartEditTitle(item, e)}
                          className="p-1 rounded-md text-slate-400 hover:text-purple-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit media title"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMediaById(item.messageId, e)}
                          className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete media file"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Document Link Attachment Editor ("add links to documents link") */}
                  {isDocument && editingDocLinkId === item.messageId && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 flex items-center gap-1"
                    >
                      <input
                        type="url"
                        value={docLinkInputValue}
                        onChange={(e) => setDocLinkInputValue(e.target.value)}
                        placeholder="https://document-link..."
                        className={`flex-1 px-2 py-1 rounded-lg text-[10px] border outline-none ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const raw = docLinkInputValue.trim();
                          if (!raw) return;
                          const formatted = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                          setDocumentLinksMap((prev) => {
                            const updated = { ...prev, [item.messageId]: formatted };
                            try {
                              localStorage.setItem(
                                'freedom_gallery_document_links_v1',
                                JSON.stringify(updated)
                              );
                            } catch {}
                            return updated;
                          });
                          setEditingDocLinkId(null);
                          setGalleryToast('🔗 Saved link to document!');
                          setTimeout(() => setGalleryToast(null), 2200);
                        }}
                        style={{ backgroundColor: primaryColor }}
                        className="px-2 py-1 rounded-lg text-white text-[10px] font-bold cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{item.timestamp}</span>
                    </span>

                    {onJumpToMessage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToMessage(item.messageId);
                        }}
                        style={{ color: primaryColor }}
                        className="font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                        title="Jump to message in chat"
                      >
                        <span>Chat</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Quick Media Actions Bar: Share in Message, Set as Avatar, Set as Profile Cover */}
                  {(isImage || isVideo) && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-1 flex-wrap"
                    >
                      <button
                        id={`gallery-share-in-message-btn-${item.messageId}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const activeMedia: ActiveMediaItem = {
                            id: item.messageId,
                            type: isVideo ? 'video' : 'image',
                            title: item.title,
                            mediaUrl: item.url,
                            thumbnailUrl: item.thumbnailUrl || item.url,
                            senderName: item.senderName,
                            timestamp: item.timestamp,
                            duration: item.duration,
                          };
                          if (onShareMediaInMessage) {
                            onShareMediaInMessage(activeMedia);
                          }
                          window.dispatchEvent(
                            new CustomEvent('freedom-share-gallery-media-in-message', {
                              detail: activeMedia,
                            })
                          );
                          setGalleryToast(`📤 Shared "${item.title}" in message!`);
                          setTimeout(() => setGalleryToast(null), 3000);
                        }}
                        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                        className="px-2 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-1 cursor-pointer hover:brightness-110 transition-all"
                        title="Share this media item in message"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Share in Msg</span>
                      </button>

                      {isImage && (
                        <div className="flex items-center gap-1">
                          <button
                            id={`gallery-set-as-avatar-btn-${item.messageId}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMediaGalleryPictureAsAvatar(
                                item.url,
                                currentUserId || 'user_abdullah',
                                item.title
                              );
                              saveUserMediaSession(likedGalleryItems, item.url, undefined);
                              setGalleryToast(
                                `👤 Set "${item.title}" as your Profile Avatar & saved session!`
                              );
                              setTimeout(() => setGalleryToast(null), 3000);
                            }}
                            className={`px-1.5 py-1 rounded-lg text-[9.5px] font-bold flex items-center gap-0.5 border cursor-pointer transition-all ${
                              isDark
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                            }`}
                            title="Set this media gallery picture as your Avatar"
                          >
                            <UserCheck className="w-2.5 h-2.5" />
                            <span>Avatar</span>
                          </button>

                          <button
                            id={`gallery-set-as-cover-btn-${item.messageId}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMediaGalleryPictureAsProfileCover(
                                item.url,
                                currentUserId || 'user_abdullah',
                                contact?.id
                              );
                              saveUserMediaSession(likedGalleryItems, undefined, item.url);
                              setGalleryToast(
                                `🖼️ Set "${item.title}" as your Profile Cover & saved session!`
                              );
                              setTimeout(() => setGalleryToast(null), 3000);
                            }}
                            className={`px-1.5 py-1 rounded-lg text-[9.5px] font-bold flex items-center gap-0.5 border cursor-pointer transition-all ${
                              isDark
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-purple-300'
                                : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700'
                            }`}
                            title="Set this media gallery picture as your Profile Cover"
                          >
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>Cover</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Media to Other Group Members Only Modal */}
      {sharingGroupItem && (
        <div
          id="group-gallery-share-modal-backdrop"
          onClick={() => setSharingGroupItem(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="group-gallery-share-modal"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border space-y-3.5 animate-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#181D27] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                >
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold">Share to Group Members Only</h4>
                  <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    <span>Restricted to {contact?.name || 'Group'} members</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSharingGroupItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Media Preview */}
            <div
              className={`p-2.5 rounded-2xl border flex items-center gap-3 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {sharingGroupItem.type === 'image' || sharingGroupItem.type === 'video' ? (
                <img
                  src={sharingGroupItem.thumbnailUrl || sharingGroupItem.url}
                  alt={sharingGroupItem.title}
                  className="w-11 h-11 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                >
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{sharingGroupItem.title}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  Shared by {sharingGroupItem.senderName} • {sharingGroupItem.timestamp}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] px-1">
              <span className="text-slate-400 font-semibold">
                Select Group Members ({selectedShareMemberIds.length}/{otherGroupMembers.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedShareMemberIds.length === otherGroupMembers.length) {
                    setSelectedShareMemberIds([]);
                  } else {
                    setSelectedShareMemberIds(otherGroupMembers.map((m) => m.id));
                  }
                }}
                style={{ color: primaryColor }}
                className="font-bold hover:underline cursor-pointer"
              >
                {selectedShareMemberIds.length === otherGroupMembers.length
                  ? 'Deselect All'
                  : 'Select All Members'}
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {otherGroupMembers.map((member) => {
                const isSelected = selectedShareMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSelectedShareMemberIds((prev) =>
                        prev.includes(member.id)
                          ? prev.filter((id) => id !== member.id)
                          : [...prev, member.id]
                      );
                    }}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60'
                        : isDark
                        ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/70'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{member.name}</p>
                        <p className="text-[10px] text-slate-400">
                          Group Member • {member.nativeLanguage || 'English'}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <input
              type="text"
              value={shareGroupNote}
              onChange={(e) => setShareGroupNote(e.target.value)}
              placeholder="Add a message for group members (optional)..."
              className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSharingGroupItem(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-gallery-share-group-btn"
                disabled={selectedShareMemberIds.length === 0}
                onClick={() => {
                  const chosen = otherGroupMembers.filter((m) =>
                    selectedShareMemberIds.includes(m.id)
                  );
                  const names = chosen.map((m) => m.name.split(' ')[0]).join(', ');
                  const activeMedia: ActiveMediaItem = {
                    id: sharingGroupItem.messageId,
                    type:
                      sharingGroupItem.type === 'video'
                        ? 'video'
                        : sharingGroupItem.type === 'document'
                        ? 'document'
                        : 'image',
                    title: sharingGroupItem.title,
                    mediaUrl: sharingGroupItem.url,
                    thumbnailUrl: sharingGroupItem.thumbnailUrl,
                    senderName: sharingGroupItem.senderName,
                    timestamp: sharingGroupItem.timestamp,
                  };
                  if (onShareWithGroupMembers) {
                    onShareWithGroupMembers(
                      activeMedia,
                      selectedShareMemberIds,
                      shareGroupNote.trim() || undefined
                    );
                  }
                  setGalleryToast(
                    `Shared "${sharingGroupItem.title}" with group members: ${names}!`
                  );
                  setTimeout(() => setGalleryToast(null), 3500);
                  setSharingGroupItem(null);
                }}
                style={
                  selectedShareMemberIds.length > 0 ? { backgroundColor: primaryColor } : undefined
                }
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedShareMemberIds.length > 0
                    ? 'text-white shadow-md hover:brightness-110 active:scale-95 cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Share ({selectedShareMemberIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* REPORT GALLERY MEDIA FILE MODAL (PHOTOS & VIDEOS -> ADMIN PANEL)   */}
      {/* ================================================================== */}
      {reportingMediaItem && (
        <div
          id="report-media-file-modal-backdrop"
          onClick={() => setReportingMediaItem(null)}
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="report-media-file-modal"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-3xl p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#181D27] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold">
                    Report {reportingMediaItem.type === 'video' ? 'Video' : 'Photo'} to Admin
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Flag forbidden platform content or adult/nudity media
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportingMediaItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Media Preview Row */}
            <div
              className={`p-2.5 rounded-2xl border flex items-center gap-3 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <img
                src={reportingMediaItem.thumbnailUrl || reportingMediaItem.url}
                alt={reportingMediaItem.title}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
                  {reportingMediaItem.type === 'video' ? 'Gallery Video' : 'Gallery Photo'}
                </span>
                <p className="text-xs font-bold truncate mt-1">{reportingMediaItem.title}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  Uploaded by {reportingMediaItem.senderName} • {reportingMediaItem.timestamp}
                </p>
              </div>
            </div>

            {/* Violation Category Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Select Platform Violation Category
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {MEDIA_REPORT_CATEGORIES.map((cat) => {
                  const isSelected = selectedReportCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedReportCategory(cat.id);
                        if (cat.id === 'adult_nudity') {
                          setReportAlsoMarkAdult(true);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                          : isDark
                          ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-extrabold block">{cat.label}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {cat.description}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-slate-950'
                            : 'border-slate-500'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Option to also Hide as Adult / Nudity Immediately */}
            <label className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reportAlsoMarkAdult || selectedReportCategory === 'adult_nudity'}
                onChange={(e) => setReportAlsoMarkAdult(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-extrabold text-rose-400 block">
                  🔞 Hide as Adult / Nudity Media Immediately
                </span>
                <span className="text-[10px] text-slate-400">
                  Hides or blurs this file in your gallery under your Adult / Nudity filter
                </span>
              </div>
            </label>

            {/* Additional Report Notes */}
            <input
              type="text"
              value={reportReasonInput}
              onChange={(e) => setReportReasonInput(e.target.value)}
              placeholder="Add additional details for Admin review (optional)..."
              className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />

            {/* Submit Report Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReportingMediaItem(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                id="confirm-submit-media-report-btn"
                type="button"
                onClick={() => {
                  reportGalleryMediaFile({
                    mediaId: reportingMediaItem.messageId,
                    mediaType: reportingMediaItem.type === 'video' ? 'video' : 'image',
                    mediaUrl: reportingMediaItem.url,
                    thumbnailUrl: reportingMediaItem.thumbnailUrl || reportingMediaItem.url,
                    mediaTitle: reportingMediaItem.title,
                    uploaderName: reportingMediaItem.senderName,
                    uploaderAvatar: reportingMediaItem.senderAvatar,
                    reporterName: 'You',
                    category: selectedReportCategory,
                    reason: reportReasonInput,
                    markAsAdultNudity:
                      reportAlsoMarkAdult || selectedReportCategory === 'adult_nudity',
                  });
                  setReportedMediaList(getReportedMediaFiles());
                  setAdultNudityIds(getAdultNudityMediaIds());
                  setGalleryToast(
                    `🚩 Reported "${reportingMediaItem.title}" to Admin Panel for moderation review!`
                  );
                  setTimeout(() => setGalleryToast(null), 3500);
                  setReportingMediaItem(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Submit Report to Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Interactive Media View Modal (Picture Zoom, Video Player, Like & Share, Edit Title & Delete) */}
      <MediaPlayerModal
        media={viewerMediaItem}
        isOpen={!!viewerMediaItem}
        onClose={() => setViewerMediaItem(null)}
        isDark={isDark}
        primaryColor={primaryColor}
        isGroupMedia={isGroupMode}
        groupName={contact?.name || 'Group'}
        groupParticipants={resolvedGroupParticipants}
        onShareWithGroupMembers={(mediaItem, memberIds, note) => {
          if (onShareWithGroupMembers) {
            onShareWithGroupMembers(mediaItem, memberIds, note);
          }
          const chosen = otherGroupMembers.filter((m) => memberIds.includes(m.id));
          const names = chosen.map((m) => m.name.split(' ')[0]).join(', ');
          setGalleryToast(`Shared "${mediaItem.title}" with group members: ${names}!`);
          setTimeout(() => setGalleryToast(null), 3500);
        }}
        onToggleFavorite={(mediaId, nextFav) => {
          setFavoriteMap((prev) => {
            const updated = { ...prev, [mediaId]: nextFav };
            try {
              localStorage.setItem('freedom_favorite_media_map', JSON.stringify(updated));
            } catch {}
            return updated;
          });
          if (onToggleFavoriteMedia) {
            onToggleFavoriteMedia(mediaId, nextFav);
          }
        }}
        onToggleLike={(mediaId, nextLiked) => {
          setLikeMap((prev) => {
            const currentCount = prev[mediaId]?.likesCount ?? viewerMediaItem?.likesCount ?? 14;
            const nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
            return {
              ...prev,
              [mediaId]: { isLiked: nextLiked, likesCount: nextCount },
            };
          });
          if (onToggleLikeMedia) {
            onToggleLikeMedia(mediaId, nextLiked);
          }
        }}
        onEditTitle={(mediaId, newTitle) => {
          handleSaveTitleForId(mediaId, newTitle);
          setViewerMediaItem((prev) => (prev ? { ...prev, title: newTitle } : null));
        }}
        onDeleteMedia={(mediaId) => {
          handleDeleteMediaById(mediaId);
          setViewerMediaItem(null);
        }}
        onOpenStudioEditor={(mediaItem) => {
          setViewerMediaItem(null);
          setEditorState({
            isOpen: true,
            mediaType: mediaItem.type === 'video' ? 'video' : 'image',
            mediaUrl: mediaItem.mediaUrl,
            mediaTitle: mediaItem.title,
            mediaId: mediaItem.id,
            thumbnailUrl: mediaItem.thumbnailUrl || mediaItem.mediaUrl,
          });
        }}
      />

      {/* Full-Screen Photo & Video Studio Editor Modal (Matching Screenshot_20210725_004432.jpg & 36.jpg) */}
      <GalleryPhotoVideoEditorModal
        isOpen={editorState.isOpen}
        onClose={() => setEditorState((prev) => ({ ...prev, isOpen: false }))}
        mediaType={editorState.mediaType}
        mediaUrl={editorState.mediaUrl}
        mediaTitle={editorState.mediaTitle}
        mediaId={editorState.mediaId}
        thumbnailUrl={editorState.thumbnailUrl}
        primaryColor={primaryColor}
        onSaveEditedMedia={(res) => {
          const targetId = res.mediaId || `edited-${Date.now()}`;
          setEditedMediaMap((prev) => {
            const updated = {
              ...prev,
              [targetId]: {
                url: res.editedDataUrl,
                thumbnailUrl: res.thumbnailUrl,
                title: res.title,
              },
            };
            try {
              localStorage.setItem('freedom_edited_gallery_media_v1', JSON.stringify(updated));
            } catch {}
            return updated;
          });

          // Also ensure if it was a newly uploaded creative inside the editor, it appears in the gallery cards
          const existsInAll = allItems.some(
            (i) => i.messageId === targetId || i.id === targetId
          );
          if (!existsInAll) {
            const updatedLiked = addMediaToLikedUserGallery({
              id: targetId,
              messageId: targetId,
              type: res.mediaType,
              url: res.editedDataUrl,
              thumbnailUrl: res.thumbnailUrl,
              title: res.title || 'Edited Studio Creative',
              senderName: 'You',
            });
            setLikedGalleryItems(updatedLiked);
          }

          setGalleryToast(
            `✨ Saved edited ${res.mediaType === 'video' ? 'video' : 'photo'} "${res.title}" to User Gallery!`
          );
          setTimeout(() => setGalleryToast(null), 3200);
        }}
      />
    </div>
  );
};
