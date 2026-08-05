"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface CriarPersonagemProps {
  roomId: string;
  userId: string;
  isMestre: boolean;
  onCreated: (newChar: any) => void;
  onCancel?: () => void;
}

const MAX_POINTS_NID = 8;

export default function CriarPersonagem({
  roomId,
  userId,
  isMestre,
  onCreated,
  onCancel,
}: CriarPersonagemProps) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tokenShape, setTokenShape] = useState<"circle" | "square">("circle");
  const [isNpc, setIsNpc] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pluginConfig, setPluginConfig] = useState<any>(null);

  // Atributos Genéricos (Funciona para NID ou Plugin)
  const [attributes, setAttributes] = useState<Record<string, number>>({});

  // Recursos Genéricos para Plugins (PV, Sanidade, PE, etc.)
  const [resources, setResources] = useState<Record<string, number>>({});

  // Estados NID FOR END (Fallback)
  const [ability1, setAbility1] = useState({ name: "", type: "Físico", cost: 1, dieSides: 6 });
  const [ability2, setAbility2] = useState({ name: "", type: "Distância", cost: 2, dieSides: 8 });

  useEffect(() => {
    fetchRoomPlugin();
  }, [roomId]);

  const fetchRoomPlugin = async () => {
    const { data } = await supabase
      .from("rooms")
      .select("plugin_config")
      .eq("id", roomId)
      .single();

    if (data?.plugin_config) {
      const plugin = data.plugin_config;
      setPluginConfig(plugin);

      // Inicializa atributos do Plugin (Ex: Agilidade = 1, Força = 1...)
      const initialAttrs: Record<string, number> = {};
      plugin.attributes?.forEach((attr: any) => {
        initialAttrs[attr.id] = 1;
      });
      setAttributes(initialAttrs);

      // Inicializa valores máximos dos Recursos
      const initialRes: Record<string, number> = {};
      plugin.resources?.forEach((res: any) => {
        initialRes[res.id] = 20; // Valor padrão inicial
      });
      setResources(initialRes);
    } else {
      // Fallback Nativo (NID FOR END)
      setAttributes({
        resiliencia: 0,
        vontade: 0,
        iniciativa: 0,
        precisao: 0,
        forca: 0,
        intelecto: 0,
      });
    }
  };

  // Helper NID FOR END
  const getHpMaxNid = (r: number, v: number) => 20 + Math.floor((r + v) / 2);
  const getStaminaMaxNid = (r: number) => 10 + r * 5;

  const pointsSpentNid = Object.values(attributes).reduce((acc, val) => acc + val, 0);
  const pointsRemainingNid = MAX_POINTS_NID - pointsSpentNid;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = `${roomId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("tokens").upload(fileName, file);

    if (error) {
      alert("Erro ao subir Token: " + error.message);
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("tokens").getPublicUrl(fileName);
    setAvatarUrl(urlData.publicUrl);
    setIsUploading(false);
  };

  const handleAttrChange = (key: string, delta: number) => {
    if (!pluginConfig && delta > 0 && pointsRemainingNid <= 0) return;

    setAttributes((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  const handleResourceChange = (key: string, val: number) => {
    setResources((prev) => ({
      ...prev,
      [key]: Math.max(1, val),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let newCharData: any = {
      room_id: roomId,
      user_id: userId,
      name: name.trim(),
      avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
      token_shape: tokenShape,
      is_npc: isMestre ? isNpc : false,
      level: 1,
      xp: 0,
      attributes: attributes,
    };

    if (pluginConfig) {
      // SALVA COM AS REGRAS DO PLUGIN
      const customResObj: Record<string, { current: number; max: number }> = {};
      Object.entries(resources).forEach(([key, val]) => {
        customResObj[key] = { current: val, max: val };
      });

      newCharData.current_hp = resources["vida"] || resources["pv"] || resources["hp"] || 20;
      newCharData.max_hp = newCharData.current_hp;
      newCharData.custom_resources = customResObj;
    } else {
      // SALVA COM AS REGRAS NATIVAS DO NID FOR END
      const hp = getHpMaxNid(attributes.resiliencia || 0, attributes.vontade || 0);
      const stamina = getStaminaMaxNid(attributes.resiliencia || 0);

      newCharData.current_hp = hp;
      newCharData.max_hp = hp;
      newCharData.current_stamina = stamina;
      newCharData.max_stamina = stamina;
      newCharData.current_pericia = 5;
      newCharData.max_pericia = 5;
      newCharData.abilities = [
        { id: "1", ...ability1 },
        { id: "2", ...ability2 },
      ];
    }

    const { data, error } = await supabase
      .from("characters")
      .insert([newCharData])
      .select()
      .single();

    if (error) {
      alert("Erro ao salvar personagem: " + error.message);
    } else if (data) {
      onCreated(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-[#0b0c16] p-4 rounded-xl border border-purple-800/50 text-xs text-white">
      <div className="flex justify-between items-center pb-2 border-b border-purple-900/40">
        <h3 className="font-bold text-cyan-400 uppercase text-xs">
          ⚡ Criar Ficha - {pluginConfig?.systemName || "NID FOR END"}
        </h3>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-white cursor-pointer">
            ✕
          </button>
        )}
      </div>

      {/* Nome */}
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Personagem / Agente</label>
        <input
          type="text"
          required
          placeholder="Ex: Kaelen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-1.5 bg-[#12131f] border border-purple-800/50 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* Foto / Token */}
      <div>
        <label className="block text-[10px] font-bold text-purple-300 uppercase mb-1">Foto / Token (Opcional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-900/60 file:text-purple-200 cursor-pointer"
        />
        {isUploading && <p className="text-[10px] text-cyan-400 animate-pulse mt-1">Enviando imagem...</p>}
      </div>

      {/* Formato e Tipo */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Formato Token</label>
          <select
            value={tokenShape}
            onChange={(e: any) => setTokenShape(e.target.value)}
            className="w-full p-1.5 bg-[#12131f] border border-purple-800/50 rounded-lg text-white cursor-pointer"
          >
            <option value="circle">⭕ Círculo</option>
            <option value="square">🔲 Quadrado</option>
          </select>
        </div>

        {isMestre && (
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo</label>
            <select
              value={isNpc ? "true" : "false"}
              onChange={(e) => setIsNpc(e.target.value === "true")}
              className="w-full p-1.5 bg-[#12131f] border border-purple-800/50 rounded-lg text-white cursor-pointer"
            >
              <option value="false">🛡️ Jogador</option>
              <option value="true">👹 NPC / Monstro</option>
            </select>
          </div>
        )}
      </div>

      {/* RECURSOS INICIAIS (SE FOR PLUGIN) */}
      {pluginConfig && pluginConfig.resources && (
        <div className="space-y-1.5 pt-2 border-t border-purple-900/40">
          <span className="block text-[10px] font-bold text-cyan-400 uppercase">
            ❤️ Recursos Máximos Iniciais
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {pluginConfig.resources.map((res: any) => (
              <div key={res.id} className="bg-[#12131f] p-2 rounded-lg border border-purple-900/40 flex justify-between items-center">
                <span className="text-[10px] text-gray-300 font-bold">{res.name} Máximo:</span>
                <input
                  type="number"
                  min="1"
                  value={resources[res.id] || 20}
                  onChange={(e) => handleResourceChange(res.id, Number(e.target.value))}
                  className="w-16 bg-[#0b0c16] border border-purple-800/40 rounded px-2 py-0.5 text-center text-white text-xs font-mono font-bold"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ATRIBUTOS (ADAPTA PARA PLUGIN OU NID FOR END) */}
      <div className="space-y-1.5 pt-2 border-t border-purple-900/40">
        <div className="flex justify-between items-center">
          <span className="block text-[10px] font-bold text-purple-300 uppercase">
            📊 Atributos Iniciais
          </span>
          {!pluginConfig && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${pointsRemainingNid === 0 ? "bg-green-950 text-green-300" : "bg-cyan-950 text-cyan-300"}`}>
              Pontos: {pointsRemainingNid} / {MAX_POINTS_NID}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {(pluginConfig?.attributes || [
            { id: "resiliencia", name: "Resiliência" },
            { id: "vontade", name: "Vontade" },
            { id: "iniciativa", name: "Iniciativa" },
            { id: "precisao", name: "Precisão" },
            { id: "forca", name: "Força" },
            { id: "intelecto", name: "Intelecto" },
          ]).map((attr: any) => (
            <div key={attr.id} className="bg-[#12131f] p-1.5 rounded-lg border border-purple-900/40 flex justify-between items-center">
              <span className="text-[10px] text-gray-300 truncate max-w-[70px]">{attr.name}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAttrChange(attr.id, -1)}
                  className="px-1.5 bg-purple-950 text-purple-300 rounded font-bold hover:bg-purple-900"
                >
                  -
                </button>
                <span className="font-bold text-cyan-300 w-3 text-center">{attributes[attr.id] ?? 0}</span>
                <button
                  type="button"
                  onClick={() => handleAttrChange(attr.id, 1)}
                  className="px-1.5 bg-purple-950 text-purple-300 rounded font-bold hover:bg-purple-900"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isUploading}
        className="w-full py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
      >
        Salvar Personagem
      </button>
    </form>
  );
}