
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
  ZEPHYR = 'Zephyr',
  CLONED = 'Cloned' // Sentinel for custom voices
}

export const VOICE_METADATA: Record<string, { label: string; gender: 'Male' | 'Female' | 'Custom' }> = {
  [VoiceName.KORE]: { label: 'Anjali', gender: 'Female' },
  [VoiceName.ZEPHYR]: { label: 'Siri', gender: 'Female' },
  [VoiceName.PUCK]: { label: 'Arjun', gender: 'Male' },
  [VoiceName.CHARON]: { label: 'Venkat', gender: 'Male' },
  [VoiceName.FENRIR]: { label: 'Rajesh', gender: 'Male' },
};

export interface ClonedVoice {
  id: string;
  name: string;
  audioData: string; // base64
  mimeType: string;
  timestamp: number;
}

export interface TTSPreset {
  id: string;
  name: string;
  language: Language;
  accent: Accent;
  voice: VoiceName | string; // Can be a ClonedVoice ID
  speed: number;
  pitch: number;
  volume: number;
}

export interface TTSHistoryItem {
  id: string;
  text: string;
  language: Language;
  accent: Accent;
  voice: VoiceName | string;
  speed: number;
  pitch: number;
  volume: number;
  timestamp: number;
  audioData?: string; // base64
  isCloned?: boolean;
}
