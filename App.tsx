
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ttsService } from './services/geminiService';
import { Language, Accent, VoiceName, TTSHistoryItem, TTSPreset, ClonedVoice } from './types';
import { decodeBase64, decodeAudioData, playAudioBuffer, pcmToWavBlob, downloadBlob } from './utils/audioUtils';
import VoiceSelector from './components/VoiceSelector';
import HistoryList from './components/HistoryList';
import PresetManager from './components/PresetManager';
import VoiceCloner from './components/VoiceCloner';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
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
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [selectedClonedVoiceId, setSelectedClonedVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAudioData, setLastAudioData] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [playbackStatus, setPlaybackStatus] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('vani_tts_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedPresets = localStorage.getItem('vani_tts_presets');
    if (savedPresets) setPresets(JSON.parse(savedPresets));

    const savedClones = localStorage.getItem('vani_tts_clones');
    if (savedClones) setClonedVoices(JSON.parse(savedClones));
  }, []);

  useEffect(() => localStorage.setItem('vani_tts_history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('vani_tts_presets', JSON.stringify(presets)), [presets]);
  useEffect(() => localStorage.setItem('vani_tts_clones', JSON.stringify(clonedVoices)), [clonedVoices]);

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
    if (ctx.state === 'suspended') await ctx.resume();

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
      setError("Playback failed.");
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
      try { activeSourceRef.current.stop(); } catch(e) {}
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
      const activeClonedVoice = clonedVoices.find(v => v.id === selectedClonedVoiceId);
      
      const audioData = await ttsService.generateSpeech(
        text, 
        language, 
        accent, 
        selectedClonedVoiceId ? 'CLONED' : voice, 
        speed, 
        pitch, 
        volume,
        activeClonedVoice
      );
      
      setLastAudioData(audioData);
      
      const newItem: TTSHistoryItem = {
        id: crypto.randomUUID(),
        text: text,
        language: language,
        accent: accent,
        voice: selectedClonedVoiceId || voice,
        speed: speed,
        pitch: pitch,
        volume: volume,
        timestamp: Date.now(),
        audioData: audioData,
        isCloned: !!selectedClonedVoiceId
      };

      setHistory(prev => [newItem, ...prev].slice(0, 20));
      await handlePlayAudio(audioData);
    } catch (err: any) {
      const errMsg = err.message || "";
      // Handle API key resets if key is invalid or missing
      if (errMsg.includes("403") || errMsg.includes("permission") || errMsg.includes("Requested entity was not found")) {
        setError("API key issue. Please select a valid paid API key.");
        setHasApiKey(false);
        handleOpenKeySelector();
      } else {
        setError(errMsg || "Synthesis failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setIsTranslating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const targetLang = language === Language.ENGLISH ? "Telugu" : "English";
      const prompt = `Translate the following text into ${targetLang}. Provide ONLY the translation. Text: "${text}"`;
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
      const errMsg = err.message || "";
      if (errMsg.includes("Requested entity was not found")) {
        setHasApiKey(false);
        handleOpenKeySelector();
      }
      setError("Translation failed.");
    } finally {
      setIsTranslating(false);
    }
  };

  const savePreset = (name: string) => {
    const newPreset: TTSPreset = {
      id: crypto.randomUUID(),
      name, language, accent, 
      voice: selectedClonedVoiceId || voice, 
      speed, pitch, volume
    };
    setPresets(prev => [...prev, newPreset]);
  };

  const loadPreset = (preset: TTSPreset) => {
    setLanguage(preset.language);
    setAccent(preset.accent);
    if (preset.voice.startsWith('cloned_')) {
      setSelectedClonedVoiceId(preset.voice);
    } else {
      setSelectedClonedVoiceId(null);
      setVoice(preset.voice as VoiceName);
    }
    setSpeed(preset.speed);
    setPitch(preset.pitch);
    setVolume(preset.volume);
  };

  const generateAIExample = async () => {
    setIsGeneratingExample(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Generate a single short creative English sentence for a ${accent} speaker. Text only.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }]
      });
      const exampleText = response.text?.trim() || "";
      if (exampleText) setText(exampleText);
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.includes("Requested entity was not found")) {
        setHasApiKey(false);
        handleOpenKeySelector();
      }
      setError("Could not generate AI example.");
    } finally {
      setIsGeneratingExample(false);
    }
  };

  // Added fix for missing 'clearHistory' function
  const clearHistory = () => {
    if (window.confirm("Clear all items from your history?")) {
      setHistory([]);
    }
  };

  // Added fix for missing 'handleDownloadLast' function
  const handleDownloadLast = () => {
    if (!lastAudioData) return;
    const bytes = decodeBase64(lastAudioData);
    const blob = pcmToWavBlob(bytes);
    const safeName = text.slice(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'vani_audio';
    downloadBlob(blob, `vani_${safeName}.wav`);
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
            <p className="text-slate-500 mb-8 leading-relaxed">High-fidelity voices and cloning require a paid API key from Google AI Studio. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Check billing docs</a>.</p>
            <button onClick={handleOpenKeySelector} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2">
              <span>Select API Key</span>
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-4 transform hover:scale-105 transition-transform">
            <i className="fa-solid fa-waveform-lines text-2xl"></i>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Vani <span className="text-indigo-600">TTS</span></h1>
          <p className="mt-3 text-lg text-slate-500 font-medium">Clone voices. Speak anything. Natural Telugu & English.</p>
        </header>

        <main className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-6 sm:p-10">
          <VoiceCloner 
            clonedVoices={clonedVoices}
            onVoiceAdded={(v) => setClonedVoices(prev => [...prev, v])}
            onVoiceDeleted={(id) => {
              setClonedVoices(prev => prev.filter(v => v.id !== id));
              if (selectedClonedVoiceId === id) setSelectedClonedVoiceId(null);
            }}
            selectedClonedVoiceId={selectedClonedVoiceId}
            onSelectVoice={setSelectedClonedVoiceId}
          />

          {!selectedClonedVoiceId && (
            <VoiceSelector 
              currentVoice={voice} setVoice={setVoice}
              currentLanguage={language} setLanguage={setLanguage}
              currentAccent={accent} setAccent={setAccent}
            />
          )}

          {selectedClonedVoiceId && (
            <div className="mb-8 p-4 bg-indigo-600 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-100 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-dna animate-pulse"></i>
                <span className="font-bold text-sm">Cloned Voice Active: {clonedVoices.find(v => v.id === selectedClonedVoiceId)?.name}</span>
              </div>
              <button onClick={() => setSelectedClonedVoiceId(null)} className="text-xs font-bold underline opacity-80 hover:opacity-100">Switch to Prebuilt</button>
            </div>
          )}

          <PresetManager
            presets={presets}
            currentConfig={{ language, accent, voice, speed, pitch, volume }}
            onSave={savePreset}
            onLoad={loadPreset}
            onDelete={(id) => setPresets(prev => prev.filter(p => p.id !== id))}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Speed</label>
                <span className="text-[10px] font-bold text-indigo-600">{speed.toFixed(1)}x</span>
              </div>
              <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full h-1.5 accent-indigo-600" />
            </div>
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pitch</label>
                <span className="text-[10px] font-bold text-indigo-600">{pitch.toFixed(1)}</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.1" value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="w-full h-1.5 accent-indigo-600" />
            </div>
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volume</label>
                <span className="text-[10px] font-bold text-indigo-600">{Math.round(volume * 100)}%</span>
              </div>
              <input type="range" min="0.1" max="1.0" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 accent-indigo-600" />
            </div>
          </div>

          <div className="relative mb-4">
            <textarea
              className="w-full h-48 p-6 text-lg bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none placeholder:text-slate-300"
              placeholder={language === Language.TELUGU ? "ఇక్కడ తెలుగు వచనాన్ని టైప్ చేయండి..." : "Type your English or Telugu text here..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isTranslating}
            />
            {isTranslating && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-2xl">
                <i className="fa-solid fa-circle-notch animate-spin text-indigo-600 text-2xl"></i>
              </div>
            )}
          </div>

          <div className="mb-8 flex items-center space-x-2">
            <button onClick={handleTranslate} disabled={isTranslating || !text.trim()} className="px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 shadow-sm transition-all disabled:opacity-50">
              <i className="fa-solid fa-language mr-2"></i> Translate
            </button>
            <button onClick={generateAIExample} disabled={isGeneratingExample} className="px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 shadow-sm transition-all">
              <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> AI Example
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center text-sm">
              <i className="fa-solid fa-circle-exclamation mr-3"></i> {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={generateTTS}
                disabled={isLoading || !text.trim()}
                className="group w-full sm:w-auto min-w-[200px] px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center space-x-3"
              >
                {isLoading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-microphone-lines"></i>}
                <span>{selectedClonedVoiceId ? 'Cloned Speak' : 'Speak Text'}</span>
              </button>

              {playbackStatus !== 'stopped' && (
                <div className="flex items-center space-x-2">
                  <button onClick={togglePauseResume} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all">
                    <i className={`fa-solid ${playbackStatus === 'playing' ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>
                  <button onClick={stopPlayback} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all">
                    <i className="fa-solid fa-stop"></i>
                  </button>
                </div>
              )}
            </div>

            {lastAudioData && !isLoading && (
              <button onClick={handleDownloadLast} className="w-full sm:w-auto px-8 py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center space-x-3">
                <i className="fa-solid fa-download"></i> <span>Download</span>
              </button>
            )}
            
            <button onClick={() => { setText(''); setLastAudioData(null); stopPlayback(); }} className="w-full sm:w-auto px-8 py-4 text-slate-500 font-semibold hover:text-slate-800 transition-colors">Clear</button>
          </div>
        </main>

        <HistoryList history={history} onPlay={(item) => item.audioData && handlePlayAudio(item.audioData)} onDelete={(id) => setHistory(prev => prev.filter(i => i.id !== id))} onClear={clearHistory} />

        <footer className="mt-16 text-center text-slate-400 text-sm pb-12">
          <p>Powered by Gemini 2.5 Native Audio & TTS.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
