
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, Accent, VoiceName, VOICE_METADATA, ClonedVoice } from "../types";

export class GeminiTTSService {
  async generateSpeech(
    text: string, 
    language: Language, 
    accent: Accent, 
    voice: VoiceName | string, 
    speed: number = 1.0,
    pitch: number = 1.0,
    volume: number = 0.8,
    clonedVoice?: ClonedVoice
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // If a cloned voice is active, we use the Native Audio model which supports audio-to-audio
    if (clonedVoice) {
      const nativeModel = 'gemini-2.5-flash-native-audio-preview-09-2025';
      const prompt = `Please speak the following text clearly. Match the voice, tone, and character of the provided audio sample as closely as possible. 
      Text to speak: "${text.trim()}"
      Language: ${language}
      Desired Speed: ${speed}x
      Pitch Adjustment: ${pitch}`;

      try {
        const response = await ai.models.generateContent({
          model: nativeModel,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: clonedVoice.mimeType,
                  data: clonedVoice.audioData
                }
              },
              { text: prompt }
            ]
          },
          config: {
            responseModalities: [Modality.AUDIO]
          }
        });

        const audioPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData)?.inlineData?.data;
        if (!audioPart) throw new Error("Voice cloning engine failed to produce audio.");
        return audioPart;
      } catch (err: any) {
        console.error("Voice Cloning Error:", err);
        throw new Error(err.message || "Failed to synthesize speech using cloned voice.");
      }
    }

    // Standard Prebuilt TTS Logic
    const modelName = 'gemini-2.5-flash-preview-tts';
    const voiceMeta = VOICE_METADATA[voice as VoiceName] || { label: 'Assistant', gender: 'Female' };
    
    let instruction = "";
    const stylePrefix = accent === Accent.CHEERFUL ? "Say cheerfully: " : 
                        accent === Accent.FORMAL ? "Say formally: " : 
                        accent === Accent.ROMANTIC ? "Say romantically: " :
                        accent === Accent.PODCAST ? "Say in an engaging conversational podcast style: " :
                        accent === Accent.WHISPER ? "Whisper this quietly and softly: " : "";

    let speedDesc = "at a normal pace";
    if (speed <= 0.6) speedDesc = "very slowly";
    else if (speed <= 0.8) speedDesc = "slowly";
    else if (speed >= 1.7) speedDesc = "very quickly";
    else if (speed >= 1.3) speedDesc = "quickly";

    let pitchDesc = "with a natural pitch";
    if (pitch >= 1.3) pitchDesc = "with a very high-pitched, bright voice";
    else if (pitch >= 1.1) pitchDesc = "with a slightly higher pitch";
    else if (pitch <= 0.7) pitchDesc = "with a deep, low-pitched voice";
    else if (pitch <= 0.9) pitchDesc = "with a slightly lower pitch";

    let volDesc = "at a standard volume";
    if (accent === Accent.WHISPER) volDesc = "softly, in a hushed whisper";
    else if (volume >= 0.9) volDesc = "loudly and powerfully";
    else if (volume <= 0.4) volDesc = "softly, almost in a whisper";

    const audioInstruction = `Speak ${speedDesc}, ${pitchDesc}, and ${volDesc}.`;

    if (language === Language.TELUGU) {
      instruction = `As ${voiceMeta.label}, read this Telugu text clearly. ${audioInstruction} ${stylePrefix}`;
    } else if (language === Language.ENGLISH) {
      if (accent === Accent.TELUGU_ACCENT) {
        instruction = `As ${voiceMeta.label}, read this English text with a natural, clear Telugu regional accent. ${audioInstruction}`;
      } else {
        instruction = `As ${voiceMeta.label}, read this English text. ${audioInstruction} ${stylePrefix}`;
      }
    } else {
      instruction = `As ${voiceMeta.label}, read this mixed text naturally. ${audioInstruction} ${stylePrefix}`;
    }

    const fullPrompt = `${instruction}\n"${text.trim()}"`;

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice as VoiceName },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find(p => p.inlineData)?.inlineData?.data;
      if (!audioPart) throw new Error("Speech engine returned no audio data.");
      return audioPart;
    } catch (error: any) {
      console.error("Gemini TTS Error:", error);
      throw new Error(error.message || "An error occurred during speech synthesis.");
    }
  }
}

export const ttsService = new GeminiTTSService();
