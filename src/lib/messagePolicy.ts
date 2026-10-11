export interface MessagePolicySection {
  id: string;
  title: string;
  summary: string;
  rules: string[];
}

export const OFFICIAL_MESSAGE_POLICY: MessagePolicySection[] = [
  {
    id: 'msg_encryption_privacy',
    title: '1. End-to-End Message Privacy & Protection',
    summary:
      'All one-on-one and group conversations are protected in transit and stored in compliance with platform security standards.',
    rules: [
      'Private messages, voice notes, and shared attachments are accessible only to conversation participants.',
      'Users may lock individual messages or conversations using a personal 4-digit security PIN.',
      'Custom chat wallpapers uploaded in a 2-participant conversation are shared between both chatting participants until the other participant uploads her own different wallpaper picture.',
    ],
  },
  {
    id: 'msg_acceptable_use',
    title: '2. Acceptable Messaging Conduct',
    summary:
      'To maintain a respectful global community, all messages must comply with anti-harassment and safety guidelines.',
    rules: [
      'Do not send unsolicited spam, phishing links, malware, or automated bulk messages.',
      'Harassment, hate speech, impersonation, and threats of violence are strictly prohibited.',
      'Respect recipient boundaries; users who block a contact will immediately stop receiving messages or calls from that account.',
    ],
  },
  {
    id: 'msg_media_voice',
    title: '3. Media, Voice Notes & Translation Integrity',
    summary:
      'Shared photos, videos, documents, and AI-translated voice notes must respect copyright and consent.',
    rules: [
      'Only share photos, videos, and documents that you own or have permission to distribute.',
      'Video auto-play is configurable by each user ("Video auto Play :off" in settings) to conserve mobile data and battery life.',
      'Group and channel administrators may moderate or lock participant message contributions when necessary.',
    ],
  },
  {
    id: 'msg_retention_deletion',
    title: '4. Message Deletion & Account Removal',
    summary:
      'Users retain full control over their sent messages, chat history, and account lifecycle.',
    rules: [
      'You can delete individual messages, archive conversations, or clear chat threads at any time.',
      'Deleting your account from the Profile page permanently removes your profile and personal session data.',
    ],
  },
];

export function validateMessageAgainstPolicy(text: string): {
  allowed: boolean;
  reason?: string;
} {
  const clean = (text || '').trim();
  if (!clean) {
    return { allowed: false, reason: 'Message cannot be empty.' };
  }
  if (clean.length > 5000) {
    return { allowed: false, reason: 'Message exceeds maximum length of 5,000 characters.' };
  }
  return { allowed: true };
}
