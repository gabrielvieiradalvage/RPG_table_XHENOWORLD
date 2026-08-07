"use client";

import React, { useRef, useEffect, useState } from "react";

export interface RoomAudio {
  id: string;
  title: string;
  audio_url: string;
}

interface AudioProps {
  isMestre: boolean;
  playlist: RoomAudio[];
  isUploadingAudio: boolean;
  currentTrack?: RoomAudio | null;
  isPlaying?: boolean;
  onAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlayTrack: (track: RoomAudio) => void;
  onStopTrack?: () => void;
  onDeleteTrack?: (track: RoomAudio) => void;
}

export default function Audio({
  isMestre,
  playlist,
  isUploadingAudio,
  currentTrack = null,
  isPlaying = false,
  onAudioUpload,
  onPlayTrack,
  onStopTrack,
  onDeleteTrack,
}: AudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;

    if (currentTrack && isPlaying) {
      audioRef.current.src = currentTrack.audio_url;
      audioRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => {
          console.warn("Autoplay bloqueado pelo navegador:", err);
          setAutoplayBlocked(true);
        });
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [currentTrack, isPlaying]);

  const handleUnlockAutoplay = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => console.error("Falha ao forçar áudio:", err));
    }
  };

  return (
    <div className="space-y-3.5 w-full">
      <audio ref={audioRef} preload="auto" loop />

      {/* ALERTA DE AUTOPLAY BLOQUEADO PELO NAVEGADOR */}
      {autoplayBlocked && currentTrack && (
        <div className="p-3 bg-amber-950/80 border border-amber-600/50 rounded-xl flex items-center justify-between gap-2">
          <p className="text-[11px] text-amber-200 leading-tight">
            O áudio da sala está tocando. Clique ao lado para sincronizar.
          </p>
          <button
            onClick={handleUnlockAutoplay}
            className="px-3 py-1.5 bg-amber-600 active:bg-amber-500 text-xs font-bold text-white rounded-lg transition cursor-pointer shrink-0"
          >
            Ativar Áudio 🔊
          </button>
        </div>
      )}

      {/* PAINEL DE ÁUDIO ATIVO */}
      {currentTrack && isPlaying && (
        <div className="p-3 bg-purple-950/40 border border-purple-500/50 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <div className="truncate min-w-0">
              <span className="block text-[9px] uppercase font-bold text-cyan-400">Tocando para todos</span>
              <span className="text-xs font-semibold text-white truncate block">{currentTrack.title}</span>
            </div>
          </div>

          {isMestre && onStopTrack && (
            <button
              onClick={onStopTrack}
              className="px-3 py-1.5 bg-red-900/80 active:bg-red-700 text-[10px] font-bold text-red-100 rounded-lg transition border border-red-700/50 cursor-pointer shrink-0"
            >
              Parar ⏹
            </button>
          )}
        </div>
      )}

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
            className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-900/60 file:text-purple-200 hover:file:bg-purple-800 cursor-pointer"
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
          playlist.map((track) => {
            const isThisPlaying = currentTrack?.id === track.id && isPlaying;

            return (
              <div
                key={track.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                  isThisPlaying
                    ? "bg-purple-900/30 border-purple-500"
                    : "bg-[#0b0c16] border-purple-900/40"
                }`}
              >
                <span className="text-xs text-white font-medium truncate flex-1 min-w-0">
                  🎵 {track.title}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isMestre && (
                    <button
                      onClick={() => (isThisPlaying && onStopTrack ? onStopTrack() : onPlayTrack(track))}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                        isThisPlaying
                          ? "bg-amber-600 active:bg-amber-500 text-white"
                          : "bg-purple-600 active:bg-cyan-500 text-white"
                      }`}
                    >
                      {isThisPlaying ? "Pausar ⏸" : "Tocar ▶"}
                    </button>
                  )}

                  {isMestre && onDeleteTrack && (
                    <button
                      onClick={() => onDeleteTrack(track)}
                      title="Excluir Músicas/Áudio"
                      className="p-1.5 px-2 bg-red-950/60 active:bg-red-700 text-red-300 active:text-white rounded-lg transition border border-red-800/40 cursor-pointer text-xs"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}