import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StatusBar } from './StatusBar';
import { BottomNav } from './BottomNav';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Users,
  Search,
  Globe,
  Handshake,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react';
import { CallLog, ScreenView, ThemeMode, UserContact } from '../types';
import { FriendshipModal } from './FriendshipModal';

interface CallsScreenProps {
  calls: CallLog[];
  contacts?: UserContact[];
  onStartCall: (
    contactName: string,
    avatar: string,
    type: 'voice' | 'video',
    isGroupCall?: boolean
  ) => void;
  onNavigate: (screen: ScreenView) => void;
  onViewProfile?: (contact: UserContact) => void;
  onOpenFriendshipModal?: (contact: UserContact) => void;
  onSelectChat?: (contact: UserContact) => void;
  onOpenChat?: (contact: UserContact) => void;
  onDeleteCall?: (callId: string) => void;
  onRestoreCall?: (call: CallLog) => void;
  theme?: ThemeMode;
  onOpenImportContacts?: () => void;
  onSyncContacts?: () => void;
  primaryColor?: string;
  isAdminVerified?: boolean;
  userAvatar?: string;
}

export const CallsScreen: React.FC<CallsScreenProps> = ({
  calls,
  contacts = [],
  onStartCall,
  onNavigate,
  onViewProfile,
  onOpenFriendshipModal,
  onSelectChat,
  onDeleteCall,
  onRestoreCall,
  theme = 'light',
  onOpenImportContacts,
  onSyncContacts,
  primaryColor = '#7C3AED',
  isAdminVerified = false,
  userAvatar,
}) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'all' | 'missed' | 'contacts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [friendshipContact, setFriendshipContact] = useState<UserContact | null>(null);

  // Swipe-to-Delete state for Call Logs
  const [localDeletedCallIds, setLocalDeletedCallIds] = useState<Set<string>>(new Set());
  const [swipedCallRowKey, setSwipedCallRowKey] = useState<string | null>(null);
  const [activeDraggingRowKey, setActiveDraggingRowKey] = useState<string | null>(null);
  const [callDragOffset, setCallDragOffset] = useState<number>(0);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);

  // Undo Toast state for Deleted Calls
  const [deletedCallToast, setDeletedCallToast] = useState<{
    call: CallLog;
    text: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleExecuteDeleteCall = (call: CallLog) => {
    setLocalDeletedCallIds((prev) => new Set(prev).add(call.id));
    setSwipedCallRowKey(null);
    setActiveDraggingRowKey(null);
    setCallDragOffset(0);
    if (onDeleteCall) {
      onDeleteCall(call.id);
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setDeletedCallToast({
      call,
      text: `Call with ${call.contactName} deleted`,
    });
    toastTimerRef.current = setTimeout(() => {
      setDeletedCallToast(null);
    }, 4500);
  };

  const handleRestoreDeletedCall = (call: CallLog) => {
    setLocalDeletedCallIds((prev) => {
      const next = new Set(prev);
      next.delete(call.id);
      return next;
    });
    if (onRestoreCall) {
      onRestoreCall(call);
    }
    setDeletedCallToast(null);
  };

  // Touch & Mouse Swipe Handlers for Call Rows
  const handleCallTouchStart = (e: React.TouchEvent, rowKey: string) => {
    const touch = e.touches[0];
    dragStartXRef.current = touch.clientX;
    dragStartYRef.current = touch.clientY;
    isHorizontalSwipeRef.current = false;
    if (swipedCallRowKey && swipedCallRowKey !== rowKey) {
      setSwipedCallRowKey(null);
    }
  };

  const handleCallTouchMove = (e: React.TouchEvent, rowKey: string) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartXRef.current;
    const deltaY = touch.clientY - dragStartYRef.current;

    if (!isHorizontalSwipeRef.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isHorizontalSwipeRef.current = true;
    }

    if (isHorizontalSwipeRef.current) {
      const clamped = Math.max(-140, Math.min(0, deltaX));
      setActiveDraggingRowKey(rowKey);
      setCallDragOffset(clamped);
    }
  };

  const handleCallTouchEnd = (rowKey: string, call: CallLog) => {
    if (activeDraggingRowKey === rowKey) {
      if (callDragOffset < -65) {
        handleExecuteDeleteCall(call);
      }
      setSwipedCallRowKey(null);
      setActiveDraggingRowKey(null);
      setCallDragOffset(0);
    }
  };

  const handleCallMouseDown = (e: React.MouseEvent, rowKey: string) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    isHorizontalSwipeRef.current = false;
    if (swipedCallRowKey && swipedCallRowKey !== rowKey) {
      setSwipedCallRowKey(null);
    }
  };

  const handleCallMouseMove = (e: React.MouseEvent, rowKey: string) => {
    if (!isMouseDownRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const deltaY = e.clientY - dragStartYRef.current;

    if (!isHorizontalSwipeRef.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isHorizontalSwipeRef.current = true;
    }

    if (isHorizontalSwipeRef.current) {
      const clamped = Math.max(-140, Math.min(0, deltaX));
      setActiveDraggingRowKey(rowKey);
      setCallDragOffset(clamped);
    }
  };

  const handleCallMouseUp = (rowKey: string, call: CallLog) => {
    isMouseDownRef.current = false;
    if (activeDraggingRowKey === rowKey) {
      if (callDragOffset < -65) {
        handleExecuteDeleteCall(call);
      }
      setSwipedCallRowKey(null);
      setActiveDraggingRowKey(null);
      setCallDragOffset(0);
    }
  };

  // Trigger contact synchronisation
  const handleTriggerSync = () => {
    setIsSyncing(true);
    if (onSyncContacts) {
      onSyncContacts();
    }
    setTimeout(() => {
      setIsSyncing(false);
      setSyncFeedback(`Successfully synchronised ${contacts.length} contacts with calls!`);
      setTimeout(() => setSyncFeedback(null), 3000);
    }, 600);
  };

  // Find matching contact for a call
  const getLinkedContact = (call: CallLog) => {
    return contacts.find(
      (c) =>
        c.id === call.contactId ||
        c.name.toLowerCase() === call.contactName.toLowerCase() ||
        (c.phoneNumber && call.phoneNumber && c.phoneNumber === call.phoneNumber)
    );
  };

  const handleOpenFriendship = (contact: UserContact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onOpenFriendshipModal) {
      onOpenFriendshipModal(contact);
    } else {
      setFriendshipContact(contact);
    }
  };

  // Filtered lists
  const filteredCalls = useMemo(() => {
    return calls.filter(
      (c) =>
        !localDeletedCallIds.has(c.id) &&
        c.contactName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [calls, searchQuery, localDeletedCallIds]);

  const missedCalls = useMemo(() => {
    return filteredCalls.filter((c) => c.direction === 'missed');
  }, [filteredCalls]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.nativeLanguage && c.nativeLanguage.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phoneNumber && c.phoneNumber.includes(searchQuery))
    );
  }, [contacts, searchQuery]);

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#12161F] text-white' : 'bg-white text-slate-900'
      }`}
    >
      {/* Top Header */}
      <div
        className="text-white pt-1 pb-3.5 px-4 rounded-b-[28px] shadow-sm z-10 transition-colors shrink-0"
        style={{ backgroundColor: primaryColor }}
      >
        <StatusBar time="9:41" theme="green" className="px-1 -mx-2" />

        <div className="flex items-center justify-between mt-1.5 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Calls</h1>
              {missedCalls.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow-xs">
                  <PhoneMissed className="w-2.5 h-2.5" />
                  {missedCalls.length} Missed
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/85 font-medium">
              Missed calls, contacts & translated calling
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Start Group Voice Call Button */}
            <button
              id="start-group-voice-call-btn"
              type="button"
              onClick={() => {
                const groupContact = contacts.find(
                  (c) => c.isGroup || c.entityType === 'group'
                );
                onStartCall(
                  groupContact?.name || 'Group Voice Call',
                  groupContact?.avatar ||
                    contacts[0]?.avatar ||
                    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=300&auto=format&fit=crop&q=80',
                  'voice',
                  true
                );
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white text-slate-900 hover:bg-white/90 active:scale-95 text-xs font-extrabold transition-all cursor-pointer shadow-xs"
              title="Start a Group Voice Call with multiple participants"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px]">Group Voice</span>
            </button>

            {/* Sync Contacts Button */}
            <button
              id="sync-contacts-calls-btn"
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
              title="Synchronise contacts with call logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Import Mobile Contacts Button */}
            {onOpenImportContacts && (
              <button
                id="import-contacts-calls-btn"
                onClick={onOpenImportContacts}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-xs font-bold transition-all cursor-pointer text-white"
                title="Import mobile phone contacts"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px]">Import</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Tab Selector: All Calls | Missed | Contacts */}
        <div className="grid grid-cols-3 bg-black/20 p-1 rounded-2xl text-[11px] font-bold gap-1 mt-1.5">
          <button
            type="button"
            id="calls-tab-all-btn"
            onClick={() => setActiveTab('all')}
            className={`py-1.5 px-1 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-white/85 hover:text-white'
            }`}
          >
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">All ({calls.length})</span>
          </button>

          <button
            type="button"
            id="calls-tab-missed-btn"
            onClick={() => setActiveTab('missed')}
            className={`py-1.5 px-1 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'missed'
                ? 'bg-red-500 text-white shadow-xs'
                : 'text-white/85 hover:text-white'
            }`}
          >
            <PhoneMissed className="w-3 h-3 shrink-0" />
            <span className="truncate">Missed ({missedCalls.length})</span>
          </button>

          <button
            type="button"
            id="calls-tab-contacts-btn"
            onClick={() => setActiveTab('contacts')}
            className={`py-1.5 px-1 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'contacts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-white/85 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3 shrink-0" />
            <span className="truncate">Contacts ({filteredContacts.length})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative mt-2">
          <input
            type="text"
            placeholder="Search calls, contacts, or languages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-1.5 pl-8 pr-3 bg-white/20 placeholder-white/75 text-white rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <Search className="w-3.5 h-3.5 text-white/75 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* Sync feedback notification */}
      {syncFeedback && (
        <div
          style={{
            backgroundColor: `${primaryColor}18`,
            borderColor: `${primaryColor}40`,
            color: primaryColor,
          }}
          className="mx-4 mt-2 px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{syncFeedback}</span>
        </div>
      )}

      {/* Main Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* ==================================================================== */}
        {/* 1. MISSED CALLS SECTION (Displayed in 'all' and 'missed')           */}
        {/* ==================================================================== */}
        {(activeTab === 'all' || activeTab === 'missed') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <PhoneMissed className="w-3.5 h-3.5 text-red-500" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-500">
                  Missed Calls ({missedCalls.length})
                </h3>
              </div>
              {activeTab === 'all' && missedCalls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('missed')}
                  className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                >
                  View Missed Only
                </button>
              )}
            </div>

            {missedCalls.length === 0 ? (
              <div
                className={`p-4 rounded-2xl border text-center ${
                  isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                }`}
              >
                <PhoneMissed className="w-6 h-6 mx-auto mb-1 text-slate-400 opacity-60" />
                <p className="text-xs font-semibold text-slate-400">No missed calls</p>
              </div>
            ) : (
              <div className="space-y-2">
                {missedCalls.map((call) => {
                  const linkedContact = getLinkedContact(call);
                  const rowKey = `missed-${call.id}`;
                  const isDragging = activeDraggingRowKey === rowKey;
                  const offset = isDragging ? callDragOffset : 0;

                  return (
                    <div
                      key={rowKey}
                      className="relative overflow-hidden rounded-2xl select-none"
                    >
                      <div
                        onTouchStart={(e) => handleCallTouchStart(e, rowKey)}
                        onTouchMove={(e) => handleCallTouchMove(e, rowKey)}
                        onTouchEnd={() => handleCallTouchEnd(rowKey, call)}
                        onMouseDown={(e) => handleCallMouseDown(e, rowKey)}
                        onMouseMove={(e) => handleCallMouseMove(e, rowKey)}
                        onMouseUp={() => handleCallMouseUp(rowKey, call)}
                        onMouseLeave={() => {
                          isMouseDownRef.current = false;
                          if (activeDraggingRowKey === rowKey) {
                            setActiveDraggingRowKey(null);
                            setCallDragOffset(0);
                          }
                        }}
                        style={{
                          transform: `translateX(${offset}px)`,
                          transition: isDragging ? 'none' : 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        }}
                        className={`relative z-10 flex items-center justify-between p-2.5 rounded-2xl border transition-colors ${
                          isDark
                            ? 'bg-[#1C161D] border-red-500/30 hover:bg-[#241A24]'
                            : 'bg-red-50 border-red-200 hover:bg-red-100/70'
                        }`}
                      >
                        <div
                          onClick={() => {
                            if (onViewProfile && linkedContact) onViewProfile(linkedContact);
                          }}
                          className="flex items-center gap-3 min-w-0 cursor-pointer"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={linkedContact ? linkedContact.avatar : call.avatar}
                              alt={call.contactName}
                              className="w-15 h-15 rounded-full object-cover border-2 border-red-400 shadow-sm"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center border border-white dark:border-[#12161F]">
                              <PhoneMissed className="w-2.5 h-2.5" />
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-xs sm:text-sm text-red-600 dark:text-red-400 truncate">
                                {call.contactName}
                              </h4>
                              <span className="text-[9px] bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 px-1.5 py-0.2 rounded-full font-bold">
                                Missed {call.type === 'video' ? 'Video' : 'Voice'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                              <span>{call.time}</span>
                              {linkedContact?.nativeLanguage && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: primaryColor }} className="font-semibold">
                                    {linkedContact.nativeLanguage}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Call Back Actions + Delete button */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() =>
                              onStartCall(
                                call.contactName,
                                linkedContact ? linkedContact.avatar : call.avatar,
                                'voice'
                              )
                            }
                            className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                            title={`Call back ${call.contactName} (Voice)`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onStartCall(
                                call.contactName,
                                linkedContact ? linkedContact.avatar : call.avatar,
                                'video'
                              )
                            }
                            style={{ backgroundColor: primaryColor }}
                            className="w-8 h-8 rounded-full hover:brightness-110 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                            title={`Video Call ${call.contactName}`}
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-missed-call-btn-${call.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExecuteDeleteCall(call);
                            }}
                            className="w-8 h-8 rounded-full bg-rose-500/15 hover:bg-rose-600 text-rose-500 hover:text-white active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                            title="Delete call log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 2. ALL RECENT CALL LOGS (Displayed in 'all')                        */}
        {/* ==================================================================== */}
        {activeTab === 'all' && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                All Call History ({filteredCalls.length})
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">
                Swipe left to delete • Auto-Synced
              </span>
            </div>

            <div className="space-y-1.5">
              {filteredCalls.map((call) => {
                const isMissed = call.direction === 'missed';
                const linkedContact = getLinkedContact(call);
                const rowKey = `all-${call.id}`;
                const isDragging = activeDraggingRowKey === rowKey;
                const offset = isDragging ? callDragOffset : 0;

                return (
                  <div
                    key={call.id}
                    id={`call-row-container-${call.id}`}
                    className="relative overflow-hidden rounded-2xl select-none"
                  >
                    <div
                      onTouchStart={(e) => handleCallTouchStart(e, rowKey)}
                      onTouchMove={(e) => handleCallTouchMove(e, rowKey)}
                      onTouchEnd={() => handleCallTouchEnd(rowKey, call)}
                      onMouseDown={(e) => handleCallMouseDown(e, rowKey)}
                      onMouseMove={(e) => handleCallMouseMove(e, rowKey)}
                      onMouseUp={() => handleCallMouseUp(rowKey, call)}
                      onMouseLeave={() => {
                        isMouseDownRef.current = false;
                        if (activeDraggingRowKey === rowKey) {
                          setActiveDraggingRowKey(null);
                          setCallDragOffset(0);
                        }
                      }}
                      style={{
                        transform: `translateX(${offset}px)`,
                        transition: isDragging ? 'none' : 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      }}
                      className={`relative z-10 flex items-center justify-between py-2.5 px-2.5 rounded-2xl border transition-colors ${
                        isDark
                          ? 'bg-[#141923] hover:bg-[#1a2130] border-slate-800/60'
                          : 'bg-white hover:bg-slate-50 border-slate-100 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          onClick={(e) => {
                            if (onViewProfile && linkedContact) {
                              e.stopPropagation();
                              onViewProfile(linkedContact);
                            }
                          }}
                          className="relative shrink-0 cursor-pointer"
                        >
                          <img
                            src={linkedContact ? linkedContact.avatar : call.avatar}
                            alt={call.contactName}
                            className="w-15 h-15 rounded-full object-cover shadow-sm border-2 border-slate-200 dark:border-slate-700"
                          />
                          {linkedContact && linkedContact.online && (
                            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#12161F] rounded-full" />
                          )}
                        </div>

                        <div
                          className="min-w-0"
                          onClick={() => {
                            if (onViewProfile && linkedContact) {
                              onViewProfile(linkedContact);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <h4
                              className={`font-bold text-xs sm:text-sm truncate ${
                                isMissed ? 'text-red-500' : ''
                              } ${linkedContact && onViewProfile ? 'hover:underline cursor-pointer' : ''}`}
                            >
                              {call.contactName}
                            </h4>
                            {linkedContact && (
                              <span
                                style={{
                                  backgroundColor: `${primaryColor}18`,
                                  color: primaryColor,
                                }}
                                className="text-[9px] px-1.5 py-0.2 rounded-full font-bold"
                              >
                                {linkedContact.nativeLanguage}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                            {call.direction === 'incoming' && (
                              <PhoneIncoming style={{ color: primaryColor }} className="w-3.5 h-3.5" />
                            )}
                            {call.direction === 'outgoing' && (
                              <PhoneOutgoing className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            {call.direction === 'missed' && (
                              <PhoneMissed className="w-3.5 h-3.5 text-red-500" />
                            )}
                            <span>{call.time}</span>
                            {call.duration && (
                              <>
                                <span>•</span>
                                <span>{call.duration}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Voice, Video & Delete buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() =>
                            onStartCall(
                              call.contactName,
                              linkedContact ? linkedContact.avatar : call.avatar,
                              'voice'
                            )
                          }
                          style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                          className="w-8 h-8 rounded-full hover:brightness-110 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                          title={`Voice Call ${call.contactName}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onStartCall(
                              call.contactName,
                              linkedContact ? linkedContact.avatar : call.avatar,
                              'video'
                            )
                          }
                          style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                          className="w-8 h-8 rounded-full hover:brightness-110 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                          title={`Video Call ${call.contactName}`}
                        >
                          <Video className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-call-btn-${call.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteDeleteCall(call);
                          }}
                          className="w-8 h-8 rounded-full bg-rose-500/15 hover:bg-rose-600 text-rose-500 hover:text-white active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                          title="Delete call log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 3. SYNCHRONISED CONTACTS TAB (Quick Dial + Friendship Hub)          */}
        {/* ==================================================================== */}
        {activeTab === 'contacts' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Synchronised Contacts ({filteredContacts.length})
              </h3>
              {onOpenImportContacts && (
                <button
                  type="button"
                  onClick={onOpenImportContacts}
                  style={{ color: primaryColor }}
                  className="text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Import More</span>
                </button>
              )}
            </div>

            {filteredContacts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">No contacts match "{searchQuery}"</p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                return (
                  <div
                    key={contact.id}
                    className={`flex items-center justify-between py-2.5 px-2 rounded-xl transition-colors ${
                      isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div
                      onClick={() => handleOpenFriendship(contact)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={contact.avatar}
                          alt={contact.name}
                          className="w-15 h-15 rounded-full object-cover shadow-sm border-2 border-slate-200 dark:border-slate-700"
                        />
                        {contact.online && (
                          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#12161F] rounded-full" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs sm:text-sm truncate">{contact.name}</h4>
                          {contact.relationshipTier && (
                            <span
                              style={{
                                backgroundColor: `${primaryColor}18`,
                                color: primaryColor,
                              }}
                              className="text-[9px] px-1.5 py-0.2 rounded-full font-bold"
                            >
                              {contact.relationshipTier}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                          <Globe style={{ color: primaryColor }} className="w-3 h-3 shrink-0" />
                          <span style={{ color: primaryColor }} className="font-semibold">
                            {contact.nativeLanguage || 'English'}
                          </span>
                          {contact.phoneNumber && !contact.hidePhoneNumberPublic && (
                            <>
                              <span>•</span>
                              <span className="truncate">{contact.phoneNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Voice & Video Call Buttons only */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => onStartCall(contact.name, contact.avatar, 'voice')}
                        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                        className="w-8 h-8 rounded-full hover:brightness-110 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                        title={`Voice Call ${contact.name}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartCall(contact.name, contact.avatar, 'video')}
                        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                        className="w-8 h-8 rounded-full hover:brightness-110 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                        title={`Video Call ${contact.name}`}
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Undo Toast for Deleted Call */}
      {deletedCallToast && (
        <div className="absolute bottom-20 left-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 border bg-slate-900/95 border-white/10 text-white backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-xs font-medium truncate">{deletedCallToast.text}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleRestoreDeletedCall(deletedCallToast.call)}
                className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => setDeletedCallToast(null)}
                className="p-1 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friendship & Engagement Modal */}
      {friendshipContact && (
        <FriendshipModal
          isOpen={Boolean(friendshipContact)}
          onClose={() => setFriendshipContact(null)}
          contact={friendshipContact}
          currentUserAvatar={userAvatar}
          onStartCall={(type) =>
            onStartCall(friendshipContact.name, friendshipContact.avatar, type)
          }
          onOpenChat={(c) => {
            if (onSelectChat) {
              onSelectChat(c);
            } else {
              onNavigate('chats');
            }
          }}
          theme={theme}
          primaryColor={primaryColor}
        />
      )}

      <BottomNav
        currentScreen="calls"
        onNavigate={onNavigate}
        theme={theme}
        unreadCount={3}
        primaryColor={primaryColor}
        isAdminVerified={isAdminVerified}
        userAvatar={userAvatar}
      />

      {/* Device Bottom Home Indicator Bar (iOS style) */}
      <div className="w-full flex justify-center pb-2 pt-0.5 bg-white dark:bg-[#181A20] shrink-0 z-30">
        <div className="w-32 h-1 bg-slate-900/25 dark:bg-white/25 rounded-full pointer-events-none" />
      </div>
    </div>
  );
};
