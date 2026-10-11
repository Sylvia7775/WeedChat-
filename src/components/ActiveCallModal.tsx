import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  SwitchCamera,
  Grid,
  ShieldCheck,
  X,
  PhoneForwarded,
  UserPlus,
  Users,
  Check,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import { GroupParticipant, UserContact, UserProfile } from '../types';
import { getInitialsAvatar, getCleanAvatar, getPersistentUserThumbnail } from '../lib/avatarHelper';

export interface CallGridParticipant {
  id: string;
  name: string;
  avatar: string;
  nativeLanguage?: string;
  role?: string;
  isSelf?: boolean;
  isMuted?: boolean;
  status: 'joining' | 'connected';
}

interface ActiveCallModalProps {
  contactName: string;
  avatar: string;
  type: 'voice' | 'video';
  onEndCall: (summary?: { durationSecs: number; type: 'voice' | 'video' }) => void;
  isGroupCall?: boolean;
  initialParticipants?: GroupParticipant[];
  availableContacts?: UserContact[];
  currentUser?: UserProfile;
  primaryColor?: string;
}

const DEFAULT_FALLBACK_CANDIDATES: Array<{
  id: string;
  name: string;
  avatar: string;
  nativeLanguage: string;
}> = [
  {
    id: 'usr_elena_rodriguez',
    name: 'Elena Rodriguez',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    nativeLanguage: 'Spanish',
  },
  {
    id: 'user_kristin',
    name: 'Kristin Watson',
    avatar:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    nativeLanguage: 'English',
  },
  {
    id: 'usr_marcus_vance',
    name: 'Marcus Vance',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    nativeLanguage: 'French',
  },
  {
    id: 'usr_sophie_laurent',
    name: 'Sophie Laurent',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80',
    nativeLanguage: 'French',
  },
  {
    id: 'usr_lukas_weber',
    name: 'Lukas Weber',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    nativeLanguage: 'German',
  },
];

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  contactName,
  avatar,
  type: initialType,
  onEndCall,
  isGroupCall = false,
  initialParticipants = [],
  availableContacts = [],
  currentUser,
  primaryColor = '#7C3AED',
}) => {
  const [callType, setCallType] = useState<'voice' | 'video'>(initialType);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialType === 'video');
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [dialedKey, setDialedKey] = useState<string>('');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Group Voice Call state: Participants list & Add Participant sheet
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [forceGridLayout, setForceGridLayout] = useState<boolean>(Boolean(isGroupCall));
  const [participantSearch, setParticipantSearch] = useState('');
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState<number>(0);

  const myResolvedAvatar = useMemo(() => {
    if (currentUser) {
      return getPersistentUserThumbnail(currentUser, true);
    }
    return getInitialsAvatar('You', primaryColor);
  }, [currentUser, primaryColor]);

  const [participants, setParticipants] = useState<CallGridParticipant[]>(() => {
    const selfEntry: CallGridParticipant = {
      id: currentUser?.id || 'me',
      name: currentUser?.name ? `${currentUser.name} (You)` : 'You',
      avatar: myResolvedAvatar,
      nativeLanguage: currentUser?.motherLanguage || 'English',
      role: 'Host',
      isSelf: true,
      isMuted: false,
      status: 'connected',
    };

    if (isGroupCall && initialParticipants && initialParticipants.length > 0) {
      const others: CallGridParticipant[] = initialParticipants
        .filter((p) => p.id !== 'me' && p.id !== currentUser?.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          avatar: getCleanAvatar(p.name, p.avatar, primaryColor, p.id),
          nativeLanguage: p.nativeLanguage || 'English',
          role: p.role,
          isSelf: false,
          isMuted: false,
          status: 'connected' as const,
        }));
      if (others.length > 0) {
        return [selfEntry, ...others];
      }
    }

    if (isGroupCall) {
      // Seed 3 initial group voice participants if group had no explicit participants array
      const seeded = DEFAULT_FALLBACK_CANDIDATES.slice(0, 3).map((c) => ({
        id: c.id,
        name: c.name,
        avatar: getCleanAvatar(c.name, c.avatar, primaryColor, c.id),
        nativeLanguage: c.nativeLanguage,
        isSelf: false,
        isMuted: false,
        status: 'connected' as const,
      }));
      return [selfEntry, ...seeded];
    }

    // Standard 1-on-1 call: starts with You + the called contact
    return [
      selfEntry,
      {
        id: `callee_${contactName.toLowerCase().replace(/\s+/g, '_')}`,
        name: contactName,
        avatar: getCleanAvatar(contactName, avatar, primaryColor),
        nativeLanguage: 'English',
        isSelf: false,
        isMuted: false,
        status: 'connected',
      },
    ];
  });

  // Keep self mute state synced in participants grid
  useEffect(() => {
    setParticipants((prev) =>
      prev.map((p) => (p.isSelf ? { ...p, isMuted, avatar: myResolvedAvatar } : p))
    );
  }, [isMuted, myResolvedAvatar]);

  // Candidate contacts that can join the active audio call
  const joinableCandidates = useMemo(() => {
    const existingIds = new Set(participants.map((p) => p.id));
    const existingNames = new Set(
      participants.map((p) => p.name.replace(/\s*\(You\)$/i, '').toLowerCase())
    );

    const fromContacts = (availableContacts || [])
      .filter((c) => !c.isGroup && !c.isChannel && c.entityType !== 'group' && c.entityType !== 'channel')
      .map((c) => ({
        id: c.id,
        name: c.name,
        avatar: getCleanAvatar(c.name, c.avatar, primaryColor, c.id),
        nativeLanguage: c.nativeLanguage || 'English',
      }));

    const combined = [...fromContacts, ...DEFAULT_FALLBACK_CANDIDATES];
    const deduped: typeof DEFAULT_FALLBACK_CANDIDATES = [];
    const seen = new Set<string>();

    for (const item of combined) {
      const nameKey = item.name.toLowerCase();
      if (seen.has(item.id) || seen.has(nameKey)) continue;
      seen.add(item.id);
      seen.add(nameKey);
      if (existingIds.has(item.id) || existingNames.has(nameKey)) continue;
      if (
        participantSearch.trim() &&
        !nameKey.includes(participantSearch.trim().toLowerCase()) &&
        !item.nativeLanguage.toLowerCase().includes(participantSearch.trim().toLowerCase())
      ) {
        continue;
      }
      deduped.push(item);
    }

    return deduped;
  }, [availableContacts, participants, participantSearch, primaryColor]);

  // Handler to add a participant to the active audio call
  const handleAddParticipantToCall = (candidate: {
    id: string;
    name: string;
    avatar: string;
    nativeLanguage?: string;
  }) => {
    setForceGridLayout(true);
    if (callType !== 'voice') {
      setCallType('voice');
      setIsVideoEnabled(false);
    }

    const newParticipant: CallGridParticipant = {
      id: candidate.id,
      name: candidate.name,
      avatar: candidate.avatar,
      nativeLanguage: candidate.nativeLanguage || 'English',
      isSelf: false,
      isMuted: false,
      status: 'joining',
    };

    setParticipants((prev) => {
      if (prev.some((p) => p.id === candidate.id)) return prev;
      return [...prev, newParticipant];
    });

    // Transition from 'joining' to 'connected' after 900ms
    setTimeout(() => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === candidate.id ? { ...p, status: 'connected' } : p))
      );
    }, 900);
  };

  // Handler to add multiple participants at once ("Join All")
  const handleJoinMultipleParticipants = () => {
    const batch = joinableCandidates.slice(0, 3);
    if (batch.length === 0) return;
    setForceGridLayout(true);
    if (callType !== 'voice') {
      setCallType('voice');
      setIsVideoEnabled(false);
    }

    batch.forEach((candidate, idx) => {
      setTimeout(() => {
        handleAddParticipantToCall(candidate);
      }, idx * 200);
    });
    setIsAddParticipantOpen(false);
  };

  // Toggle mute for a specific remote participant in the group call grid
  const handleToggleParticipantMute = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== participantId) return p;
        if (p.isSelf) {
          handleToggleMute();
          return { ...p, isMuted: !isMuted };
        }
        return { ...p, isMuted: !p.isMuted };
      })
    );
  };

  // Remove a remote participant from the group call
  const handleRemoveParticipant = (participantId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId || p.isSelf));
  };

  // Audio Equalizer wave level
  const [audioLevel, setAudioLevel] = useState<number>(0.4);

  // Rotate active speaker highlight in group voice call
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const interval = setInterval(() => {
      setActiveSpeakerIndex((prev) => (prev + 1) % Math.max(1, participants.length));
    }, 2400);
    return () => clearInterval(interval);
  }, [callStatus, participants.length]);

  // Refs for media elements
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // 1. Play realistic phone ringing tone using Web Audio API
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        // Dual frequency ring tone (US/International standard 440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        // Ring cadence: 1.5s on, 2s off
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime + 1.4);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + 3.0);
        gain.gain.setValueAtTime(0, ctx.currentTime + 4.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        ringOscillatorRef.current = { osc1, osc2, gain };
      }
    } catch {
      // AudioContext unavailable or restricted
    }

    // Automatically transition from 'ringing' to 'connected' after 2.4s
    timeout = setTimeout(() => {
      stopRingtone();
      setCallStatus('connected');
    }, 2400);

    return () => {
      clearTimeout(timeout);
      stopRingtone();
    };
  }, []);

  const stopRingtone = () => {
    if (ringOscillatorRef.current) {
      try {
        ringOscillatorRef.current.osc1.stop();
        ringOscillatorRef.current.osc2.stop();
        ringOscillatorRef.current.gain.disconnect();
      } catch {
        // ignore
      }
      ringOscillatorRef.current = null;
    }
  };

  // 2. Camera & Microphone Stream Handler
  useEffect(() => {
    let isCancelled = false;

    const startLocalStream = async () => {
      if (callType === 'video' && isVideoEnabled) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            let stream: MediaStream;
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: { ideal: facingMode },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: false,
              });
            } catch {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            }

            if (isCancelled) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }

            localStreamRef.current = stream;
            setHasCameraPermission(true);
            setCameraError(null);

            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.play().catch(() => {});
            }

            // Acquire microphone separately so audio permissions never block video
            navigator.mediaDevices
              .getUserMedia({ audio: true, video: false })
              .then((audStream) => {
                if (isCancelled) {
                  audStream.getTracks().forEach((t) => t.stop());
                  return;
                }
                if (audioContextRef.current) {
                  try {
                    const source = audioContextRef.current.createMediaStreamSource(audStream);
                    const analyser = audioContextRef.current.createAnalyser();
                    analyser.fftSize = 64;
                    source.connect(analyser);
                    analyserRef.current = analyser;
                  } catch {
                    // Ignore audio graph errors
                  }
                }
              })
              .catch(() => {});
          } else {
            setHasCameraPermission(false);
            setCameraError('Camera access not supported on this browser');
          }
        } catch (err: unknown) {
          if (!isCancelled) {
            setHasCameraPermission(false);
            const errMsg = err instanceof Error ? err.message : 'Camera permission denied or unavailable';
            setCameraError(errMsg);
          }
        }
      } else {
        // Stop video tracks if video is disabled
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
        }
      }
    };

    startLocalStream();

    return () => {
      isCancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [callType, isVideoEnabled, facingMode]);

  // 3. Audio level simulation or analyzer loop
  useEffect(() => {
    let animId: number;
    const dataArray = new Uint8Array(32);

    const updateAudioWave = () => {
      if (analyserRef.current && !isMuted) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(1.0, 0.2 + avg / 120));
      } else if (callStatus === 'connected' && !isMuted) {
        // Simulated voice rhythm
        const time = Date.now() / 300;
        const synthLevel = 0.35 + Math.sin(time) * 0.25 + Math.cos(time * 1.7) * 0.15;
        setAudioLevel(Math.max(0.15, Math.min(0.9, synthLevel)));
      } else {
        setAudioLevel(0.1);
      }
      animId = requestAnimationFrame(updateAudioWave);
    };

    animId = requestAnimationFrame(updateAudioWave);
    animFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [callStatus, isMuted]);

  // 4. Call Duration Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callStatus === 'connected') {
      timer = setInterval(() => {
        setCallDuration((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  // 5. DTMF Keypad Tones
  const handleKeypadPress = (digit: string) => {
    setDialedKey((prev) => prev + digit);
    if (audioContextRef.current) {
      try {
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.frequency.setValueAtTime(697 + digit.charCodeAt(0) * 8, audioContextRef.current.currentTime);
        gain.gain.setValueAtTime(0.06, audioContextRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        osc.stop(audioContextRef.current.currentTime + 0.16);
      } catch {
        // Ignore
      }
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    }
  };

  // Toggle Video
  const handleToggleVideo = () => {
    const next = !isVideoEnabled;
    setIsVideoEnabled(next);
    if (next && callType === 'voice') {
      setCallType('video');
    }
  };

  // Flip Camera
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // End Call Handler
  const handleEndCall = () => {
    stopRingtone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setCallStatus('ended');
    setTimeout(() => {
      onEndCall({ durationSecs: callDuration, type: callType });
    }, 200);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const isMultiParticipantVoiceGrid =
    callType === 'voice' && (isGroupCall || forceGridLayout || participants.length > 2);

  return (
    <div
      id="active-call-modal"
      className="absolute inset-0 bg-[#0A0E17]/95 backdrop-blur-md z-50 flex flex-col justify-between p-4 sm:p-6 text-white select-none animate-in fade-in duration-200"
    >
      {/* Top Header info */}
      <div className="relative text-center pt-3 sm:pt-5 z-20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isMultiParticipantVoiceGrid
                ? `Group Voice Call • ${participants.length} Joined`
                : `Encrypted ${callType === 'video' ? 'Video' : 'Voice'} Call`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {callType === 'voice' && (
              <button
                id="call-toggle-group-grid-btn"
                type="button"
                onClick={() => setForceGridLayout((prev) => !prev)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                  isMultiParticipantVoiceGrid
                    ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                    : 'bg-white/10 hover:bg-white/20 border-white/15 text-slate-200'
                }`}
                title="Toggle Group Voice Grid Layout"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid ({participants.length})</span>
              </button>
            )}

            <button
              id="call-header-add-participant-btn"
              type="button"
              onClick={() => setIsAddParticipantOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className="px-3 py-1 rounded-full text-white text-[11px] font-extrabold flex items-center gap-1 shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              title="Add participants to join this active audio call"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add People</span>
            </button>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight drop-shadow-sm truncate">
          {isMultiParticipantVoiceGrid && participants.length > 2
            ? isGroupCall
              ? contactName
              : `${contactName} + ${participants.length - 2} more`
            : contactName}
        </h2>

        {callStatus === 'ringing' ? (
          <p className="text-xs sm:text-sm font-semibold text-emerald-400 mt-0.5 flex items-center justify-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              {isMultiParticipantVoiceGrid
                ? `Connecting ${participants.length} participants...`
                : 'Ringing...'}
            </span>
          </p>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <p className="text-xs sm:text-sm font-mono text-emerald-300 font-bold tracking-wider">
              {formatTime(callDuration)}
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold flex items-center gap-1">
              <Users className="w-3 h-3 text-emerald-400" />
              <span>{participants.length} in call</span>
            </span>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative my-2 min-h-0 overflow-y-auto">
        {callType === 'video' ? (
          <div className="relative w-full max-w-xs sm:max-w-sm h-80 sm:h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-slate-900 group">
            {/* Remote Video Stream */}
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
              {avatar ? (
                <img
                  src={avatar}
                  alt={contactName}
                  className="w-full h-full object-cover brightness-95"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-2xl">
                  {contactName.slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Remote participant audio wave badge */}
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-2 border border-white/10">
                <span className="text-[11px] font-bold text-white">{contactName}</span>
                <div className="flex items-center gap-0.5 h-3">
                  {[0.4, 0.8, 0.5, 0.9, 0.6].map((bar, i) => (
                    <span
                      key={i}
                      className="w-0.5 bg-emerald-400 rounded-full transition-all duration-100"
                      style={{ height: `${Math.round(bar * audioLevel * 12)}px` }}
                    />
                  ))}
                </div>
              </div>

              {/* HD Tag */}
              <div className="absolute top-3 right-3 bg-emerald-500/80 backdrop-blur-xs text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-xs">
                HD 1080p
              </div>
            </div>

            {/* Local User Stream (Picture in Picture) */}
            <div className="absolute bottom-3 right-3 w-24 h-32 sm:w-28 sm:h-36 rounded-2xl overflow-hidden border-2 border-emerald-400/80 shadow-2xl bg-black/80 z-20 group/pip">
              {isVideoEnabled ? (
                <div className="relative w-full h-full bg-slate-950">
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                        el.srcObject = localStreamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />
                  {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-slate-950/90">
                      <span className="text-[9px] text-rose-300 font-semibold leading-tight">
                        Allow Camera
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-950">
                  <VideoOff className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400">Camera Off</span>
                </div>
              )}

              {/* Local PiP Label */}
              <div className="absolute bottom-1 left-1 bg-black/60 px-1 py-0.2 rounded text-[8px] font-bold text-white">
                You
              </div>

              {/* Camera Flip Button on PiP */}
              {isVideoEnabled && (
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  title="Flip camera"
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white/80 hover:text-white cursor-pointer active:scale-90"
                >
                  <SwitchCamera className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Camera error / fallback notification banner */}
            {cameraError && isVideoEnabled && (
              <div className="absolute bottom-2 left-2 right-28 bg-black/75 backdrop-blur-md px-2 py-1 rounded-lg border border-amber-500/30 text-[10px] text-amber-200 flex items-center gap-1 z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="truncate">Camera simulated (preview mode)</span>
              </div>
            )}
          </div>
        ) : isMultiParticipantVoiceGrid ? (
          /* Group Voice Call Multi-Participant Grid Layout */
          <div className="w-full max-w-md mx-auto flex flex-col gap-3 px-1">
            <div
              id="group-voice-call-grid"
              className={`grid gap-2.5 sm:gap-3 w-full ${
                participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {participants.map((participant, idx) => {
                const isSpeakingNow =
                  callStatus === 'connected' &&
                  !participant.isMuted &&
                  participant.status === 'connected' &&
                  idx === activeSpeakerIndex;

                return (
                  <div
                    key={participant.id}
                    id={`group-call-participant-tile-${participant.id}`}
                    className={`relative rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-between border transition-all duration-200 ${
                      isSpeakingNow
                        ? 'bg-emerald-950/40 border-emerald-400 shadow-lg shadow-emerald-500/15 scale-[1.01]'
                        : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Top Row: Language / Status Pill & Mute/Remove controls */}
                    <div className="w-full flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold truncate">
                        {participant.status === 'joining'
                          ? 'Joining...'
                          : participant.nativeLanguage || 'Audio'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleParticipantMute(participant.id)}
                          title={participant.isMuted ? 'Unmute participant' : 'Mute participant'}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            participant.isMuted
                              ? 'bg-rose-500/90 text-white'
                              : 'bg-white/10 hover:bg-white/20 text-emerald-400'
                          }`}
                        >
                          {participant.isMuted ? (
                            <MicOff className="w-3 h-3" />
                          ) : (
                            <Mic className="w-3 h-3" />
                          )}
                        </button>

                        {!participant.isSelf && participants.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(participant.id)}
                            title={`Remove ${participant.name} from call`}
                            className="w-6 h-6 rounded-full bg-white/10 hover:bg-rose-500/80 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Center Avatar with Active Speaking Pulse Ring */}
                    <div className="relative my-1.5">
                      {isSpeakingNow && (
                        <div
                          className="absolute -inset-1.5 rounded-full bg-emerald-400/25 animate-pulse"
                          style={{ transform: `scale(${1.05 + audioLevel * 0.18})` }}
                        />
                      )}
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 relative z-10 shadow-md transition-all ${
                          participant.status === 'joining'
                            ? 'border-amber-400 opacity-75 animate-pulse'
                            : isSpeakingNow
                            ? 'border-emerald-400'
                            : 'border-white/25'
                        }`}
                      />
                      <span
                        className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0A0E17] z-20 ${
                          participant.status === 'joining'
                            ? 'bg-amber-400 animate-ping'
                            : participant.isMuted
                            ? 'bg-rose-500'
                            : 'bg-emerald-400'
                        }`}
                      />
                    </div>

                    {/* Participant Name & Live Voice Waveform */}
                    <div className="w-full text-center mt-1">
                      <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                        {participant.name}
                      </p>
                      <div className="flex items-center justify-center gap-1 h-4 mt-1">
                        {participant.status === 'joining' ? (
                          <span className="text-[10px] text-amber-300 font-semibold animate-pulse">
                            Ringing to join...
                          </span>
                        ) : participant.isMuted ? (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                            <MicOff className="w-2.5 h-2.5" />
                            <span>Muted</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-0.5 h-3">
                            {[0.4, 0.85, 1.0, 0.65, 0.9, 0.5].map((bar, barIdx) => (
                              <span
                                key={barIdx}
                                className={`w-0.5 rounded-full transition-all duration-100 ${
                                  isSpeakingNow ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                                style={{
                                  height: isSpeakingNow
                                    ? `${Math.max(3, Math.round(bar * audioLevel * 14))}px`
                                    : '4px',
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick "+ Join Participant" Tile inside the Grid */}
              {joinableCandidates.length > 0 && (
                <button
                  id="group-call-grid-add-tile-btn"
                  type="button"
                  onClick={() => setIsAddParticipantOpen(true)}
                  className="rounded-2xl p-3 sm:p-3.5 border border-dashed border-emerald-500/40 hover:border-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer min-h-[148px] group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-105">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-extrabold text-emerald-300">+ Add Participant</p>
                    <p className="text-[10px] text-slate-400">
                      {joinableCandidates.length} available to join
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Single 1-on-1 Voice Call Visuals with Pulsing Ring & Quick Prompt to Add Participants */
          <div className="flex flex-col items-center justify-center relative">
            <div className="relative mb-6">
              {/* Dynamic pulsing audio rings */}
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping transition-all duration-300"
                style={{ transform: `scale(${1.1 + audioLevel * 0.4})` }}
              />
              <div
                className="absolute -inset-4 rounded-full bg-emerald-500/10 animate-pulse transition-all duration-300"
                style={{ transform: `scale(${1.2 + audioLevel * 0.3})` }}
              />

              <img
                src={avatar}
                alt={contactName}
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-emerald-500 relative z-10 shadow-2xl"
              />

              {/* Online pulse dot */}
              <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-400 border-2 border-[#0A0E17] rounded-full z-20" />
            </div>

            {/* Live voice wave visualizer */}
            <div className="flex items-center gap-1.5 h-8 px-4 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-xs">
              <span className="text-[11px] text-emerald-400 font-semibold mr-1">Voice Audio:</span>
              {[0.3, 0.7, 0.9, 0.5, 0.8, 1.0, 0.6, 0.4, 0.7, 0.5].map((factor, i) => (
                <span
                  key={i}
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, Math.round(factor * audioLevel * 24))}px`,
                    opacity: isMuted ? 0.3 : 0.9,
                  }}
                />
              ))}
            </div>

            <button
              id="voice-call-switch-to-group-btn"
              type="button"
              onClick={() => setIsAddParticipantOpen(true)}
              className="mt-4 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-emerald-300 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Participants for Group Voice Call</span>
            </button>
          </div>
        )}

        {/* Add Participants to Group Voice Call Modal / Sheet */}
        {isAddParticipantOpen && (
          <div
            id="add-call-participants-modal"
            className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl p-4 flex flex-col justify-between z-30 animate-in zoom-in-95 duration-150 border border-white/15"
          >
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    style={{ backgroundColor: `${primaryColor}30`, color: primaryColor }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white">
                      Add Participants to Group Voice Call
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {participants.length} currently in call • Tap to join audio grid
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddParticipantOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Quick Join All Bar */}
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Search friends by name or language..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-slate-400 outline-none focus:border-emerald-400"
                />
                {joinableCandidates.length > 1 && (
                  <button
                    id="join-all-group-call-btn"
                    type="button"
                    onClick={handleJoinMultipleParticipants}
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold shrink-0 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Join All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Candidate List */}
            <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
              {joinableCandidates.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  All available friends have already joined the Group Voice Call!
                </div>
              ) : (
                joinableCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={cand.avatar}
                        alt={cand.name}
                        className="w-10 h-10 rounded-full object-cover border border-emerald-400/50 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{cand.name}</p>
                        <p className="text-[10px] text-emerald-400 font-medium">
                          {cand.nativeLanguage || 'English'} • Online
                        </p>
                      </div>
                    </div>
                    <button
                      id={`add-participant-btn-${cand.id}`}
                      type="button"
                      onClick={() => handleAddParticipantToCall(cand)}
                      style={{ backgroundColor: primaryColor }}
                      className="px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Join Call</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAddParticipantOpen(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-extrabold text-white cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Return to Group Voice Grid ({participants.length} Participants)</span>
            </button>
          </div>
        )}

        {/* In-Call Keypad Overlay if opened */}
        {isKeypadOpen && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-3xl p-4 flex flex-col justify-between z-30 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">In-Call Keypad</h4>
              <button
                type="button"
                onClick={() => setIsKeypadOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-2">
              <span className="text-xl font-mono tracking-widest text-emerald-400 min-h-7 inline-block">
                {dialedKey || 'Dial digits...'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto w-full">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadPress(d)}
                  className="w-12 h-12 mx-auto rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-base font-bold flex items-center justify-center transition-all cursor-pointer"
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsKeypadOpen(false)}
              className="w-full py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 mt-2"
            >
              Close Keypad
            </button>
          </div>
        )}
      </div>

      {/* Action Controls Bar */}
      <div className="relative pb-4 sm:pb-6 z-20">
        <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 flex-wrap">
          {/* Mute Mic toggle */}
          <button
            type="button"
            id="call-mute-toggle-btn"
            onClick={handleToggleMute}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
              isMuted ? 'bg-rose-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white active:scale-95'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Add Participant to Group Voice Call button */}
          <button
            type="button"
            id="call-add-participant-btn"
            onClick={() => setIsAddParticipantOpen((prev) => !prev)}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md relative ${
              isAddParticipantOpen
                ? 'bg-emerald-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white active:scale-95'
            }`}
            title="Add participant to Group Voice Call"
          >
            <UserPlus className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold flex items-center justify-center border border-[#0A0E17]">
              {participants.length}
            </span>
          </button>

          {/* Video Toggle (Switch to Video or Turn Off Camera) */}
          <button
            type="button"
            id="call-video-toggle-btn"
            onClick={handleToggleVideo}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
              isVideoEnabled ? 'bg-emerald-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white active:scale-95'
            }`}
            title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Switch Call Mode (Voice <-> Video) */}
          <button
            type="button"
            id="call-switch-type-btn"
            onClick={() => {
              const nextType = callType === 'voice' ? 'video' : 'voice';
              setCallType(nextType);
              setIsVideoEnabled(nextType === 'video');
            }}
            className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md"
            title={callType === 'voice' ? 'Switch to Video Call' : 'Switch to Audio Call'}
          >
            <PhoneForwarded className="w-5 h-5" />
          </button>

          {/* Keypad toggle */}
          <button
            type="button"
            id="call-keypad-btn"
            onClick={() => setIsKeypadOpen((prev) => !prev)}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
              isKeypadOpen ? 'bg-emerald-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white active:scale-95'
            }`}
            title="Dialpad"
          >
            <Grid className="w-5 h-5" />
          </button>

          {/* Speaker toggle */}
          <button
            type="button"
            id="call-speaker-btn"
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
              isSpeaker ? 'bg-emerald-600 text-white' : 'bg-white/15 hover:bg-white/25 text-white active:scale-95'
            }`}
            title={isSpeaker ? 'Speaker On' : 'Speaker Off'}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End Call */}
          <button
            type="button"
            id="call-end-btn"
            onClick={handleEndCall}
            className="w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-rose-500/35 transition-all cursor-pointer ml-1"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

