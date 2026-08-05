"use client";

export interface RoomAudio {
  id: string;
  title: string;
  audio_url: string;
}

interface AudioProps {
  isMestre: boolean;
  playlist: RoomAudio[];
  isUploadingAudio: boolean;
  onAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlayTrack: (track: RoomAudio) => void;
  onDeleteTrack?: (track: RoomAudio) => void; // <--- Nova Prop de Deleção
}

export default function Audio({
  isMestre,
  playlist,
  isUploadingAudio,
  onAudioUpload,
  onPlayTrack,
  onDeleteTrack,
}: AudioProps) {
  return (
    <div className="space-y-4">
      {/* UPLOAD DE MP3 (Apenas Mestre) */}
      {isMestre && (
        <div className="p-3 bg-[#0b0c16] border border-purple-800/40 rounded-xl space-y-2">
          <span className="block text-xs font-bold text-purple-300 uppercase">
            Upload de Músicas (MP3)
          </span>
          <input
            type="file"
            accept="audio/mp3,audio/wav"
            onChange={onAudioUpload}
            disabled={isUploadingAudio}
            className="text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-900/60 file:text-purple-200 hover:file:bg-purple-800 cursor-pointer"
          />
          {isUploadingAudio && (
            <p className="text-[10px] text-cyan-400 animate-pulse">Enviando MP3...</p>
          )}
        </div>
      )}

      {/* TRILHAS SALVAS */}
      <div className="space-y-2">
        <span className="block text-xs font-bold text-gray-400">Trilhas Salvas</span>
        {playlist.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">Nenhuma música enviada.</p>
        ) : (
          playlist.map((track) => (
            <div
              key={track.id}
              className="p-2.5 bg-[#0b0c16] rounded-xl border border-purple-900/40 flex items-center justify-between gap-2"
            >
              <span className="text-xs text-white font-medium truncate flex-1">🎵 {track.title}</span>
              
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onPlayTrack(track)}
                  className="px-3 py-1 bg-purple-600 hover:bg-cyan-500 text-[10px] font-bold text-white rounded-lg transition cursor-pointer"
                >
                  Tocar ▶
                </button>

                {isMestre && onDeleteTrack && (
                  <button
                    onClick={() => onDeleteTrack(track)}
                    title="Excluir Músicas/Áudio"
                    className="p-1 px-2 bg-red-950/60 hover:bg-red-700/80 text-red-300 hover:text-white rounded-lg transition border border-red-800/40 cursor-pointer text-xs"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}