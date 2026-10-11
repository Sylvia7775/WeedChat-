import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from './StatusBar';
import {
  ChevronLeft,
  Phone,
  Video,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  Send,
  Mic,
  Paperclip,
  Check,
  CheckCheck,
  AlertCircle,
  XCircle,
  RotateCcw,
  Globe,
  Smile,
  Camera,
  Search,
  X,
  Info,
  Plus,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Ban,
  Lock,
  Unlock,
  Handshake,
  ShieldAlert,
  MoreVertical,
  Tag,
  Heart,
  Bookmark,
  Star,
  Share2,
  Images,
  FileText,
  User,
  Users,
  UserPlus,
  Trash2,
  Forward,
  Copy,
  Reply,
  Clock,
  Link as LinkIcon,
  Volume2,
  VolumeX,
  Loader2,
  Download,
  Maximize2,
  RotateCw,
  Calendar,
  Megaphone,
  Radio,
  Headphones,
  Edit2,
  Save,
  BatteryCharging,
  Upload,
} from 'lucide-react';
import { ChatMessage, UserContact, ThemeMode, StickerItem, ActiveMediaItem, GroupParticipant, ChannelLiveChatMessage } from '../types';
import {
  detectVideoPlatformFromText,
  stripVideoUrlsFromText,
  optimizeUploadedImageFile,
  generateVideoFileThumbnail,
  createPlatformSvgThumbnail,
  getAutoPlayChatVideosSetting,
  setAutoPlayChatVideosSetting,
  subscribeAutoPlayChatVideosSetting,
} from '../lib/videoPlatformHelper';
import { getStickerById } from '../data/stickersData';
import { StickerItemCard } from './StickerItemCard';
import { EmojiAndStickersTray } from './EmojiAndStickersTray';
import { MediaPlayerModal } from './MediaPlayerModal';
import { MediaGalleryModal } from './MediaGalleryModal';
import { UserProfileModal } from './UserProfileModal';
import { ForwardMessageModal } from './ForwardMessageModal';
import { FriendshipModal } from './FriendshipModal';
import { SnapFaceFilterCameraModal } from './SnapFaceFilterCameraModal';
import {
  ChannelLiveStreamAndPodcastModal,
  LiveBroadcastMode,
} from './ChannelLiveStreamAndPodcastModal';
import { addMediaToLikedUserGallery } from '../lib/likedUserGalleryHelper';
import {
  GroupVideoCallSchedulerModal,
  ScheduledGroupVideoCall,
  formatReadableCallDate,
} from './GroupVideoCallSchedulerModal';
import {
  VoiceNoteWaveformVisualizer,
  RecordingVoiceVisualizer,
} from './VoiceNoteWaveformVisualizer';
import { formatAudioTime } from '../lib/audioWaveformHelper';
import {
  syncTypingIndicatorToDb,
  saveChannelLiveStreamToDb,
  deleteChannelLiveStreamFromDb,
  sendChannelLiveChatMessageToDb,
  subscribeChannelLiveChatMessages,
  saveContactOrChannelToDb,
  saveConversationWallpaperInDb,
  subscribeConversationWallpaperFromDb,
  resolveParticipantConversationWallpaper,
  ChannelLiveStreamRecord,
} from '../lib/firebase';
import { getCleanAvatar, getPersistentUserThumbnail } from '../lib/avatarHelper';
import {
  VerifiedCheckmarkBadge,
  isAccountProfileValidated,
} from './VerifiedCheckmarkBadge';

interface ActiveChatScreenProps {
  contact: UserContact;
  messages: ChatMessage[];
  onBack: () => void;
  onSendMessage: (
    text: string,
    type?: 'text' | 'audio' | 'image' | 'video' | 'sticker',
    imageUrl?: string,
    stickerData?: { id: string; name: string; category?: string },
    extraVideoMeta?: {
      thumbnailUrl?: string;
      videoPlatform?: string;
      embedUrl?: string;
      originalVideoUrl?: string;
      duration?: string;
    }
  ) => void;
  onStartCall: (type: 'voice' | 'video') => void;
  theme?: ThemeMode;
  userMotherLanguage?: string;
  onToggleMessageStatus?: (messageId: string) => void;
  onReactToMessage?: (messageId: string, emoji: string) => void;
  onOpenImportWhatsApp?: () => void;
  isContactTyping?: boolean;
  onSetContactTyping?: (typing: boolean) => void;
  primaryColor?: string;
  onToggleBlockUser?: (contactId: string, blocked: boolean) => void;
  customStickers?: StickerItem[];
  onToggleLikeMedia?: (mediaId: string, isLiked: boolean) => void;
  onToggleFavoriteMedia?: (mediaId: string, isFavorite: boolean) => void;
  onRateMedia?: (mediaId: string, rating: number) => void;
  onShareMedia?: (media: ActiveMediaItem) => void;
  contacts?: UserContact[];
  onForwardMessage?: (targetContactIds: string[], message: ChatMessage, note?: string) => void;
  onUpdateGroupParticipants?: (groupId: string, participants: GroupParticipant[]) => void;
  onSimulateParticipantMessage?: (participant: GroupParticipant) => void;
  onToggleLockMessageContribution?: (messageId: string, locked: boolean) => void;
  onToggleLockUserContribution?: (contactId: string, locked: boolean) => void;
  onDeleteMessage?: (messageId: string) => void;
  currentUserId?: string;
  currentUserName?: string;
}

const QUICK_REACTION_EMOJIS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏'];
const EXTENDED_REACTION_EMOJIS = [
  '👏', '🎉', '🚀', '💯', '👀', '✨', '💡', '🥰', '🥳', '🤝', '🤩', '💪', '🎯', '👌'
];

export const ActiveChatScreen: React.FC<ActiveChatScreenProps> = ({
  contact,
  messages,
  onBack,
  onSendMessage,
  onStartCall,
  theme = 'dark',
  userMotherLanguage = 'English',
  onToggleMessageStatus,
  onReactToMessage,
  onOpenImportWhatsApp,
  isContactTyping = false,
  onSetContactTyping,
  primaryColor = '#7C3AED',
  onToggleBlockUser,
  customStickers = [],
  onToggleLikeMedia,
  onToggleFavoriteMedia,
  onRateMedia,
  onShareMedia,
  contacts = [],
  onForwardMessage,
  onUpdateGroupParticipants,
  onSimulateParticipantMessage,
  onToggleLockMessageContribution,
  onToggleLockUserContribution,
  onDeleteMessage,
  currentUserId = 'me',
  currentUserName = 'You',
}) => {
  const isBlocked = contact.isBlocked === true || contact.status === 'blocked';
  const [isUserContributionsLocked, setIsUserContributionsLocked] = useState<boolean>(
    Boolean(contact.isContributionLocked)
  );
  const [lockedMessageIds, setLockedMessageIds] = useState<Record<string, boolean>>({});
  const [isFriendshipModalOpen, setIsFriendshipModalOpen] = useState<boolean>(false);

  const [isPinLockModalOpen, setIsPinLockModalOpen] = useState(false);
  const [pinTargetMessage, setPinTargetMessage] = useState<ChatMessage | null>(null);
  const [pinCodeInput, setPinCodeInput] = useState('1234');
  const [pinError, setPinError] = useState<string | null>(null);

  // AI Voice in Message state (only displayed in texting box when user clicks the sidebar link)
  const [isAiVoiceBoxActive, setIsAiVoiceBoxActive] = useState<boolean>(false);
  const [aiVoiceSpeakingMsgId, setAiVoiceSpeakingMsgId] = useState<string | null>(null);
  const [aiVoiceLoadingMsgId, setAiVoiceLoadingMsgId] = useState<string | null>(null);
  const [selectedAiVoiceName, setSelectedAiVoiceName] = useState<
    'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir'
  >('Kore');
  const [aiVoiceLanguage, setAiVoiceLanguage] = useState<string>('Original');
  const [isAiVoiceModalOpen, setIsAiVoiceModalOpen] = useState<boolean>(false);
  const [aiVoiceDraftText, setAiVoiceDraftText] = useState<string>('');
  const [isPreviewingAiVoice, setIsPreviewingAiVoice] = useState<boolean>(false);
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);

  const AI_VOICE_PERSONAS: Array<{
    id: 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';
    label: string;
    desc: string;
    style: string;
  }> = [
    { id: 'Kore', label: 'Kore', desc: 'Warm & Expressive', style: 'Warm, natural, conversational' },
    { id: 'Zephyr', label: 'Zephyr', desc: 'Bright & Friendly', style: 'Cheerful, bright, friendly' },
    { id: 'Puck', label: 'Puck', desc: 'Energetic & Clear', style: 'Energetic, lively, articulate' },
    { id: 'Charon', label: 'Charon', desc: 'Deep & Calm', style: 'Calm, deep, composed' },
    { id: 'Fenrir', label: 'Fenrir', desc: 'Bold & Dynamic', style: 'Bold, confident, resonant' },
  ];

  const stopAiVoicePlayback = () => {
    if (aiAudioRef.current) {
      aiAudioRef.current.pause();
      aiAudioRef.current.currentTime = 0;
      aiAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAiVoiceSpeakingMsgId(null);
    setAiVoiceLoadingMsgId(null);
    setIsPreviewingAiVoice(false);
  };

  const playBrowserSpeechFallback = (text: string, onEnd: () => void) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = selectedAiVoiceName === 'Charon' || selectedAiVoiceName === 'Fenrir' ? 0.9 : 1.05;
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(onEnd, 2500);
    }
  };

  const handlePlayMessageAiVoice = async (msg: ChatMessage, overrideVoice?: string) => {
    if (aiVoiceSpeakingMsgId === msg.id) {
      stopAiVoicePlayback();
      return;
    }

    stopAiVoicePlayback();
    const rawText =
      showTranslateMode && msg.translation?.translated
        ? msg.translation.translated
        : msg.text || 'Voice message';

    const voiceToUse = overrideVoice || selectedAiVoiceName;
    const persona =
      AI_VOICE_PERSONAS.find((p) => p.id === voiceToUse) || AI_VOICE_PERSONAS[0];

    setAiVoiceLoadingMsgId(msg.id);

    try {
      const response = await fetch('/api/ai-voice-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          voiceName: persona.id,
          style: persona.style,
          targetLanguage: aiVoiceLanguage,
        }),
      });
      const data = await response.json();

      setAiVoiceLoadingMsgId(null);
      setAiVoiceSpeakingMsgId(msg.id);
      setReactionFeedback(`🔊 AI Voice (${persona.label}) speaking message...`);
      setTimeout(() => setReactionFeedback(null), 2600);

      if (data.success && data.audioDataUrl) {
        const audio = new Audio(data.audioDataUrl);
        aiAudioRef.current = audio;
        audio.onended = () => {
          setAiVoiceSpeakingMsgId(null);
        };
        audio.onerror = () => {
          playBrowserSpeechFallback(data.spokenText || rawText, () =>
            setAiVoiceSpeakingMsgId(null)
          );
        };
        await audio.play();
      } else {
        playBrowserSpeechFallback(data.spokenText || rawText, () =>
          setAiVoiceSpeakingMsgId(null)
        );
      }
    } catch {
      setAiVoiceLoadingMsgId(null);
      setAiVoiceSpeakingMsgId(msg.id);
      playBrowserSpeechFallback(rawText, () => setAiVoiceSpeakingMsgId(null));
    }
  };

  const handlePreviewAiVoiceStudio = async () => {
    const textToSpeak =
      aiVoiceDraftText.trim() ||
      inputText.trim() ||
      `Hello ${contact.name.split(' ')[0]}! Speaking to you with Freedom AI Voice.`;

    if (isPreviewingAiVoice) {
      stopAiVoicePlayback();
      return;
    }

    stopAiVoicePlayback();
    setIsPreviewingAiVoice(true);
    const persona =
      AI_VOICE_PERSONAS.find((p) => p.id === selectedAiVoiceName) || AI_VOICE_PERSONAS[0];

    try {
      const response = await fetch('/api/ai-voice-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          voiceName: persona.id,
          style: persona.style,
          targetLanguage: aiVoiceLanguage,
        }),
      });
      const data = await response.json();
      if (data.success && data.audioDataUrl) {
        const audio = new Audio(data.audioDataUrl);
        aiAudioRef.current = audio;
        audio.onended = () => setIsPreviewingAiVoice(false);
        audio.onerror = () =>
          playBrowserSpeechFallback(data.spokenText || textToSpeak, () =>
            setIsPreviewingAiVoice(false)
          );
        await audio.play();
      } else {
        playBrowserSpeechFallback(data.spokenText || textToSpeak, () =>
          setIsPreviewingAiVoice(false)
        );
      }
    } catch {
      playBrowserSpeechFallback(textToSpeak, () => setIsPreviewingAiVoice(false));
    }
  };

  const handleSendAiVoiceMessage = () => {
    const textToSend =
      aiVoiceDraftText.trim() ||
      inputText.trim() ||
      `🎙️ [AI Voice • ${selectedAiVoiceName}]: Hello ${contact.name.split(' ')[0]}! How is your day going?`;

    const formattedText = textToSend.startsWith('🎙️ [AI Voice')
      ? textToSend
      : `🎙️ [AI Voice • ${selectedAiVoiceName}]: ${textToSend}`;

    onSendMessage(formattedText, 'text');
    setAiVoiceDraftText('');
    setInputText('');
    setIsAiVoiceModalOpen(false);
    setReactionFeedback(`🎙️ Sent AI Voice (${selectedAiVoiceName}) message!`);
    setTimeout(() => setReactionFeedback(null), 2600);
  };

  useEffect(() => {
    setIsUserContributionsLocked(Boolean(contact.isContributionLocked));
  }, [contact.id, contact.isContributionLocked]);

  const isMessageContributionLocked = (msg: ChatMessage): boolean => {
    if (lockedMessageIds[msg.id] !== undefined) {
      return lockedMessageIds[msg.id];
    }
    return Boolean(msg.isContributionLocked);
  };

  const handleToggleMessageLock = (msg: ChatMessage) => {
    const nextLocked = !isMessageContributionLocked(msg);
    setLockedMessageIds((prev) => ({ ...prev, [msg.id]: nextLocked }));
    if (onToggleLockMessageContribution) {
      onToggleLockMessageContribution(msg.id, nextLocked);
    }
    setReactionFeedback(
      nextLocked
        ? `🔒 Locked message with a Pin (${msg.senderName || (msg.senderId === 'me' ? 'You' : contact.name)})`
        : `🔓 Unlocked message with a Pin`
    );
    setTimeout(() => setReactionFeedback(null), 2600);
  };

  const handleToggleAllUserContributionsLock = (targetLocked?: boolean) => {
    const nextState = targetLocked !== undefined ? targetLocked : !isUserContributionsLocked;
    setIsUserContributionsLocked(nextState);
    if (onToggleLockUserContribution) {
      onToggleLockUserContribution(contact.id, nextState);
    }
    setReactionFeedback(
      nextState
        ? `🔒 Locked ${contact.name} with a Pin`
        : `🔓 Unlocked ${contact.name} with a Pin`
    );
    setTimeout(() => setReactionFeedback(null), 2800);
  };

  const openPinLockPrompt = (msg?: ChatMessage) => {
    setPinTargetMessage(msg || null);
    setPinCodeInput('1234');
    setPinError(null);
    setIsPinLockModalOpen(true);
  };

  const handleConfirmPinLock = () => {
    if (pinCodeInput.trim().length < 4) {
      setPinError('Please enter a 4-digit PIN (e.g., 1234)');
      return;
    }
    if (pinTargetMessage) {
      handleToggleMessageLock(pinTargetMessage);
    } else {
      handleToggleAllUserContributionsLock();
    }
    setIsPinLockModalOpen(false);
    setPinTargetMessage(null);
  };
  const isGroupChat = Boolean(contact.isGroup || contact.entityType === 'group');
  const isChannelChat = Boolean(contact.isChannel || contact.entityType === 'channel');
  const isChannelCreator = Boolean(
    isChannelChat &&
      (!contact.channelAdminId ||
        contact.channelAdminId === 'me' ||
        contact.channelAdminId === 'admin_mobilephonesky' ||
        contact.channelAdminId === 'user_abdullah')
  );

  // Channel Subscribe state
  const channelSubKey = `freedom_channel_subscribed_${contact.id}`;
  const [isSubscribedToChannel, setIsSubscribedToChannel] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(channelSubKey);
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch {}
    return contact.isSubscribedChannel ?? true;
  });
  const [channelSubscribersCount, setChannelSubscribersCount] = useState<number>(
    contact.subscribersCount || 1
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(channelSubKey);
      if (saved === 'true') {
        setIsSubscribedToChannel(true);
      } else if (saved === 'false') {
        setIsSubscribedToChannel(false);
      } else {
        setIsSubscribedToChannel(contact.isSubscribedChannel ?? true);
      }
    } catch {
      setIsSubscribedToChannel(contact.isSubscribedChannel ?? true);
    }
    setChannelSubscribersCount(contact.subscribersCount || 1);
  }, [contact.id, channelSubKey, contact.isSubscribedChannel, contact.subscribersCount]);

  const handleToggleChannelSubscribe = () => {
    const nextSub = !isSubscribedToChannel;
    const nextCount = nextSub
      ? channelSubscribersCount + 1
      : Math.max(0, channelSubscribersCount - 1);
    setIsSubscribedToChannel(nextSub);
    setChannelSubscribersCount(nextCount);
    try {
      localStorage.setItem(channelSubKey, String(nextSub));
    } catch {}
    saveContactOrChannelToDb({
      ...contact,
      isSubscribedChannel: nextSub,
      subscribersCount: nextCount,
    }).catch(() => {});
    setReactionFeedback(
      nextSub
        ? `🔔 Subscribed to ${contact.name}!`
        : `Unsubscribed from ${contact.name}`
    );
    setTimeout(() => setReactionFeedback(null), 2600);
  };

  // Channel Bubble Live Stream ("live") State
  const liveStreamsMapStorageKey = `freedom_channel_live_streams_map_${contact.id}`;
  const [channelLiveStreamsMap, setChannelLiveStreamsMap] = useState<
    Record<string, { title: string; active: boolean; deleted?: boolean }>
  >(() => {
    try {
      const raw = localStorage.getItem(liveStreamsMapStorageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(liveStreamsMapStorageKey);
      if (raw) {
        setChannelLiveStreamsMap(JSON.parse(raw));
      } else {
        setChannelLiveStreamsMap({});
      }
    } catch {
      setChannelLiveStreamsMap({});
    }
  }, [contact.id, liveStreamsMapStorageKey]);

  const persistChannelLiveStreamsMap = (
    nextMap: Record<string, { title: string; active: boolean; deleted?: boolean }>
  ) => {
    setChannelLiveStreamsMap(nextMap);
    try {
      localStorage.setItem(liveStreamsMapStorageKey, JSON.stringify(nextMap));
    } catch {}
  };

  // Active Live Stream Chat modal (only opens when user clicks the "live" icon/title in a Channel Bubble)
  const [activeLiveStreamMsgId, setActiveLiveStreamMsgId] = useState<string | null>(null);
  const [editingLiveStreamMsgId, setEditingLiveStreamMsgId] = useState<string | null>(null);
  const [editingLiveStreamTitle, setEditingLiveStreamTitle] = useState<string>('');
  const [showCreateLiveModal, setShowCreateLiveModal] = useState<boolean>(false);
  const [newLiveStreamTitle, setNewLiveStreamTitle] = useState<string>('live');
  const [newLiveStreamMode, setNewLiveStreamMode] = useState<LiveBroadcastMode>('live');
  const [newLiveCameraOn, setNewLiveCameraOn] = useState<boolean>(true);
  const [newLiveMicOn, setNewLiveMicOn] = useState<boolean>(true);
  const [newLiveFilterId, setNewLiveFilterId] = useState<string>('normal');
  const [liveChatMessages, setLiveChatMessages] = useState<ChannelLiveChatMessage[]>([]);
  const [liveChatInput, setLiveChatInput] = useState<string>('');
  const liveChatEndRef = useRef<HTMLDivElement | null>(null);

  const getBubbleLiveStreamInfo = (msg: ChatMessage) => {
    const entry = channelLiveStreamsMap[msg.id] as
      | {
          title: string;
          active: boolean;
          deleted?: boolean;
          mode?: LiveBroadcastMode;
          cameraOn?: boolean;
          micOn?: boolean;
          filterId?: string;
        }
      | undefined;
    const isPodcastText = Boolean(msg.text && msg.text.startsWith('🎙️ [PODCAST]'));
    if (entry) {
      return {
        ...entry,
        mode: entry.mode || (isPodcastText ? 'podcast' : 'live'),
      };
    }
    if (msg.liveStreamDeleted) {
      return { title: 'live', active: false, deleted: true, mode: 'live' as LiveBroadcastMode };
    }
    const defaultTitle =
      msg.liveStreamTitle ||
      (msg.text && msg.text.startsWith('🔴 [LIVE]')
        ? msg.text.replace(/^🔴\s*\[LIVE\]\s*/i, '').trim() || 'live'
        : isPodcastText && msg.text
        ? msg.text.replace(/^🎙️\s*\[PODCAST\]\s*/i, '').trim() || 'Podcast'
        : 'live');
    return {
      title: defaultTitle,
      active: true,
      deleted: false,
      mode: (isPodcastText ? 'podcast' : 'live') as LiveBroadcastMode,
    };
  };

  const handleRenameChannelLiveStream = (msgId: string, nextTitleRaw: string) => {
    const cleanTitle = nextTitleRaw.trim() || 'live';
    const nextMap = {
      ...channelLiveStreamsMap,
      [msgId]: {
        title: cleanTitle,
        active: true,
        deleted: false,
      },
    };
    persistChannelLiveStreamsMap(nextMap);
    setEditingLiveStreamMsgId(null);
    const streamId = `${contact.id}_${msgId}`;
    saveChannelLiveStreamToDb({
      id: streamId,
      channelId: contact.id,
      messageId: msgId,
      title: cleanTitle,
      creatorId: 'admin_mobilephonesky',
      creatorName: contact.name,
      active: true,
      deleted: false,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    setReactionFeedback(`🔴 Renamed live stream to "${cleanTitle}"`);
    setTimeout(() => setReactionFeedback(null), 2500);
  };

  const handleDeleteChannelLiveStream = (msgId: string) => {
    const nextMap = {
      ...channelLiveStreamsMap,
      [msgId]: {
        title: 'live',
        active: false,
        deleted: true,
      },
    };
    persistChannelLiveStreamsMap(nextMap);
    if (activeLiveStreamMsgId === msgId) {
      setActiveLiveStreamMsgId(null);
    }
    if (editingLiveStreamMsgId === msgId) {
      setEditingLiveStreamMsgId(null);
    }
    const streamId = `${contact.id}_${msgId}`;
    deleteChannelLiveStreamFromDb(streamId).catch(() => {});
    setReactionFeedback('🗑️ Deleted live stream from channel bubble');
    setTimeout(() => setReactionFeedback(null), 2500);
  };

  const handleRestoreOrCreateBubbleLiveStream = (msgId: string, customTitle?: string) => {
    const cleanTitle = (customTitle || 'live').trim() || 'live';
    const nextMap = {
      ...channelLiveStreamsMap,
      [msgId]: {
        title: cleanTitle,
        active: true,
        deleted: false,
      },
    };
    persistChannelLiveStreamsMap(nextMap);
    const streamId = `${contact.id}_${msgId}`;
    saveChannelLiveStreamToDb({
      id: streamId,
      channelId: contact.id,
      messageId: msgId,
      title: cleanTitle,
      creatorId: 'admin_mobilephonesky',
      creatorName: contact.name,
      active: true,
      deleted: false,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    setReactionFeedback(`🔴 Created "${cleanTitle}" live chat stream on bubble!`);
    setTimeout(() => setReactionFeedback(null), 2500);
  };

  const handleCreateNewLiveStreamInMessage = (e?: React.FormEvent, goLiveImmediately = true) => {
    if (e) e.preventDefault();
    const cleanTitle =
      newLiveStreamTitle.trim() || (newLiveStreamMode === 'podcast' ? 'Live Podcast' : 'live');
    const prefix = newLiveStreamMode === 'podcast' ? '🎙️ [PODCAST]' : '🔴 [LIVE]';
    onSendMessage(`${prefix} ${cleanTitle}`, 'text');
    setShowCreateLiveModal(false);
    setNewLiveStreamTitle('live');
    if (goLiveImmediately) {
      const targetId = messages[messages.length - 1]?.id || 'live_stream_now';
      const nextMap = {
        ...channelLiveStreamsMap,
        [targetId]: {
          title: cleanTitle,
          active: true,
          deleted: false,
          mode: newLiveStreamMode,
          cameraOn: newLiveCameraOn,
          micOn: newLiveMicOn,
          filterId: newLiveFilterId,
        },
      };
      persistChannelLiveStreamsMap(nextMap);
      setActiveLiveStreamMsgId(targetId);
    }
    setReactionFeedback(
      newLiveStreamMode === 'podcast'
        ? `🎙️ Started Live Podcast "${cleanTitle}" in ${contact.name}!`
        : `🔴 Started Live Stream "${cleanTitle}" in ${contact.name}!`
    );
    setTimeout(() => setReactionFeedback(null), 3200);
  };

  // Subscribe to real-time live chat messages when user clicks a channel bubble's "live" button
  useEffect(() => {
    if (!isChannelChat || !activeLiveStreamMsgId) {
      setLiveChatMessages([]);
      return;
    }
    const streamId = `${contact.id}_${activeLiveStreamMsgId}`;
    const unsub = subscribeChannelLiveChatMessages(streamId, (msgs) => {
      setLiveChatMessages(msgs);
      setTimeout(() => {
        liveChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    });
    return () => unsub();
  }, [isChannelChat, contact.id, activeLiveStreamMsgId]);

  const handleSendLiveStreamChatMessage = async (e?: React.FormEvent, quickText?: string) => {
    if (e) e.preventDefault();
    if (!activeLiveStreamMsgId) return;
    const textToSend = (quickText ?? liveChatInput).trim();
    if (!textToSend) return;
    if (!quickText) setLiveChatInput('');

    const streamId = `${contact.id}_${activeLiveStreamMsgId}`;
    const msgObj: ChannelLiveChatMessage = {
      id: `live_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channelId: contact.id,
      streamId,
      senderId: 'me',
      senderName: 'You (Channel Member)',
      senderAvatar: getCleanAvatar('You', undefined, primaryColor, 'admin_mobilephonesky'),
      text: textToSend,
      createdAt: new Date().toISOString(),
    };

    setLiveChatMessages((prev) => [...prev, msgObj]);
    await sendChannelLiveChatMessageToDb(msgObj);
    setTimeout(() => {
      liveChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };
  const groupParticipants: GroupParticipant[] =
    contact.participants && contact.participants.length > 0
      ? contact.participants
      : [
          {
            id: 'admin_mobilephonesky',
            name: 'WeedChat Support & Admin (Owner)',
            avatar: getCleanAvatar(
              'WeedChat Support & Admin',
              undefined,
              '#7C3AED',
              'admin_mobilephonesky'
            ),
            nativeLanguage: userMotherLanguage,
            online: true,
            role: 'admin',
          },
        ];

  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);
  const groupJoinKey = `freedom_group_joined_state_${contact.id}`;
  const groupCoverKey = `freedom_group_cover_${contact.id}`;
  const groupCoverFileRef = useRef<HTMLInputElement | null>(null);
  const [groupCoverUrl, setGroupCoverUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(groupCoverKey);
      if (saved) return saved;
    } catch {}
    return (
      contact.groupCoverUrl ||
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80'
    );
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(groupCoverKey);
      if (saved) {
        setGroupCoverUrl(saved);
        return;
      }
    } catch {}
    setGroupCoverUrl(
      contact.groupCoverUrl ||
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80'
    );
  }, [contact.id, groupCoverKey, contact.groupCoverUrl]);

  useEffect(() => {
    const handleShareGalleryMedia = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        mediaUrl?: string;
        mediaType?: 'image' | 'video';
        title?: string;
      }>;
      const url = customEv.detail?.mediaUrl;
      const mType = customEv.detail?.mediaType || 'image';
      const title = customEv.detail?.title || 'Shared from User Media Gallery';
      if (url) {
        onSendMessage(title, mType, url);
        setReactionFeedback(`📤 Shared "${title}" in message!`);
        setTimeout(() => setReactionFeedback(null), 2600);
      }
    };
    window.addEventListener('freedom-share-gallery-media-in-message', handleShareGalleryMedia);
    return () => {
      window.removeEventListener('freedom-share-gallery-media-in-message', handleShareGalleryMedia);
    };
  }, [onSendMessage]);

  const handleGroupCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        setGroupCoverUrl(dataUrl);
        try {
          localStorage.setItem(groupCoverKey, dataUrl);
        } catch {}
        setReactionFeedback('🖼️ Group Cover uploaded by Group Admin!');
        setTimeout(() => setReactionFeedback(null), 3200);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const [hasJoinedGroup, setHasJoinedGroup] = useState<boolean>(() => {
    try {
      return localStorage.getItem(groupJoinKey) === 'true' || Boolean(contact.isJoinedGroup);
    } catch {
      return Boolean(contact.isJoinedGroup);
    }
  });

  useEffect(() => {
    try {
      setHasJoinedGroup(
        localStorage.getItem(groupJoinKey) === 'true' || Boolean(contact.isJoinedGroup)
      );
    } catch {
      setHasJoinedGroup(Boolean(contact.isJoinedGroup));
    }
  }, [contact.id, groupJoinKey, contact.isJoinedGroup]);

  const handleJoinGroupAction = () => {
    setHasJoinedGroup(true);
    try {
      localStorage.setItem(groupJoinKey, 'true');
    } catch {}
    setReactionFeedback(`🎉 You joined "${contact.name}"! Group Gallery & member media sharing unlocked.`);
    setTimeout(() => setReactionFeedback(null), 3200);
  };

  const handleShareGroupMediaToMembers = (
    media: ActiveMediaItem,
    memberIds: string[],
    note?: string
  ) => {
    const recipientNames = groupParticipants
      .filter((p) => memberIds.includes(p.id))
      .map((p) => p.name.split(' ')[0])
      .join(', ');
    const shareCaption = `[Shared to Group Members: ${recipientNames || 'Group'}] ${media.title}${
      note ? ` — "${note}"` : ''
    }`;
    onSendMessage(
      shareCaption,
      media.type === 'image' || media.type === 'video' ? 'image' : 'text',
      media.mediaUrl || media.thumbnailUrl
    );
    setReactionFeedback(
      `📤 Shared "${media.title}" to group member${memberIds.length > 1 ? 's' : ''}: ${recipientNames}`
    );
    setTimeout(() => setReactionFeedback(null), 3200);
  };

  const [selectedProfileContact, setSelectedProfileContact] = useState<UserContact | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [blockFeedback, setBlockFeedback] = useState<string | null>(null);

  // Forward Message Modal State
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);

  // Media Player Modal State for playing videos and music/audio files
  const [activeMediaItem, setActiveMediaItem] = useState<ActiveMediaItem | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  // Auto-Play Chat Feed Videos Setting (Data & Battery Saver)
  const [autoPlayChatVideos, setAutoPlayChatVideos] = useState<boolean>(() =>
    getAutoPlayChatVideosSetting()
  );
  const [manuallyPlayingVideoIds, setManuallyPlayingVideoIds] = useState<Record<string, boolean>>({});
  const [inlineMutedVideoIds, setInlineMutedVideoIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = subscribeAutoPlayChatVideosSetting((enabled) => {
      setAutoPlayChatVideos(enabled);
      if (!enabled) {
        setManuallyPlayingVideoIds({});
      }
    });
    return () => unsub();
  }, []);

  const handleOpenMedia = (msg: ChatMessage) => {
    const detectedPlatform = detectVideoPlatformFromText(
      msg.originalVideoUrl || msg.videoUrl || msg.text || msg.mediaUrl || ''
    );
    const isVid =
      msg.type === 'video' ||
      Boolean(msg.videoUrl) ||
      Boolean(msg.videoThumbnail) ||
      Boolean(msg.videoPlatform) ||
      Boolean(detectedPlatform) ||
      msg.mediaUrl?.endsWith('.mp4') ||
      msg.mediaUrl?.startsWith('data:video') ||
      msg.mediaUrl?.includes('sample/ForBiggerBlazes') ||
      msg.mediaUrl?.includes('video');

    if (isVid) {
      const cleanTitle =
        stripVideoUrlsFromText(msg.text) ||
        detectedPlatform?.title ||
        (msg.videoPlatform ? `${msg.videoPlatform} Video` : 'Shared Video Clip');
      const resolvedThumb =
        msg.videoThumbnail ||
        detectedPlatform?.thumbnailUrl ||
        msg.mediaUrl ||
        createPlatformSvgThumbnail(
          msg.videoPlatform || detectedPlatform?.platformName || 'Video',
          cleanTitle
        );
      const resolvedStream =
        msg.videoUrl &&
        (msg.videoUrl.endsWith('.mp4') ||
          msg.videoUrl.startsWith('data:video') ||
          msg.videoUrl.startsWith('blob:') ||
          msg.videoUrl.includes('commondatastorage.googleapis.com'))
          ? msg.videoUrl
          : detectedPlatform?.playableStreamUrl ||
            (msg.mediaUrl &&
            (msg.mediaUrl.endsWith('.mp4') ||
              msg.mediaUrl.startsWith('data:video') ||
              msg.mediaUrl.startsWith('blob:') ||
              msg.mediaUrl.includes('commondatastorage.googleapis.com'))
              ? msg.mediaUrl
              : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');

      setActiveMediaItem({
        id: msg.id,
        type: 'video',
        title: cleanTitle,
        mediaUrl: resolvedStream,
        thumbnailUrl: resolvedThumb,
        videoPlatform: msg.videoPlatform || detectedPlatform?.platformName || 'Video',
        embedUrl: msg.embedUrl || detectedPlatform?.embedUrl,
        originalVideoUrl: msg.originalVideoUrl || detectedPlatform?.originalUrl,
        senderName: msg.senderName || contact.name,
        timestamp: msg.timestamp,
        duration: msg.audioDuration || '1:45',
        likesCount: msg.likesCount ?? 18,
        isLiked: msg.isLiked ?? false,
        isFavorite: msg.isFavorite ?? false,
        userRating: msg.userRating ?? 0,
        averageRating: msg.averageRating ?? 4.9,
        totalRatings: msg.totalRatings ?? 32,
      });
      setIsMediaModalOpen(true);
    } else if (msg.type === 'image') {
      setActiveMediaItem({
        id: msg.id,
        type: 'image',
        title: stripVideoUrlsFromText(msg.text) || 'Uploaded Picture',
        mediaUrl:
          msg.mediaUrl ||
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: msg.mediaUrl,
        senderName: msg.senderName || contact.name,
        timestamp: msg.timestamp,
        likesCount: msg.likesCount ?? 14,
        isLiked: msg.isLiked ?? false,
        isFavorite: msg.isFavorite ?? false,
        userRating: msg.userRating ?? 0,
        averageRating: msg.averageRating ?? 4.8,
        totalRatings: msg.totalRatings ?? 24,
      });
      setIsMediaModalOpen(true);
    } else if (msg.type === 'audio') {
      setPlayingAudioId(null);
      setActiveMediaItem({
        id: msg.id,
        type: 'audio',
        title: 'Voice Note Audio Message',
        mediaUrl:
          msg.mediaUrl ||
          'https://actions.google.com/sounds/v1/ambiences/outdoor_garden_birds.ogg',
        senderName: msg.senderName || contact.name,
        timestamp: msg.timestamp,
        duration: msg.audioDuration || '0:37',
        likesCount: msg.likesCount ?? 8,
        isLiked: msg.isLiked ?? false,
        isFavorite: msg.isFavorite ?? false,
        userRating: msg.userRating ?? 0,
        averageRating: msg.averageRating ?? 4.9,
        totalRatings: msg.totalRatings ?? 19,
      });
      setIsMediaModalOpen(true);
    }
  };

  const [inputText, setInputText] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(35);
  const [showTranslateMode, setShowTranslateMode] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isCameraSheetOpen, setIsCameraSheetOpen] = useState(false);
  const [isSnapFilterCameraOpen, setIsSnapFilterCameraOpen] = useState(false);
  const [isGroupCallSchedulerOpen, setIsGroupCallSchedulerOpen] = useState(false);

  // Scheduled Group Video Calls state (persisted per group in localStorage)
  const groupCallsStorageKey = `freedom_scheduled_group_calls_${contact.id}`;
  const [scheduledGroupCalls, setScheduledGroupCalls] = useState<ScheduledGroupVideoCall[]>(() => {
    try {
      const saved = localStorage.getItem(`freedom_scheduled_group_calls_${contact.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(groupCallsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setScheduledGroupCalls(parsed);
          return;
        }
      }
    } catch {}
    setScheduledGroupCalls([]);
  }, [groupCallsStorageKey]);

  const persistScheduledGroupCalls = (nextCalls: ScheduledGroupVideoCall[]) => {
    setScheduledGroupCalls(nextCalls);
    try {
      localStorage.setItem(groupCallsStorageKey, JSON.stringify(nextCalls));
    } catch {}
  };

  const handleSaveScheduledGroupCall = (
    newCall: ScheduledGroupVideoCall,
    sendAnnouncementToChat: boolean
  ) => {
    const nextCalls = [newCall, ...scheduledGroupCalls];
    persistScheduledGroupCalls(nextCalls);
    if (sendAnnouncementToChat) {
      const readableTime = formatReadableCallDate(newCall.dateIso, newCall.timeSlot);
      onSendMessage(
        `📅 Proposed Group Video Call: "${newCall.title}" on ${readableTime} (${newCall.durationMinutes} min • ${newCall.timezone}).${
          newCall.notes ? ` Note: ${newCall.notes}` : ''
        }`,
        'text'
      );
    }
    setReactionFeedback(`📅 Group video call scheduled for ${formatReadableCallDate(newCall.dateIso, newCall.timeSlot)}!`);
  };

  const handleUpdateGroupCallRsvp = (
    callId: string,
    status: 'going' | 'maybe' | 'declined'
  ) => {
    const nextCalls = scheduledGroupCalls.map((c) =>
      c.id === callId
        ? {
            ...c,
            rsvps: {
              ...(c.rsvps || {}),
              me: status,
            },
          }
        : c
    );
    persistScheduledGroupCalls(nextCalls);
    setReactionFeedback(
      status === 'going'
        ? '✅ RSVP updated: Going to group video call!'
        : status === 'maybe'
        ? '⏳ RSVP updated: Maybe'
        : '❌ RSVP updated: Declined'
    );
  };

  const handleDeleteScheduledGroupCall = (callId: string) => {
    const nextCalls = scheduledGroupCalls.filter((c) => c.id !== callId);
    persistScheduledGroupCalls(nextCalls);
    setReactionFeedback('🗑️ Cancelled scheduled group video call');
  };

  // Media Gallery Modal State
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const handleJumpToMessage = (messageId: string) => {
    setIsMediaGalleryOpen(false);
    setHighlightedMessageId(messageId);
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 3500);
  };

  // Block or unblock handler
  const handleToggleBlock = (shouldBlock: boolean) => {
    setIsMoreMenuOpen(false);
    setIsBlockModalOpen(false);
    if (onToggleBlockUser) {
      onToggleBlockUser(contact.id, shouldBlock);
    }
    const msg = shouldBlock
      ? `${contact.name} is now blocked. Status set to 'blocked' in database.`
      : `${contact.name} is unblocked. Status updated in database.`;
    setBlockFeedback(msg);
    setTimeout(() => setBlockFeedback(null), 3500);
  };

  // Real-time typing indicator state
  const [internalTyping, setInternalTyping] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localUserTypingIdleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

  // Broadcast local user's writing state to Firestore so other devices see typing in real-time
  const handleLocalUserWritingChange = (nextValue: string) => {
    setInputText(nextValue);
    if (isBlocked) return;

    const isWriting = nextValue.trim().length > 0;
    const now = Date.now();

    if (isWriting) {
      if (now - lastTypingBroadcastRef.current > 1200) {
        lastTypingBroadcastRef.current = now;
        syncTypingIndicatorToDb(contact.id, {
          isUserTyping: true,
          typingUserId: 'me',
          typingUserName: 'You',
        }).catch(() => {});
      }

      if (localUserTypingIdleTimerRef.current) {
        clearTimeout(localUserTypingIdleTimerRef.current);
      }
      localUserTypingIdleTimerRef.current = setTimeout(() => {
        syncTypingIndicatorToDb(contact.id, {
          isUserTyping: false,
        }).catch(() => {});
      }, 2500);
    } else {
      if (localUserTypingIdleTimerRef.current) {
        clearTimeout(localUserTypingIdleTimerRef.current);
      }
      syncTypingIndicatorToDb(contact.id, {
        isUserTyping: false,
      }).catch(() => {});
    }
  };

  // Message emoji reaction state
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<string | null>(null);
  const [showExtendedReactions, setShowExtendedReactions] = useState(false);
  const [reactionFeedback, setReactionFeedback] = useState<string | null>(null);
  const [reactionMenuPosition, setReactionMenuPosition] = useState<'above' | 'below'>('above');

  // Long press tracking refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasTriggeredLongPressRef = useRef(false);

  // Swipe-to-delete & Delete Message state
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());
  const [swipedMessageId, setSwipedMessageId] = useState<string | null>(null);
  const [activeDraggingMsgId, setActiveDraggingMsgId] = useState<string | null>(null);
  const [msgDragOffset, setMsgDragOffset] = useState<number>(0);
  const msgSwipeHorizontalRef = useRef<boolean>(false);
  const msgMouseDownRef = useRef<boolean>(false);
  const [lastDeletedMessage, setLastDeletedMessage] = useState<ChatMessage | null>(null);

  const handleExecuteDeleteMessage = (msg: ChatMessage) => {
    setDeletedMessageIds((prev) => new Set(prev).add(msg.id));
    setLastDeletedMessage(msg);
    setSelectedMessageForReaction(null);
    setSwipedMessageId(null);
    setActiveDraggingMsgId(null);
    setMsgDragOffset(0);
    if (onDeleteMessage) {
      onDeleteMessage(msg.id);
    }
    setReactionFeedback('🗑️ Message deleted');
    setTimeout(() => setReactionFeedback(null), 3500);
  };

  const handleUndoDeleteMessage = () => {
    if (!lastDeletedMessage) return;
    const restoredId = lastDeletedMessage.id;
    setDeletedMessageIds((prev) => {
      const next = new Set(prev);
      next.delete(restoredId);
      return next;
    });
    setLastDeletedMessage(null);
    setReactionFeedback('Message restored');
    setTimeout(() => setReactionFeedback(null), 2200);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const chatWallpaperStorageKey = `freedom_chat_wallpaper_${contact.id}`;
  const activeParticipantId = (currentUserId || 'me').trim();
  const [chatWallpaperUrl, setChatWallpaperUrl] = useState<string>(() => {
    return resolveParticipantConversationWallpaper(null, activeParticipantId, contact.id);
  });

  useEffect(() => {
    const unsub = subscribeConversationWallpaperFromDb(
      contact.id,
      activeParticipantId,
      (resolvedUrl) => {
        setChatWallpaperUrl(resolvedUrl);
      }
    );
    return () => unsub();
  }, [contact.id, activeParticipantId]);

  const handleChatWallpaperFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const optimizedUrl = await optimizeUploadedImageFile(file);
    if (optimizedUrl) {
      setChatWallpaperUrl(optimizedUrl);
      try {
        localStorage.setItem(chatWallpaperStorageKey, optimizedUrl);
      } catch {}
      await saveConversationWallpaperInDb(
        contact.id,
        {
          id: contact.id,
          name: file.name || 'Chat Wallpaper',
          type: 'image',
          value: optimizedUrl,
          sharedWallpaperUrl: optimizedUrl,
          uploadedByUserId: activeParticipantId,
          uploadedByUserName: currentUserName,
        },
        activeParticipantId,
        currentUserName
      );
      setReactionFeedback('Wallpaper updated');
      setTimeout(() => setReactionFeedback(null), 2500);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [showStatusLegend, setShowStatusLegend] = useState(false);

  // Cycle message status on demand for interactive testing
  const handleCycleStatus = (messageId: string, currentStatus?: ChatMessage['status']) => {
    const status = currentStatus || 'sent';
    if (onToggleMessageStatus) {
      onToggleMessageStatus(messageId);
    }
    const descriptions: Record<ChatMessage['status'], { next: string; desc: string }> = {
      sent: { next: 'Delivered', desc: 'Double checkmarks (received by device)' },
      delivered: { next: 'Read', desc: 'Double blue checkmarks (seen by recipient)' },
      read: { next: 'Failed', desc: 'Failed delivery indicator' },
      failed: { next: 'Sent', desc: 'Single checkmark (sent to server)' },
    };
    const nextInfo = descriptions[status];
    setStatusFeedback(`${nextInfo.next}: ${nextInfo.desc}`);
    setTimeout(() => {
      setStatusFeedback(null);
    }, 2400);
  };

  // Keyboard Escape listener to close reaction popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMessageForReaction(null);
        setShowExtendedReactions(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Long press gesture tracking handlers for reaction menu
  const handleStartPress = (
    messageId: string,
    clientX: number,
    clientY: number,
    targetElement?: HTMLElement | null
  ) => {
    hasTriggeredLongPressRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      hasTriggeredLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch (err) {
          // ignore
        }
      }
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        if (rect.top < 180) {
          setReactionMenuPosition('below');
        } else {
          setReactionMenuPosition('above');
        }
      }
      setSelectedMessageForReaction(messageId);
      setShowExtendedReactions(false);
    }, 420);
  };

  const handleCancelPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCheckMove = (clientX: number, clientY: number, msg?: ChatMessage) => {
    const rawDx = clientX - touchStartPosRef.current.x;
    const rawDy = clientY - touchStartPosRef.current.y;
    const dx = Math.abs(rawDx);
    const dy = Math.abs(rawDy);
    if (dx > 8 || dy > 8) {
      handleCancelPress();
    }
    if (msg) {
      if (!msgSwipeHorizontalRef.current && dx > 10 && dx > dy) {
        msgSwipeHorizontalRef.current = true;
      }
      if (msgSwipeHorizontalRef.current) {
        const clamped = Math.max(-130, Math.min(0, rawDx));
        setActiveDraggingMsgId(msg.id);
        setMsgDragOffset(clamped);
      }
    }
  };

  const handleFinishMsgSwipe = (msg: ChatMessage) => {
    handleCancelPress();
    msgMouseDownRef.current = false;
    msgSwipeHorizontalRef.current = false;
    if (activeDraggingMsgId === msg.id) {
      if (msgDragOffset < -65) {
        handleExecuteDeleteMessage(msg);
      }
      setSwipedMessageId(null);
      setActiveDraggingMsgId(null);
      setMsgDragOffset(0);
    }
  };

  const handleSelectReactionEmoji = (messageId: string, emoji: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    const existing = targetMsg?.reactions?.find((r) => r.emoji === emoji);
    const willRemove = existing?.userReacted;

    if (onReactToMessage) {
      onReactToMessage(messageId, emoji);
    }

    setReactionFeedback(willRemove ? `Removed ${emoji} reaction` : `Reacted with ${emoji}`);
    setTimeout(() => {
      setReactionFeedback(null);
    }, 2000);

    setSelectedMessageForReaction(null);
    setShowExtendedReactions(false);
  };

  // Reusable helper to render visible single / double checkmark status indicators with smooth animated color & tick transitions
  const renderStatusIndicator = (
    status: ChatMessage['status'] | undefined,
    variant: 'bubble_green' | 'bubble_dark' | 'bubble_light' | 'image_overlay' | 'bubble_footer',
    messageId?: string
  ) => {
    const currentStatus = status || 'sent';

    let label = '';
    let description = '';

    switch (currentStatus) {
      case 'sent':
        label = 'Sent';
        description = 'Single checkmark (sent to server)';
        break;
      case 'delivered':
        label = 'Delivered';
        description = 'Double checkmarks (delivered to phone)';
        break;
      case 'read':
        label = 'Read';
        description = 'Double blue checkmarks (read by recipient)';
        break;
      case 'failed':
        label = 'Failed';
        description = 'Failed to deliver';
        break;
    }

    const baseSentDeliveredColor =
      variant === 'bubble_green' || variant === 'image_overlay'
        ? 'text-white/80'
        : variant === 'bubble_footer'
        ? 'text-slate-400 dark:text-slate-400'
        : 'text-slate-400';

    const readColor =
      variant === 'bubble_green'
        ? 'text-sky-200 drop-shadow-[0_0_4px_rgba(56,189,248,0.45)]'
        : variant === 'image_overlay'
        ? 'text-sky-300 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]'
        : variant === 'bubble_footer'
        ? 'text-sky-400 font-bold drop-shadow-[0_0_4px_rgba(56,189,248,0.35)]'
        : 'text-sky-500 dark:text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.35)]';

    const activeTickColor = currentStatus === 'read' ? readColor : baseSentDeliveredColor;
    const isDoubleTick = currentStatus === 'delivered' || currentStatus === 'read';

    return (
      <button
        type="button"
        id={messageId ? `status-indicator-${messageId}` : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (messageId) {
            handleCycleStatus(messageId, currentStatus);
          }
        }}
        title={`${label}: ${description}. Tap to cycle status`}
        className="inline-flex items-center gap-0.5 group/tick hover:opacity-100 transition-all duration-300 active:scale-90 cursor-pointer p-0.5 -m-0.5 rounded"
      >
        {currentStatus === 'failed' ? (
          <AlertCircle
            className={`w-3.5 h-3.5 stroke-[2.4] transition-colors duration-500 ease-in-out ${
              variant === 'bubble_green' || variant === 'image_overlay'
                ? 'text-rose-200'
                : 'text-rose-500'
            }`}
          />
        ) : (
          <span
            className={`relative inline-flex items-center justify-center w-4 h-3.5 transition-all duration-500 ease-out ${activeTickColor} ${
              currentStatus === 'read' ? 'scale-105' : 'scale-100'
            }`}
          >
            {/* Single Checkmark (smoothly fades out as Double Checkmark fades & slides in) */}
            <Check
              className={`w-3.5 h-3.5 stroke-[2.3] transition-all duration-500 ease-in-out ${
                isDoubleTick
                  ? 'opacity-0 scale-75 -translate-x-0.5 pointer-events-none'
                  : 'opacity-100 scale-100 translate-x-0'
              }`}
            />
            {/* Double Checkmark (smoothly transitions from sent -> delivered -> read blue color) */}
            <CheckCheck
              className={`absolute inset-0 w-3.5 h-3.5 m-auto transition-all duration-500 ease-in-out ${
                currentStatus === 'read' ? 'stroke-[2.6]' : 'stroke-[2.2]'
              } ${
                isDoubleTick
                  ? 'opacity-100 scale-100 translate-x-0'
                  : 'opacity-0 scale-75 translate-x-0.5 pointer-events-none'
              }`}
            />
          </span>
        )}
      </button>
    );
  };

  // Resolve human-readable Date Header for any message to group messages chronologically
  const getMessageDateHeaderLabel = (
    msg: ChatMessage,
    index: number,
    totalCount: number
  ): string => {
    if (msg.dateLabel && msg.dateLabel.trim()) {
      return msg.dateLabel.trim();
    }
    const rawTs = (msg.timestamp || '').trim();
    if (rawTs.includes(',')) {
      const prefix = rawTs.split(',')[0].trim();
      if (prefix) return prefix;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(rawTs)) {
      const parsed = new Date(rawTs);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    }
    if (rawTs.toLowerCase() === 'just now') {
      return 'Today';
    }
    if (
      msg.id.startsWith('msg-reply-') ||
      msg.id.startsWith('fwd-') ||
      msg.id.startsWith('note-') ||
      /^msg-\d+$/.test(msg.id)
    ) {
      return 'Today';
    }
    if (totalCount >= 5) {
      if (index < 2) return 'October 3, 2026';
      if (index < 4) return 'Yesterday';
      return 'Today';
    }
    if (totalCount >= 3 && index < Math.floor(totalCount / 2)) {
      return 'Yesterday';
    }
    return 'Today';
  };

  // Filter messages based on keyword search and deleted state
  const filteredMessages = messages.filter((msg) => {
    if (deletedMessageIds.has(msg.id)) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const textMatch = msg.text?.toLowerCase().includes(query);
    const translationMatch =
      msg.translation?.translated?.toLowerCase().includes(query) ||
      msg.translation?.original?.toLowerCase().includes(query);
    const typeMatch =
      (msg.type === 'audio' && 'audio voice note speech'.includes(query)) ||
      (msg.type === 'image' && 'image photo picture video media'.includes(query));
    return Boolean(textMatch || translationMatch || typeMatch);
  });

  // Helper to highlight matching keywords within text
  const highlightMatch = (text?: string, query?: string) => {
    if (!text) return '';
    if (!query?.trim()) return text;
    const safePattern = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safePattern})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase().trim() ? (
            <mark
              key={index}
              className="bg-amber-300 text-slate-900 rounded-xs px-0.5 font-bold dark:bg-amber-400"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Auto-scroll to bottom of messages when not searching
  useEffect(() => {
    if (!searchQuery.trim()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, searchQuery]);

  // Audio player simulation timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 4;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  // Voice recording simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecordingVoice) {
      timer = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBlocked) {
      setBlockFeedback(`Cannot send: ${contact.name} is blocked.`);
      setTimeout(() => setBlockFeedback(null), 2500);
      return;
    }
    if (!inputText.trim()) return;
    const rawText = inputText.trim();
    const text = isAiVoiceBoxActive
      ? `🎙️ [AI Voice • ${selectedAiVoiceName}]: ${rawText}`
      : rawText;
    onSendMessage(text, 'text');
    setInputText('');
    if (localUserTypingIdleTimerRef.current) {
      clearTimeout(localUserTypingIdleTimerRef.current);
    }
    syncTypingIndicatorToDb(contact.id, {
      isUserTyping: false,
    }).catch(() => {});
    if (isAiVoiceBoxActive) {
      playBrowserSpeechFallback(rawText, () => {});
    }

    // Trigger typing indicator for contact only if not blocked (and sync to Firestore)
    if (!isBlocked) {
      setInternalTyping(true);
      if (onSetContactTyping) {
        onSetContactTyping(true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setInternalTyping(false);
        if (onSetContactTyping) {
          onSetContactTyping(false);
        }
      }, 2400);
    }
  };

  const handleSendVoiceNote = () => {
    setIsRecordingVoice(false);
    if (isBlocked) {
      setBlockFeedback(`Cannot send audio: ${contact.name} is blocked.`);
      setTimeout(() => setBlockFeedback(null), 2500);
      return;
    }
    const durationStr = recordSeconds > 0 ? formatAudioTime(recordSeconds) : '0:18';
    onSendMessage(durationStr, 'audio');
  };

  const handleSendSticker = (sticker: StickerItem) => {
    if (isBlocked) {
      setBlockFeedback(`Cannot send sticker: ${contact.name} is blocked.`);
      setTimeout(() => setBlockFeedback(null), 2500);
      return;
    }
    onSendMessage(sticker.emoji, 'sticker', undefined, {
      id: sticker.id,
      name: sticker.name,
      category: sticker.category,
    });
    setReactionFeedback(`Sent ${sticker.name} sticker! ✨`);
    setTimeout(() => setReactionFeedback(null), 2000);
  };

  // Auto-scroll when typing indicator appears
  useEffect(() => {
    if (internalTyping || isContactTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [internalTyping, isContactTyping]);

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#12161F] text-white' : 'bg-white text-slate-900'
      }`}
    >
      {/* Top Header matching screenshot */}
      <div
        className="text-white pt-1 pb-3 px-4 shadow-sm z-20 transition-colors"
        style={{ backgroundColor: primaryColor || '#7C3AED' }}
      >
        {/* Status Bar with Notch */}
        <StatusBar time="1:39" theme="green" className="px-1 -mx-2" showNotch={true} />

        {/* Contact Info & Call actions matching screenshot */}
        <div className="flex items-center justify-between mt-2">
          {/* Left Side: Back button and User Profile Gate */}
          <div className="flex items-center gap-2.5 overflow-hidden">
            <button
              id="chat-back-btn"
              onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Back to conversations"
            >
              <ChevronLeft className="w-6 h-6 text-white stroke-[2.5]" />
            </button>

            {/* Clickable Profile / Group Header Card */}
            <div
              id="chat-header-user-profile-btn"
              onClick={() => {
                if (isGroupChat) {
                  setIsGroupMembersModalOpen(true);
                } else {
                  setSelectedProfileContact(contact);
                  setIsUserProfileModalOpen(true);
                }
              }}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-95 transition-opacity overflow-hidden select-none"
              title={
                isGroupChat
                  ? `View ${contact.name} group participants (${groupParticipants.length} members)`
                  : `View ${contact.name}'s Profile, Bio & Media Gallery`
              }
            >
              <div className="relative shrink-0">
                <img
                  src={getPersistentUserThumbnail(contact, false)}
                  alt={contact.name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shadow-sm"
                />
                {isBlocked ? (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 rounded-full flex items-center justify-center text-white ring-2 ring-white/60 shadow-xs"
                    title="Blocked in Database"
                  >
                    <Ban className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : isChannelChat ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center ring-2 ring-white/80 shadow-xs"
                    title="Broadcast Channel"
                  >
                    <Megaphone className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                ) : isGroupChat ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center ring-2 ring-white/80 shadow-xs"
                    title={`${groupParticipants.length} group participants`}
                  >
                    <Users className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                ) : contact.online ? (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-300 border-2 border-emerald-600 rounded-full" />
                ) : null}
              </div>

              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold tracking-tight text-white leading-tight truncate">
                    {contact.name}
                  </h2>
                  {isAccountProfileValidated(contact) && (
                    <VerifiedCheckmarkBadge
                      id="chat-header-verified-badge"
                      variant="header"
                      size="md"
                      title={`${contact.name} • Account Profile Validation Completed (Verified Account)`}
                    />
                  )}
                  {isChannelChat && (
                    <span className="text-[9px] bg-white/25 text-white font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                      <Megaphone className="w-2.5 h-2.5" />
                      <span>CHANNEL</span>
                    </span>
                  )}
                  {isGroupChat && (
                    <span className="text-[9px] bg-white/25 text-white font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      <span>{groupParticipants.length}</span>
                    </span>
                  )}
                  {isBlocked && (
                    <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                      Blocked
                    </span>
                  )}
                </div>
                {isBlocked ? (
                  <p className="text-[10px] text-rose-200 font-bold flex items-center gap-1 bg-rose-500/30 px-1.5 py-0.2 rounded-md w-fit mt-0.5">
                    <Ban className="w-2.5 h-2.5 stroke-[2.5]" />
                    <span>Blocked in DB</span>
                  </p>
                ) : isContactTyping || internalTyping ? (
                  <p className="text-[11px] text-emerald-200 font-bold animate-pulse flex items-center gap-1">
                    <span>
                      {isGroupChat
                        ? `${groupParticipants[0]?.name.split(' ')[0] || 'Member'} is typing`
                        : 'typing'}
                    </span>
                    <span className="inline-block animate-bounce [animation-delay:-0.3s]">.</span>
                    <span className="inline-block animate-bounce [animation-delay:-0.15s]">.</span>
                    <span className="inline-block animate-bounce">.</span>
                  </p>
                ) : isGroupChat ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex -space-x-1.5 shrink-0">
                      {groupParticipants.slice(0, 4).map((p) => (
                        <img
                          key={p.id}
                          src={p.avatar}
                          alt={p.name}
                          className="w-4 h-4 rounded-full object-cover ring-1 ring-white/80"
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-white/90 font-medium truncate">
                      {groupParticipants.length} members •{' '}
                      {groupParticipants.filter((p) => p.online !== false).length} online
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-white/90 font-medium truncate">
                    {contact.statusText || 'Active 3m ago'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Audio Call, Video Call & Message Sidebar Menu icons matching screenshot */}
          <div className="flex items-center gap-2.5 shrink-0 pr-0.5">
            {/* Audio Call Button matching screenshot */}
            <button
              id="chat-call-audio-btn"
              type="button"
              onClick={() => {
                if (isBlocked) {
                  setBlockFeedback(`Cannot call: ${contact.name} is blocked.`);
                  setTimeout(() => setBlockFeedback(null), 2500);
                  return;
                }
                onStartCall('voice');
              }}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              title={isBlocked ? 'Contact is blocked' : 'Start voice audio call'}
            >
              <Phone className="w-4.5 h-4.5 text-white fill-white" />
            </button>

            {/* Video Call Button matching screenshot */}
            <button
              id="chat-call-video-btn"
              type="button"
              onClick={() => {
                if (isBlocked) {
                  setBlockFeedback(`Cannot video call: ${contact.name} is blocked.`);
                  setTimeout(() => setBlockFeedback(null), 2500);
                  return;
                }
                onStartCall('video');
              }}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              title={isBlocked ? 'Contact is blocked' : 'Start video call'}
            >
              <Video className="w-5 h-5 text-white fill-white" />
            </button>

            {/* More Options Message Sidebar Dropdown */}
            <div className="relative">
              <button
                id="chat-more-options-btn"
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="More options"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isMoreMenuOpen
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'bg-white/20 hover:bg-white/30 text-white active:scale-95'
                }`}
              >
                <MoreVertical className="w-4.5 h-4.5" />
              </button>

              {isMoreMenuOpen && (
                <div
                  className={`absolute right-0 top-12 w-64 rounded-2xl shadow-2xl py-2.5 z-50 border animate-in fade-in zoom-in-95 duration-100 ${
                    isDark
                      ? 'bg-[#1A202C] border-slate-700 text-white'
                      : 'bg-white border-slate-100 text-slate-900'
                  }`}
                >
                  <button
                    id="menu-toggle-search-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsSearchOpen(!isSearchOpen);
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Search in Conversation</span>
                  </button>

                  <button
                    id="menu-view-user-profile-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setSelectedProfileContact(contact);
                      setIsUserProfileModalOpen(true);
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {isGroupChat ? (
                      <>
                        <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Profile</span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Profile</span>
                      </>
                    )}
                  </button>

                  {isGroupChat ? (
                    <button
                      id="menu-join-group-btn"
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        handleJoinGroupAction();
                      }}
                      className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        hasJoinedGroup
                          ? 'text-emerald-500 dark:text-emerald-400'
                          : isDark
                          ? 'text-slate-100'
                          : 'text-slate-900'
                      }`}
                    >
                      <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{hasJoinedGroup ? 'Joined Group ✓' : 'Join Group'}</span>
                    </button>
                  ) : (
                    <button
                      id="menu-open-friendship-modal-btn"
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsFriendshipModalOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      <Handshake className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Friends</span>
                    </button>
                  )}

                  {!isGroupChat && (
                    <button
                      id="menu-open-media-gallery-btn"
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsMediaGalleryOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      <Images className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Media</span>
                    </button>
                  )}

                  <button
                    id="menu-open-ai-voice-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsAiVoiceBoxActive((prev) => {
                        const next = !prev;
                        setReactionFeedback(
                          next
                            ? `🎙️ AI Germain enabled (${selectedAiVoiceName})`
                            : 'AI Germain hidden'
                        );
                        setTimeout(() => setReactionFeedback(null), 2400);
                        return next;
                      });
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isAiVoiceBoxActive
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : isDark
                        ? 'text-slate-100'
                        : 'text-slate-900'
                    }`}
                  >
                    <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>AI Germain</span>
                  </button>

                  <button
                    id="menu-toggle-video-autoplay-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      const nextVal = !autoPlayChatVideos;
                      setAutoPlayChatVideos(nextVal);
                      setAutoPlayChatVideosSetting(nextVal);
                      setReactionFeedback(
                        nextVal
                          ? '🎬 Video auto Play :on'
                          : '🔋 Video auto Play :off'
                      );
                      setTimeout(() => setReactionFeedback(null), 2600);
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      autoPlayChatVideos
                        ? 'text-purple-500 dark:text-purple-400'
                        : isDark
                        ? 'text-slate-100'
                        : 'text-slate-900'
                    }`}
                  >
                    {autoPlayChatVideos ? (
                      <Video className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>
                      {autoPlayChatVideos
                        ? 'Video auto Play :on'
                        : 'Video auto Play :off'}
                    </span>
                  </button>

                  <a
                    id="menu-wallpaper-sidebar-link"
                    href="#wallpaper"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMoreMenuOpen(false);
                      wallpaperFileInputRef.current?.click();
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold block hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    wallpaper
                  </a>

                  {isGroupChat && (
                    <button
                      id="menu-schedule-group-video-call-btn"
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsGroupCallSchedulerOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Schedule Group Video Call</span>
                    </button>
                  )}

                  {onOpenImportWhatsApp && (
                    <button
                      id="menu-import-whatsapp-btn"
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenImportWhatsApp();
                      }}
                      className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Import WhatsApp Messages</span>
                    </button>
                  )}

                  <button
                    id="menu-toggle-translate-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setShowTranslateMode(!showTranslateMode);
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {showTranslateMode
                        ? 'Hide Translation'
                        : `Translate (${contact.nativeLanguage || 'French'})`}
                    </span>
                  </button>

                  <button
                    id="menu-toggle-lock-contributions-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      openPinLockPrompt();
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isUserContributionsLocked
                        ? 'text-amber-500 dark:text-amber-400'
                        : isDark
                        ? 'text-slate-100'
                        : 'text-slate-900'
                    }`}
                  >
                    {isUserContributionsLocked ? (
                      <>
                        <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Unlock with a Pin</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Lock with a Pin</span>
                      </>
                    )}
                  </button>

                  {isGroupChat && (
                    <button
                      id="menu-open-group-members-btn"
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsGroupMembersModalOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Group Participants ({groupParticipants.length})</span>
                    </button>
                  )}

                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    id="menu-toggle-block-btn"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      if (isBlocked) {
                        handleToggleBlock(false);
                      } else {
                        setIsBlockModalOpen(true);
                      }
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      isBlocked
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400'
                    }`}
                  >
                    {isBlocked ? (
                      <>
                        <Unlock className="w-4 h-4 shrink-0" />
                        <span>Unblock {contact.name}</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4 shrink-0" />
                        <span>Block User</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expandable keyword search bar in header */}
        {isSearchOpen && (
          <div className="mt-2.5 pt-1">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-white/75 absolute left-3 pointer-events-none" />
              <input
                id="chat-search-messages-input"
                type="text"
                placeholder="Filter messages by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full py-1.5 pl-8.5 pr-20 bg-white/20 placeholder-white/70 text-white text-xs font-medium rounded-xl outline-none focus:ring-2 focus:ring-white/50 transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery.trim() && (
                  <>
                    <span className="text-white/90 font-bold text-[10px] bg-black/20 px-1.5 py-0.5 rounded-md">
                      {filteredMessages.length} {filteredMessages.length === 1 ? 'match' : 'matches'}
                    </span>
                    <button
                      id="clear-chat-search-btn"
                      onClick={() => setSearchQuery('')}
                      className="text-white/80 hover:text-white p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Read status indicator guide banner */}
        {showStatusLegend && (
          <div className="mt-2.5 py-2 px-3 bg-black/40 backdrop-blur-md rounded-xl text-white text-[11px] flex items-center justify-between gap-2 border border-white/15 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5 text-white/80 stroke-[2.3]" />
                <span>Sent</span>
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <CheckCheck className="w-3.5 h-3.5 text-white/80 stroke-[2.2]" />
                <span>Delivered</span>
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-sky-200">
                <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.6]" />
                <span>Read</span>
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-rose-200">
                <AlertCircle className="w-3.5 h-3.5 text-rose-300 stroke-[2.4]" />
                <span>Failed</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-200 font-medium hidden sm:inline">Long-press message to react</span>
              <span className="text-[10px] text-white/70 shrink-0">Tap tick to cycle</span>
            </div>
          </div>
        )}

        {/* Temporary toast when status is cycled */}
        {statusFeedback && (
          <div className="mt-2 py-1 px-2.5 bg-emerald-900/90 text-white rounded-lg text-xs font-semibold text-center shadow-lg border border-emerald-400/40 animate-in fade-in duration-150">
            {statusFeedback}
          </div>
        )}

        {/* Temporary toast when reaction is added or removed */}
        {reactionFeedback && (
          <div className="mt-2 py-1 px-3 bg-slate-900/95 text-emerald-400 rounded-lg text-xs font-bold text-center shadow-xl border border-emerald-500/40 animate-in fade-in zoom-in-95 duration-150 flex items-center justify-center gap-2 mx-auto w-fit">
            <span>{reactionFeedback}</span>
            {lastDeletedMessage && reactionFeedback.includes('deleted') && (
              <button
                type="button"
                onClick={handleUndoDeleteMessage}
                className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-extrabold hover:bg-emerald-400 cursor-pointer"
              >
                Undo
              </button>
            )}
          </div>
        )}

        {/* Temporary toast when contact is blocked / unblocked */}
        {blockFeedback && (
          <div className="mt-2 py-1.5 px-3.5 bg-slate-900/95 text-white rounded-xl text-xs font-bold text-center shadow-xl border border-rose-500/40 animate-in fade-in zoom-in-95 duration-150 flex items-center justify-center gap-2 mx-auto w-fit">
            <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{blockFeedback}</span>
          </div>
        )}
      </div>

      {/* Channel Broadcast Bar (shown for Channel Entities) */}
      {isChannelChat && (
        <div
          id="channel-broadcast-info-bar"
          className={`px-3 py-2 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark
              ? 'bg-[#161B26] border-slate-800 text-slate-200'
              : 'bg-slate-50 border-slate-200/80 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            >
              <Megaphone className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">
                  {contact.channelHandle || `@${contact.name.toLowerCase().replace(/\s+/g, '_')}`}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">
                  {contact.channelCategory || 'Broadcast'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {contact.channelDescription || `${channelSubscribersCount} subscribers • Official Channel`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="channel-bar-create-live-btn"
              type="button"
              onClick={() => {
                setNewLiveStreamMode('live');
                setNewLiveCameraOn(true);
                setNewLiveMicOn(true);
                setNewLiveStreamTitle('live');
                setShowCreateLiveModal(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-[#E1306C] hover:brightness-110 text-white text-[10px] font-extrabold shrink-0 flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
              title="Create Live Stream in Channel"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>+ Live</span>
            </button>
            <button
              id="channel-bar-create-podcast-btn"
              type="button"
              onClick={() => {
                setNewLiveStreamMode('podcast');
                setNewLiveCameraOn(false);
                setNewLiveMicOn(true);
                setNewLiveStreamTitle('Live Podcast');
                setShowCreateLiveModal(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-extrabold shrink-0 flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
              title="Create Live Podcast in Channel"
            >
              <Headphones className="w-3 h-3" />
              <span>+ Podcast</span>
            </button>
            <button
              id="channel-bar-subscribe-toggle-btn"
              type="button"
              onClick={handleToggleChannelSubscribe}
              style={isSubscribedToChannel ? undefined : { backgroundColor: primaryColor }}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-all ${
                isSubscribedToChannel
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'text-white shadow-xs hover:brightness-110 active:scale-95'
              }`}
              title={isSubscribedToChannel ? 'Subscribed — click to unsubscribe' : 'Subscribe to this channel'}
            >
              {isSubscribedToChannel ? (
                <>
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Subscribed ({channelSubscribersCount})</span>
                </>
              ) : (
                <>
                  <Megaphone className="w-3 h-3" />
                  <span>Subscribe to channel</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Group Participants Bar (shown for Group Entities) */}
      {isGroupChat && (
        <div
          id="group-participants-bar"
          className={`px-3 py-2 border-b flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 ${
            isDark
              ? 'bg-[#161B26] border-slate-800 text-slate-200'
              : 'bg-slate-50 border-slate-200/80 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {groupParticipants.map((participant) => {
              const isMeParticipant = participant.id === 'me';
              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => {
                    if (!isMeParticipant && onSimulateParticipantMessage) {
                      onSimulateParticipantMessage(participant);
                    } else {
                      setIsGroupMembersModalOpen(true);
                    }
                  }}
                  title={
                    isMeParticipant
                      ? `${participant.name} (${participant.nativeLanguage || userMotherLanguage})`
                      : `Click to simulate message from ${participant.name} (${participant.nativeLanguage || 'English'})`
                  }
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold shrink-0 border transition-all cursor-pointer active:scale-95 ${
                    isDark
                      ? 'bg-[#1F2635] border-slate-700/80 hover:border-purple-400/60 text-slate-200'
                      : 'bg-white border-slate-200 hover:border-purple-400 text-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={participant.avatar}
                      alt={participant.name}
                      style={{ width: '25px', height: '25px' }}
                      className="w-[25px] h-[25px] rounded-full object-cover"
                    />
                    {participant.online !== false && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
                    )}
                  </div>
                  <span className="truncate max-w-[76px]">{participant.name.split(' ')[0]}</span>
                  {isAccountProfileValidated(participant) && (
                    <VerifiedCheckmarkBadge
                      size="xs"
                      title={`${participant.name} • Verified Account`}
                    />
                  )}
                  <span
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                    }}
                    className="text-[9px] font-bold px-1.5 py-0.2 rounded-full"
                  >
                    {(participant.nativeLanguage || 'EN').slice(0, 2).toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="group-bar-schedule-video-call-btn"
              type="button"
              onClick={() => setIsGroupCallSchedulerOpen(true)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-all active:scale-95 border ${
                isDark
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Propose a calendar date & time for a Group Video Call"
            >
              <Calendar className="w-3 h-3" />
              <span>Schedule Video Call</span>
            </button>

            <button
              id="bar-join-group-btn"
              type="button"
              onClick={handleJoinGroupAction}
              style={
                hasJoinedGroup
                  ? undefined
                  : { backgroundColor: primaryColor, color: '#ffffff' }
              }
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                hasJoinedGroup
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : 'shadow-xs hover:brightness-110'
              }`}
            >
              {hasJoinedGroup ? (
                <>
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Joined Group</span>
                </>
              ) : (
                <>
                  <Users className="w-3 h-3" />
                  <span>Join Group</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Scheduled Group Video Call Banner (shown when a group call is scheduled) */}
      {isGroupChat && scheduledGroupCalls.length > 0 && (() => {
        const nextCall = scheduledGroupCalls[0];
        const myRsvp = nextCall.rsvps?.me || 'going';
        const goingCount = Object.values(nextCall.rsvps || {}).filter((v) => v === 'going').length;
        return (
          <div
            id="scheduled-group-video-call-banner"
            className={`px-3 py-2 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark
                ? 'bg-[#17212B] border-emerald-500/30 text-slate-100'
                : 'bg-emerald-50/80 border-emerald-200 text-slate-800'
            }`}
          >
            <div
              onClick={() => setIsGroupCallSchedulerOpen(true)}
              className="flex items-center gap-2 min-w-0 cursor-pointer"
            >
              <div
                style={{ backgroundColor: primaryColor }}
                className="w-7 h-7 rounded-xl text-white flex items-center justify-center shrink-0 shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-extrabold truncate">{nextCall.title}</span>
                  <span className="text-[9px] font-bold text-emerald-500 shrink-0">
                    · {goingCount} Going
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {formatReadableCallDate(nextCall.dateIso, nextCall.timeSlot)} ({nextCall.durationMinutes}m)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleUpdateGroupCallRsvp(
                    nextCall.id,
                    myRsvp === 'going' ? 'maybe' : 'going'
                  )
                }
                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  myRsvp === 'going'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
                title="Click to toggle RSVP"
              >
                {myRsvp === 'going' ? '✓ Going' : 'Maybe'}
              </button>
              <button
                id="banner-start-scheduled-group-call-btn"
                type="button"
                onClick={() => onStartCall('video')}
                style={{ backgroundColor: primaryColor }}
                className="px-2.5 py-1 rounded-lg text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                title="Start Group Video Call now"
              >
                <Video className="w-3 h-3" />
                <span>Join Call</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Translation banner if active */}
      {showTranslateMode && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>
              Live Freedom Translation: <strong>{contact.nativeLanguage || 'Spanish'}</strong> ↔{' '}
              <strong>{userMotherLanguage}</strong>
            </span>
          </div>
          <button
            onClick={() => setShowTranslateMode(false)}
            className="text-[11px] font-semibold underline hover:opacity-80"
          >
            Hide
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div
        id="chat-messages-stream-container"
        className={`flex-1 relative overflow-hidden flex flex-col transition-colors duration-200 ${
          isDark ? 'bg-[#0F141C]' : 'bg-[#F4F5F7]'
        }`}
      >
        {chatWallpaperUrl && (
          <div
            id="chat-custom-wallpaper-bg"
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={chatWallpaperUrl}
              alt="Message Wallpaper"
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 ${isDark ? 'bg-black/30' : 'bg-black/10'}`} />
          </div>
        )}

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
          {/* Locked User Contributions In-Stream Banner */}
          {isUserContributionsLocked && (
            <div
              id="chat-in-stream-locked-contributions-banner"
              className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-2.5 text-xs animate-in fade-in mb-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-500">
                  <Lock className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                    Locked with a Pin
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Message edits, forwarding, and external participant contributions are PIN-protected.
                  </p>
                </div>
              </div>
              <button
                id="stream-unlock-contributions-btn"
                type="button"
                onClick={() => openPinLockPrompt()}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1"
              >
                <Unlock className="w-3 h-3" />
                <span>Unlock with a Pin</span>
              </button>
            </div>
          )}

          {/* Blocked Contact In-Stream Alert Banner */}
        {isBlocked && (
          <div
            id="chat-in-stream-blocked-banner"
            className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-3 text-xs animate-in fade-in mb-3"
          >
            <div className="flex items-center gap-2.5 text-rose-400 min-w-0">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Ban className="w-4 h-4 text-rose-400 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-rose-500 dark:text-rose-400 text-xs">
                  {contact.name} is blocked
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Status set to <span className="font-semibold text-rose-400">'blocked'</span> in database. Messages prevented.
                </p>
              </div>
            </div>
            <button
              id="stream-unblock-btn"
              type="button"
              onClick={() => handleToggleBlock(false)}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unblock</span>
            </button>
          </div>
        )}

        {/* Active search filter status indicator */}
        {searchQuery.trim() && (
          <div className="flex items-center justify-between text-[11px] font-medium px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-300 mb-2 shadow-xs">
            <div className="flex items-center gap-1.5 truncate mr-2">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Showing messages matching "<strong>{searchQuery}</strong>" (
                {filteredMessages.length} {filteredMessages.length === 1 ? 'result' : 'results'})
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="font-bold underline hover:opacity-80 shrink-0 cursor-pointer text-[10px]"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Empty state when keyword query has 0 matches */}
        {searchQuery.trim() && filteredMessages.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
            <div className="w-12 h-12 rounded-full bg-slate-800/40 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
              <Search className="w-6 h-6 stroke-[1.8]" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              No messages found matching "{searchQuery}"
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
              Check your spelling or try searching for a different keyword.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 cursor-pointer shadow-xs transition-colors"
            >
              Reset Search
            </button>
          </div>
        ) : (
          filteredMessages.map((msg, msgIndex) => {
            const isMe = msg.senderId === 'me';
            const isDraggingMsg = activeDraggingMsgId === msg.id;
            const currentMsgOffset = isDraggingMsg ? msgDragOffset : 0;
            const currentDateHeader = getMessageDateHeaderLabel(
              msg,
              msgIndex,
              filteredMessages.length
            );
            const prevDateHeader =
              msgIndex > 0
                ? getMessageDateHeaderLabel(
                    filteredMessages[msgIndex - 1],
                    msgIndex - 1,
                    filteredMessages.length
                  )
                : null;
            const showDateHeader = msgIndex === 0 || currentDateHeader !== prevDateHeader;

            return (
              <React.Fragment key={msg.id}>
                {showDateHeader && (
                  <div
                    id={`chat-date-header-${currentDateHeader
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')}`}
                    data-date-header={currentDateHeader}
                    className="flex items-center justify-center my-3 select-none"
                  >
                    <div
                      className={`px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-xs border backdrop-blur-md flex items-center gap-1.5 ${
                        isDark
                          ? 'bg-slate-800/90 text-slate-300 border-slate-700/80'
                          : 'bg-white/95 text-slate-600 border-slate-200/90'
                      }`}
                    >
                      <Calendar
                        className="w-3 h-3 opacity-80 shrink-0"
                        style={{ color: primaryColor }}
                      />
                      <span>{currentDateHeader}</span>
                    </div>
                  </div>
                )}

              <div
                id={`msg-${msg.id}`}
                style={{
                  transform: currentMsgOffset ? `translateX(${currentMsgOffset}px)` : undefined,
                  transition: isDraggingMsg ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
                className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {/* Other party avatar - click to visit profile */}
                {!isMe && (
                  <div
                    onClick={() => {
                      const matchedContact = contacts.find(
                        (c) =>
                          c.id === msg.senderParticipantId ||
                          c.name.toLowerCase() === (msg.senderName || '').toLowerCase()
                      );
                      setSelectedProfileContact(matchedContact || contact);
                      setIsUserProfileModalOpen(true);
                    }}
                    className="shrink-0 mb-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    title={`Visit ${msg.senderName || contact.name}'s profile & media gallery`}
                  >
                    <img
                      src={getPersistentUserThumbnail(
                        {
                          id: msg.senderParticipantId || contact.id,
                          name: msg.senderName || contact.name,
                          avatar: msg.senderAvatar || contact.avatar,
                        },
                        false
                      )}
                      alt={msg.senderName || contact.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-700 hover:border-emerald-400 shadow-xs"
                    />
                  </div>
                )}

                {/* Message Content Container */}
                <div className="max-w-[78%] flex flex-col gap-1">
                  {/* Group Participant Sender Name & Native Language Label */}
                  {isGroupChat && !isMe && (
                    <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold">
                      <span style={{ color: primaryColor }} className="truncate">
                        {msg.senderName || 'Group Member'}
                      </span>
                      {(msg.senderLanguage || msg.translation?.language) && (
                        <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-semibold flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5 opacity-75" />
                          <span>{msg.senderLanguage || msg.translation?.language}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bubble Row with desktop quick reaction trigger */}
                  <div
                    className={`relative group/msg flex items-center gap-1.5 ${
                      isMe ? 'flex-row-reverse self-end' : 'flex-row self-start'
                    }`}
                  >
                    {/* The message bubble wrapper with long press handlers */}
                    <div
                      id={`msg-bubble-target-${msg.id}`}
                      className={`relative transition-all duration-200 ${
                        highlightedMessageId === msg.id
                          ? 'z-40 scale-[1.03] ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900 rounded-2xl shadow-2xl animate-pulse'
                          : selectedMessageForReaction === msg.id
                          ? 'z-40 scale-[1.02] ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 rounded-2xl shadow-xl'
                          : ''
                      }`}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        msgSwipeHorizontalRef.current = false;
                        if (swipedMessageId && swipedMessageId !== msg.id) {
                          setSwipedMessageId(null);
                        }
                        handleStartPress(msg.id, touch.clientX, touch.clientY, e.currentTarget);
                      }}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        handleCheckMove(touch.clientX, touch.clientY, msg);
                      }}
                      onTouchEnd={() => handleFinishMsgSwipe(msg)}
                      onTouchCancel={handleCancelPress}
                      onMouseDown={(e) => {
                        if (e.button === 0) {
                          msgMouseDownRef.current = true;
                          msgSwipeHorizontalRef.current = false;
                          if (swipedMessageId && swipedMessageId !== msg.id) {
                            setSwipedMessageId(null);
                          }
                          handleStartPress(msg.id, e.clientX, e.clientY, e.currentTarget);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (msgMouseDownRef.current) {
                          handleCheckMove(e.clientX, e.clientY, msg);
                        } else {
                          handleCheckMove(e.clientX, e.clientY);
                        }
                      }}
                      onMouseUp={() => handleFinishMsgSwipe(msg)}
                      onMouseLeave={() => {
                        msgMouseDownRef.current = false;
                        handleCancelPress();
                        if (activeDraggingMsgId === msg.id) {
                          setActiveDraggingMsgId(null);
                          setMsgDragOffset(0);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleCancelPress();
                        if (selectedMessageForReaction === msg.id) {
                          setSelectedMessageForReaction(null);
                          setShowExtendedReactions(false);
                        } else {
                          setSelectedMessageForReaction(msg.id);
                          setShowExtendedReactions(false);
                        }
                      }}
                    >
                      {/* Pop-up Long-Press Context Menu anchored to this message */}
                      {selectedMessageForReaction === msg.id && (
                        <div
                          id={`reaction-popup-${msg.id}`}
                          className={`absolute z-50 ${
                            reactionMenuPosition === 'above' ? '-top-32 sm:-top-36' : '-bottom-32 sm:-bottom-36'
                          } ${
                            isMe ? 'right-0' : 'left-0'
                          } flex flex-col p-1.5 rounded-2xl bg-slate-900/95 dark:bg-[#18202c]/95 backdrop-blur-md border border-slate-700/80 shadow-2xl animate-in zoom-in-90 fade-in duration-150 select-none min-w-[210px]`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Quick Emoji Reactions row */}
                          <div className="flex items-center gap-1 pb-1.5 border-b border-slate-700/60">
                            {QUICK_REACTION_EMOJIS.slice(0, 6).map((emoji) => {
                              const isSelected = msg.reactions?.some(
                                (r) => r.emoji === emoji && r.userReacted
                              );
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  id={`react-btn-${emoji}-${msg.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectReactionEmoji(msg.id, emoji);
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-base sm:text-lg hover:scale-135 active:scale-95 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-500/30 ring-2 ring-emerald-400 scale-110'
                                      : 'hover:bg-white/10'
                                  }`}
                                  title={`React ${emoji}`}
                                >
                                  <span className="leading-none select-none">{emoji}</span>
                                </button>
                              );
                            })}

                            {/* Plus button to show extra emojis */}
                            <button
                              type="button"
                              id={`react-more-btn-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowExtendedReactions(!showExtendedReactions);
                              }}
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer ${
                                showExtendedReactions ? 'bg-white/20 text-white' : 'hover:bg-white/10'
                              }`}
                              title="More emojis"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Extended emoji picker grid */}
                          {showExtendedReactions && (
                            <div
                              id={`reaction-extended-panel-${msg.id}`}
                              className="p-1.5 my-1 rounded-xl bg-slate-950/90 border border-slate-700/60 grid grid-cols-7 gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {EXTENDED_REACTION_EMOJIS.map((emoji) => {
                                const isSelected = msg.reactions?.some(
                                  (r) => r.emoji === emoji && r.userReacted
                                );
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectReactionEmoji(msg.id, emoji);
                                    }}
                                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs hover:scale-125 transition-transform hover:bg-white/10 cursor-pointer ${
                                      isSelected ? 'bg-emerald-500/30' : ''
                                    }`}
                                  >
                                    <span className="leading-none select-none">{emoji}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Action Items: Forward, Copy, Reply, Star */}
                          <div className="flex flex-col gap-0.5 pt-1 text-xs text-slate-200">
                            {/* Forward Action */}
                            <button
                              type="button"
                              id={`context-forward-btn-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessageForReaction(null);
                                setForwardingMessage(msg);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-400 text-left cursor-pointer transition-colors"
                            >
                              <Forward className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="font-semibold">Forward to Contacts</span>
                            </button>

                            {/* Copy Text */}
                            {msg.text && (
                              <button
                                type="button"
                                id={`context-copy-btn-${msg.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(msg.text || '');
                                  setReactionFeedback('Copied text to clipboard');
                                  setTimeout(() => setReactionFeedback(null), 2000);
                                  setSelectedMessageForReaction(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left cursor-pointer transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Text</span>
                              </button>
                            )}

                            {/* Reply */}
                            <button
                              type="button"
                              id={`context-reply-btn-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInputText(`> ${msg.text ? msg.text.slice(0, 30) : 'Attachment'}\n`);
                                setSelectedMessageForReaction(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left cursor-pointer transition-colors"
                            >
                              <Reply className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Reply</span>
                            </button>

                            {/* Star Message */}
                            <button
                              type="button"
                              id={`context-star-btn-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onToggleFavoriteMedia) {
                                  onToggleFavoriteMedia(msg.id, !msg.isFavorite);
                                }
                                setReactionFeedback(msg.isFavorite ? 'Removed from favorites' : 'Saved to favorites');
                                setTimeout(() => setReactionFeedback(null), 2000);
                                setSelectedMessageForReaction(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left cursor-pointer transition-colors"
                            >
                              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                              <span>{msg.isFavorite ? 'Starred' : 'Star Message'}</span>
                            </button>

                            {/* AI Voice Read-Aloud in Bubble Message Context Menu */}
                            {msg.text && (
                              <button
                                type="button"
                                id={`context-ai-voice-btn-${msg.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMessageForReaction(null);
                                  setIsAiVoiceBoxActive(true);
                                  handlePlayMessageAiVoice(msg);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 text-left cursor-pointer transition-colors"
                              >
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="font-semibold text-emerald-300">
                                  {aiVoiceSpeakingMsgId === msg.id
                                    ? 'Stop AI Voice'
                                    : `AI Voice (${selectedAiVoiceName})`}
                                </span>
                              </button>
                            )}

                            {/* Lock with a Pin in Bubble Message Context Menu */}
                            <button
                              type="button"
                              id={`context-lock-contribution-btn-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessageForReaction(null);
                                openPinLockPrompt(msg);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 text-left cursor-pointer transition-colors"
                            >
                              {isMessageContributionLocked(msg) ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="font-semibold text-amber-300">
                                    Unlock with a Pin
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="font-semibold text-amber-300">
                                    Lock with a Pin
                                  </span>
                                </>
                              )}
                            </button>

                            {/* Delete Message Action */}
                            <button
                              type="button"
                              id={`context-delete-msg-btn-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExecuteDeleteMessage(msg);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left cursor-pointer transition-colors border-t border-slate-700/50 mt-0.5 pt-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span className="font-semibold">Delete Message</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 1. Text Message (only if NOT a shared video URL message) */}
                      {(() => {
                        const detectedVideoForText = detectVideoPlatformFromText(
                          msg.originalVideoUrl || msg.videoUrl || msg.text || ''
                        );
                        const isVideoMessage =
                          msg.type === 'video' ||
                          Boolean(msg.videoUrl) ||
                          Boolean(msg.videoThumbnail) ||
                          Boolean(msg.videoPlatform) ||
                          Boolean(detectedVideoForText);

                        if (msg.type === 'text' && !isVideoMessage) {
                          return (
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-[13px] font-medium leading-relaxed shadow-xs ${
                                isMe
                                  ? 'bg-emerald-500 text-white rounded-br-xs'
                                  : isDark
                                  ? 'bg-[#222834] text-slate-100 rounded-bl-xs'
                                  : 'bg-emerald-500 text-white rounded-bl-xs'
                              }`}
                            >
                              {msg.isForwarded && (
                                <div className="flex items-center gap-1 text-[10px] text-emerald-100 font-semibold mb-1 italic opacity-95">
                                  <Forward className="w-3 h-3 stroke-[2.5]" />
                                  <span>Forwarded{msg.forwardedFrom ? ` from ${msg.forwardedFrom}` : ''}</span>
                                </div>
                              )}
                              {(isMessageContributionLocked(msg) || isUserContributionsLocked) && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPinLockPrompt(msg);
                                  }}
                                  className="flex items-center gap-1 text-[9px] font-bold bg-amber-400/25 text-amber-100 border border-amber-300/40 px-1.5 py-0.5 rounded-md mb-1 w-fit cursor-pointer"
                                  title="Message is Locked with a Pin (Tap to unlock/manage)"
                                >
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Locked with a Pin</span>
                                </div>
                              )}
                              {msg.isWhatsAppImported && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-100 bg-black/25 px-1.5 py-0.5 rounded-md mb-1.5 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                                  <span>WhatsApp Archive</span>
                                  {msg.whatsappSender && <span className="opacity-90">• {msg.whatsappSender}</span>}
                                </div>
                              )}
                              <span>{highlightMatch(stripVideoUrlsFromText(msg.text), searchQuery)}</span>

                              {/* Translation row if enabled */}
                              {showTranslateMode && msg.translation && (
                                <div className="mt-1.5 pt-1.5 border-t border-white/20 dark:border-slate-700/50 text-[11px] opacity-90 italic">
                                  <span>{highlightMatch(stripVideoUrlsFromText(msg.translation.translated), searchQuery)}</span>
                                </div>
                              )}

                              {/* Inline AI Voice in Message Control Bar inside Text Bubble */}
                              {(isAiVoiceBoxActive ||
                                aiVoiceSpeakingMsgId === msg.id ||
                                aiVoiceLoadingMsgId === msg.id) && (
                                <div className="mt-1.5 pt-1 border-t border-white/15 dark:border-slate-700/40 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    id={`bubble-ai-voice-btn-${msg.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePlayMessageAiVoice(msg);
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                                      aiVoiceSpeakingMsgId === msg.id
                                        ? 'bg-white text-emerald-700 shadow-xs'
                                        : 'bg-black/20 hover:bg-black/30 text-white/95'
                                    }`}
                                    title="Play message with Gemini AI Voice"
                                  >
                                    {aiVoiceLoadingMsgId === msg.id ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Generating AI Voice...</span>
                                      </>
                                    ) : aiVoiceSpeakingMsgId === msg.id ? (
                                      <>
                                        <VolumeX className="w-3 h-3" />
                                        <span>Speaking ({selectedAiVoiceName}) • Stop</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-3 h-3" />
                                        <span>AI Voice ({selectedAiVoiceName})</span>
                                      </>
                                    )}
                                  </button>

                                  {aiVoiceSpeakingMsgId === msg.id && (
                                    <div className="flex items-center gap-0.5 h-3">
                                      <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                                      <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" />
                                      <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse" />
                                      <span className="w-0.5 h-2.5 bg-white rounded-full animate-bounce" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (isVideoMessage) {
                          const platformLabel =
                            msg.videoPlatform ||
                            detectedVideoForText?.platformName ||
                            'Video';
                          const cleanVideoCaption =
                            stripVideoUrlsFromText(msg.text) ||
                            detectedVideoForText?.title ||
                            `${platformLabel} Video`;
                          const fallbackSvgThumb =
                            detectedVideoForText?.fallbackThumbnailUrl ||
                            createPlatformSvgThumbnail(platformLabel, cleanVideoCaption);
                          const primaryThumb =
                            msg.videoThumbnail ||
                            detectedVideoForText?.thumbnailUrl ||
                            msg.mediaUrl ||
                            fallbackSvgThumb;
                          const playableStreamUrl =
                            msg.videoUrl &&
                            (msg.videoUrl.endsWith('.mp4') ||
                              msg.videoUrl.startsWith('data:video') ||
                              msg.videoUrl.startsWith('blob:') ||
                              msg.videoUrl.includes('commondatastorage.googleapis.com'))
                              ? msg.videoUrl
                              : detectedVideoForText?.playableStreamUrl ||
                                (msg.mediaUrl &&
                                (msg.mediaUrl.endsWith('.mp4') ||
                                  msg.mediaUrl.startsWith('data:video') ||
                                  msg.mediaUrl.startsWith('blob:') ||
                                  msg.mediaUrl.includes('commondatastorage.googleapis.com'))
                                  ? msg.mediaUrl
                                  : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
                          const isInlinePlaying = Boolean(
                            autoPlayChatVideos || manuallyPlayingVideoIds[msg.id]
                          );
                          const isInlineMuted = inlineMutedVideoIds[msg.id] ?? true;

                          return (
                            <div
                              id={`video-thumb-card-${msg.id}`}
                              className="relative rounded-2xl overflow-hidden shadow-xl w-64 sm:w-72 group border border-slate-700/60 bg-slate-950 transition-all select-none"
                            >
                              {/* Video Feed Area: Auto-plays inline when enabled, or shows static thumbnail when Data & Battery Saver is active */}
                              <div
                                onClick={() => handleOpenMedia(msg)}
                                role="button"
                                tabIndex={0}
                                title={`Play ${cleanVideoCaption}`}
                                className="relative w-full h-40 sm:h-44 cursor-pointer overflow-hidden bg-slate-900"
                              >
                                {isInlinePlaying ? (
                                  <video
                                    src={playableStreamUrl}
                                    poster={primaryThumb}
                                    autoPlay
                                    muted={isInlineMuted}
                                    loop
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={primaryThumb}
                                    alt={cleanVideoCaption}
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.src !== fallbackSvgThumb) {
                                        target.src = fallbackSvgThumb;
                                      }
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}

                                {/* Dark gradient scrim */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 pointer-events-none" />

                                {/* Top-Left: Platform Badge + Sender + Auto-Play / Data Saver state */}
                                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap max-w-[80%]">
                                  <span
                                    style={{
                                      backgroundColor:
                                        detectedVideoForText?.badgeColor || '#EF4444',
                                    }}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white shadow-md flex items-center gap-1"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-white" />
                                    <span>{platformLabel}</span>
                                  </span>
                                  <span className="bg-black/65 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold text-white">
                                    {isMe ? 'You' : (msg.senderName || contact.name).split(' ')[0]}
                                  </span>
                                  {isInlinePlaying ? (
                                    <span className="bg-emerald-500/85 backdrop-blur-xs px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-white flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                      <span>{autoPlayChatVideos ? 'AUTO-PLAY' : 'PLAYING'}</span>
                                    </span>
                                  ) : (
                                    <span
                                      className="bg-slate-900/80 backdrop-blur-xs border border-emerald-500/40 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-emerald-300 flex items-center gap-0.5"
                                      title="Auto-play is off to save data and battery life"
                                    >
                                      <BatteryCharging className="w-2.5 h-2.5 text-emerald-400" />
                                      <span>Data Saver</span>
                                    </span>
                                  )}
                                </div>

                                {/* Top-Right: Mute/Unmute (when auto-playing) + Favourite / Like Heart */}
                                <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
                                  {isInlinePlaying && (
                                    <button
                                      type="button"
                                      id={`inline-mute-video-${msg.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInlineMutedVideoIds((prev) => ({
                                          ...prev,
                                          [msg.id]: !(prev[msg.id] ?? true),
                                        }));
                                      }}
                                      className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/85 text-white shadow-md flex items-center justify-center transition-all cursor-pointer"
                                      title={isInlineMuted ? 'Unmute inline video' : 'Mute inline video'}
                                    >
                                      {isInlineMuted ? (
                                        <VolumeX className="w-3.5 h-3.5 text-slate-200" />
                                      ) : (
                                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    id={`quick-fav-video-${msg.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextFav = !msg.isFavorite;
                                      if (onToggleFavoriteMedia) {
                                        onToggleFavoriteMedia(msg.id, nextFav);
                                      }
                                      if (nextFav) {
                                        addMediaToLikedUserGallery({
                                          id: msg.id,
                                          messageId: msg.id,
                                          type: 'video',
                                          url: msg.videoUrl || msg.mediaUrl || '',
                                          thumbnailUrl: primaryThumb,
                                          title: cleanVideoCaption || 'Liked Video Clip',
                                          senderName: isMe ? 'You' : msg.senderName || contact.name,
                                          timestamp: msg.timestamp,
                                          likesCount: 120000,
                                          likesDisplay: '120K',
                                          contactId: contact.id,
                                        });
                                        setReactionFeedback(
                                          '❤️ Liked video & added to 3×3 User Profile Gallery (🤍 120K)!'
                                        );
                                        setTimeout(() => setReactionFeedback(null), 3000);
                                      }
                                    }}
                                    className="w-7 h-7 rounded-full bg-white/95 shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-90"
                                    title={
                                      msg.isFavorite
                                        ? 'Liked & in User Profile Gallery (120K)'
                                        : 'Like & add to User Profile Gallery (🤍 120K)'
                                    }
                                  >
                                    <Heart
                                      className={`w-3.5 h-3.5 transition-all duration-200 ${
                                        msg.isFavorite
                                          ? 'fill-red-500 text-red-500 scale-110'
                                          : 'text-slate-500 hover:text-red-500'
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Center Smooth Play Button (shown when not auto-playing inline) */}
                                {!isInlinePlaying && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div
                                      style={{ backgroundColor: primaryColor }}
                                      className="w-13 h-13 rounded-full text-white flex items-center justify-center shadow-2xl ring-4 ring-white/25 group-hover:scale-110 active:scale-95 transition-all"
                                    >
                                      <Play className="w-6 h-6 fill-white ml-0.5" />
                                    </div>
                                  </div>
                                )}

                                {/* Bottom-left Clean Video Title (NO URL shown) */}
                                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-white truncate drop-shadow">
                                    {cleanVideoCaption}
                                  </p>
                                  <span className="px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono font-bold text-emerald-400 shrink-0">
                                    {isInlinePlaying ? 'LIVE FEED' : 'HD PLAY'}
                                  </span>
                                </div>
                              </div>

                              {/* Bottom Action Bar: Play, Fullscreen, Rotate, Share, Save to Device */}
                              <div className="px-2.5 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1">
                                  {!autoPlayChatVideos && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setManuallyPlayingVideoIds((prev) => ({
                                          ...prev,
                                          [msg.id]: !prev[msg.id],
                                        }));
                                      }}
                                      className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                      title={
                                        manuallyPlayingVideoIds[msg.id]
                                          ? 'Pause inline video preview'
                                          : 'Play inline in chat feed'
                                      }
                                    >
                                      {manuallyPlayingVideoIds[msg.id] ? (
                                        <>
                                          <Pause className="w-2.5 h-2.5 fill-current" />
                                          <span>Pause</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-2.5 h-2.5 fill-current" />
                                          <span>Play</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMedia(msg)}
                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors"
                                    title="Full Screen & Rotate Video"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMedia(msg)}
                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors"
                                    title="Rotate Video"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setForwardingMessage(msg);
                                    }}
                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-sky-400 cursor-pointer transition-colors"
                                    title="Share Video"
                                  >
                                    <Share2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const streamUrl =
                                        msg.videoUrl ||
                                        detectedVideoForText?.playableStreamUrl ||
                                        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
                                      const a = document.createElement('a');
                                      a.href = streamUrl;
                                      a.download = `${cleanVideoCaption
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]+/g, '-')}.mp4`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      setReactionFeedback('📥 Video saved to device!');
                                      setTimeout(() => setReactionFeedback(null), 2800);
                                    }}
                                    className="p-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 cursor-pointer transition-colors"
                                    title="Save Video to Device"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {msg.timestamp || 'Just now'}
                                  </span>
                                  {isMe && renderStatusIndicator(msg.status, 'image_overlay', msg.id)}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* 2. Voice Note Audio Message with Waveform Visualizer */}
                      {msg.type === 'audio' && (
                        <VoiceNoteWaveformVisualizer
                          message={msg}
                          isMe={isMe}
                          isDark={isDark}
                          isPlaying={playingAudioId === msg.id}
                          onTogglePlay={() => {
                            setPlayingAudioId((current) => (current === msg.id ? null : msg.id));
                          }}
                          onOpenMediaModal={() => handleOpenMedia(msg)}
                          primaryColor={primaryColor}
                          userMotherLanguage={userMotherLanguage}
                          renderStatusIndicator={renderStatusIndicator}
                        />
                      )}

                      {/* 3. Uploaded Image Attachment */}
                      {msg.type === 'image' &&
                        !msg.videoUrl &&
                        !msg.videoThumbnail &&
                        !detectVideoPlatformFromText(msg.originalVideoUrl || msg.text || '') && (
                        <div
                          id={`media-thumb-${msg.id}`}
                          className="relative rounded-2xl overflow-hidden shadow-lg max-w-64 sm:max-w-72 group border border-slate-700/40 bg-slate-900 transition-all select-none"
                        >
                          {/* Image preview area with click to open full Media View */}
                          <div
                            onClick={() => handleOpenMedia(msg)}
                            role="button"
                            tabIndex={0}
                            title="Click to open Media View (Zoom, Rotate, Share & Save)"
                            className="relative w-full h-40 sm:h-48 cursor-pointer overflow-hidden"
                          >
                            <img
                              src={
                                msg.mediaUrl ||
                                'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&auto=format&fit=crop&q=80'
                              }
                              alt={msg.text || 'Uploaded Image'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {/* Top Left: Sender badge */}
                            <div className="absolute top-2.5 left-2.5 bg-black/65 backdrop-blur-xs px-2.5 py-0.5 rounded-full shadow-sm">
                              <span className="text-[10px] font-bold text-white">
                                {isMe ? 'You' : (msg.senderName || contact.name).split(' ')[0]}
                              </span>
                            </div>

                            {/* Top Right: Circular white Favourite / Like Heart button (Adds to 3x3 User Profile Gallery!) */}
                            <button
                              type="button"
                              id={`quick-fav-${msg.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextFav = !msg.isFavorite;
                                if (onToggleFavoriteMedia) {
                                  onToggleFavoriteMedia(msg.id, nextFav);
                                }
                                if (nextFav && msg.mediaUrl) {
                                  addMediaToLikedUserGallery({
                                    id: msg.id,
                                    messageId: msg.id,
                                    type: 'image',
                                    url: msg.mediaUrl,
                                    thumbnailUrl: msg.mediaUrl,
                                    title: msg.text || 'Liked Photo',
                                    senderName: isMe ? 'You' : msg.senderName || contact.name,
                                    timestamp: msg.timestamp,
                                    likesCount: 120000,
                                    likesDisplay: '120K',
                                    contactId: contact.id,
                                  });
                                  setReactionFeedback(
                                    '❤️ Liked photo & added to 3×3 User Profile Gallery (🤍 120K)!'
                                  );
                                  setTimeout(() => setReactionFeedback(null), 3000);
                                }
                              }}
                              className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-90"
                              title={
                                msg.isFavorite
                                  ? 'Liked & in User Profile Gallery (120K)'
                                  : 'Like & add to User Profile Gallery (🤍 120K)'
                              }
                            >
                              <Heart
                                className={`w-4 h-4 transition-all duration-200 ${
                                  msg.isFavorite
                                    ? 'fill-red-500 text-red-500 scale-110'
                                    : 'text-slate-400 hover:text-red-400'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Bottom Bar: Quick Share, Save to Device, Timestamp & Status */}
                          <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-700/40 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenMedia(msg)}
                                className="text-[10px] font-semibold text-emerald-400 hover:underline cursor-pointer"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setForwardingMessage(msg);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-sky-400 cursor-pointer"
                                title="Share Image"
                              >
                                <Share2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!msg.mediaUrl) return;
                                  const a = document.createElement('a');
                                  a.href = msg.mediaUrl;
                                  a.download = `freedom-image-${Date.now()}.jpg`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  setReactionFeedback('📥 Image saved to device!');
                                  setTimeout(() => setReactionFeedback(null), 2800);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-emerald-400 cursor-pointer"
                                title="Save Image to Device"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-medium text-slate-400">
                                {msg.timestamp || '1:37 PM'}
                              </span>
                              {isMe && renderStatusIndicator(msg.status, 'image_overlay', msg.id)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3b. Sticker Message Bubble */}
                      {msg.type === 'sticker' && (() => {
                        const customMatch = customStickers.find((s) => s.id === msg.stickerId);
                        const stickerObj = getStickerById(msg.stickerId) || customMatch || {
                          id: msg.stickerId || 'custom-sticker',
                          name: msg.stickerName || msg.text || 'Sticker',
                          category: (msg.stickerCategory as StickerItem['category']) || 'moods',
                          emoji: msg.text || '✨',
                          title: msg.stickerName || 'Sticker',
                          bgGradient: 'from-emerald-400 to-teal-600',
                          badgeText: msg.stickerName || 'STICKER',
                          imageUrl: msg.mediaUrl,
                        };

                        return (
                          <div className="relative p-1 flex flex-col items-center select-none">
                            <StickerItemCard
                              sticker={stickerObj}
                              size="lg"
                              interactive={false}
                            />
                            {/* Subtle timestamp & delivery checkmark pill */}
                            <div className="flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-xs text-[10px] text-white/95 self-end shadow-xs">
                              <span>{msg.timestamp}</span>
                              {isMe && renderStatusIndicator(msg.status, 'image_overlay', msg.id)}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4. Audio Call & Video Call Messages (Display video Calls icon and audio Calls in message) */}
                      {msg.type === 'call' && (() => {
                        const isVideo = msg.callType === 'video';
                        const isMissed = msg.callStatus === 'missed';
                        const isDeclined = msg.callStatus === 'declined';
                        const callDuration = msg.callDuration || (isVideo ? '12m 30s' : '4m 12s');

                        return (
                          <div
                            id={`call-msg-bubble-${msg.id}`}
                            className={`p-3 sm:p-3.5 rounded-2xl border transition-all select-none min-w-[210px] sm:min-w-[250px] shadow-sm ${
                              isMe
                                ? 'bg-emerald-600/90 text-white border-emerald-400/40 rounded-br-xs'
                                : isDark
                                ? 'bg-[#1C2330] text-slate-100 border-slate-700/80 rounded-bl-xs'
                                : 'bg-slate-100 text-slate-900 border-slate-200 rounded-bl-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Video Call or Audio Call Icon */}
                                <div
                                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                    isVideo
                                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white ring-2 ring-purple-400/30'
                                      : isMissed || isDeclined
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : isMe
                                      ? 'bg-white/20 text-white ring-1 ring-white/30'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  {isVideo ? (
                                    <Video className="w-5 h-5 fill-current" />
                                  ) : isMissed ? (
                                    <PhoneMissed className="w-5 h-5 text-rose-400 stroke-[2.5]" />
                                  ) : isMe ? (
                                    <PhoneOutgoing className="w-5 h-5 stroke-[2.5]" />
                                  ) : (
                                    <PhoneIncoming className="w-5 h-5 stroke-[2.5]" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs sm:text-[13px] tracking-tight">
                                      {isVideo ? 'Video Call' : 'Audio Call'}
                                    </span>
                                    {isMissed && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        Missed
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5 opacity-80">
                                    <span className="font-mono font-medium">{callDuration}</span>
                                    <span>•</span>
                                    <span className="truncate">{msg.text || (isVideo ? 'Video call ended' : 'Audio call ended')}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Direct Call-back Action button with Video / Audio Icon */}
                              <button
                                type="button"
                                id={`call-back-btn-${msg.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartCall(isVideo ? 'video' : 'voice');
                                }}
                                className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 flex items-center justify-center border shadow-xs ${
                                  isVideo
                                    ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-400/30 hover:border-purple-400/60'
                                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-400/30 hover:border-emerald-400/60'
                                }`}
                                title={isVideo ? 'Call back with Video' : 'Call back with Audio'}
                              >
                                {isVideo ? (
                                  <Video className="w-4 h-4 fill-current" />
                                ) : (
                                  <Phone className="w-4 h-4 fill-current" />
                                )}
                              </button>
                            </div>

                            {/* Timestamp and delivery tick */}
                            <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-white/10 dark:border-slate-800/80 text-[10px] opacity-80">
                              <span>{msg.timestamp}</span>
                              {isMe && renderStatusIndicator(msg.status, 'bubble_dark', msg.id)}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 5. Error Status Message (Matching "Error happend" with red icon in screenshot) */}
                      {msg.type === 'error' && (
                        <div className="flex items-center gap-2 self-end">
                          <div className="px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                            <span>{msg.text || 'Error happend'}</span>
                            <span className="text-[10px] opacity-75">{msg.timestamp}</span>
                            {renderStatusIndicator(msg.status, 'bubble_dark', msg.id)}
                          </div>

                          <button
                            title="Retry sending message"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSendMessage('Retry message', 'text');
                            }}
                            className="text-rose-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4 fill-rose-500 text-white" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick action buttons on message hover: Reactions, Audio Call & Video Call */}
                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                      {!isMe && (
                        <>
                          <button
                            type="button"
                            id={`quick-audio-call-${msg.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartCall('voice');
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-full cursor-pointer transition-colors"
                            title={`Audio call ${contact.name}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`quick-video-call-${msg.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartCall('video');
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-full cursor-pointer transition-colors"
                            title={`Video call ${contact.name}`}
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {msg.text && (
                        <button
                          type="button"
                          id={`quick-ai-voice-${msg.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayMessageAiVoice(msg);
                          }}
                          className={`p-1 rounded-full cursor-pointer transition-colors ${
                            aiVoiceSpeakingMsgId === msg.id
                              ? 'text-emerald-400 bg-emerald-500/20'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-white/10'
                          }`}
                          title={`Play with AI Voice (${selectedAiVoiceName})`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        id={`quick-lock-contribution-${msg.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPinLockPrompt(msg);
                        }}
                        className={`p-1 rounded-full cursor-pointer transition-colors ${
                          isMessageContributionLocked(msg)
                            ? 'text-amber-400 bg-amber-500/20'
                            : 'text-slate-400 hover:text-amber-400 hover:bg-white/10'
                        }`}
                        title={
                          isMessageContributionLocked(msg)
                            ? 'Unlock with a Pin'
                            : 'Lock with a Pin'
                        }
                      >
                        {isMessageContributionLocked(msg) ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        id={`hover-react-trigger-${msg.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedMessageForReaction === msg.id) {
                            setSelectedMessageForReaction(null);
                            setShowExtendedReactions(false);
                          } else {
                            setSelectedMessageForReaction(msg.id);
                            setShowExtendedReactions(false);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-full cursor-pointer transition-colors"
                        title="React to message (or long-press)"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* CHANNEL BUBBLE ONLY: "live" Stream Title & Icon Bar (User must click it to join the live stream chat; Creator can Create, Edit/Rename, Delete) */}
                  {isChannelChat && (() => {
                    const liveInfo = getBubbleLiveStreamInfo(msg);
                    const isEditingThisLive = editingLiveStreamMsgId === msg.id;

                    if (liveInfo.deleted) {
                      if (!isChannelCreator) return null;
                      return (
                        <div className="mt-1.5 flex items-center justify-end">
                          <button
                            id={`channel-bubble-restore-live-${msg.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreOrCreateBubbleLiveStream(msg.id, 'live');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 cursor-pointer transition-all"
                            title="Create live chat stream on this channel bubble"
                          >
                            <Radio className="w-3 h-3" />
                            <span>+ Create "live"</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        id={`channel-bubble-live-bar-${msg.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`mt-1.5 p-2 rounded-2xl border flex flex-col gap-1.5 transition-all ${
                          isDark
                            ? 'bg-slate-900/90 border-rose-500/40 text-white shadow-md'
                            : 'bg-white/95 border-rose-500/40 text-slate-900 shadow-sm'
                        }`}
                      >
                        {isEditingThisLive ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase flex items-center gap-1 shrink-0">
                              <Radio className="w-2.5 h-2.5 animate-pulse" />
                              <span>live</span>
                            </span>
                            <input
                              type="text"
                              value={editingLiveStreamTitle}
                              onChange={(e) => setEditingLiveStreamTitle(e.target.value)}
                              placeholder="Enter live title..."
                              autoFocus
                              className={`flex-1 min-w-0 px-2 py-1 rounded-lg text-xs font-bold border outline-none ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500'
                                  : 'bg-slate-100 border-slate-300 text-slate-900 focus:border-rose-500'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameChannelLiveStream(msg.id, editingLiveStreamTitle)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Save className="w-2.5 h-2.5" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLiveStreamMsgId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-700 text-slate-200 text-[10px] font-semibold cursor-pointer shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            {/* Clickable "live" Icon & Title in Channel Bubble to activate and join the live chat stream */}
                            <button
                              id={`channel-bubble-join-live-btn-${msg.id}`}
                              type="button"
                              onClick={() => setActiveLiveStreamMsgId(msg.id)}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left group/livebtn cursor-pointer"
                              title="Click to activate and join the live stream chat"
                            >
                              <span className="px-2 py-0.5 rounded-full bg-rose-600 group-hover/livebtn:bg-rose-500 text-white text-[10px] font-extrabold tracking-wide flex items-center gap-1 shrink-0 shadow-xs transition-all">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                <Radio className="w-3 h-3" />
                                <span>live</span>
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-extrabold truncate block group-hover/livebtn:text-rose-400 transition-colors">
                                  {liveInfo.title}
                                </span>
                                <span className="text-[10px] text-emerald-400 font-semibold block truncate">
                                  Tap "live" to join live chat stream →
                                </span>
                              </div>
                            </button>

                            {/* Channel Creator Controls: Edit/Rename & Delete */}
                            {isChannelCreator && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  id={`channel-bubble-edit-live-btn-${msg.id}`}
                                  type="button"
                                  onClick={() => {
                                    setEditingLiveStreamMsgId(msg.id);
                                    setEditingLiveStreamTitle(liveInfo.title);
                                  }}
                                  className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                    isDark
                                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                                  }`}
                                  title="Edit / Rename live stream"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  id={`channel-bubble-delete-live-btn-${msg.id}`}
                                  type="button"
                                  onClick={() => handleDeleteChannelLiveStream(msg.id)}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 cursor-pointer transition-colors"
                                  title="Delete live stream from channel bubble"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Exact Time Sent / Received directly below each message bubble */}
                  <div
                    id={`msg-exact-time-${msg.id}`}
                    className={`flex items-center gap-1.5 mt-1 px-1.5 text-[11px] font-medium tracking-tight select-none ${
                      isMe
                        ? 'justify-end text-slate-400 dark:text-slate-400'
                        : 'justify-start text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Clock className="w-3 h-3 opacity-70 shrink-0" />
                    <span>
                      {isMe ? 'Sent' : 'Received'} {msg.timestamp}
                    </span>
                    {isMe && (
                      <span className="ml-0.5 inline-flex items-center">
                        {renderStatusIndicator(msg.status, 'bubble_footer', msg.id)}
                      </span>
                    )}
                  </div>

                  {/* Message Reaction Badges */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div
                      id={`reactions-bar-${msg.id}`}
                      className={`flex flex-wrap items-center gap-1 mt-0.5 ${
                        isMe ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.reactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          id={`reaction-pill-${msg.id}-${reaction.emoji}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectReactionEmoji(msg.id, reaction.emoji);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-xs active:scale-90 select-none ${
                            reaction.userReacted
                              ? 'bg-emerald-500/25 border-emerald-500 text-emerald-400 font-bold'
                              : isDark
                              ? 'bg-[#1e2430] border-slate-700/70 text-slate-300 hover:border-slate-500'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                          title={
                            reaction.userReacted
                              ? `You reacted with ${reaction.emoji} (tap to remove)`
                              : `Reacted with ${reaction.emoji} (tap to toggle)`
                          }
                        >
                          <span className="text-xs sm:text-sm leading-none">{reaction.emoji}</span>
                          {reaction.count > 1 && (
                            <span className="text-[10px] font-bold opacity-90">{reaction.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current User Persistent Profile Thumbnail Avatar on Outgoing Messages */}
                {isMe && (
                  <div
                    onClick={onBack}
                    className="shrink-0 mb-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    title="Your Persistent Profile Thumbnail"
                  >
                    <img
                      src={getPersistentUserThumbnail(
                        {
                          name: msg.senderName || 'You',
                          avatar: msg.senderAvatar,
                        },
                        true
                      )}
                      alt={msg.senderName || 'You'}
                      className="w-7 h-7 rounded-full object-cover border border-emerald-500/60 shadow-xs"
                    />
                  </div>
                )}
              </div>
              </React.Fragment>
            );
          }))}

        {/* Real-time typing indicator bubble */}
        {(isContactTyping || internalTyping) && (
          <div
            id="chat-typing-indicator-bubble"
            className="flex items-end gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 duration-200 mt-2"
          >
            <div className="shrink-0 mb-1">
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold ml-2">
                {contact.name.split(' ')[0]} is typing...
              </span>
              <div
                className={`px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-sm ${
                  isDark
                    ? 'bg-[#1e2430] border border-slate-700/60'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {/* Global Backdrop to dismiss reaction menu */}
        {selectedMessageForReaction && (
          <div
            id="reaction-menu-backdrop"
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[0.5px] cursor-default"
            onClick={() => {
              setSelectedMessageForReaction(null);
              setShowExtendedReactions(false);
            }}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      </div>

      {/* Recording indicator bar with live visualizer */}
      {isRecordingVoice && (
        <RecordingVoiceVisualizer
          seconds={recordSeconds}
          onCancel={() => setIsRecordingVoice(false)}
          onSend={handleSendVoiceNote}
          isDark={isDark}
        />
      )}

      {/* Interactive Emoji & Stickers Tray (Drawer above input) */}
      {isEmojiPickerOpen && (
        <EmojiAndStickersTray
          isDark={isDark}
          customStickers={customStickers}
          onClose={() => setIsEmojiPickerOpen(false)}
          onSelectEmoji={(emoji) => {
            setInputText((prev) => prev + emoji);
            textInputRef.current?.focus();
          }}
          onDeleteChar={() => {
            setInputText((prev) => prev.slice(0, -2));
            textInputRef.current?.focus();
          }}
          onSendSticker={handleSendSticker}
          initialTab="stickers"
        />
      )}

      {/* Camera Action Options Sheet */}
      {isCameraSheetOpen && (
        <div
          className={`border-t p-3 select-none animate-in slide-in-from-bottom-2 duration-150 ${
            isDark ? 'bg-[#181A20] border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-500" />
              Camera & Media
            </span>
            <button
              type="button"
              onClick={() => setIsCameraSheetOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="open-snap-face-filter-camera-btn"
              type="button"
              onClick={() => {
                setIsCameraSheetOpen(false);
                setIsSnapFilterCameraOpen(true);
              }}
              className="col-span-2 p-3 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:brightness-110 text-white flex items-center justify-between text-xs font-bold cursor-pointer shadow-md transition-all active:scale-98"
            >
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span>Face Filter Camera (Masks, Effects & Filters)</span>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                Photo & Video
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCameraSheetOpen(false);
                setIsSnapFilterCameraOpen(true);
              }}
              className="p-2.5 rounded-xl border border-dashed border-emerald-500/40 hover:bg-emerald-500/10 flex items-center gap-2 text-xs font-medium cursor-pointer text-emerald-600 dark:text-emerald-400 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
                setIsCameraSheetOpen(false);
              }}
              className="p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors"
            >
              <Paperclip className="w-4 h-4" />
              <span>Photo Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCameraSheetOpen(false);
                setIsSnapFilterCameraOpen(true);
              }}
              className="p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-emerald-500/20 flex items-center gap-2 text-xs cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-pink-500 shrink-0" />
              <span className="truncate">Take Live Snapshot</span>
            </button>
              <button
                type="button"
                onClick={() => {
                  onSendMessage(
                    'https://www.youtube.com/watch?v=aqz-KE-bpKQ Big Buck Bunny 4K Showcase',
                    'text'
                  );
                  setIsCameraSheetOpen(false);
                }}
                className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 flex items-center gap-2 text-xs font-semibold text-red-400 cursor-pointer transition-colors"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span className="truncate">Share YouTube Video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSendMessage(
                    'https://www.tiktok.com/@creator/video/72948192014 Trending TikTok Clip',
                    'text'
                  );
                  setIsCameraSheetOpen(false);
                }}
                className="p-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 flex items-center gap-2 text-xs font-semibold text-purple-300 cursor-pointer transition-colors"
              >
                <Video className="w-4 h-4 shrink-0" />
                <span className="truncate">Share TikTok / Vimeo</span>
              </button>
            </div>
          </div>
        )}

      {/* Live Video Platform Thumbnail Preview when user types/pastes a YouTube/Vimeo/TikTok URL */}
      {(() => {
        const liveVideoDetect = detectVideoPlatformFromText(inputText);
        if (!liveVideoDetect) return null;
        return (
          <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom-1 duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={liveVideoDetect.thumbnailUrl}
                alt={liveVideoDetect.title}
                onError={(e) => {
                  if (
                    liveVideoDetect.fallbackThumbnailUrl &&
                    e.currentTarget.src !== liveVideoDetect.fallbackThumbnailUrl
                  ) {
                    e.currentTarget.src = liveVideoDetect.fallbackThumbnailUrl;
                  }
                }}
                className="w-14 h-9 rounded-lg object-cover border border-white/15 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    style={{ backgroundColor: liveVideoDetect.badgeColor }}
                    className="px-1.5 py-0.2 rounded text-[9px] font-extrabold text-white"
                  >
                    {liveVideoDetect.platformName}
                  </span>
                  <span className="text-[11px] font-bold text-white truncate">
                    {stripVideoUrlsFromText(inputText) || liveVideoDetect.title}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400 font-semibold truncate">
                  ✓ Thumbnail generated • Video URL will be hidden automatically
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hidden file inputs for Camera and Attachments (persists uploaded media images & videos) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.type.startsWith('video/')) {
            const { thumbnailUrl, videoObjectUrl } = await generateVideoFileThumbnail(file);
            const cleanName = file.name.replace(/\.[^/.]+$/, '');
            onSendMessage(cleanName, 'video', videoObjectUrl);
            try {
              const savedMedia = JSON.parse(localStorage.getItem('freedom_uploaded_media_items') || '[]');
              savedMedia.unshift({
                id: `vid_${Date.now()}`,
                type: 'video',
                mediaUrl: videoObjectUrl,
                thumbnailUrl,
                title: cleanName,
                createdAt: Date.now(),
              });
              localStorage.setItem('freedom_uploaded_media_items', JSON.stringify(savedMedia.slice(0, 30)));
            } catch {}
            setReactionFeedback('🎬 Video uploaded & thumbnail generated!');
            setTimeout(() => setReactionFeedback(null), 3000);
          } else {
            const persistentDataUrl = await optimizeUploadedImageFile(file);
            if (persistentDataUrl) {
              const cleanName = file.name.replace(/\.[^/.]+$/, '');
              onSendMessage(cleanName, 'image', persistentDataUrl);
              try {
                const savedMedia = JSON.parse(localStorage.getItem('freedom_uploaded_media_items') || '[]');
                savedMedia.unshift({
                  id: `img_${Date.now()}`,
                  type: 'image',
                  mediaUrl: persistentDataUrl,
                  thumbnailUrl: persistentDataUrl,
                  title: cleanName,
                  createdAt: Date.now(),
                });
                localStorage.setItem('freedom_uploaded_media_items', JSON.stringify(savedMedia.slice(0, 30)));
              } catch {}
              setReactionFeedback('🖼️ Uploaded media image saved!');
              setTimeout(() => setReactionFeedback(null), 3000);
            }
          }
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.type.startsWith('video/')) {
            const { videoObjectUrl } = await generateVideoFileThumbnail(file);
            onSendMessage('Captured Video Clip', 'video', videoObjectUrl);
          } else {
            const persistentDataUrl = await optimizeUploadedImageFile(file);
            if (persistentDataUrl) {
              onSendMessage('Captured Photo', 'image', persistentDataUrl);
              setReactionFeedback('📸 Captured photo saved!');
              setTimeout(() => setReactionFeedback(null), 3000);
            }
          }
        }}
      />
      <input
        ref={wallpaperFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChatWallpaperFileChange}
      />

      {/* Bottom Message Input Area: Blocked Contact Notice OR Normal Android Input Bar */}
      {isBlocked ? (
        <div
          id="chat-blocked-input-notice"
          className={`px-4 py-3.5 border-t flex flex-col items-center justify-center text-center gap-2 select-none transition-colors duration-200 ${
            isDark
              ? 'bg-[#151922] border-slate-800 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 text-rose-500 font-bold text-xs sm:text-sm">
            <Ban className="w-4 h-4 stroke-[2.5]" />
            <span>You have blocked {contact.name}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Further messages cannot be sent or received. Contact status is set to{' '}
            <span className="font-semibold text-rose-400">'blocked'</span> in the database.
          </p>
          <button
            id="chat-unblock-bottom-btn"
            type="button"
            onClick={() => handleToggleBlock(false)}
            className="mt-0.5 px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Unblock Contact</span>
          </button>
        </div>
      ) : (
        <div
          className={`px-3 py-2.5 border-t flex items-center gap-2 select-none transition-colors duration-200 ${
            isDark
              ? 'bg-[#181A20] border-slate-800/80 text-white'
              : 'bg-white border-slate-100 text-slate-800'
          }`}
        >
          {/* Audio / Mic Circular Button (matching screenshot left side) */}
          <button
            id="chat-mic-btn"
            type="button"
            onClick={() => {
              if (isRecordingVoice) {
                handleSendVoiceNote();
              } else {
                setIsRecordingVoice(true);
              }
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isRecordingVoice
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/25'
                : isDark
                ? 'bg-[#1E2533] text-emerald-400 hover:bg-[#262E3E] active:scale-95'
                : 'bg-[#E8F8F0] text-[#22C55E] hover:bg-[#DCF4E9] active:scale-95'
            }`}
            title={isRecordingVoice ? 'Stop and send audio' : 'Record voice note'}
          >
            <Mic className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Pill-shaped Message Text Box with Emojis, Input, Paperclip, and Camera */}
          <div
            className={`flex-1 flex items-center gap-2.5 px-3.5 py-2 rounded-full transition-all ${
              isDark
                ? 'bg-[#1F2634] text-white'
                : 'bg-[#F3F4F6] text-slate-900'
            }`}
          >
            {/* Stickers & Emojis Icon (Smile with sticker indicator badge) */}
            <button
              id="chat-emoji-btn"
              type="button"
              onClick={() => {
                setIsCameraSheetOpen(false);
                setIsEmojiPickerOpen((prev) => !prev);
              }}
              className={`relative transition-colors shrink-0 cursor-pointer p-0.5 rounded-full hover:bg-slate-300/40 dark:hover:bg-slate-700/50 ${
                isEmojiPickerOpen
                  ? 'text-emerald-500'
                  : 'text-slate-400 hover:text-emerald-500'
              }`}
              title="Send stickers & emojis"
            >
              <Smile className="w-5 h-5 stroke-[1.9]" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
            </button>

            {/* Text Input */}
            <form onSubmit={handleSend} className="flex-1 min-w-0">
              <input
                ref={textInputRef}
                type="text"
                id="chat-message-input"
                value={inputText}
                onChange={(e) => handleLocalUserWritingChange(e.target.value)}
                placeholder={
                  isAiVoiceBoxActive
                    ? `Type message with AI Voice (${selectedAiVoiceName})...`
                    : 'Type message'
                }
                className={`w-full bg-transparent text-[13px] sm:text-sm outline-none font-normal ${
                  isDark ? 'text-slate-100 placeholder-slate-400' : 'text-slate-800 placeholder-slate-400'
                }`}
              />
            </form>

            {/* AI Voice Controls inside Texting Box ONLY when user clicked AI Voice link from sidebar */}
            {isAiVoiceBoxActive && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  id="chat-ai-voice-composer-btn"
                  type="button"
                  onClick={() => {
                    setIsEmojiPickerOpen(false);
                    setIsCameraSheetOpen(false);
                    setAiVoiceDraftText(inputText);
                    setIsAiVoiceModalOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 bg-emerald-500 text-white shadow-xs hover:bg-emerald-600 transition-all cursor-pointer"
                  title="Open AI Voice Studio"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>AI Voice • {selectedAiVoiceName}</span>
                </button>
                <button
                  id="close-ai-voice-composer-btn"
                  type="button"
                  onClick={() => {
                    stopAiVoicePlayback();
                    setIsAiVoiceBoxActive(false);
                  }}
                  className="p-0.5 rounded-full text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Hide AI Voice from texting box"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Paperclip (Attachment) */}
            <button
              id="chat-attach-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-slate-400 hover:text-emerald-500 transition-colors shrink-0 cursor-pointer"
              title="Attach file from device"
            >
              <Paperclip className="w-5 h-5 -rotate-45 stroke-[1.9]" />
            </button>

            {/* Camera Icon (Opens Snapchat-style Face Filter Camera or Camera Sheet) */}
            <button
              id="chat-camera-btn"
              type="button"
              onClick={() => {
                setIsEmojiPickerOpen(false);
                setIsSnapFilterCameraOpen(true);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsCameraSheetOpen((prev) => !prev);
              }}
              className={`transition-colors shrink-0 cursor-pointer ${
                isSnapFilterCameraOpen || isCameraSheetOpen
                  ? 'text-pink-500'
                  : 'text-slate-400 hover:text-pink-500'
              }`}
              title="Open Face Filter Camera (Masks, Effects & Filters — Photo & Video)"
            >
              <Camera className="w-5 h-5 stroke-[1.9]" />
            </button>
          </div>

          {/* Send Button when text is present */}
          {inputText.trim() && (
            <button
              id="chat-send-btn"
              type="button"
              onClick={() => handleSend()}
              className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-md shadow-emerald-500/25 flex items-center justify-center transition-all cursor-pointer shrink-0 animate-in zoom-in-75 duration-150"
              title="Send Message"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Device Bottom Home Indicator Bar (iOS style) */}
      <div className="w-full flex justify-center pb-2 pt-0.5 bg-slate-50 dark:bg-[#121620] shrink-0 z-20">
        <div className="w-32 h-1 bg-slate-900/25 dark:bg-white/25 rounded-full pointer-events-none" />
      </div>

      {/* Block User Confirmation Modal */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border transition-all ${
              isDark ? 'bg-[#181D27] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <Ban className="w-6 h-6 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">Block {contact.name}?</h3>
                <p className="text-[11px] text-rose-400 font-semibold">Updates status to 'blocked' in database</p>
              </div>
            </div>

            <div className={`p-3 rounded-2xl text-xs space-y-2 mb-4 ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`}>
              <div className="flex items-start gap-2 text-slate-300 dark:text-slate-300">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong>No messages</strong> can be sent to or received from {contact.name}.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-300 dark:text-slate-300">
                <span className="text-rose-400 font-bold">•</span>
                <span>Incoming audio/video calls from this contact are blocked.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-300 dark:text-slate-300">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  Updates document <code className="text-emerald-400 font-mono text-[10px]">users/{contact.id}</code> to <code className="text-rose-400 font-mono text-[10px]">status: 'blocked'</code>.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                id="confirm-block-user-btn"
                type="button"
                onClick={() => handleToggleBlock(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 cursor-pointer flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Block User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Player Modal for video and music playback */}
      <MediaPlayerModal
        media={activeMediaItem}
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        isDark={isDark}
        primaryColor={primaryColor}
        onToggleLike={(id, liked) => {
          if (onToggleLikeMedia) onToggleLikeMedia(id, liked);
        }}
        onToggleFavorite={(id, fav) => {
          if (onToggleFavoriteMedia) onToggleFavoriteMedia(id, fav);
        }}
        onRateMedia={(id, rating) => {
          if (onRateMedia) onRateMedia(id, rating);
        }}
        onShareMedia={onShareMedia}
        isGroupMedia={isGroupChat}
        groupName={contact.name}
        groupParticipants={groupParticipants}
        onShareWithGroupMembers={handleShareGroupMediaToMembers}
      />

      {/* Media Gallery Modal for browsing User Media Gallery & sharing media in messages */}
      <MediaGalleryModal
        isOpen={isMediaGalleryOpen}
        onClose={() => setIsMediaGalleryOpen(false)}
        contact={contact}
        messages={messages}
        onSelectMedia={(mediaItem) => {
          setActiveMediaItem(mediaItem);
          setIsMediaModalOpen(true);
        }}
        onJumpToMessage={handleJumpToMessage}
        theme={theme}
        primaryColor={primaryColor}
        onToggleLikeMedia={onToggleLikeMedia}
        onToggleFavoriteMedia={onToggleFavoriteMedia}
        onShareWithGroupMembers={handleShareGroupMediaToMembers}
        onShareMediaInMessage={(mediaUrl, mediaType, title) => {
          onSendMessage(title || 'Shared from User Media Gallery', mediaType, mediaUrl);
          setReactionFeedback(`📤 Shared "${title || 'Media'}" from User Media Gallery!`);
          setTimeout(() => setReactionFeedback(null), 2800);
        }}
      />

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        message={forwardingMessage}
        contacts={contacts}
        currentContactId={contact.id}
        onClose={() => setForwardingMessage(null)}
        isGroupChat={isGroupChat}
        groupName={contact.name}
        groupParticipants={groupParticipants}
        onForward={(targetIds, msgToForward, note) => {
          if (isGroupChat) {
            const recipientNames = groupParticipants
              .filter((p) => targetIds.includes(p.id))
              .map((p) => p.name.split(' ')[0])
              .join(', ');
            const fallbackType =
              msgToForward.type === 'audio' || msgToForward.type === 'image' || msgToForward.type === 'sticker'
                ? msgToForward.type
                : 'text';
            onSendMessage(
              `[Shared with Group Members: ${recipientNames || 'Group'}]: ${msgToForward.text || '[Media]'}${
                note ? ` — "${note}"` : ''
              }`,
              fallbackType,
              msgToForward.mediaUrl
            );
            setReactionFeedback(
              `📤 Shared with group member${targetIds.length > 1 ? 's' : ''}: ${recipientNames}`
            );
            setTimeout(() => setReactionFeedback(null), 3000);
          } else if (onForwardMessage) {
            onForwardMessage(targetIds, msgToForward, note);
          } else {
            const fallbackType =
              msgToForward.type === 'audio' || msgToForward.type === 'image' || msgToForward.type === 'sticker'
                ? msgToForward.type
                : 'text';
            onSendMessage(
              `[Forwarded]: ${msgToForward.text || '[Attachment]'}`,
              fallbackType,
              msgToForward.mediaUrl
            );
          }
        }}
        isDark={theme === 'dark'}
      />

      {/* User Profile Modal */}
      {isUserProfileModalOpen && (
        <UserProfileModal
          isOpen={isUserProfileModalOpen}
          onClose={() => setIsUserProfileModalOpen(false)}
          contact={selectedProfileContact || contact}
          messages={messages}
          onStartCall={(type) => {
            setIsUserProfileModalOpen(false);
            onStartCall(type);
          }}
          onSendMessage={(customText) => {
            setIsUserProfileModalOpen(false);
            if (customText) {
              onSendMessage(customText, 'text');
            }
          }}
          onOpenFriendshipModal={() => {
            setIsUserProfileModalOpen(false);
            setIsFriendshipModalOpen(true);
          }}
          theme={theme}
          primaryColor={primaryColor}
          onToggleBlockUser={onToggleBlockUser}
          onJoinGroup={() => handleJoinGroupAction()}
          onShareGroupMedia={handleShareGroupMediaToMembers}
          onUpdateGroupCover={(_, newCoverUrl) => setGroupCoverUrl(newCoverUrl)}
        />
      )}

      {/* Friendship & User Engagement Modal */}
      <FriendshipModal
        isOpen={isFriendshipModalOpen}
        onClose={() => setIsFriendshipModalOpen(false)}
        contact={contact}
        userMotherLanguage={userMotherLanguage}
        messages={messages}
        onStartCall={(type) => onStartCall(type)}
        onSendMessage={(text) => onSendMessage(text, 'text')}
        onToggleLockUserContribution={(_, locked) => handleToggleAllUserContributionsLock(locked)}
        theme={theme}
        primaryColor={primaryColor}
      />

      {/* AI Voice in Message Studio Modal */}
      {isAiVoiceModalOpen && (
        <div
          id="ai-voice-modal-backdrop"
          onClick={() => {
            stopAiVoicePlayback();
            setIsAiVoiceModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="ai-voice-modal-card"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#181D27] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                >
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                    <span>AI Voice in Message</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">
                      Gemini TTS
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Speak or send messages with natural AI Voice personas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopAiVoicePlayback();
                  setIsAiVoiceModalOpen(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Select AI Voice Persona */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Select AI Voice Persona
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {AI_VOICE_PERSONAS.map((persona) => {
                  const isSelected = selectedAiVoiceName === persona.id;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => setSelectedAiVoiceName(persona.id)}
                      style={
                        isSelected
                          ? { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }
                          : undefined
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-1 ring-purple-500/40'
                          : isDark
                          ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">{persona.label}</span>
                        {isSelected && (
                          <Check style={{ color: primaryColor }} className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{persona.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spoken Language / Accent Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Spoken Language / Translation
              </label>
              <select
                value={aiVoiceLanguage}
                onChange={(e) => setAiVoiceLanguage(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="Original">Speak in Original Message Language</option>
                <option value={contact.nativeLanguage || 'Spanish'}>
                  Translate & Speak in {contact.nativeLanguage || 'Spanish'} ({contact.name.split(' ')[0]}'s Language)
                </option>
                <option value="English">English</option>
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
                <option value="Portuguese">Portuguese (Português)</option>
                <option value="Arabic">Arabic (العربية)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
              </select>
            </div>

            {/* Message Text to Speak & Send */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                AI Voice Message Text
              </label>
              <textarea
                rows={2}
                value={aiVoiceDraftText}
                onChange={(e) => setAiVoiceDraftText(e.target.value)}
                placeholder={`Type message for ${selectedAiVoiceName} AI Voice to speak to ${contact.name}...`}
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Preview & Send Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                id="preview-ai-voice-btn"
                type="button"
                onClick={handlePreviewAiVoiceStudio}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  isPreviewingAiVoice
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : isDark
                    ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isPreviewingAiVoice ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Stop Preview</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Preview AI Voice</span>
                  </>
                )}
              </button>

              <button
                id="send-ai-voice-msg-btn"
                type="button"
                onClick={handleSendAiVoiceMessage}
                style={{ backgroundColor: primaryColor }}
                className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send AI Voice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock with a Pin Modal */}
      {isPinLockModalOpen && (
        <div
          id="pin-lock-modal-backdrop"
          onClick={() => setIsPinLockModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="pin-lock-modal-card"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-3xl p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#181D27] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                >
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">
                    {pinTargetMessage
                      ? isMessageContributionLocked(pinTargetMessage)
                        ? 'Unlock with a Pin'
                        : 'Lock with a Pin'
                      : isUserContributionsLocked
                      ? 'Unlock with a Pin'
                      : 'Lock with a Pin'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {pinTargetMessage
                      ? 'Protect this message bubble with a 4-digit PIN'
                      : `Protect ${contact.name} messages with a 4-digit PIN`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPinLockModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pinTargetMessage && (
              <div
                className={`p-2.5 rounded-xl border text-xs truncate ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                "{pinTargetMessage.text || 'Media Attachment'}"
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Enter 4-Digit Security PIN
              </label>
              <input
                id="pin-lock-code-input"
                type="password"
                maxLength={6}
                value={pinCodeInput}
                onChange={(e) => {
                  setPinCodeInput(e.target.value.replace(/\D/g, ''));
                  setPinError(null);
                }}
                placeholder="1234"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-center font-mono text-lg font-extrabold tracking-[0.4em] outline-none ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
              {pinError && <p className="text-[11px] text-rose-500 font-semibold">{pinError}</p>}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsPinLockModalOpen(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                id="confirm-pin-lock-btn"
                type="button"
                onClick={handleConfirmPinLock}
                style={{ backgroundColor: primaryColor }}
                className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {pinTargetMessage
                    ? isMessageContributionLocked(pinTargetMessage)
                      ? 'Unlock Now'
                      : 'Lock with Pin'
                    : isUserContributionsLocked
                    ? 'Unlock Now'
                    : 'Lock with Pin'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Participants & Management Modal */}
      {isGroupMembersModalOpen && (
        <div
          id="group-members-modal-backdrop"
          onClick={() => setIsGroupMembersModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="group-members-modal"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border max-h-[88vh] flex flex-col ${
              isDark
                ? 'bg-[#181D27] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Group Cover Banner in Group Modal (Group Admin can upload cover) */}
            <div className="relative h-28 shrink-0 overflow-hidden bg-slate-900">
              <img
                src={groupCoverUrl}
                alt={`${contact.name} Cover`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
              <input
                ref={groupCoverFileRef}
                type="file"
                accept="image/*"
                onChange={handleGroupCoverFileChange}
                className="hidden"
              />
              <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-white text-[10px] font-bold border border-white/20">
                  Group Cover
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupMembersModalOpen(false)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                id="group-modal-upload-cover-btn"
                type="button"
                onClick={() => groupCoverFileRef.current?.click()}
                className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-black/65 hover:bg-black/80 text-white text-[10px] font-extrabold border border-white/25 flex items-center gap-1 cursor-pointer shadow-md"
                title="Upload Group Cover (Group Admin)"
              >
                <Camera className="w-3 h-3 text-emerald-400" />
                <span>Upload Group Cover</span>
              </button>
            </div>

            <div className="p-5 pt-3 flex-1 overflow-y-auto flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    style={{ width: '100px', height: '100px' }}
                    className="w-[100px] h-[100px] rounded-full object-cover border-3 border-amber-400 shrink-0 shadow-lg"
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{contact.name}</h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {contact.groupTopic || 'Multilingual group conversation'}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 text-[10px] font-bold">
                      <Users className="w-3 h-3" />
                      <span>{groupParticipants.length} Members</span>
                    </span>
                  </div>
                </div>
              </div>

            {/* Current Participants List */}
            <div className="py-3 flex-1 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Participants ({groupParticipants.length})
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold">
                  Auto-translates to {userMotherLanguage}
                </span>
              </div>

              <div className="space-y-1.5">
                {groupParticipants.map((member) => {
                  const isMeMember = member.id === 'me';
                  const isMemberBanned = member.moderationStatus === 'banned';
                  const isMemberSuspended = member.moderationStatus === 'suspended';

                  return (
                    <div
                      key={member.id}
                      className={`flex flex-col gap-2 p-2.5 rounded-2xl border ${
                        isMemberBanned
                          ? 'bg-rose-950/25 border-rose-500/40'
                          : isMemberSuspended
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : isDark
                          ? 'bg-[#1F2633] border-slate-800'
                          : 'bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className={`w-12 h-12 rounded-full object-cover border border-slate-700 ${
                                isMemberBanned ? 'grayscale opacity-60' : ''
                              }`}
                            />
                            {member.online !== false && !isMemberBanned && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold truncate">{member.name}</span>
                              {member.role === 'admin' && (
                                <span
                                  style={{
                                    backgroundColor: `${primaryColor}20`,
                                    color: primaryColor,
                                  }}
                                  className="text-[9px] font-bold px-1.5 py-0.2 rounded-md"
                                >
                                  Admin
                                </span>
                              )}
                              {member.role === 'moderator' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300">
                                  Moderator
                                </span>
                              )}
                              {isMemberBanned && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-400 uppercase">
                                  Banned
                                </span>
                              )}
                              {isMemberSuspended && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300">
                                  Suspended (24h)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Globe className="w-2.5 h-2.5" />
                              <span>{member.nativeLanguage || 'English'}</span>
                            </div>
                          </div>
                        </div>

                        {!isMeMember && onSimulateParticipantMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              onSimulateParticipantMessage(member);
                              setIsGroupMembersModalOpen(false);
                            }}
                            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold hover:brightness-110 cursor-pointer shrink-0"
                            title={`Simulate incoming message from ${member.name}`}
                          >
                            Reply
                          </button>
                        )}
                      </div>

                      {/* Group Admin & Moderator Actions: Suspend, Ban User, Delete Member */}
                      {!isMeMember && (
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-700/30">
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus = isMemberSuspended ? 'active' : 'suspended';
                              const updated = groupParticipants.map((p) =>
                                p.id === member.id
                                  ? { ...p, moderationStatus: nextStatus as 'active' | 'suspended' }
                                  : p
                              );
                              if (onUpdateGroupParticipants) {
                                onUpdateGroupParticipants(contact.id, updated);
                              }
                              try {
                                localStorage.setItem(
                                  `freedom_group_members_${contact.id}`,
                                  JSON.stringify(updated)
                                );
                              } catch {}
                              setReactionFeedback(
                                isMemberSuspended
                                  ? `✅ Lifted temporary suspension for ${member.name}`
                                  : `⏳ Temporarily suspended ${member.name} for 24h`
                              );
                              setTimeout(() => setReactionFeedback(null), 2800);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                              isMemberSuspended
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{isMemberSuspended ? 'Unsuspend' : 'Suspend'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus = isMemberBanned ? 'active' : 'banned';
                              const updated = groupParticipants.map((p) =>
                                p.id === member.id
                                  ? { ...p, moderationStatus: nextStatus as 'active' | 'banned' }
                                  : p
                              );
                              if (onUpdateGroupParticipants) {
                                onUpdateGroupParticipants(contact.id, updated);
                              }
                              try {
                                localStorage.setItem(
                                  `freedom_group_members_${contact.id}`,
                                  JSON.stringify(updated)
                                );
                              } catch {}
                              setReactionFeedback(
                                isMemberBanned
                                  ? `✅ Unbanned ${member.name} in ${contact.name}`
                                  : `🚫 Banned ${member.name} from ${contact.name}`
                              );
                              setTimeout(() => setReactionFeedback(null), 2800);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                              isMemberBanned
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30'
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{isMemberBanned ? 'Unban' : 'Ban User'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = groupParticipants.filter(
                                (p) => p.id !== member.id
                              );
                              if (onUpdateGroupParticipants) {
                                onUpdateGroupParticipants(contact.id, updated);
                              }
                              try {
                                localStorage.setItem(
                                  `freedom_group_members_${contact.id}`,
                                  JSON.stringify(updated)
                                );
                              } catch {}
                              setReactionFeedback(`🗑️ Deleted ${member.name} from group`);
                              setTimeout(() => setReactionFeedback(null), 2800);
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-slate-700"
                            title={`Delete ${member.name} from group`}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Join Group & Open Group Gallery Quick Actions */}
              <div className="pt-2 space-y-2">
                <button
                  id="group-modal-join-group-btn"
                  type="button"
                  onClick={handleJoinGroupAction}
                  style={
                    hasJoinedGroup
                      ? undefined
                      : { backgroundColor: primaryColor }
                  }
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
                    hasJoinedGroup
                      ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-500'
                      : 'text-white shadow-md hover:brightness-110'
                  }`}
                >
                  {hasJoinedGroup ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Joined Group • Active Member</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Join Group</span>
                    </>
                  )}
                </button>

                <button
                  id="group-modal-open-gallery-btn"
                  type="button"
                  onClick={() => {
                    setIsGroupMembersModalOpen(false);
                    setSelectedProfileContact(contact);
                    setIsUserProfileModalOpen(true);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Open Group Page</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsGroupMembersModalOpen(false)}
                style={{ backgroundColor: primaryColor }}
                className="w-full py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer hover:brightness-110 transition-all"
              >
                Done
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Live Stream & Live Podcast in Channel Modal */}
      {isChannelChat && showCreateLiveModal && (
        <div
          id="channel-create-live-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowCreateLiveModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border space-y-4 ${
              isDark ? 'bg-[#181D27] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                    newLiveStreamMode === 'podcast' ? 'bg-purple-600' : 'bg-[#E1306C]'
                  }`}
                >
                  {newLiveStreamMode === 'podcast' ? (
                    <Headphones className="w-5 h-5" />
                  ) : (
                    <Radio className="w-5 h-5 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                    <span>Create</span>
                    <span
                      className={`px-2 py-0.5 rounded-[5px] text-white text-[10px] font-extrabold ${
                        newLiveStreamMode === 'podcast' ? 'bg-purple-600' : 'bg-[#E1306C]'
                      }`}
                    >
                      {newLiveStreamMode === 'podcast' ? 'Podcast' : 'Live'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Stream live video or host a podcast with live chat in {contact.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateLiveModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => handleCreateNewLiveStreamInMessage(e, true)}
              className="space-y-3.5"
            >
              {/* Mode Switcher: Live Stream vs Live Podcast */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewLiveStreamMode('live');
                    setNewLiveCameraOn(true);
                    if (newLiveStreamTitle === 'Live Podcast') setNewLiveStreamTitle('live');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                    newLiveStreamMode === 'live'
                      ? 'bg-[#E1306C] border-pink-400 text-white shadow-md'
                      : isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live Stream</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewLiveStreamMode('podcast');
                    if (newLiveStreamTitle === 'live') setNewLiveStreamTitle('Live Podcast');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                    newLiveStreamMode === 'podcast'
                      ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                      : isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Live Podcast</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {newLiveStreamMode === 'podcast' ? 'Podcast Title' : 'Live Stream Title'}
                </label>
                <input
                  type="text"
                  value={newLiveStreamTitle}
                  onChange={(e) => setNewLiveStreamTitle(e.target.value)}
                  placeholder={newLiveStreamMode === 'podcast' ? 'Live Podcast' : 'live'}
                  autoFocus
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-pink-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-pink-500'
                  }`}
                />
              </div>

              {/* Camera, Mic & Filter Toggles */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewLiveCameraOn((prev) => !prev)}
                  className={`py-2 px-2 rounded-xl text-[10px] font-extrabold flex flex-col items-center gap-1 border cursor-pointer transition-all ${
                    newLiveCameraOn
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>Camera: {newLiveCameraOn ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewLiveMicOn((prev) => !prev)}
                  className={`py-2 px-2 rounded-xl text-[10px] font-extrabold flex flex-col items-center gap-1 border cursor-pointer transition-all ${
                    newLiveMicOn
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>Mic: {newLiveMicOn ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNewLiveFilterId((prev) => (prev === 'normal' ? 'warm_glow' : 'normal'))
                  }
                  className={`py-2 px-2 rounded-xl text-[10px] font-extrabold flex flex-col items-center gap-1 border cursor-pointer transition-all ${
                    newLiveFilterId !== 'normal'
                      ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Filter: {newLiveFilterId === 'normal' ? 'Ready' : 'Glow'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateLiveModal(false)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all ${
                    newLiveStreamMode === 'podcast'
                      ? 'bg-purple-600 hover:bg-purple-500'
                      : 'bg-[#E1306C] hover:brightness-110'
                  }`}
                >
                  {newLiveStreamMode === 'podcast' ? (
                    <Headphones className="w-3.5 h-3.5" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {newLiveStreamMode === 'podcast' ? 'Start Live Podcast' : 'Start Live Stream'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Channel Live Stream & Podcast Modal matching 10.jpg */}
      {isChannelChat && activeLiveStreamMsgId && (() => {
        const targetMsg = messages.find((m) => m.id === activeLiveStreamMsgId);
        const liveInfo = targetMsg
          ? getBubbleLiveStreamInfo(targetMsg)
          : (channelLiveStreamsMap[activeLiveStreamMsgId] as any) || {
              title: 'live',
              active: true,
              mode: 'live',
            };

        return (
          <ChannelLiveStreamAndPodcastModal
            isOpen={Boolean(activeLiveStreamMsgId)}
            onClose={() => setActiveLiveStreamMsgId(null)}
            contact={contact}
            streamMsgId={activeLiveStreamMsgId}
            streamTitle={liveInfo.title || 'live'}
            initialMode={liveInfo.mode || 'live'}
            initialCameraOn={liveInfo.cameraOn ?? (liveInfo.mode === 'podcast' ? false : true)}
            initialMicOn={liveInfo.micOn ?? true}
            initialFilterId={liveInfo.filterId || 'normal'}
            isChannelCreator={isChannelCreator}
            subscribersCount={channelSubscribersCount}
            liveChatMessages={liveChatMessages}
            liveChatInput={liveChatInput}
            onChangeLiveChatInput={setLiveChatInput}
            onSendLiveChatMessage={handleSendLiveStreamChatMessage}
            onRenameStream={handleRenameChannelLiveStream}
            onDeleteStream={handleDeleteChannelLiveStream}
            primaryColor={primaryColor}
          />
        );
      })()}
      {/* Calendar-Based Group Video Call Scheduler Modal */}
      {isGroupChat && (
        <GroupVideoCallSchedulerModal
          isOpen={isGroupCallSchedulerOpen}
          onClose={() => setIsGroupCallSchedulerOpen(false)}
          groupId={contact.id}
          groupName={contact.name}
          participants={groupParticipants}
          scheduledCalls={scheduledGroupCalls}
          onSaveScheduledCall={handleSaveScheduledGroupCall}
          onUpdateRsvp={handleUpdateGroupCallRsvp}
          onDeleteScheduledCall={handleDeleteScheduledGroupCall}
          onStartVideoCallNow={() => onStartCall('video')}
          theme={theme}
          primaryColor={primaryColor}
        />
      )}

      {/* Snapchat-Style Face Mask, Effect & Filter Camera Modal (Photo & Video) */}
      <SnapFaceFilterCameraModal
        isOpen={isSnapFilterCameraOpen}
        onClose={() => setIsSnapFilterCameraOpen(false)}
        recipientName={contact.name}
        primaryColor={primaryColor}
        onSendPhoto={(photoDataUrl, caption) => {
          onSendMessage(caption || '', 'image', photoDataUrl);
          setReactionFeedback('📸 Sent filtered photo snap!');
        }}
        onSendVideo={(videoUrl, thumbnailDataUrl, caption, durationSec) => {
          onSendMessage(caption || 'Snap Filter Video', 'video', videoUrl, undefined, {
            thumbnailUrl: thumbnailDataUrl,
            videoPlatform: 'Snap Filter Camera',
            duration: `0:${String(durationSec || 5).padStart(2, '0')}`,
          });
          setReactionFeedback('🎥 Sent filtered video snap!');
        }}
      />
    </div>
  );
};
