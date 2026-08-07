"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TurnToken {
  id: string;
  name: string;
  avatar_url?: string | null;
  token_shape: string;
  is_npc: boolean;
  initiative_roll?: number;
  current_hp: number;
  max_hp: number;
}

interface TurnosProps {
  roomId: string;
  isMestre: boolean;
  currentUserId?: string;
}

export default function Turnos({ roomId, isMestre }: TurnosProps) {
  const [tokens, setTokens] = useState<TurnToken[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [roundCount, setRoundCount] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    fetchTurnData();

    const channel = supabase
      .channel(`room_turnos_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload: any) => {
          if (payload.new.turn_index !== undefined) setCurrentTurnIndex(payload.new.turn_index || 0);
          if (payload.new.round_count !== undefined) setRoundCount(payload.new.round_count || 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "characters", filter: `room_id=eq.${roomId}` },
        () => {
          fetchTurnData();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchTurnData();
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [roomId]);

  const fetchTurnData = async () => {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("turn_index, round_count")
      .eq("id", roomId)
      .single();

    if (roomData) {
      if (roomData.turn_index !== undefined) setCurrentTurnIndex(roomData.turn_index || 0);
      if (roomData.round_count !== undefined) setRoundCount(roomData.round_count || 1);
    }

    const { data: charData } = await supabase
      .from("characters")
      .select("id, name, avatar_url, token_shape, is_npc, current_hp, max_hp, attributes")
      .eq("room_id", roomId);

    if (charData && charData.length > 0) {
      const activeChars = charData.filter((c: any) => {
        const val = c.attributes?.initiative_roll;
        return val !== null && val !== undefined;
      });

      const formatted = activeChars.map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar_url: c.avatar_url,
        token_shape: c.token_shape || "circle",
        is_npc: c.is_npc,
        initiative_roll: Number(c.attributes?.initiative_roll || 0),
        current_hp: c.current_hp,
        max_hp: c.max_hp,
      }));

      formatted.sort((a, b) => (b.initiative_roll || 0) - (a.initiative_roll || 0));
      setTokens(formatted);
    } else {
      setTokens([]);
    }
  };

  const handleNextTurn = async () => {
    if (tokens.length === 0) return;

    let nextIndex = currentTurnIndex + 1;
    let nextRound = roundCount;

    if (nextIndex >= tokens.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    setCurrentTurnIndex(nextIndex);
    setRoundCount(nextRound);

    await supabase.from("rooms").update({
      turn_index: nextIndex,
      round_count: nextRound,
    }).eq("id", roomId);
  };

  const handleResetCombat = async () => {
    if (!confirm("Deseja reiniciar a contagem de rodadas e limpar as iniciativas?")) return;

    setCurrentTurnIndex(0);
    setRoundCount(1);

    const { data: allChars } = await supabase.from("characters").select("id, attributes").eq("room_id", roomId);

    if (allChars) {
      for (const c of allChars) {
        const newAttrs = { ...(c.attributes || {}) };
        delete newAttrs.initiative_roll;
        await supabase.from("characters").update({
          attributes: newAttrs,
        }).eq("id", c.id);
      }
    }

    await supabase.from("rooms").update({
      turn_index: 0,
      round_count: 1,
    }).eq("id", roomId);

    fetchTurnData();
  };

  const activeToken = tokens[currentTurnIndex] || tokens[0];

  return (
    <div className="w-full bg-[#0b0c16] border-b border-purple-900/50 shadow-md select-none shrink-0">
      {/* HEADER DO PAINEL DE TURNOS */}
      <div className="p-2 sm:p-2.5 bg-[#12131f] flex items-center justify-between gap-2 border-b border-purple-900/30">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider hover:text-cyan-300 cursor-pointer min-w-0"
        >
          <span className="truncate">⚔️ Ordem de Turnos</span>
          <span className="text-[10px] text-gray-400 shrink-0">{isExpanded ? "▲" : "▼"}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-700/60 px-2 py-0.5 rounded font-mono font-bold">
            Rodada #{roundCount}
          </span>

          {isMestre && (
            <button
              type="button"
              onClick={handleResetCombat}
              className="px-2 py-1 bg-red-950/60 active:bg-red-800 border border-red-800/40 text-red-300 rounded text-[9px] font-bold transition cursor-pointer"
              title="Reiniciar Ordem de Turnos"
            >
              🔄 Limpar
            </button>
          )}
        </div>
      </div>

      {/* CONTEÚDO EXPANDÍVEL */}
      {isExpanded && (
        <div className="p-2 space-y-2 bg-[#0b0c16]/90">
          {tokens.length === 0 ? (
            <div className="text-center py-2 text-[10px] text-purple-300/80 italic">
              🎲 Role a <strong className="text-cyan-400">Iniciativa</strong> na ficha do personagem para entrar no combate!
            </div>
          ) : (
            <>
              {/* LISTA DE TOKENS ORDENADOS */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                {tokens.map((token, index) => {
                  const isActive = index === currentTurnIndex;
                  const initialLetter = token.name ? token.name.charAt(0).toUpperCase() : "T";

                  return (
                    <div
                      key={token.id}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-xl transition-all duration-300 shrink-0 border ${
                        isActive
                          ? "bg-cyan-950/80 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] scale-105"
                          : "bg-[#12131f] border-purple-900/40 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="relative shrink-0">
                        {token.avatar_url ? (
                          <img
                            src={token.avatar_url}
                            alt={token.name}
                            className={`w-6 h-6 object-cover border ${
                              isActive ? "border-cyan-300 ring-2 ring-cyan-400/50" : token.is_npc ? "border-red-500" : "border-purple-500"
                            } ${token.token_shape === "circle" ? "rounded-full" : "rounded-md"}`}
                          />
                        ) : (
                          <div
                            className={`w-6 h-6 flex items-center justify-center font-extrabold text-[10px] text-white border ${
                              isActive
                                ? "bg-cyan-600 border-cyan-300"
                                : token.is_npc
                                ? "bg-red-900 border-red-500"
                                : "bg-purple-800 border-purple-500"
                            } ${token.token_shape === "circle" ? "rounded-full" : "rounded-md"}`}
                          >
                            {initialLetter}
                          </div>
                        )}

                        <span className="absolute -bottom-1 -right-1 bg-black/90 text-cyan-300 border border-purple-700 text-[8px] font-mono font-bold px-1 rounded-full">
                          {token.initiative_roll}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className={`text-[10px] font-bold leading-none max-w-[65px] sm:max-w-[80px] truncate ${isActive ? "text-cyan-300" : "text-gray-300"}`}>
                          {token.name}
                        </span>
                        {isActive && (
                          <span className="text-[7px] font-black uppercase tracking-widest text-cyan-400 animate-pulse mt-0.5">
                            ▶ DA VEZ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RODAPÉ DO TURNO ATIVO */}
              <div className="flex justify-between items-center bg-[#12131f] px-2.5 py-1.5 rounded-lg border border-purple-900/40 gap-2">
                <span className="text-[10px] text-gray-300 truncate min-w-0">
                  Vez de: <strong className="text-cyan-300 font-bold">{activeToken?.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleNextTurn}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 active:from-purple-500 active:to-cyan-500 text-white font-black text-[10px] rounded-md transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span>Próximo Turno</span>
                  <span>➔</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}