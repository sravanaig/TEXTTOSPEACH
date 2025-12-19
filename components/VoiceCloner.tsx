
import React, { useState, useRef } from 'react';
import { ClonedVoice } from '../types';
import { fileToBase64 } from '../utils/audioUtils';

interface VoiceClonerProps {
  clonedVoices: ClonedVoice[];
  onVoiceAdded: (voice: ClonedVoice) => void;
  onVoiceDeleted: (id: string) => void;
  selectedClonedVoiceId: string | null;
  onSelectVoice: (id: string | null) => void;
}

const VoiceCloner: React.FC<VoiceClonerProps> = ({
  clonedVoices,
  onVoiceAdded,
  onVoiceDeleted,
  selectedClonedVoiceId,
  onSelectVoice
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File too large. Please use a sample under 2MB (approx 10-15 seconds).");
      return;
    }

    setIsUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const name = file.name.split('.')[0] || "Custom Voice";
      
      const newVoice: ClonedVoice = {
        id: `cloned_${crypto.randomUUID()}`,
        name: name.slice(0, 15),
        audioData: base64,
        mimeType: file.type || 'audio/mpeg',
        timestamp: Date.now()
      };

      onVoiceAdded(newVoice);
      onSelectVoice(newVoice.id);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to process audio sample.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-10 p-6 bg-indigo-50/30 border border-indigo-100 rounded-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center">
            <i className="fa-solid fa-dna mr-2 text-indigo-500"></i>
            Voice Cloning
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Upload a 5-10s sample to clone a unique voice</p>
        </div>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
        >
          {isUploading ? (
            <i className="fa-solid fa-circle-notch animate-spin mr-2"></i>
          ) : (
            <i className="fa-solid fa-cloud-arrow-up mr-2"></i>
          )}
          New Sample
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="audio/*" 
          className="hidden" 
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <button
          onClick={() => onSelectVoice(null)}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
            selectedClonedVoiceId === null 
              ? 'bg-white border-indigo-500 shadow-md ring-4 ring-indigo-50' 
              : 'bg-white/50 border-slate-100 hover:border-slate-300'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <i className="fa-solid fa-user-robot text-sm"></i>
          </div>
          <span className="text-[10px] font-bold text-slate-600">Default Voices</span>
        </button>

        {clonedVoices.map((voice) => (
          <div key={voice.id} className="relative group">
            <button
              onClick={() => onSelectVoice(voice.id)}
              className={`w-full flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                selectedClonedVoiceId === voice.id 
                  ? 'bg-white border-indigo-500 shadow-md ring-4 ring-indigo-50' 
                  : 'bg-white/50 border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                <i className="fa-solid fa-waveform text-sm"></i>
              </div>
              <span className="text-[10px] font-bold text-slate-800 truncate w-full text-center">
                {voice.name}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVoiceDeleted(voice.id);
              }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceCloner;
