
import React from 'react';
import { VoiceName, Language, Accent, VOICE_METADATA } from '../types';

interface VoiceSelectorProps {
  currentVoice: VoiceName;
  setVoice: (v: VoiceName) => void;
  currentLanguage: Language;
  setLanguage: (l: Language) => void;
  currentAccent: Accent;
  setAccent: (a: Accent) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  currentVoice, setVoice,
  currentLanguage, setLanguage,
  currentAccent, setAccent
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Language Selection */}
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
          <i className="fa-solid fa-language mr-2 text-indigo-500"></i>
          Language
        </label>
        <div className="relative group">
          <select 
            value={currentLanguage}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full p-3.5 pl-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none appearance-none cursor-pointer text-slate-700 font-medium"
          >
            {Object.values(Language).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
            <i className="fa-solid fa-chevron-down text-xs"></i>
          </div>
        </div>
      </div>

      {/* Accent / Style Selection */}
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
          <i className="fa-solid fa-wand-magic-sparkles mr-2 text-indigo-500"></i>
          Speech Style
        </label>
        <div className="relative group">
          <select 
            value={currentAccent}
            onChange={(e) => setAccent(e.target.value as Accent)}
            className="w-full p-3.5 pl-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none appearance-none cursor-pointer text-slate-700 font-medium"
          >
            {Object.values(Accent).map(acc => {
              // Contextual labeling
              let label: string = acc;
              if (currentLanguage === Language.ENGLISH) {
                if (acc === Accent.TELUGU_ACCENT) label = "Telugu Regional Accent";
                if (acc === Accent.FORMAL) label = "Professional / Formal";
                if (acc === Accent.CHEERFUL) label = "Bright & Cheerful";
                if (acc === Accent.ROMANTIC) label = "Romantic & Soft";
                if (acc === Accent.PODCAST) label = "Podcast / Conversation";
                if (acc === Accent.WHISPER) label = "Soft Whisper";
              } else {
                if (acc === Accent.ROMANTIC) label = "Romantic / భావోద్వేగ";
                if (acc === Accent.PODCAST) label = "Podcast / సంభాషణ";
                if (acc === Accent.WHISPER) label = "Whisper / గుసగుస";
              }
              
              // Hide Telugu Accent option if Language is pure Telugu (it's redundant)
              if (currentLanguage === Language.TELUGU && acc === Accent.TELUGU_ACCENT) return null;

              return (
                <option key={acc} value={acc}>{label}</option>
              );
            })}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
            <i className="fa-solid fa-chevron-down text-xs"></i>
          </div>
        </div>
      </div>

      {/* Voice Selection */}
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
          <i className="fa-solid fa-user-tie mr-2 text-indigo-500"></i>
          Character Voice
        </label>
        <div className="relative group">
          <select 
            value={currentVoice}
            onChange={(e) => setVoice(e.target.value as VoiceName)}
            className="w-full p-3.5 pl-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none appearance-none cursor-pointer text-slate-700 font-medium"
          >
            {Object.entries(VOICE_METADATA).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label} ({meta.gender})
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
            <i className="fa-solid fa-chevron-down text-xs"></i>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSelector;
