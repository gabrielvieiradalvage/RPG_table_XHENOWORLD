"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TokenItem {
  id: string;
  name: string;
  avatar_url?: string | null;
  token_shape: "circle" | "square";
  is_npc: boolean;
  on_map: boolean;
  folder_name?: string | null;
}

interface TokensProps {
  roomId: string;
}

export default function Tokens({ roomId }: TokensProps) {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sistema de Pastas
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  const fetchTokens = async () => {
    const { data } = await supabase
      .from("characters")
      .select("id, name, avatar_url, token_shape, is_npc, on_map, folder_name")
      .eq("room_id", roomId)
      .order("name", { ascending: true });

    if (data) {
      setTokens(data as TokenItem[]);

      const existingFolders = Array.from(
        new Set(
          data
            .map((t: any) => t.folder_name)
            .filter((f): f is string => Boolean(f) && f.trim() !== "")
        )
      );

      setFolders((prev) => Array.from(new Set([...prev, ...existingFolders])));
    }
    setLoading(false);
  };

  const handleToggleMap = async (tokenId: string, currentlyOnMap: boolean) => {
    const updates = currentlyOnMap
      ? { on_map: false }
      : { on_map: true, pos_x: 50, pos_y: 50, scale: 60 };

    await supabase.from("characters").update(updates).eq("id", tokenId);
    fetchTokens();
  };

  const handleMoveToFolder = async (tokenId: string, folderName: string) => {
    const targetFolder = folderName === "none" ? null : folderName;

    setTokens((prev) =>
      prev.map((t) => (t.id === tokenId ? { ...t, folder_name: targetFolder } : t))
    );

    await supabase
      .from("characters")
      .update({ folder_name: targetFolder })
      .eq("id", tokenId);

    fetchTokens();
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    if (!folders.includes(trimmed)) {
      setFolders((prev) => [...prev, trimmed]);
      setActiveFolder(trimmed);
    }

    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleRenameFolder = async (oldName: string) => {
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingFolder(null);
      return;
    }

    setFolders((prev) => prev.map((f) => (f === oldName ? trimmed : f)));

    await supabase
      .from("characters")
      .update({ folder_name: trimmed })
      .eq("room_id", roomId)
      .eq("folder_name", oldName);

    if (activeFolder === oldName) setActiveFolder(trimmed);
    setEditingFolder(null);
    setRenameInput("");
    fetchTokens();
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`Deseja apagar a pasta "${folderName}"? Os tokens serão mantidos em "Sem Pasta".`)) {
      return;
    }

    setFolders((prev) => prev.filter((f) => f !== folderName));

    await supabase
      .from("characters")
      .update({ folder_name: null })
      .eq("room_id", roomId)
      .eq("folder_name", folderName);

    if (activeFolder === folderName) setActiveFolder("all");
    fetchTokens();
  };

  const filteredTokens = tokens.filter((token) => {
    if (activeFolder === "all") return true;
    if (activeFolder === "unassigned") return !token.folder_name;
    return token.folder_name === activeFolder;
  });

  if (loading && tokens.length === 0) {
    return <div className="text-center py-8 text-xs text-gray-400">Carregando tokens...</div>;
  }

  return (
    <div className="space-y-3 text-xs text-white w-full max-w-full">
      {/* Header e Botão de Criar Pasta */}
      <div className="flex justify-between items-center pb-1 border-b border-purple-900/40">
        <span className="text-xs font-bold text-purple-300 uppercase tracking-wider truncate min-w-0">
          📂 Gestor de Tokens ({filteredTokens.length}/{tokens.length})
        </span>
        <button
          type="button"
          onClick={() => setIsCreatingFolder(!isCreatingFolder)}
          className="px-2.5 py-1.5 bg-purple-900/50 active:bg-purple-800 hover:bg-purple-800 border border-purple-700/60 text-purple-200 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0"
        >
          {isCreatingFolder ? "✕ Cancelar" : "➕ Nova Pasta"}
        </button>
      </div>

      {/* Formulário de Criação de Pasta */}
      {isCreatingFolder && (
        <form onSubmit={handleCreateFolder} className="flex gap-1.5 bg-[#0b0c16] p-2 rounded-xl border border-purple-800/50">
          <input
            type="text"
            placeholder="Nome da Pasta (Ex: Goblins, Chefões...)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="flex-1 bg-[#12131f] border border-purple-900/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 min-w-0"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-600 active:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            Criar
          </button>
        </form>
      )}

      {/* Barra de Navegação por Pastas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveFolder("all")}
          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border whitespace-nowrap transition cursor-pointer shrink-0 ${
            activeFolder === "all"
              ? "bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
              : "bg-[#0b0c16] border-purple-900/40 text-gray-400 hover:text-white"
          }`}
        >
          🌐 Todas ({tokens.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFolder("unassigned")}
          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border whitespace-nowrap transition cursor-pointer shrink-0 ${
            activeFolder === "unassigned"
              ? "bg-purple-950 border-purple-500 text-purple-300"
              : "bg-[#0b0c16] border-purple-900/40 text-gray-400 hover:text-white"
          }`}
        >
          📄 Sem Pasta ({tokens.filter((t) => !t.folder_name).length})
        </button>

        {folders.map((folder) => {
          const count = tokens.filter((t) => t.folder_name === folder).length;
          const isEditing = editingFolder === folder;

          return (
            <div key={folder} className="flex items-center gap-0.5 shrink-0">
              {isEditing ? (
                <div className="flex items-center gap-1 bg-[#0b0c16] p-1 rounded-lg border border-cyan-400">
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    className="w-20 bg-[#12131f] text-xs text-white px-1.5 py-0.5 rounded focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleRenameFolder(folder)}
                    className="text-[10px] text-green-400 font-bold px-1"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFolder(null)}
                    className="text-[10px] text-red-400 font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveFolder(folder)}
                    className={`px-2.5 py-1.5 text-[10px] font-bold rounded-l-lg border-y border-l whitespace-nowrap transition cursor-pointer ${
                      activeFolder === folder
                        ? "bg-emerald-950 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        : "bg-[#0b0c16] border-purple-900/40 text-gray-400 hover:text-white"
                    }`}
                  >
                    📂 {folder} ({count})
                  </button>
                  <div className="flex border-y border-r border-purple-900/40 rounded-r-lg bg-[#0b0c16] px-1.5 py-1.5 gap-1 items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFolder(folder);
                        setRenameInput(folder);
                      }}
                      className="text-[10px] text-gray-500 hover:text-cyan-300 cursor-pointer"
                      title="Renomear Pasta"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder)}
                      className="text-[10px] text-gray-500 hover:text-red-400 cursor-pointer"
                      title="Excluir Pasta"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid de Tokens Filtrados */}
      {filteredTokens.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-8 bg-[#0b0c16] rounded-xl border border-dashed border-purple-900/40">
          Nenhum token nesta pasta.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {filteredTokens.map((token) => {
            const initialLetter = token.name ? token.name.charAt(0).toUpperCase() : "T";

            return (
              <div
                key={token.id}
                className={`flex flex-col items-center gap-2 bg-[#0b0c16] p-2.5 rounded-xl border transition min-w-0 ${
                  token.on_map
                    ? "border-cyan-500/80 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    : "border-purple-900/40 hover:border-cyan-400"
                }`}
              >
                {/* Avatar / Letra Inicial */}
                <div className="relative shrink-0">
                  {token.avatar_url ? (
                    <img
                      src={token.avatar_url}
                      alt={token.name}
                      className={`w-12 h-12 sm:w-14 sm:h-14 object-cover border-2 ${
                        token.is_npc ? "border-red-500" : "border-cyan-400"
                      } ${token.token_shape === "circle" ? "rounded-full" : "rounded-xl"}`}
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center font-extrabold text-lg text-white border-2 shadow-md ${
                        token.is_npc
                          ? "bg-gradient-to-tr from-red-900 via-rose-700 to-amber-600 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                          : "bg-gradient-to-tr from-purple-700 via-indigo-600 to-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      } ${token.token_shape === "circle" ? "rounded-full" : "rounded-xl"}`}
                    >
                      {initialLetter}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-gray-200 font-bold truncate max-w-full text-center block">
                  {token.name}
                </span>

                {/* Seletor Mover para Pasta */}
                <select
                  value={token.folder_name || "none"}
                  onChange={(e) => handleMoveToFolder(token.id, e.target.value)}
                  className="w-full bg-[#12131f] border border-purple-800/40 text-[9px] text-gray-300 rounded p-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="none">📁 Sem Pasta</option>
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      📂 {f}
                    </option>
                  ))}
                </select>

                {/* Botão de Colocar/Remover do Mapa */}
                <button
                  type="button"
                  onClick={() => handleToggleMap(token.id, token.on_map)}
                  className={`w-full py-1.5 text-[9px] font-bold rounded uppercase transition cursor-pointer ${
                    token.on_map
                      ? "bg-red-950/80 text-red-300 active:bg-red-900"
                      : "bg-cyan-900/50 text-cyan-300 active:bg-cyan-700"
                  }`}
                >
                  {token.on_map ? "Remover do Mapa" : "➕ Ir ao Mapa"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}