
import React from 'react';
import { TTSHistoryItem, VOICE_METADATA } from '../types';
import { decodeBase64, pcmToWavBlob, downloadBlob } from '../utils/audioUtils';

interface HistoryListProps {
  history: TTSHistoryItem[];
  onPlay: (item: TTSHistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ history, onPlay, onDelete, onClear }) => {
  if (history.length === 0) return null;

  const handleDownload = (item: TTSHistoryItem) => {
    if (!item.audioData) return;
    const bytes = decodeBase64(item.audioData);
    const blob = pcmToWavBlob(bytes);
    const safeName = item.text.slice(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'vani_tts';
    downloadBlob(blob, `vani_${safeName}_${item.id.slice(0, 4)}.wav`);
  };

  return (
    <div className="mt-12 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <i className="fa-solid fa-clock-rotate-left mr-3 text-indigo-500"></i>
          Recent Sessions
        </h2>
        <button
          onClick={onClear}
          className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-100 hover:border-red-100 shadow-sm"
        >
          <i className="fa-solid fa-trash-sweep mr-2"></i>
          Clear All
        </button>
      </div>
      
      <div className="space-y-4">
        {history.map((item) => (
          <div 
            key={item.id} 
            className="group relative bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex-1 mr-4">
              <div className="flex items-center space-x-3 mb-1 flex-wrap gap-y-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase">
                  {item.language}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                  {item.accent}
                </span>
                <div className="flex items-center space-x-1">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase">
                    S:{item.speed}x
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">
                    P:{item.pitch}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-bold uppercase">
                    V:{Math.round(item.volume * 100)}%
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                  {VOICE_METADATA[item.voice]?.label || item.voice}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-slate-700 text-sm line-clamp-2 leading-relaxed">
                {item.text}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => onPlay(item)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                title="Play again"
              >
                <i className="fa-solid fa-play"></i>
              </button>
              <button 
                onClick={() => handleDownload(item)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors"
                title="Download as WAV"
              >
                <i className="fa-solid fa-download"></i>
              </button>
              <button 
                onClick={() => onDelete(item.id)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryList;
