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
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Carrega volume salvo do localStorage
  useEffect(() => {
    const savedVolume = localStorage.getItem("xhenos_audio_volume");
    if (savedVolume !== null) {
      const parsed = parseFloat(savedVolume);
      if (!isNaN(parsed)) setVolume(parsed);
    }
  }, []);

  // Aplica alteração de volume e mute diretamente na tag HTML de áudio
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Controle único de reprodução de áudio
  useEffect(() => {
    if (!audioRef.current) return;

    if (currentTrack && isPlaying) {
      const currentSrc = audioRef.current.getAttribute("src");
      if (currentSrc !== currentTrack.audio_url) {
        audioRef.current.src = currentTrack.audio_url;
      }
      
      audioRef.current.volume = isMuted ? 0 : volume;

      if (audioRef.current.paused) {
        audioRef.current
          .play()
          .then(() => setAutoplayBlocked(false))
          .catch((err) => {
            console.warn("Autoplay bloqueado pelo navegador/celular:", err);
            setAutoplayBlocked(true);
          });
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [currentTrack, isPlaying]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (isMuted && newVolume > 0) setIsMuted(false);
    localStorage.setItem("xhenos_audio_volume", newVolume.toString());
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleUnlockAutoplay = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => console.error("Falha ao forçar reprodução de áudio:", err));
    }
  };

  return (
    <div className="space-y-3.5 w-full max-w-full">
      {/* ÚNICO ELEMENTO DE ÁUDIO DA MESA */}
      <audio ref={audioRef} preload="auto" loop />

      {/* ALERTA DE AUTOPLAY BLOQUEADO PELO NAVEGADOR / CELULAR */}
      {autoplayBlocked && currentTrack && (
        <div className="p-3 bg-amber-950/90 border-2 border-amber-500 rounded-xl flex items-center justify-between gap-3 shadow-lg animate-pulse">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🔊</span>
            <p className="text-[11px] font-semibold text-amber-200 leading-tight truncate">
              Toque para ativar o som da mesa no celular
            </p>
          </div>
          <button
            type="button"
            onClick={handleUnlockAutoplay}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-xs font-black text-black rounded-lg transition cursor-pointer shrink-0 shadow-md"
          >
            Sincronizar 🎵
          </button>
        </div>
      )}

      {/* PAINEL DE ÁUDIO ATIVO */}
      {currentTrack && isPlaying && (
        <div className="p-3 bg-purple-950/60 border border-cyan-500/50 rounded-xl flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2.5 truncate min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <div className="truncate min-w-0">
              <span className="block text-[9px] uppercase font-black tracking-wider text-cyan-300">
                Tocando na Mesa
              </span>
              <span className="text-xs font-bold text-white truncate block">
                {currentTrack.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleUnlockAutoplay}
              className="p-1.5 px-2.5 bg-cyan-950 active:bg-cyan-800 text-cyan-300 border border-cyan-700/60 rounded-lg text-[10px] font-bold transition cursor-pointer"
              title="Sincronizar Áudio Manualmente"
            >
              🔊 Ouvir
            </button>

            {isMestre && onStopTrack && (
              <button
                type="button"
                onClick={onStopTrack}
                className="px-3 py-1.5 bg-red-950 active:bg-red-800 text-[10px] font-bold text-red-200 rounded-lg transition border border-red-800/60 cursor-pointer"
              >
                Parar ⏹
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONTROLE DE VOLUME LOCAL */}
      <div className="p-3 bg-[#0b0c16] border border-purple-800/40 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              className="hover:scale-110 transition-transform cursor-pointer"
              title={isMuted ? "Desmutar" : "Mutar"}
            >
              {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            Volume Local
          </span>
          <span className="text-[10px] font-mono font-bold text-cyan-400">
            {isMuted ? "MUTADO" : `${Math.round(volume * 100)}%`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVolumeChange(Math.max(0, volume - 0.1))}
            className="w-7 h-7 bg-[#12131f] border border-purple-800/50 hover:border-cyan-400 text-cyan-300 font-bold rounded-lg text-xs flex items-center justify-center transition cursor-pointer shrink-0"
          >
            -
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="flex-1 accent-cyan-400 cursor-pointer h-2 bg-[#12131f] rounded-lg border border-purple-900/40"
          />

          <button
            type="button"
            onClick={() => handleVolumeChange(Math.min(1, volume + 0.1))}
            className="w-7 h-7 bg-[#12131f] border border-purple-800/50 hover:border-cyan-400 text-cyan-300 font-bold rounded-lg text-xs flex items-center justify-center transition cursor-pointer shrink-0"
          >
            +
          </button>
        </div>
      </div>

      {/* UPLOAD DE ÁUDIO (Apenas Mestre) */}
      {isMestre && (
        <div className="p-3.5 bg-[#0b0c16] border border-purple-800/40 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-bold text-purple-300 uppercase tracking-wider">
              🎧 Enviar Áudio / Música
            </span>
            <span className="text-[9px] text-gray-400">MP3, WAV, OGG, M4A</span>
          </div>

          <label className="relative flex flex-col items-center justify-center p-3 border-2 border-dashed border-purple-800/60 hover:border-cyan-400/80 active:border-cyan-400 bg-[#12131f] hover:bg-purple-950/20 rounded-xl cursor-pointer transition group">
            <input
              type="file"
              accept="audio/*,audio/mp3,audio/wav,audio/mpeg,audio/ogg,audio/m4a,audio/aac"
              onChange={onAudioUpload}
              disabled={isUploadingAudio}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-xl group-hover:scale-110 transition-transform">📁</span>
              <span className="text-xs font-semibold text-gray-300 group-hover:text-cyan-300">
                {isUploadingAudio ? "Enviando arquivo..." : "Toque ou Arraste para enviar áudio"}
              </span>
              <span className="text-[9px] text-gray-500">Funciona no Celular e PC</span>
            </div>
          </label>

          {isUploadingAudio && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-cyan-400 font-bold animate-pulse">
                Carregando áudio para a nuvem...
              </p>
            </div>
          )}
        </div>
      )}

      {/* TRILHAS SALVAS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
            🎶 Trilhas da Mesa ({playlist.length})
          </span>
        </div>

        {playlist.length === 0 ? (
          <div className="p-4 bg-[#0b0c16] border border-purple-900/30 rounded-xl text-center">
            <p className="text-xs text-gray-500">Nenhuma música enviada até o momento.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-thin">
            {playlist.map((track) => {
              const isThisPlaying = currentTrack?.id === track.id && isPlaying;

              return (
                <div
                  key={track.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                    isThisPlaying
                      ? "bg-purple-900/40 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                      : "bg-[#0b0c16] border-purple-900/40 hover:border-purple-700/60"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <span className="text-sm shrink-0">{isThisPlaying ? "🔊" : "🎵"}</span>
                    <span className="text-xs text-white font-semibold truncate block">
                      {track.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMestre && (
                      <button
                        type="button"
                        onClick={() => (isThisPlaying && onStopTrack ? onStopTrack() : onPlayTrack(track))}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                          isThisPlaying
                            ? "bg-amber-600 active:bg-amber-500 text-white shadow-sm"
                            : "bg-purple-600 hover:bg-purple-500 active:bg-cyan-500 text-white shadow-sm"
                        }`}
                      >
                        {isThisPlaying ? "Pausar ⏸" : "Tocar ▶"}
                      </button>
                    )}

                    {isMestre && onDeleteTrack && (
                      <button
                        type="button"
                        onClick={() => onDeleteTrack(track)}
                        title="Excluir Trilha"
                        className="p-1.5 px-2 bg-red-950/60 hover:bg-red-900 active:bg-red-700 text-red-300 hover:text-white rounded-lg transition border border-red-800/40 cursor-pointer text-xs"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}