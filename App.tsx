
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ttsService } from './services/geminiService';
import { Language, Accent, VoiceName, TTSHistoryItem, TTSPreset } from './types';
import { decodeBase64, decodeAudioData, playAudioBuffer, pcmToWavBlob, downloadBlob } from './utils/audioUtils';
import VoiceSelector from './components/VoiceSelector';
import HistoryList from './components/HistoryList';
import PresetManager from './components/PresetManager';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Make aistudio optional to align with existing global declarations in the environment.
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [accent, setAccent] = useState<Accent>(Accent.TELUGU_ACCENT);
  const [voice, setVoice] = useState<VoiceName>(VoiceName.KORE);
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingExample, setIsGeneratingExample] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [history, setHistory] = useState<TTSHistoryItem[]>([]);
  const [presets, setPresets] = useState<TTSPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastAudioData, setLastAudioData] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [playbackStatus, setPlaybackStatus] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Check for API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  // Load history & presets from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('vani_tts_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    const savedPresets = localStorage.getItem('vani_tts_presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to load presets", e);
      }
    }
  }, []);

  // Sync state with localStorage
  useEffect(() => {
    localStorage.setItem('vani_tts_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('vani_tts_presets', JSON.stringify(presets));
  }, [presets]);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setError(null);
    }
  };

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handlePlayAudio = async (base64Data: string) => {
    initAudio();
    const ctx = audioContextRef.current!;
    
    if (activeSourceRef.current) {
      try { 
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop(); 
      } catch(e) {}
    }

    // Ensure context is running if it was previously paused/suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    try {
      const bytes = decodeBase64(base64Data);
      const buffer = await decodeAudioData(bytes, ctx);
      const source = playAudioBuffer(buffer, ctx);
      activeSourceRef.current = source;
      setPlaybackStatus('playing');

      source.onended = () => {
        setPlaybackStatus('stopped');
        activeSourceRef.current = null;
      };
    } catch (err) {
      console.error("Audio playback error:", err);
      setError("Playback failed. Please try again.");
      setPlaybackStatus('stopped');
    }
  };

  const togglePauseResume = async () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    if (playbackStatus === 'playing') {
      await ctx.suspend();
      setPlaybackStatus('paused');
    } else if (playbackStatus === 'paused') {
      await ctx.resume();
      setPlaybackStatus('playing');
    }
  };

  const stopPlayback = () => {
    if (activeSourceRef.current) {
      try { 
        activeSourceRef.current.stop(); 
      } catch(e) {}
    }
    setPlaybackStatus('stopped');
  };

  const generateTTS = async () => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      const audioData = await ttsService.generateSpeech(text, language, accent, voice, speed, pitch, volume);
      setLastAudioData(audioData);
      
      const newItem: TTSHistoryItem = {
        id: crypto.randomUUID(),
        text: text,
        language: language,
        accent: accent,
        voice: voice,
        speed: speed,
        pitch: pitch,
        volume: volume,
        timestamp: Date.now(),
        audioData: audioData
      };

      setHistory(prev => [newItem, ...prev].slice(0, 20));
      await handlePlayAudio(audioData);
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.includes("permission") || errMsg.includes("403") || errMsg.includes("not found")) {
        setError("API permission error. Please ensure you have a valid paid API key selected.");
        handleOpenKeySelector();
      } else {
        setError(errMsg || "Failed to generate speech. Check your connection or API key.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) {
      setError("Enter text to translate.");
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const targetLang = language === Language.ENGLISH ? "Telugu" : "English";
      const prompt = `Translate the following text into ${targetLang}. Provide ONLY the translation without any other text, quotes or labels. Text: "${text}"`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }]
      });
      
      const translatedText = response.text?.trim() || "";
      if (translatedText) {
        setText(translatedText);
        if (language === Language.ENGLISH) {
          setLanguage(Language.TELUGU);
          setAccent(Accent.NEUTRAL);
        } else {
          setLanguage(Language.ENGLISH);
          setAccent(Accent.TELUGU_ACCENT);
        }
      }
    } catch (err: any) {
      console.error("Translation failed:", err);
      if (err.message?.includes("403") || err.message?.includes("permission")) {
        handleOpenKeySelector();
      }
      setError("Translation failed. Please check your API key.");
    } finally {
      setIsTranslating(false);
    }
  };

  const savePreset = (name: string) => {
    const newPreset: TTSPreset = {
      id: crypto.randomUUID(),
      name,
      language,
      accent,
      voice,
      speed,
      pitch,
      volume
    };
    setPresets(prev => [...prev, newPreset]);
  };

  const loadPreset = (preset: TTSPreset) => {
    setLanguage(preset.language);
    setAccent(preset.accent);
    setVoice(preset.voice);
    setSpeed(preset.speed);
    setPitch(preset.pitch);
    setVolume(preset.volume);
  };

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const generateAIExample = async () => {
    setIsGeneratingExample(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Generate a single, short, creative English sentence (max 15 words) that is perfect for a ${accent} style of speaking. Do not include quotes or labels. Just the sentence.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }]
      });
      
      const exampleText = response.text?.trim() || "";
      if (exampleText) setText(exampleText);
    } catch (err: any) {
      console.error("Failed to generate example:", err);
      if (err.message?.includes("403")) handleOpenKeySelector();
      setError("Could not generate AI example.");
    } finally {
      setIsGeneratingExample(false);
    }
  };

  const handleDownloadLast = () => {
    if (!lastAudioData) return;
    const bytes = decodeBase64(lastAudioData);
    const blob = pcmToWavBlob(bytes);
    const safeName = text.slice(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'vani_tts';
    downloadBlob(blob, `vani_${safeName}.wav`);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 py-12 px-4 sm:px-6 lg:px-8">
      
      {!hasApiKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border border-indigo-50">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-key text-2xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">API Key Required</h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              To use Vani's high-fidelity generative voices, you need to select a paid API key from your Google AI Studio account.
            </p>
            <button
              onClick={handleOpenKeySelector}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2"
            >
              <span>Select API Key</span>
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
            <p className="mt-4 text-[10px] text-slate-400">
              Need help? Visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-indigo-500">Billing Docs</a>
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-4 transform hover:scale-105 transition-transform">
            <i className="fa-solid fa-waveform-lines text-2xl"></i>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Vani <span className="text-indigo-600">TTS</span></h1>
          <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto font-medium">
            Natural English & Telugu voices with authentic regional accents.
          </p>
        </header>

        {/* Main Interface */}
        <main className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-6 sm:p-10">
          
          <VoiceSelector 
            currentVoice={voice} setVoice={setVoice}
            currentLanguage={language} setLanguage={setLanguage}
            currentAccent={accent} setAccent={setAccent}
          />

          <PresetManager
            presets={presets}
            currentConfig={{ language, accent, voice, speed, pitch, volume }}
            onSave={savePreset}
            onLoad={loadPreset}
            onDelete={deletePreset}
          />

          {/* Audio Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                  <i className="fa-solid fa-gauge-high mr-2 text-indigo-500"></i>
                  Speed
                </label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {speed.toFixed(1)}x
                </span>
              </div>
              <input
                type="range" min="0.5" max="2.0" step="0.1" value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className={`p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 transition-all ${language === Language.TELUGU ? 'ring-2 ring-indigo-500/20' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                  <i className="fa-solid fa-arrows-up-down mr-2 text-indigo-500"></i>
                  Pitch
                </label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {pitch.toFixed(1)}
                </span>
              </div>
              <input
                type="range" min="0.5" max="1.5" step="0.1" value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                  <i className="fa-solid fa-volume-high mr-2 text-indigo-500"></i>
                  Volume
                </label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range" min="0.1" max="1.0" step="0.1" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          <div className="relative mb-4">
            <textarea
              className={`w-full h-48 p-6 text-lg bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none placeholder:text-slate-300 ${isTranslating ? 'opacity-50 grayscale cursor-wait' : ''}`}
              placeholder={language === Language.TELUGU ? "ఇక్కడ తెలుగు వచనాన్ని టైప్ చేయండి..." : "Type your English or Telugu text here..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isTranslating}
            />
            {isTranslating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/80 px-4 py-2 rounded-xl shadow-lg border border-indigo-100 flex items-center space-x-3">
                  <i className="fa-solid fa-circle-notch animate-spin text-indigo-600"></i>
                  <span className="text-sm font-bold text-slate-700">Translating...</span>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 right-4 text-xs font-bold text-slate-300 uppercase tracking-widest">
              {text.length} characters
            </div>
          </div>

          {/* Tools Section */}
          <div className="mb-8 p-5 rounded-2xl bg-slate-50/80 border border-slate-200/50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleTranslate}
                  disabled={isTranslating || !text.trim()}
                  className="px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 hover:border-indigo-300 shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center"
                >
                  {isTranslating ? (
                    <i className="fa-solid fa-circle-notch animate-spin mr-2"></i>
                  ) : (
                    <i className="fa-solid fa-language mr-2"></i>
                  )}
                  Translate to {language === Language.ENGLISH ? 'Telugu' : 'English'}
                </button>
                
                {language === Language.ENGLISH && (
                  <button 
                    onClick={generateAIExample}
                    disabled={isGeneratingExample}
                    className="px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 hover:border-indigo-300 shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center"
                  >
                    {isGeneratingExample ? (
                      <i className="fa-solid fa-circle-notch animate-spin mr-2"></i>
                    ) : (
                      <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                    )}
                    AI Example
                  </button>
                )}
              </div>
              <button 
                onClick={handleOpenKeySelector}
                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center"
              >
                <i className="fa-solid fa-key mr-1.5"></i>
                Change API Key
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center space-x-3">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span className="text-sm font-medium">{error}</span>
              {error.includes("permission") && (
                <button onClick={handleOpenKeySelector} className="text-xs font-bold underline ml-auto">Fix Now</button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={generateTTS}
                disabled={isLoading || !text.trim()}
                className={`group relative w-full sm:w-auto min-w-[200px] px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:bg-slate-300 disabled:shadow-none`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-microphone-lines text-xl group-hover:animate-pulse"></i>
                    <span>Speak Text</span>
                  </>
                )}
              </button>

              {playbackStatus !== 'stopped' && (
                <div className="flex items-center space-x-2 animate-in fade-in zoom-in duration-300">
                  <button
                    onClick={togglePauseResume}
                    className="w-14 h-14 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all shadow-sm"
                    title={playbackStatus === 'playing' ? 'Pause' : 'Resume'}
                  >
                    <i className={`fa-solid ${playbackStatus === 'playing' ? 'fa-pause' : 'fa-play'} text-lg`}></i>
                  </button>
                  <button
                    onClick={stopPlayback}
                    className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                    title="Stop"
                  >
                    <i className="fa-solid fa-stop text-lg"></i>
                  </button>
                </div>
              )}
            </div>

            {lastAudioData && !isLoading && (
              <button
                onClick={handleDownloadLast}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center space-x-3"
              >
                <i className="fa-solid fa-download text-lg"></i>
                <span>Download Audio</span>
              </button>
            )}
            
            <button
              onClick={() => {
                setText('');
                setLastAudioData(null);
                stopPlayback();
              }}
              className="w-full sm:w-auto px-8 py-4 text-slate-500 font-semibold hover:text-slate-800 transition-colors"
            >
              Clear Input
            </button>
          </div>
        </main>

        <HistoryList 
          history={history} 
          onPlay={(item) => item.audioData && handlePlayAudio(item.audioData)}
          onDelete={deleteHistoryItem}
          onClear={clearHistory}
        />

        <footer className="mt-16 text-center text-slate-400 text-sm pb-12">
          <p>Powered by Gemini 2.5 generative audio technology.</p>
          <div className="flex items-center justify-center space-x-4 mt-2">
            <span>High Fidelity PCM (24kHz)</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>Natural Telugu Accents</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
