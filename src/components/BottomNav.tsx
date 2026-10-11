import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Phone, User, Bell, X } from 'lucide-react';
import { FooterPageTab, ScreenView, ThemeMode } from '../types';
import { getPersistentUserThumbnail } from '../lib/avatarHelper';
import {
  ChatIconActivityNotification,
  getChatIconNotifications,
  subscribeChatIconNotifications,
} from '../lib/chatIconNotificationsHelper';

interface BottomNavProps {
  currentScreen: ScreenView;
  onNavigate: (screen: ScreenView, footerTab?: FooterPageTab) => void;
  theme?: ThemeMode;
  unreadCount?: number;
  isAdminVerified?: boolean;
  primaryColor?: string;
  userAvatar?: string;
  appName?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  theme = 'light',
  unreadCount = 0,
  primaryColor = '#7C3AED',
  userAvatar,
}) => {
  const isDark = theme === 'dark';
  const resolvedProfileAvatar = getPersistentUserThumbnail({ avatar: userAvatar }, true);

  const [iconNotifications, setIconNotifications] = useState<ChatIconActivityNotification[]>(() =>
    getChatIconNotifications()
  );
  const [activePopoverNotif, setActivePopoverNotif] =
    useState<ChatIconActivityNotification | null>(() => {
      const unreadList = getChatIconNotifications().filter((n) => n.unread);
      return unreadList[0] || null;
    });

  useEffect(() => {
    const unsub = subscribeChatIconNotifications(({ notifications, latestAdded }) => {
      setIconNotifications(notifications);
      if (latestAdded) {
        setActivePopoverNotif(latestAdded);
      }
    });
    return unsub;
  }, []);

  const unreadActivityCount = iconNotifications.filter((n) => n.unread).length;
  const totalChatsBadgeCount = unreadCount + unreadActivityCount;

  return (
    <nav
      id="app-bottom-navigation"
      aria-label="Bottom Navigation Menu"
      className={`relative w-full border-t flex items-center justify-around pt-2.5 pb-2 px-3 select-none transition-colors duration-200 shrink-0 z-30 ${
        isDark
          ? 'bg-[#181A20] border-slate-800 text-slate-400'
          : 'bg-white border-slate-100 text-slate-500 shadow-xs'
      }`}
    >
      {/* Floating Chats Icon Notification Callout for Welcome Message & Friend Activities */}
      {activePopoverNotif && currentScreen !== 'chats' && (
        <div
          id="chats-icon-floating-notification"
          onClick={() => {
            setActivePopoverNotif(null);
            onNavigate('chats');
          }}
          className={`
            absolute left-2 -top-13 z-40 max-w-[290px] sm:max-w-[330px] px-3 py-2 rounded-2xl border shadow-xl cursor-pointer
            flex items-center gap-2 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200
            ${
              isDark
                ? 'bg-[#1F2635]/95 border-purple-500/50 text-white'
                : 'bg-slate-900/95 border-purple-400/50 text-white'
            }
          `}
        >
          <span
            style={{ backgroundColor: primaryColor }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs"
          >
            <Bell className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold text-emerald-400 truncate">
              {activePopoverNotif.type === 'welcome_message'
                ? '🎉 New User Welcome Notification'
                : activePopoverNotif.type === 'friend_befriended'
                ? '🤝 Friend Activity • New Friend'
                : '❤️ Friend Activity • Liked Media'}
            </p>
            <p className="text-[10px] text-slate-100 font-medium truncate">
              {activePopoverNotif.message}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActivePopoverNotif(null);
            }}
            className="p-0.5 rounded-full text-slate-400 hover:text-white cursor-pointer shrink-0"
            title="Dismiss notification preview"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 1. Chats Tab (Displays unread messages + Welcome Message + Friend Activity notifications) */}
      <button
        id="nav-chats-btn"
        type="button"
        onClick={() => {
          setActivePopoverNotif(null);
          onNavigate('chats');
        }}
        style={
          currentScreen === 'chats' || currentScreen === 'chat_detail'
            ? { color: primaryColor }
            : undefined
        }
        title={
          iconNotifications[0]
            ? `Chats (${totalChatsBadgeCount}) • Latest: ${iconNotifications[0].message}`
            : 'Chats'
        }
        className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-4 min-w-[70px] transition-all cursor-pointer ${
          currentScreen === 'chats' || currentScreen === 'chat_detail'
            ? 'font-extrabold'
            : isDark
            ? 'font-semibold hover:text-slate-200'
            : 'font-semibold hover:text-slate-800'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="w-7 h-7 sm:w-[30px] sm:h-[30px] stroke-[2.25]" />
          {totalChatsBadgeCount > 0 && (
            <span
              id="nav-chats-notification-badge"
              className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[10px] font-bold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-[#181A20] shadow-xs"
            >
              {totalChatsBadgeCount}
            </span>
          )}
          {unreadActivityCount > 0 && (
            <span
              id="nav-chats-activity-dot"
              className="absolute -bottom-0.5 -left-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#181A20] animate-pulse"
              title="New Welcome or Friend Activity Notification in Chats"
            />
          )}
        </div>
        <span className="text-[13px] leading-tight">Chats</span>
      </button>

      {/* 2. People Tab */}
      <button
        id="nav-people-btn"
        type="button"
        onClick={() => onNavigate('people')}
        style={currentScreen === 'people' ? { color: primaryColor } : undefined}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-4 min-w-[70px] transition-all cursor-pointer ${
          currentScreen === 'people'
            ? 'font-extrabold'
            : isDark
            ? 'font-semibold hover:text-slate-200'
            : 'font-semibold hover:text-slate-800'
        }`}
      >
        <Users className="w-7 h-7 sm:w-[30px] sm:h-[30px] stroke-[2.25]" />
        <span className="text-[13px] leading-tight">People</span>
      </button>

      {/* 3. Calls Tab */}
      <button
        id="nav-calls-btn"
        type="button"
        onClick={() => onNavigate('calls')}
        style={currentScreen === 'calls' ? { color: primaryColor } : undefined}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-4 min-w-[70px] transition-all cursor-pointer ${
          currentScreen === 'calls'
            ? 'font-extrabold'
            : isDark
            ? 'font-semibold hover:text-slate-200'
            : 'font-semibold hover:text-slate-800'
        }`}
      >
        <Phone className="w-7 h-7 sm:w-[30px] sm:h-[30px] stroke-[2.25]" />
        <span className="text-[13px] leading-tight">Calls</span>
      </button>

      {/* 4. Profile Tab */}
      <button
        id="nav-profile-btn"
        type="button"
        onClick={() => onNavigate('profile')}
        style={currentScreen === 'profile' ? { color: primaryColor } : undefined}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-4 min-w-[70px] transition-all cursor-pointer ${
          currentScreen === 'profile'
            ? 'font-extrabold'
            : isDark
            ? 'font-semibold hover:text-slate-200'
            : 'font-semibold hover:text-slate-800'
        }`}
      >
        <div className="w-7 h-7 sm:w-[30px] sm:h-[30px] rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
          {resolvedProfileAvatar ? (
            <img
              src={resolvedProfileAvatar}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          )}
        </div>
        <span className="text-[13px] leading-tight">Profile</span>
      </button>
    </nav>
  );
};

