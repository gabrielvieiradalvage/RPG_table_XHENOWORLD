"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface CharacterItem {
  id: string;
  name: string;
  is_npc: boolean;
  current_hp: number;
  max_hp: number;
  current_stamina: number;
  max_stamina: number;
  current_pericia: number;
  xp: number;
  moedas?: number;
  attributes?: {
    escudo?: number;
    [key: string]: any;
  };
}

interface CombatZone {
  shape: "circulo" | "quadrado" | "triangulo" | "hexagono";
  size: number;
  x: number;
  y: number;
}

interface FerramentasDoMestreProps {
  roomId: string;
}

export default function FerramentasDoMestre({ roomId }: FerramentasDoMestreProps) {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("all_players");
  const [xpAmount, setXpAmount] = useState<number>(50);
  const [moedasAmount, setMoedasAmount] = useState<number>(10);

  const [recoveryType, setRecoveryType] = useState<"dice" | "fixed">("dice");
  const [recoveryDice, setRecoveryDice] = useState<number>(20);
  const [recoveryFixedAmount, setRecoveryFixedAmount] = useState<number>(50);

  const [gameMode, setGameMode] = useState<"exploracao" | "combate">("exploracao");
  const [gridType, setGridType] = useState<"quadrado" | "hexagono" | "circulo" | "nenhum">("quadrado");

  const [combatZone, setCombatZone] = useState<CombatZone>({
    shape: "circulo",
    size: 150,
    x: 50,
    y: 50,
  });

  useEffect(() => {
    fetchRoomAndCharacters();
  }, [roomId]);

  const fetchRoomAndCharacters = async () => {
    const { data: charData } = await supabase
      .from("characters")
      .select("id, name, is_npc, current_hp, max_hp, current_stamina, max_stamina, current_pericia, xp, moedas, attributes")
      .eq("room_id", roomId);

    if (charData) setCharacters(charData as CharacterItem[]);

    const { data: roomData } = await supabase
      .from("rooms")
      .select("game_mode, grid_type, combat_zone")
      .eq("id", roomId)
      .single();

    if (roomData) {
      if (roomData.game_mode) setGameMode(roomData.game_mode);
      if (roomData.grid_type) setGridType(roomData.grid_type);
      if (roomData.combat_zone) setCombatZone(roomData.combat_zone);
    }
  };

  const players = characters.filter((c) => !c.is_npc);
  const npcs = characters.filter((c) => c.is_npc);

  const getTargetCharacters = (): CharacterItem[] => {
    if (selectedTarget === "all_players") return players;
    if (selectedTarget === "all_npcs") return npcs;
    const found = characters.find((c) => c.id === selectedTarget);
    return found ? [found] : [];
  };

  const handleApplyStaminaRest = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");

    for (const char of targets) {
      const amount = recoveryType === "dice" ? Math.floor(Math.random() * recoveryDice) + 1 : recoveryFixedAmount;
      const newStamina = Math.min(char.max_stamina || 999, char.current_stamina + amount);
      const newPericia = Math.min(5, (char.current_pericia || 0) + 3);

      await supabase.from("characters").update({ current_stamina: newStamina, current_pericia: newPericia }).eq("id", char.id);
    }
    alert(`💤 Descanso Aplicado para ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleApplyHpHeal = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");

    for (const char of targets) {
      const amount = recoveryType === "dice" ? Math.floor(Math.random() * recoveryDice) + 1 : recoveryFixedAmount;
      const newHp = Math.min(char.max_hp || 999, char.current_hp + amount);

      await supabase.from("characters").update({ current_hp: newHp }).eq("id", char.id);
    }
    alert(`❤️ Cura Aplicada para ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleFullRestoreAll = async (type: "hp" | "stamina") => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return;

    for (const char of targets) {
      if (type === "hp") {
        await supabase.from("characters").update({ current_hp: char.max_hp || 999 }).eq("id", char.id);
      } else {
        await supabase.from("characters").update({ current_stamina: char.max_stamina || 999, current_pericia: 5 }).eq("id", char.id);
      }
    }
    alert(`Restauração Máxima de ${type.toUpperCase()} concluída!`);
    fetchRoomAndCharacters();
  };

  const handleGiveXp = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");
    for (const char of targets) {
      await supabase.from("characters").update({ xp: (char.xp || 0) + xpAmount }).eq("id", char.id);
    }
    alert(`+${xpAmount} XP concedido para ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleDeductXp = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");
    for (const char of targets) {
      await supabase.from("characters").update({ xp: Math.max(0, (char.xp || 0) - xpAmount) }).eq("id", char.id);
    }
    alert(`-${xpAmount} XP removido de ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleGiveMoedas = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");
    for (const char of targets) {
      const currentCoins = char.moedas ?? 0;
      await supabase.from("characters").update({ moedas: currentCoins + moedasAmount }).eq("id", char.id);
    }
    alert(`+🪙 ${moedasAmount} moedas concedidas para ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleDeductMoedas = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");
    for (const char of targets) {
      const currentCoins = char.moedas ?? 0;
      await supabase.from("characters").update({ moedas: Math.max(0, currentCoins - moedasAmount) }).eq("id", char.id);
    }
    alert(`-🪙 ${moedasAmount} moedas removidas de ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleBreakShields = async () => {
    const targets = getTargetCharacters();
    if (targets.length === 0) return alert("Nenhum alvo encontrado.");

    if (!confirm(`Zerar os escudos (Barreira) de ${targets.length} alvo(s)?`)) return;

    for (const char of targets) {
      const updatedAttrs = {
        ...(char.attributes || {}),
        escudo: 0,
      };
      await supabase.from("characters").update({ attributes: updatedAttrs }).eq("id", char.id);
    }
    
    alert(`🛡️ Escudos quebrados/zerados para ${targets.length} alvo(s)!`);
    fetchRoomAndCharacters();
  };

  const handleClearMapTokens = async () => {
    if (!confirm("Remover TODOS os tokens do mapa?")) return;
    await supabase.from("characters").update({ on_map: false }).eq("room_id", roomId);
    alert("Tokens removidos!");
    fetchRoomAndCharacters();
  };

  const updateRoomSetting = async (field: string, value: any) => {
    await supabase.from("rooms").update({ [field]: value }).eq("id", roomId);
  };

  const handleGameModeChange = (mode: "exploracao" | "combate") => {
    setGameMode(mode);
    updateRoomSetting("game_mode", mode);
  };

  const handleGridChange = (grid: any) => {
    setGridType(grid);
    updateRoomSetting("grid_type", grid);
  };

  const handleZoneChangeLocal = (key: keyof CombatZone, val: any) => {
    setCombatZone({ ...combatZone, [key]: val });
  };

  const saveZoneToDatabase = () => {
    updateRoomSetting("combat_zone", combatZone);
  };

  return (
    <div className="space-y-3.5 text-xs text-white w-full max-w-full">
      <div className="flex items-center gap-2 pb-2 border-b border-purple-900/40">
        <span className="text-base">👑</span>
        <h3 className="font-bold text-purple-300 uppercase">Painel do Mestre</h3>
      </div>

      {/* 1. SELEÇÃO DE ALVOS */}
      <div className="bg-[#0b0c16] p-3 rounded-xl border border-purple-800/40 space-y-2.5">
        <span className="block text-[10px] font-bold text-cyan-400 uppercase">🎯 Seleção de Alvo(s)</span>
        <div>
          <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} className="w-full bg-[#12131f] border border-purple-800/40 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-400">
            <optgroup label="🌐 Ações em Grupo">
              <option value="all_players">🛡️ Todos os Jogadores ({players.length})</option>
              <option value="all_npcs">👹 Todos os NPCs / Monstros ({npcs.length})</option>
            </optgroup>
            {players.length > 0 && (
              <optgroup label="🛡️ Jogadores Individuais">
                {players.map((p) => (<option key={p.id} value={p.id}>{p.name} (HP: {p.current_hp}/{p.max_hp} | 🛡️ {p.attributes?.escudo || 0} | 🪙 {p.moedas ?? 0})</option>))}
              </optgroup>
            )}
            {npcs.length > 0 && (
              <optgroup label="👹 NPCs / Monstros Individuais">
                {npcs.map((n) => (<option key={n.id} value={n.id}>{n.name} (HP: {n.current_hp}/{n.max_hp} | 🛡️ {n.attributes?.escudo || 0} | 🪙 {n.moedas ?? 0})</option>))}
              </optgroup>
            )}
          </select>
        </div>

        {/* 2. CONFIGURADOR DE DESCANSO E CURA */}
        <div className="pt-2 border-t border-purple-900/40 space-y-2">
          <span className="block text-[10px] font-bold text-amber-300 uppercase">💤 Configuração de Descanso / Cura</span>
          <div className="flex gap-2">
            <button onClick={() => setRecoveryType("dice")} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer ${recoveryType === "dice" ? "bg-amber-950 border-amber-500 text-amber-300" : "bg-[#12131f] border-purple-900/40 text-gray-400"}`}>🎲 Rolar Dado</button>
            <button onClick={() => setRecoveryType("fixed")} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer ${recoveryType === "fixed" ? "bg-cyan-950 border-cyan-400 text-cyan-300" : "bg-[#12131f] border-purple-900/40 text-gray-400"}`}>🔢 Valor Fixo</button>
          </div>

          {recoveryType === "dice" ? (
            <div>
              <label className="block text-[9px] text-gray-400 mb-1">Selecione o Dado de Recuperação:</label>
              <div className="grid grid-cols-5 gap-1">
                {[10, 20, 30, 50, 100].map((d) => (
                  <button key={d} onClick={() => setRecoveryDice(d)} className={`py-1.5 text-[10px] font-bold rounded border cursor-pointer ${recoveryDice === d ? "bg-purple-600 border-cyan-400 text-white" : "bg-[#12131f] border-purple-900/40 text-gray-400"}`}>d{d}</button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[9px] text-gray-400 mb-1">Quantidade Exata a Restaurar:</label>
              <input type="number" value={recoveryFixedAmount} onChange={(e) => setRecoveryFixedAmount(Number(e.target.value))} className="w-full bg-[#12131f] border border-purple-800/40 rounded px-2.5 py-1.5 text-xs text-cyan-300 font-mono font-bold" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button onClick={handleApplyStaminaRest} className="py-2 bg-amber-950 active:bg-amber-800 text-amber-200 font-bold rounded-lg transition border border-amber-800/50 cursor-pointer text-[10px]">⚡ Dar Descanso</button>
            <button onClick={handleApplyHpHeal} className="py-2 bg-red-950 active:bg-red-800 text-red-200 font-bold rounded-lg transition border border-red-800/50 cursor-pointer text-[10px]">❤️ Aplicar Cura</button>
          </div>
          <div className="flex gap-1.5 pt-1">
            <button onClick={() => handleFullRestoreAll("stamina")} className="flex-1 py-1.5 bg-amber-900/40 active:bg-amber-800 text-amber-300 text-[9px] font-bold rounded border border-amber-800/40 cursor-pointer">⚡ Stamina Full</button>
            <button onClick={() => handleFullRestoreAll("hp")} className="flex-1 py-1.5 bg-red-900/40 active:bg-red-800 text-red-300 text-[9px] font-bold rounded border border-red-800/40 cursor-pointer">❤️ HP Full</button>
          </div>
        </div>

        {/* QUEBRAR ESCUDOS */}
        <div className="pt-2 border-t border-cyan-900/40 space-y-1.5">
          <label className="block text-[9px] text-cyan-400 uppercase tracking-wider font-bold">🛡️ Gerenciamento de Escudos:</label>
          <button 
            onClick={handleBreakShields} 
            className="w-full py-2 bg-gradient-to-r from-cyan-900 to-blue-900 hover:from-cyan-800 hover:to-blue-800 text-cyan-100 font-bold rounded-lg text-xs cursor-pointer shadow-md"
          >
            Quebrar Escudos do(s) Alvo(s) Selecionado(s)
          </button>
        </div>

        {/* CONTROLE DE MOEDAS */}
        <div className="space-y-1.5 pt-2 border-t border-purple-900/40">
          <label className="block text-[9px] text-gray-400">Distribuição de Moedas 🪙:</label>
          <div className="flex gap-1.5">
            <input type="number" value={moedasAmount} onChange={(e) => setMoedasAmount(Number(e.target.value))} className="w-20 bg-[#12131f] border border-purple-800/40 rounded-lg p-1.5 text-center font-mono font-bold text-amber-300 text-xs shrink-0" />
            <button onClick={handleGiveMoedas} className="flex-1 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-500 text-black font-extrabold rounded-lg text-[10px] cursor-pointer">+ Moedas</button>
            <button onClick={handleDeductMoedas} className="flex-1 py-1.5 bg-red-950 text-red-300 font-bold rounded-lg text-[10px] cursor-pointer">- Moedas</button>
          </div>
        </div>

        {/* CONTROLE DE XP */}
        <div className="space-y-1.5 pt-2 border-t border-purple-900/40">
          <label className="block text-[9px] text-gray-400">Quantidade de XP:</label>
          <div className="flex gap-1.5">
            <input type="number" value={xpAmount} onChange={(e) => setXpAmount(Number(e.target.value))} className="w-20 bg-[#12131f] border border-purple-800/40 rounded-lg p-1.5 text-center font-mono font-bold text-cyan-300 text-xs shrink-0" />
            <button onClick={handleGiveXp} className="flex-1 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-lg text-[10px] cursor-pointer">+ XP</button>
            <button onClick={handleDeductXp} className="flex-1 py-1.5 bg-red-950 text-red-300 font-bold rounded-lg text-[10px] cursor-pointer">- XP</button>
          </div>
        </div>

        {/* REMOVER TOKENS */}
        <div className="pt-2 border-t border-purple-900/40">
          <button onClick={handleClearMapTokens} className="w-full py-2 bg-rose-950 text-rose-200 font-bold rounded-lg text-xs cursor-pointer">🧹 Remover Todos os Tokens do Mapa</button>
        </div>
      </div>

      {/* 3. ESTILO DE GRID */}
      <div className="bg-[#0b0c16] p-3 rounded-xl border border-purple-800/40 space-y-2">
        <span className="block text-[10px] font-bold text-purple-300 uppercase">📐 Estilo de Grid Visual</span>
        <div className="grid grid-cols-2 gap-1.5">
          {[ { id: "quadrado", label: "🔲 Quadrado" }, { id: "hexagono", label: "🛑 Hexágono" }, { id: "circulo", label: "⭕ Círculo" }, { id: "nenhum", label: "🚫 Sem Grid" } ].map((grid) => (
            <button key={grid.id} onClick={() => handleGridChange(grid.id)} className={`py-2 text-[11px] font-bold rounded-lg border transition cursor-pointer ${gridType === grid.id ? "bg-purple-900/60 border-cyan-400 text-cyan-300" : "bg-[#12131f] border-purple-900/40 text-gray-400"}`}>{grid.label}</button>
          ))}
        </div>
      </div>

      {/* 4. MODOS DE JOGO E ZONA DE COMBATE */}
      <div className="bg-[#0b0c16] p-3 rounded-xl border border-purple-800/40 space-y-3">
        <span className="block text-[10px] font-bold text-amber-400 uppercase">🚨 Modo de Jogo Ativo</span>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleGameModeChange("exploracao")} className={`py-2.5 text-xs font-bold rounded-xl border transition cursor-pointer ${gameMode === "exploracao" ? "bg-green-950/80 border-green-500 text-green-300 shadow-lg" : "bg-[#12131f] border-purple-900/40 text-gray-400"}`}>🗺️ Exploração</button>
          <button onClick={() => handleGameModeChange("combate")} className={`py-2.5 text-xs font-bold rounded-xl border transition cursor-pointer ${gameMode === "combate" ? "bg-red-950/80 border-red-500 text-red-300 shadow-lg animate-pulse" : "bg-[#12131f] border-purple-900/40 text-gray-400"}`}>⚔️ Combate</button>
        </div>

        {gameMode === "combate" && (
          <div className="p-2.5 bg-[#12131f] rounded-xl border border-red-800/40 space-y-2 pt-2">
            <span className="block text-[9px] font-bold text-red-400 uppercase">Configurar Zona Vermelha</span>
            <div>
              <label className="block text-[9px] text-gray-400 mb-1">Formato</label>
              <select value={combatZone.shape} onChange={(e: any) => { handleZoneChangeLocal("shape", e.target.value); saveZoneToDatabase(); }} className="w-full bg-[#0b0c16] border border-red-900/40 text-white rounded-lg p-1.5 text-xs">
                <option value="circulo">⭕ Círculo</option>
                <option value="quadrado">🔲 Quadrado</option>
                <option value="triangulo">🔺 Triângulo</option>
                <option value="hexagono">🛑 Hexágono</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                <span>Tamanho (Solte para salvar)</span>
                <span className="font-mono text-cyan-300">{combatZone.size}px</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={combatZone.size}
                onChange={(e) => handleZoneChangeLocal("size", Number(e.target.value))}
                onMouseUp={saveZoneToDatabase}
                onTouchEnd={saveZoneToDatabase}
                className="w-full accent-red-500 cursor-pointer h-2"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}