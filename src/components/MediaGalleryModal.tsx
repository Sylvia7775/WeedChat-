import React from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { ChatMessage, UserContact, ThemeMode, ActiveMediaItem } from '../types';
import { MediaPictureGalleryView } from './MediaPictureGalleryView';

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: UserContact;
  messages: ChatMessage[];
  onSelectMedia: (media: ActiveMediaItem) => void;
  onJumpToMessage?: (messageId: string) => void;
  theme?: ThemeMode;
  primaryColor?: string;
  onToggleLikeMedia?: (mediaId: string, isLiked: boolean) => void;
  onToggleFavoriteMedia?: (mediaId: string, isFavorite: boolean) => void;
  onShareWithGroupMembers?: (media: ActiveMediaItem, memberIds: string[], note?: string) => void;
  onShareMediaInMessage?: (mediaUrl: string, mediaType: 'image' | 'video', title?: string) => void;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  isOpen,
  onClose,
  contact,
  messages,
  onSelectMedia,
  onJumpToMessage,
  theme = 'dark',
  primaryColor = '#7C3AED',
  onShareWithGroupMembers,
  onShareMediaInMessage,
}) => {
  const isDark = theme === 'dark';
  const isGroup = Boolean(contact.isGroup || contact.entityType === 'group');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl h-[92vh] max-h-[820px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-colors ${
          isDark
            ? 'bg-[#12161F] text-slate-100 border-slate-700/80'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Modal Top Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 transition-colors ${
            isDark ? 'bg-[#181D27] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">
                  {isGroup ? 'Group Gallery' : 'User Media Gallery & Browser'}
                </h3>
                {isGroup && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    Group Members Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{isGroup ? 'All media shared in' : 'Browse & share media with'}</span>
                <span style={{ color: primaryColor }} className="font-bold">{contact.name}</span>
                <span>•</span>
                <span className="text-[11px] opacity-80">
                  {isGroup
                    ? `${contact.participants?.length || 4} group members`
                    : contact.nativeLanguage}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-media-gallery-btn"
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-200/80 hover:bg-slate-300 border-slate-300 text-slate-700'
              }`}
              title="Close Media Gallery"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Gallery Content Area with 'Images', 'Videos', 'Documents' Tab Switcher */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <MediaPictureGalleryView
            messages={messages}
            contact={contact}
            theme={theme}
            primaryColor={primaryColor}
            onSelectMedia={isGroup ? undefined : onSelectMedia}
            onJumpToMessage={onJumpToMessage}
            isGroupGallery={isGroup}
            groupParticipants={contact.participants}
            onShareWithGroupMembers={onShareWithGroupMembers}
            onShareMediaInMessage={(media) => {
              if (onShareMediaInMessage) {
                const targetUrl = (media as any).mediaUrl || (media as any).url || '';
                const targetType = media.type === 'video' ? 'video' : 'image';
                onShareMediaInMessage(targetUrl, targetType, media.title);
                onClose();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
