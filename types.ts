
export enum Language {
  ENGLISH = 'English',
  TELUGU = 'Telugu',
  MIXED = 'English-Telugu Mixed'
}

export enum Accent {
  NEUTRAL = 'Neutral',
  TELUGU_ACCENT = 'Telugu Accent',
  FORMAL = 'Formal',
  CHEERFUL = 'Cheerful',
  ROMANTIC = 'Romantic',
  PODCAST = 'Podcast',
  WHISPER = 'Whisper'
}

export enum VoiceName {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

export const VOICE_METADATA: Record<VoiceName, { label: string; gender: 'Male' | 'Female' }> = {
  [VoiceName.KORE]: { label: 'Anjali', gender: 'Female' },
  [VoiceName.ZEPHYR]: { label: 'Siri', gender: 'Female' },
  [VoiceName.PUCK]: { label: 'Arjun', gender: 'Male' },
  [VoiceName.CHARON]: { label: 'Venkat', gender: 'Male' },
  [VoiceName.FENRIR]: { label: 'Rajesh', gender: 'Male' },
};

export interface TTSPreset {
  id: string;
  name: string;
  language: Language;
  accent: Accent;
  voice: VoiceName;
  speed: number;
  pitch: number;
  volume: number;
}

export interface TTSHistoryItem {
  id: string;
  text: string;
  language: Language;
  accent: Accent;
  voice: VoiceName;
  speed: number;
  pitch: number;
  volume: number;
  timestamp: number;
  audioData?: string; // base64
}

export interface TTSConfig {
  voice: VoiceName;
  language: Language;
  accent: Accent;
  speed: number;
  pitch: number;
  volume: number;
}
