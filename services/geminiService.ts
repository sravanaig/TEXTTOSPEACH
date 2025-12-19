
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, Accent, VoiceName, VOICE_METADATA } from "../types";

export class GeminiTTSService {
  /**
   * Generates audio data for the given text using Gemini 2.5 TTS.
   * Instantiates a new GoogleGenAI client per request for reliability.
   */
  async generateSpeech(
    text: string, 
    language: Language, 
    accent: Accent, 
    voice: VoiceName, 
    speed: number = 1.0,
    pitch: number = 1.0,
    volume: number = 0.8
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = 'gemini-2.5-flash-preview-tts';
    const voiceMeta = VOICE_METADATA[voice];
    
    // Constructing a high-precision instruction for the TTS engine
    let instruction = "";
    
    // Explicit style triggers
    const stylePrefix = accent === Accent.CHEERFUL ? "Say cheerfully: " : 
                        accent === Accent.FORMAL ? "Say formally: " : 
                        accent === Accent.ROMANTIC ? "Say romantically: " :
                        accent === Accent.PODCAST ? "Say in an engaging conversational podcast style: " :
                        accent === Accent.WHISPER ? "Whisper this quietly and softly: " : "";

    // Speed Description
    let speedDesc = "at a normal pace";
    if (speed <= 0.6) speedDesc = "very slowly";
    else if (speed <= 0.8) speedDesc = "slowly";
    else if (speed >= 1.7) speedDesc = "very quickly";
    else if (speed >= 1.3) speedDesc = "quickly";

    // Pitch Description
    let pitchDesc = "with a natural pitch";
    if (pitch >= 1.3) pitchDesc = "with a very high-pitched, bright voice";
    else if (pitch >= 1.1) pitchDesc = "with a slightly higher pitch";
    else if (pitch <= 0.7) pitchDesc = "with a deep, low-pitched voice";
    else if (pitch <= 0.9) pitchDesc = "with a slightly lower pitch";

    // Volume/Intensity Description
    let volDesc = "at a standard volume";
    if (accent === Accent.WHISPER) {
      volDesc = "softly, in a hushed whisper";
    } else if (volume >= 0.9) {
      volDesc = "loudly and powerfully";
    } else if (volume <= 0.4) {
      volDesc = "softly, almost in a whisper";
    } else if (volume <= 0.6) {
      volDesc = "quietly";
    }

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
        contents: [{ 
          parts: [{ text: fullPrompt }] 
        }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find(p => p.inlineData)?.inlineData?.data;

      if (!audioPart) {
        const textPart = parts.find(p => p.text)?.text;
        throw new Error(textPart || "Speech engine returned no audio data.");
      }

      return audioPart;
    } catch (error: any) {
      console.error("Gemini TTS Generation Error:", error);
      if (error.message?.includes("Rpc failed") || error.message?.includes("ProxyUnaryCall")) {
        throw new Error("Service busy. Please try again in a few seconds.");
      }
      throw new Error(error.message || "An error occurred during speech synthesis.");
    }
  }
}

export const ttsService = new GeminiTTSService();
