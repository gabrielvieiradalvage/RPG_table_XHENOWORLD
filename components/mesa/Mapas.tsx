"use client";

import React from "react";

export interface RoomMap {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
}

interface MapasProps {
  isMestre: boolean;
  maps: RoomMap[];
  activeMapUrl: string | null;
  isUploadingMap: boolean;
  onMapUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectMap: (map: RoomMap) => void;
  onDeleteMap: (map: RoomMap) => void;
  mapScale?: number;
  onMapScaleChange?: (scale: number) => void;
  mapFitMode?: "contain" | "cover" | "stretch";
  onFitModeChange?: (mode: "contain" | "cover" | "stretch") => void;
}

export default function Mapas({
  isMestre,
  maps,
  activeMapUrl,
  isUploadingMap,
  onMapUpload,
  onSelectMap,
  onDeleteMap,
  mapScale = 100,
  onMapScaleChange,
  mapFitMode = "contain",
  onFitModeChange,
}: MapasProps) {
  return (
    <div className="space-y-3.5 text-xs text-white w-full max-w-full">
      {/* UPLOAD DE NOVO MAPA */}
      {isMestre && (
        <div className="p-3 bg-[#0b0c16] border border-purple-800/40 rounded-xl space-y-2">
          <span className="block text-[10px] font-bold text-purple-300 uppercase tracking-wider">
            Upload de Novo Mapa
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onMapUpload}
            disabled={isUploadingMap}
            className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-900/60 file:text-purple-200 hover:file:bg-purple-800 cursor-pointer"
          />
          {isUploadingMap && (
            <p className="text-[10px] text-cyan-400 animate-pulse">Enviando imagem...</p>
          )}
        </div>
      )}

      {/* PAINEL DE ZOOM E AJUSTE DE TAMANHO DO MAPA ATIVO */}
      {activeMapUrl && (
        <div className="p-3 bg-[#0b0c16] border border-cyan-800/40 rounded-xl space-y-3">
          <span className="block text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
            🔍 Zoom & Tamanho do Mapa
          </span>

          {/* Controle de Zoom / Escala */}
          {onMapScaleChange && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-gray-300">
                <span>Escala do Zoom:</span>
                <strong className="text-cyan-400 font-mono">{mapScale}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={mapScale}
                  onChange={(e) => onMapScaleChange(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-2 bg-[#12131f] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onMapScaleChange(100)}
                  className="px-2.5 py-1 bg-purple-900/60 active:bg-purple-800 hover:bg-purple-800 text-[10px] font-bold text-purple-200 rounded transition cursor-pointer shrink-0"
                  title="Resetar Zoom para 100%"
                >
                  100%
                </button>
              </div>
            </div>
          )}

          {/* Opções de Esticar / Preencher */}
          {onFitModeChange && (
            <div className="space-y-1 pt-1">
              <label className="block text-[10px] text-gray-400">Modo de Exibição:</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => onFitModeChange("contain")}
                  className={`py-1.5 text-[10px] font-bold rounded border transition cursor-pointer ${
                    mapFitMode === "contain"
                      ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                      : "bg-[#12131f] border-purple-900/40 text-gray-400 hover:text-white"
                  }`}
                >
                  🖼️ Normal
                </button>
                <button
                  type="button"
                  onClick={() => onFitModeChange("cover")}
                  className={`py-1.5 text-[10px] font-bold rounded border transition cursor-pointer ${
                    mapFitMode === "cover"
                      ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                      : "bg-[#12131f] border-purple-900/40 text-gray-400 hover:text-white"
                  }`}
                >
                  🔎 Preencher
                </button>
                <button
                  type="button"
                  onClick={() => onFitModeChange("stretch")}
                  className={`py-1.5 text-[10px] font-bold rounded border transition cursor-pointer ${
                    mapFitMode === "stretch"
                      ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                      : "bg-[#12131f] border-purple-900/40 text-gray-400 hover:text-white"
                  }`}
                >
                  ↔️ Esticar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LISTA DE MAPAS DA SALA */}
      <div className="space-y-2">
        <span className="block text-xs font-bold text-gray-400">Mapas da Sala</span>
        {maps.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4 bg-[#0b0c16] rounded-xl border border-dashed border-purple-900/40">
            Nenhum mapa carregado.
          </p>
        ) : (
          maps.map((map) => (
            <div
              key={map.id}
              className={`p-2.5 bg-[#0b0c16] rounded-xl border flex items-center justify-between gap-2.5 ${
                map.image_url === activeMapUrl ? "border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]" : "border-purple-900/40"
              }`}
            >
              <img
                src={map.image_url}
                alt={map.name}
                className="w-12 h-12 object-cover rounded-lg border border-purple-800/40 shrink-0"
              />
              <span className="text-xs text-white font-medium flex-1 truncate min-w-0">{map.name}</span>

              {isMestre && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onSelectMap(map)}
                    className="px-2.5 py-1.5 bg-purple-900/60 active:bg-cyan-600 hover:bg-cyan-600 text-[10px] font-bold text-white rounded-lg transition cursor-pointer"
                  >
                    Ativar
                  </button>

                  <button
                    onClick={() => onDeleteMap(map)}
                    title="Excluir Mapa"
                    className="p-1.5 px-2 bg-red-950/60 active:bg-red-700 text-red-300 hover:text-white rounded-lg transition border border-red-800/40 cursor-pointer text-xs"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}