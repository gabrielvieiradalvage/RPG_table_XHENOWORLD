"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface NpcProfile {
  id: string;
  name: string;
  personality: string;
  current_hp: number;
  max_hp: number;
  current_stamina: number;
  max_stamina: number;
  is_active_ia?: boolean;
}

interface IaPersonagensProps {
  roomId: string;
  mapTokens: any[];
  activeNpcId: string | null;
  onSelectActiveNpc: (npc: any) => void;
}

const PRESETS_PERSONALIDADE = [
  {
    label: "🛡️ Guardião Rígido",
    text: "Guerreiro focado, desconfiado com estranhos, fala firme, não aceita suborno e protege a entrada a qualquer custo.",
  },
  {
    label: "👺 Goblin Gainro",
    text: "Ganancioso, morde-costas, fala rápido em terceira pessoa, morre de medo de armas grandes e ama moedas de ouro.",
  },
  {
    label: "🧙‍♂️ Mago Enigmático",
    text: "Sábio, calmo, fala em metáforas sobre o universo e os elementos, ignora ofensas e gosta de propor enigmas.",
  },
  {
    label: "🍺 Mercador Debochado",
    text: "Sarcástico, brincalhão, tenta vender itens duvidosos por preços altos e adora fazer piadas com os jogadores.",
  },
];

export default function IaPersonagens({
  roomId,
  mapTokens,
  activeNpcId,
  onSelectActiveNpc,
}: IaPersonagensProps) {
  const npcs = mapTokens.filter((t) => t.is_npc);

  const [selectedNpcId, setSelectedNpcId] = useState<string>(
    activeNpcId || (npcs[0]?.id || "")
  );
  const [personality, setPersonality] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const selectedNpc = npcs.find((n) => n.id === selectedNpcId);

  const handleSelectNpc = (npcId: string) => {
    setSelectedNpcId(npcId);
    const target = npcs.find((n) => n.id === npcId);
    if (target) {
      setPersonality(target.personality || "");
      onSelectActiveNpc(target);
    }
  };

  const handleSavePersonality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNpcId) return;

    setSaving(true);
    setSuccessMsg("");

    const { error } = await supabase
      .from("characters")
      .update({ personality })
      .eq("id", selectedNpcId);

    setSaving(false);

    if (error) {
      alert("Erro ao salvar personalidade: " + error.message);
    } else {
      setSuccessMsg("🧠 Personalidade atualizada com sucesso!");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  return (
    <div className="space-y-3.5 text-xs w-full max-w-full">
      {/* Header do Gerenciador */}
      <div className="p-3 bg-[#0b0c16] border border-emerald-900/40 rounded-xl space-y-1">
        <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
          🧠 Cérebro de IA dos NPCs
        </h3>
        <p className="text-gray-400 text-[11px] leading-relaxed">
          Selecione um NPC da mesa para ajustar a forma como a IA (Xhenos Mind) irá interpretá-lo durante o chat.
        </p>
      </div>

      {/* Seleção de NPC Ativo na Mesa */}
      <div className="space-y-1.5">
        <label className="block font-bold text-gray-300 uppercase tracking-wider text-[10px]">
          NPC em Destaque na IA:
        </label>
        {npcs.length === 0 ? (
          <div className="p-3 bg-[#12131f] border border-dashed border-gray-700 rounded-xl text-center text-gray-500">
            Nenhum NPC encontrado no mapa. Crie um na aba <strong>Tokens</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5">
            {npcs.map((npc) => (
              <button
                key={npc.id}
                type="button"
                onClick={() => handleSelectNpc(npc.id)}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer gap-2 ${
                  selectedNpcId === npc.id
                    ? "bg-emerald-950/50 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : "bg-[#12131f] border-purple-900/40 text-gray-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={npc.avatar_url}
                    alt={npc.name}
                    className="w-7 h-7 rounded-full object-cover border border-purple-500/50 shrink-0"
                  />
                  <div className="text-left min-w-0">
                    <span className="font-bold block text-cyan-300 truncate">{npc.name}</span>
                    <span className="text-[9px] text-gray-400 block truncate">
                      HP: {npc.current_hp}/{npc.max_hp} | Stamina: {npc.current_stamina}/{npc.max_stamina}
                    </span>
                  </div>
                </div>
                {selectedNpcId === npc.id && (
                  <span className="text-[8px] bg-emerald-900 text-emerald-300 border border-emerald-500 px-2 py-0.5 rounded-full font-bold shrink-0">
                    ATIVO
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Formulário de Personalidade */}
      {selectedNpc && (
        <form onSubmit={handleSavePersonality} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="block font-bold text-gray-300 uppercase tracking-wider text-[10px]">
              Prompt de Personalidade para ({selectedNpc.name}):
            </label>
            <textarea
              rows={3}
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Descreva a personalidade, tom de voz, motivações e segredos do NPC..."
              className="w-full p-2.5 bg-[#12131f] border border-purple-800/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 text-xs font-mono leading-relaxed resize-none"
            />
          </div>

          {/* Presets Rápidos */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold text-purple-400 uppercase tracking-wider">
              ⚡ Presets Rápidos:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PRESETS_PERSONALIDADE.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPersonality(preset.text)}
                  className="p-2 bg-[#12131f] active:bg-emerald-950/40 border border-purple-900/40 hover:border-emerald-500 text-[10px] text-gray-300 rounded-lg transition text-left truncate cursor-pointer"
                  title={preset.text}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botão de Salvar */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 active:from-emerald-500 active:to-cyan-500 font-bold text-white rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Salvando..." : "💾 Salvar Personalidade do NPC"}
          </button>

          {successMsg && (
            <p className="text-emerald-400 font-bold text-[10px] text-center animate-pulse">
              {successMsg}
            </p>
          )}
        </form>
      )}
    </div>
  );
}