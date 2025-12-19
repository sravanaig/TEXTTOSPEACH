
import React, { useState } from 'react';
import { TTSPreset, Language, Accent, VoiceName, VOICE_METADATA } from '../types';

interface PresetManagerProps {
  presets: TTSPreset[];
  currentConfig: {
    language: Language;
    accent: Accent;
    voice: VoiceName;
    speed: number;
    pitch: number;
    volume: number;
  };
  onSave: (name: string) => void;
  onLoad: (preset: TTSPreset) => void;
  onDelete: (id: string) => void;
}

const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  currentConfig,
  onSave,
  onLoad,
  onDelete
}) => {
  const [newPresetName, setNewPresetName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = () => {
    if (!newPresetName.trim()) return;
    onSave(newPresetName);
    setNewPresetName('');
    setIsAdding(false);
  };

  return (
    <div className="mb-8 p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center">
          <i className="fa-solid fa-bookmark mr-2 text-indigo-500"></i>
          Your Voice Presets
        </h3>
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors flex items-center"
          >
            <i className="fa-solid fa-plus mr-1.5"></i>
            Save Current
          </button>
        ) : (
          <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-2 duration-300">
            <input
              type="text"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-32 sm:w-48"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <i className="fa-solid fa-check text-[10px]"></i>
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"
            >
              <i className="fa-solid fa-xmark text-[10px]"></i>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {presets.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No saved presets yet. Customize your voice and save it!</p>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              className="group flex items-center space-x-1 bg-slate-50 border border-slate-100 p-1.5 pr-2 rounded-xl hover:border-indigo-200 transition-all hover:shadow-sm"
            >
              <button
                onClick={() => onLoad(preset)}
                className="flex items-center space-x-2 text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm">
                  {VOICE_METADATA[preset.voice]?.label.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {preset.name}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {preset.language} • {preset.accent}
                  </span>
                </div>
              </button>
              <button
                onClick={() => onDelete(preset.id)}
                className="ml-2 w-5 h-5 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <i className="fa-solid fa-trash-can text-[9px]"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PresetManager;
