"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import CriarPersonagem from "./CriarPersonagem";

export interface Ability {
  id: string;
  name: string;
  type: "Físico" | "Distância" | "Magia" | "Cura" | "Suporte" | "Escudo" | string;
  cost: number;
  dieSides: number;
}

export interface Character {
  id: string;
  room_id: string;
  user_id: string;
  name: string;
  avatar_url?: string | null;
  token_shape: "circle" | "square";
  is_npc: boolean;
  level: number;
  xp: number;
  moedas?: number;
  inventory?: any[];
  current_hp: number;
  max_hp: number;
  current_stamina: number;
  max_stamina: number;
  current_pericia: number;
  max_pericia: number;
  initiative_roll?: number;
  attributes: {
    resiliencia: number;
    vontade: number;
    iniciativa: number;
    precisao: number;
    forca: number;
    intelecto: number;
    attribute_points?: number;
    escudo?: number;
    [key: string]: any;
  };
  abilities: Ability[];
}

interface FichaProps {
  roomId: string;
  userId: string;
  isMestre: boolean;
  onRollDice?: (sides: number, bonus?: number, label?: string) => void;
  onOpenChat?: () => void;
}

export default function Ficha({ roomId, userId, isMestre, onRollDice, onOpenChat }: FichaProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Seleção de Alvos
  const [targetList, setTargetList] = useState<{ id: string; name: string; is_npc: boolean }[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  // Edição
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editTokenShape, setEditTokenShape] = useState<"circle" | "square">("circle");

  // Nova Habilidade
  const [newAbilityName, setNewAbilityName] = useState("");
  const [newAbilityType, setNewAbilityType] = useState<string>("Físico");
  const [newAbilityCost, setNewAbilityCost] = useState(1);
  const [newAbilityDie, setNewAbilityDie] = useState(6);

  // Helpers de Cálculo
  const getHpMax = (r: number, v: number) => 20 + Math.floor((r + v) / 2);
  const getStaminaMax = (r: number) => 10 + r * 5;

  const triggerRoll = (sides: number, bonus?: number, label?: string) => {
    if (onRollDice) {
      onRollDice(sides, bonus, label);
    }
    if (onOpenChat) {
      onOpenChat();
    }
  };

  useEffect(() => {
    fetchCharacters();
    fetchTargetList();
  }, [roomId, userId]);

  const fetchCharacters = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("characters")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const charList = data as Character[];
      setCharacters(charList);

      // Prioriza a ficha vinculada ao próprio jogador, caso exista
      const myChar = charList.find((c) => c.user_id === userId && !c.is_npc);
      setActiveChar((prev) => {
        if (prev) {
          return charList.find((c) => c.id === prev.id) || charList[0];
        }
        return myChar || charList[0];
      });
    } else {
      setCharacters([]);
      setActiveChar(null);
    }
    setLoading(false);
  };

  const fetchTargetList = async () => {
    const { data } = await supabase.from("characters").select("id, name, is_npc").eq("room_id", roomId);
    if (data) setTargetList(data);
  };

  const updateCharacterData = async (updatedChar: Character, payload: Partial<Character>) => {
    setActiveChar(updatedChar);
    setCharacters((prev) => prev.map((c) => (c.id === updatedChar.id ? updatedChar : c)));
    await supabase.from("characters").update(payload).eq("id", updatedChar.id);
  };

  const updateStat = (field: string, value: number) => {
    if (!activeChar) return;
    const updated = { ...activeChar, [field]: value };
    updateCharacterData(updated, { [field]: value });
  };

  const updateMoedas = (delta: number) => {
    if (!activeChar) return;
    const currentCoins = activeChar.moedas ?? 0;
    const newMoedas = Math.max(0, currentCoins + delta);
    const updated = { ...activeChar, moedas: newMoedas };
    updateCharacterData(updated, { moedas: newMoedas });
  };

  // EVOLUÇÃO DE LEVEL COM ROLAGEM D6
  const handleLevelUp = async () => {
    if (!activeChar) return;
    const LEVEL_XP_COST = 50;

    if (activeChar.xp < LEVEL_XP_COST) {
      alert(`XP insuficiente! Subir de nível requer ${LEVEL_XP_COST} XP.`);
      return;
    }

    const pointsGained = Math.floor(Math.random() * 6) + 1;
    const newXp = activeChar.xp - LEVEL_XP_COST;
    const newLevel = (activeChar.level || 1) + 1;
    const currentPoints = Number(activeChar.attributes?.attribute_points) || 0;
    const newPoints = currentPoints + pointsGained;

    const updatedAttrs = {
      ...(activeChar.attributes || {}),
      attribute_points: newPoints,
    };

    const updated: Character = {
      ...activeChar,
      xp: newXp,
      level: newLevel,
      attributes: updatedAttrs as any,
    };

    await updateCharacterData(updated, { xp: newXp, level: newLevel, attributes: updatedAttrs });

    triggerRoll(0, 0, `🎉 ${activeChar.name} subiu para o NÍVEL ${newLevel}! 🎲 Rolou d6 e ganhou +${pointsGained} Pontos de Atributo Livre! (-50 XP)`);
  };

  const handleRollIniciativa = async () => {
    if (!activeChar) return;

    const sides = 6 + (Number(activeChar.attributes?.iniciativa) || 0);
    const rollResult = Math.floor(Math.random() * sides) + 1;

    const updatedAttrs = {
      ...(activeChar.attributes || {}),
      initiative_roll: rollResult,
    };

    const updated: Character = {
      ...activeChar,
      initiative_roll: rollResult,
      attributes: updatedAttrs as any,
    };

    setActiveChar(updated);
    setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

    await supabase
      .from("characters")
      .update({ attributes: updatedAttrs })
      .eq("id", activeChar.id);

    triggerRoll(0, 0, `🎲 Iniciativa de ${activeChar.name}: [ ${rollResult} ] (d${sides})`);
  };

  const handleIncreaseAttribute = (attrKey: keyof Character["attributes"]) => {
    if (!activeChar) return;
    const freePoints = Number(activeChar.attributes?.attribute_points) || 0;

    if (freePoints <= 0) {
      alert("Sem pontos de atributo disponíveis! Suba de nível (50 XP) para rolar o d6 de pontos livres.");
      return;
    }

    const newFreePoints = freePoints - 1;
    const newAttrs = {
      ...activeChar.attributes,
      [attrKey]: (Number(activeChar.attributes[attrKey]) || 0) + 1,
      attribute_points: newFreePoints,
    };

    const newMaxHp = getHpMax(newAttrs.resiliencia, newAttrs.vontade);
    const newMaxStamina = getStaminaMax(newAttrs.resiliencia);

    const updated: Character = {
      ...activeChar,
      attributes: newAttrs,
      max_hp: newMaxHp,
      max_stamina: newMaxStamina,
    };

    updateCharacterData(updated, { attributes: newAttrs, max_hp: newMaxHp, max_stamina: newMaxStamina });
  };

  const handleDecreaseAttribute = (attrKey: keyof Character["attributes"]) => {
    if (!activeChar) return;
    const currentVal = Number(activeChar.attributes[attrKey]) || 0;
    if (currentVal <= 0) return;

    const freePoints = Number(activeChar.attributes?.attribute_points) || 0;
    const newFreePoints = freePoints + 1;

    const newAttrs = {
      ...activeChar.attributes,
      [attrKey]: currentVal - 1,
      attribute_points: newFreePoints,
    };

    const newMaxHp = getHpMax(newAttrs.resiliencia, newAttrs.vontade);
    const newMaxStamina = getStaminaMax(newAttrs.resiliencia);

    const updated: Character = {
      ...activeChar,
      attributes: newAttrs,
      max_hp: newMaxHp,
      max_stamina: newMaxStamina,
      current_hp: Math.min(activeChar.current_hp, newMaxHp),
      current_stamina: Math.min(activeChar.current_stamina, newMaxStamina),
    };

    updateCharacterData(updated, {
      attributes: newAttrs,
      max_hp: newMaxHp,
      max_stamina: newMaxStamina,
      current_hp: updated.current_hp,
      current_stamina: updated.current_stamina,
    });
  };

  const handleDeleteCharacter = async () => {
    if (!activeChar) return;
    if (!confirm(`Deseja apagar a ficha de "${activeChar.name}"?`)) return;

    const { error } = await supabase.from("characters").delete().eq("id", activeChar.id);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }

    const remaining = characters.filter((c) => c.id !== activeChar.id);
    setCharacters(remaining);
    setActiveChar(remaining[0] || null);
    fetchTargetList();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChar || !editName.trim()) return;

    const updated = {
      ...activeChar,
      name: editName.trim(),
      avatar_url: editAvatarUrl.trim() || null,
      token_shape: editTokenShape,
    };

    setIsEditing(false);
    await updateCharacterData(updated, {
      name: editName.trim(),
      avatar_url: editAvatarUrl.trim() || null,
      token_shape: editTokenShape,
    });
    fetchTargetList();
  };

  const handleAddAbility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChar || !newAbilityName.trim()) return;

    const newAbility: Ability = {
      id: Date.now().toString(),
      name: newAbilityName.trim(),
      type: newAbilityType,
      cost: Number(newAbilityCost),
      dieSides: Number(newAbilityDie),
    };

    const cleanAbilities = (activeChar.abilities || []).filter((a) => a && a.name && a.name.trim() !== "");
    const updatedAbilities = [...cleanAbilities, newAbility];
    const updated = { ...activeChar, abilities: updatedAbilities };

    setNewAbilityName("");
    await updateCharacterData(updated, { abilities: updatedAbilities });
  };

  const handleDeleteAbility = async (abilityId: string) => {
    if (!activeChar) return;
    const abilityToRemove = (activeChar.abilities || []).find((a) => a && a.id === abilityId);
    if (abilityToRemove && !confirm(`Deseja desaprender a habilidade "${abilityToRemove.name}"?`)) return;

    const updatedAbilities = (activeChar.abilities || []).filter((a) => a && a.id !== abilityId && a.name && a.name.trim() !== "");
    await updateCharacterData({ ...activeChar, abilities: updatedAbilities }, { abilities: updatedAbilities });
  };

  const handleDescansar = async () => {
    if (!activeChar) return;

    const staminaRecovered = Math.floor(Math.random() * 10) + 1;
    const newStamina = Math.min(activeChar.max_stamina || 10, activeChar.current_stamina + staminaRecovered);
    const newPericia = Math.min(5, activeChar.current_pericia + 3);

    const updated = { ...activeChar, current_pericia: newPericia, current_stamina: newStamina };
    await updateCharacterData(updated, { current_pericia: newPericia, current_stamina: newStamina });

    triggerRoll(0, 0, `💤 Descansou! Recuperou +3 ⭐ de Perícia e +${staminaRecovered}⚡ de Stamina [d10] (${newStamina}/${activeChar.max_stamina})`);
  };

  // PROCESSAMENTO DE DANO SINCRONIZADO COM BARREIRA NO SUPABASE E ESTADO LOCAL
  const applyDamageToTarget = async (targetId: string, damageInput: number) => {
    const damage = Number(damageInput) || 0;
    const { data: targetData, error } = await supabase
      .from("characters")
      .select("id, name, current_hp, attributes")
      .eq("id", targetId)
      .single();

    if (error || !targetData) return "";

    const currentShield = Number(targetData.attributes?.escudo) || 0;
    const currentHp = Number(targetData.current_hp) || 0;
    let newShield = currentShield;
    let newHp = currentHp;
    let logText = "";

    if (currentShield > 0) {
      if (damage <= currentShield) {
        newShield = currentShield - damage;
        logText = ` 🎯 em ${targetData.name} (🛡️ Barreira absorveu ${damage} de dano! Barreira restante: ${newShield})`;
      } else {
        const overflowDamage = damage - currentShield;
        newShield = 0;
        newHp = Math.max(0, currentHp - overflowDamage);
        logText = ` 🎯 em ${targetData.name} (💥 Barreira QUEBROU! Absorveu ${currentShield} e causou ${overflowDamage} no HP! ❤️ HP: ${newHp})`;
      }
    } else {
      newHp = Math.max(0, currentHp - damage);
      logText = ` 🎯 em ${targetData.name} (💥 Causou ${damage} de dano! ❤️ HP: ${newHp})`;
    }

    const updatedAttrs = {
      ...(targetData.attributes || {}),
      escudo: newShield,
    };

    await supabase
      .from("characters")
      .update({ current_hp: newHp, attributes: updatedAttrs })
      .eq("id", targetId);

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? { ...c, current_hp: newHp, attributes: updatedAttrs }
          : c
      )
    );

    if (activeChar && activeChar.id === targetId) {
      setActiveChar((prev) =>
        prev ? { ...prev, current_hp: newHp, attributes: updatedAttrs } : null
      );
    }

    return logText;
  };

  const handleSocoBasico = async () => {
    const damage = Math.floor(Math.random() * 6) + 1;
    let targetText = "";

    if (selectedTargetId) {
      targetText = await applyDamageToTarget(selectedTargetId, damage);
    }

    triggerRoll(0, 0, `👊 Soco Básico (0 ⭐): 🎲 [ ${damage} ]${targetText}`);
  };

  // PROCESSAMENTO AUTOMATIZADO DE HABILIDADES
  const handleUseAbility = async (ability: Ability) => {
    if (!activeChar) return;

    if (activeChar.current_pericia < ability.cost) {
      alert(`Estrelas insuficientes! Requer ${ability.cost} ⭐ de Perícia.`);
      return;
    }

    const staminaDieSides = ability.cost * 10;
    const staminaCost = Math.floor(Math.random() * staminaDieSides) + 1;
    const isExhausted = activeChar.current_stamina < staminaCost;
    const newPericia = activeChar.current_pericia - ability.cost;
    const newStamina = Math.max(0, activeChar.current_stamina - staminaCost);

    const updatedCaster = { ...activeChar, current_pericia: newPericia, current_stamina: newStamina };
    await updateCharacterData(updatedCaster, { current_pericia: newPericia, current_stamina: newStamina });

    if (isExhausted) {
      triggerRoll(0, 0, `💀 AÇÃO FALHOU! ${activeChar.name} tentou usar "${ability.name}", mas ficou EXAUSTO! Stamina zerou! ⚡ [0/${activeChar.max_stamina}]`);
      return;
    }

    const rollValue = Math.floor(Math.random() * ability.dieSides) + 1;
    let actionLog = "";

    // 1. TIPO CURA
    if (ability.type === "Cura") {
      const targetCharId = selectedTargetId || activeChar.id;
      const { data: targetData } = await supabase
        .from("characters")
        .select("id, name, current_hp, max_hp")
        .eq("id", targetCharId)
        .single();

      if (targetData) {
        const maxHp = Number(targetData.max_hp) || 20;
        const currentHp = Number(targetData.current_hp) || 0;
        const newHp = Math.min(maxHp, currentHp + rollValue);

        await supabase
          .from("characters")
          .update({ current_hp: newHp })
          .eq("id", targetCharId);

        setCharacters((prev) =>
          prev.map((c) => (c.id === targetCharId ? { ...c, current_hp: newHp } : c))
        );

        if (activeChar && activeChar.id === targetCharId) {
          setActiveChar((prev) => (prev ? { ...prev, current_hp: newHp } : null));
        }

        const targetName = targetCharId === activeChar.id ? "si mesmo" : targetData.name;
        actionLog = `🧪 [Cura] ${activeChar.name} usou "${ability.name}" em ${targetName} e curou +${rollValue} HP! (❤️ HP: ${newHp}/${maxHp})`;
      }
    }
    // 2. TIPO BARREIRA / ESCUDO
    else if (ability.type === "Escudo") {
      const targetCharId = selectedTargetId || activeChar.id;
      const { data: targetData } = await supabase
        .from("characters")
        .select("id, name, attributes")
        .eq("id", targetCharId)
        .single();

      if (targetData) {
        const currentShield = Number(targetData.attributes?.escudo) || 0;
        const newShield = currentShield + rollValue;
        const updatedAttrs = {
          ...(targetData.attributes || {}),
          escudo: newShield,
        };

        await supabase
          .from("characters")
          .update({ attributes: updatedAttrs })
          .eq("id", targetCharId);

        setCharacters((prev) =>
          prev.map((c) =>
            c.id === targetCharId ? { ...c, attributes: updatedAttrs } : c
          )
        );

        if (activeChar && activeChar.id === targetCharId) {
          setActiveChar((prev) =>
            prev ? { ...prev, attributes: updatedAttrs } : null
          );
        }

        const targetName = targetCharId === activeChar.id ? "si mesmo" : targetData.name;
        actionLog = `🔰 [Barreira] ${activeChar.name} usou "${ability.name}" em ${targetName} concedendo +${rollValue} de Barreira! (🛡️ Barreira Total: ${newShield})`;
      }
    }
    // 3. TIPO SUPORTE (BUFF / DEBUFF)
    else if (ability.type === "Suporte") {
      const targetName = selectedTargetId
        ? targetList.find((t) => t.id === selectedTargetId)?.name || "Alvo"
        : "si mesmo";

      actionLog = `🛡️ [Suporte] ${activeChar.name} ativou "${ability.name}" em ${targetName}! (Efeito Tático: 🎲 [ ${rollValue} ])`;
    }
    // 4. ATAQUES (FÍSICO, DISTÂNCIA, MAGIA)
    else {
      let targetText = "";
      if (selectedTargetId) {
        targetText = await applyDamageToTarget(selectedTargetId, rollValue);
      } else {
        targetText = " (Nenhum alvo selecionado)";
      }
      actionLog = `✨ [${ability.type}] ${activeChar.name} usou "${ability.name}": 🎲 d${ability.dieSides} [ ${rollValue} ]${targetText}`;
    }

    triggerRoll(0, 0, `${actionLog} | Custo: -${ability.cost}⭐, -${staminaCost}⚡ Stamina`);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Físico": return "⚔️";
      case "Distância": return "🏹";
      case "Magia": return "✨";
      case "Cura": return "🧪";
      case "Suporte": return "🛡️";
      case "Escudo": return "🔰";
      default: return "⚡";
    }
  };

  if (loading) return <div className="text-center py-6 text-xs text-purple-300">Carregando Ficha...</div>;

  if (isCreating || characters.length === 0) {
    return (
      <CriarPersonagem
        roomId={roomId}
        userId={userId}
        isMestre={isMestre}
        onCreated={(newChar) => {
          setCharacters((prev) => [...prev, newChar]);
          setActiveChar(newChar);
          setIsCreating(false);
          fetchTargetList();
        }}
        onCancel={characters.length > 0 ? () => setIsCreating(false) : undefined}
      />
    );
  }

  const initialLetter = activeChar?.name ? activeChar.name.charAt(0).toUpperCase() : "P";
  const validAbilities = (activeChar?.abilities || []).filter(
    (a) => a && a.name && a.name.trim() !== ""
  );
  const freeAttributePoints = Number(activeChar?.attributes?.attribute_points) || 0;
  const currentShieldValue = Number(activeChar?.attributes?.escudo) || 0;

  return (
    <div className="space-y-3 text-xs text-white w-full max-w-full">
      {/* SELETOR UNIFICADO DE PERSONAGEM (DISPONÍVEL PARA JOGADORES E MESTRE) */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-purple-900/40">
        {characters.length > 0 && (
          <select
            value={activeChar?.id || ""}
            onChange={(e) => {
              const selected = characters.find((c) => c.id === e.target.value) || null;
              setActiveChar(selected);
              setIsEditing(false);
            }}
            className="flex-1 bg-[#0b0c16] border border-purple-800/40 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-400 min-w-0"
          >
            <optgroup label="🛡️ Personagens de Jogadores">
              {characters.filter((c) => !c.is_npc).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user_id === userId ? "⭐ (Meu) " : "🛡️ "} {c.name} (LV {c.level || 1})
                </option>
              ))}
            </optgroup>
            {characters.some((c) => c.is_npc) && (
              <optgroup label="👹 NPCs / Monstros">
                {characters.filter((c) => c.is_npc).map((c) => (
                  <option key={c.id} value={c.id}>
                    👹 {c.name} (LV {c.level || 1})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}

        <button
          onClick={() => { setIsCreating(true); setIsEditing(false); }}
          className="px-2.5 py-2 bg-purple-600 active:bg-cyan-600 font-bold rounded-lg transition text-xs cursor-pointer shrink-0"
          title="Criar Nova Ficha"
        >
          + Novo
        </button>

        {activeChar && (
          <>
            <button
              onClick={() => {
                setEditName(activeChar.name);
                setEditAvatarUrl(activeChar.avatar_url || "");
                setEditTokenShape(activeChar.token_shape || "circle");
                setIsEditing(true);
              }}
              className="px-2.5 py-2 bg-cyan-950/80 active:bg-cyan-700 text-cyan-300 border border-cyan-800/50 rounded-lg transition text-xs cursor-pointer shrink-0"
              title="Editar Personagem / Habilidades"
            >
              ✏️
            </button>
            <button
              onClick={handleDeleteCharacter}
              className="px-2.5 py-2 bg-red-950/80 active:bg-red-700 text-red-300 border border-red-800/50 rounded-lg transition text-xs cursor-pointer shrink-0"
              title="Apagar Ficha"
            >
              🗑️
            </button>
          </>
        )}
      </div>

      {/* TELA DE EDIÇÃO */}
      {isEditing && activeChar ? (
        <div className="space-y-3 bg-[#0b0c16] p-3 rounded-xl border border-cyan-800/50">
          <div className="flex justify-between items-center border-b border-purple-900/40 pb-1.5">
            <h3 className="font-bold text-cyan-400">✏️ Editar {activeChar.name}</h3>
            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white p-1">✕</button>
          </div>

          <form onSubmit={handleSaveEdit} className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Nome</label>
              <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1.5 bg-[#12131f] border border-purple-800/40 rounded text-white text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">URL Avatar</label>
              <input type="text" value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} className="w-full px-2 py-1.5 bg-[#12131f] border border-purple-800/40 rounded text-white text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Formato Token</label>
              <select value={editTokenShape} onChange={(e: any) => setEditTokenShape(e.target.value)} className="w-full p-1.5 bg-[#12131f] border border-purple-800/40 rounded text-white text-xs">
                <option value="circle">⭕ Círculo</option>
                <option value="square">🔲 Quadrado</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2 bg-cyan-600 active:bg-cyan-500 font-bold rounded text-xs cursor-pointer">Salvar Alterações</button>
          </form>

          {/* CADASTRAR E DESAPRENDER HABILIDADES */}
          <div className="pt-2 border-t border-purple-900/40 space-y-2">
            <span className="text-[10px] font-bold text-purple-300 block">➕ Adicionar Habilidade</span>
            <form onSubmit={handleAddAbility} className="space-y-2 bg-[#12131f] p-2.5 rounded-lg border border-purple-900/40">
              <input type="text" required placeholder="Nome da Habilidade" value={newAbilityName} onChange={(e) => setNewAbilityName(e.target.value)} className="w-full px-2 py-1.5 bg-[#0b0c16] border border-purple-800/40 rounded text-white text-[11px]" />
              
              <div>
                <label className="text-[8px] text-gray-400 block mb-0.5">Classificação Tática</label>
                <select value={newAbilityType} onChange={(e) => setNewAbilityType(e.target.value)} className="w-full bg-[#0b0c16] border border-purple-800/40 text-white rounded p-1.5 text-[10px]">
                  <option value="Físico">⚔️ Ataque Físico (Dano Corporal)</option>
                  <option value="Distância">🏹 Ataque a Distância (Projétil)</option>
                  <option value="Magia">✨ Magia (Dano Arcano/Elementar)</option>
                  <option value="Cura">🧪 Cura (Restaura HP do Alvo)</option>
                  <option value="Suporte">🛡️ Suporte (Buffs / Debuffs)</option>
                  <option value="Escudo">🔰 Barreira (Proteção Extra)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] text-gray-400">Custo ⭐ (Perícia)</label>
                  <input type="number" min="1" max="5" value={newAbilityCost} onChange={(e) => setNewAbilityCost(Number(e.target.value))} className="w-full bg-[#0b0c16] border border-purple-800/40 text-white rounded p-1 text-[10px]" />
                </div>
                <div>
                  <label className="text-[8px] text-gray-400">Dado de Efeito (dX)</label>
                  <input type="number" min="2" value={newAbilityDie} onChange={(e) => setNewAbilityDie(Number(e.target.value))} className="w-full bg-[#0b0c16] border border-purple-800/40 text-white rounded p-1 text-[10px]" />
                </div>
              </div>

              <button type="submit" className="w-full py-1.5 bg-purple-700 active:bg-purple-600 text-white font-bold text-[10px] rounded cursor-pointer">+ Cadastrar Habilidade</button>
            </form>

            {/* LISTAGEM PARA DESAPRENDER HABILIDADES */}
            {validAbilities.length > 0 && (
              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-bold text-red-400 block uppercase">🔥 Desaprender Habilidades</span>
                <div className="space-y-1">
                  {validAbilities.map((ability) => (
                    <div key={ability.id} className="p-2 bg-[#12131f] border border-red-900/40 rounded-lg flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-white text-[10px] block truncate">
                          {getTypeIcon(ability.type)} {ability.name}
                        </span>
                        <span className="text-[8px] text-gray-400 block truncate">
                          {ability.cost} ⭐ • d{ability.dieSides}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAbility(ability.id)}
                        className="px-2 py-1 bg-red-950 hover:bg-red-800 text-red-200 border border-red-700/60 font-bold text-[9px] rounded cursor-pointer transition shrink-0"
                      >
                        Desaprender 🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* FICHA PRINCIPAL DO PERSONAGEM */
        activeChar && (
          <div className="space-y-3">
            {/* HEADER */}
            <div className="bg-[#0b0c16] p-2.5 border border-purple-800/40 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {activeChar.avatar_url ? (
                  <img src={activeChar.avatar_url} alt={activeChar.name} className={`w-10 h-10 object-cover border-2 shrink-0 ${activeChar.is_npc ? "border-red-500" : "border-cyan-400"} ${activeChar.token_shape === "circle" ? "rounded-full" : "rounded-lg"}`} />
                ) : (
                  <div className={`w-10 h-10 flex items-center justify-center font-extrabold text-sm text-white border-2 shadow-md shrink-0 ${activeChar.is_npc ? "bg-gradient-to-tr from-red-900 to-amber-600 border-red-500" : "bg-gradient-to-tr from-purple-700 to-cyan-500 border-cyan-400"} ${activeChar.token_shape === "circle" ? "rounded-full" : "rounded-lg"}`}>
                    {initialLetter}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-extrabold text-white text-xs truncate">{activeChar.name}</h3>
                  <span className="text-[10px] text-cyan-400 block truncate">
                    LV {activeChar.level || 1} • <strong className="text-amber-300 font-mono">{activeChar.xp} XP</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={handleLevelUp}
                disabled={activeChar.xp < 50}
                className={`px-2.5 py-1.5 text-[9px] font-bold rounded-lg border transition cursor-pointer shrink-0 ${
                  activeChar.xp >= 50
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-yellow-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse"
                    : "bg-[#12131f] border-purple-900/40 text-gray-500 opacity-60 cursor-not-allowed"
                }`}
                title="Consome 50 XP e rola 1d6 para ganhar Pontos de Atributo Livre"
              >
                {activeChar.xp >= 50 ? "⚡ Subir LV! (d6 Pts)" : "Subir LV (50 XP)"}
              </button>
            </div>

            {/* PAINEL DE MOEDAS */}
            <div className="bg-[#0b0c16] p-2.5 rounded-xl border border-amber-500/40 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-amber-400 font-mono flex items-center gap-1 shrink-0">
                🪙 Moedas: {activeChar.moedas ?? 0}
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => updateMoedas(-10)}
                  className="px-2 py-0.5 bg-amber-950/80 active:bg-amber-800 text-amber-300 border border-amber-800/40 rounded font-bold cursor-pointer text-[10px]"
                >
                  -10
                </button>
                <button
                  onClick={() => updateMoedas(-1)}
                  className="px-2 py-0.5 bg-amber-950/80 active:bg-amber-800 text-amber-300 border border-amber-800/40 rounded font-bold cursor-pointer text-[10px]"
                >
                  -1
                </button>
                <button
                  onClick={() => updateMoedas(1)}
                  className="px-2 py-0.5 bg-amber-950/80 active:bg-amber-800 text-amber-300 border border-amber-800/40 rounded font-bold cursor-pointer text-[10px]"
                >
                  +1
                </button>
                <button
                  onClick={() => updateMoedas(10)}
                  className="px-2 py-0.5 bg-amber-950/80 active:bg-amber-800 text-amber-300 border border-amber-800/40 rounded font-bold cursor-pointer text-[10px]"
                >
                  +10
                </button>
              </div>
            </div>

            {/* SELEÇÃO DE ALVO */}
            <div className="bg-[#0b0c16] p-2.5 rounded-xl border border-purple-800/40 space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-cyan-400 uppercase">🎯 Alvo da Ação:</label>
                {selectedTargetId && (
                  <button onClick={() => setSelectedTargetId("")} className="text-[9px] text-gray-400 hover:text-white cursor-pointer">Limpar</button>
                )}
              </div>
              <select value={selectedTargetId} onChange={(e) => setSelectedTargetId(e.target.value)} className="w-full bg-[#12131f] border border-purple-800/50 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-400">
                <option value="">-- Sem Alvo Selecionado --</option>
                {targetList.filter((t) => t.id !== activeChar.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.is_npc ? "👹 NPC: " : "🛡️ "} {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* VITAIS COM EXIBIÇÃO EM TEMPO REAL DA BARREIRA */}
            <div className="space-y-2">
              <div className="bg-[#0b0c16] p-2.5 rounded-xl border border-red-900/40">
                <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-red-400">❤️ HP: {activeChar.current_hp} / {activeChar.max_hp || 20}</span>
                    {currentShieldValue > 0 && (
                      <span className="text-cyan-300 font-bold bg-cyan-950/80 border border-cyan-500/60 px-1.5 py-0.2 rounded font-mono">
                        (+{currentShieldValue} 🛡️ Barreira)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => updateStat("current_hp", Math.max(0, activeChar.current_hp - 1))} className="px-2.5 py-1 bg-red-950 active:bg-red-800 text-red-300 rounded font-bold cursor-pointer">-1</button>
                    <button onClick={() => updateStat("current_hp", Math.min(activeChar.max_hp || 20, activeChar.current_hp + 1))} className="px-2.5 py-1 bg-red-950 active:bg-red-800 text-red-300 rounded font-bold cursor-pointer">+1</button>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b0c16] p-2.5 rounded-xl border border-amber-900/40">
                <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                  <span className="text-amber-400">⚡ Stamina: {activeChar.current_stamina} / {activeChar.max_stamina || 10}</span>
                  <div className="flex gap-1">
                    <button onClick={() => updateStat("current_stamina", Math.max(0, activeChar.current_stamina - 1))} className="px-2.5 py-1 bg-amber-950 active:bg-amber-800 text-amber-300 rounded font-bold cursor-pointer">-1</button>
                    <button onClick={() => updateStat("current_stamina", Math.min(activeChar.max_stamina || 10, activeChar.current_stamina + 1))} className="px-2.5 py-1 bg-amber-950 active:bg-amber-800 text-amber-300 rounded font-bold cursor-pointer">+1</button>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b0c16] p-2.5 rounded-xl border border-cyan-800/40 space-y-2">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-cyan-300">⭐ Perícia (Ações):</span>
                  <span className="text-amber-300">{"⭐".repeat(activeChar.current_pericia)} ({activeChar.current_pericia}/5)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button onClick={handleSocoBasico} className="py-2 bg-purple-900/60 active:bg-cyan-600 text-[10px] font-bold text-white rounded-lg transition cursor-pointer">
                    👊 Soco (0 ⭐) [d6]
                  </button>
                  <button onClick={handleDescansar} className="py-2 bg-amber-950 active:bg-amber-800 text-[10px] font-bold text-amber-200 rounded-lg transition cursor-pointer">
                    💤 Descansar (+3⭐/+d10⚡)
                  </button>
                </div>
              </div>
            </div>

            {/* HABILIDADES */}
            {validAbilities.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-purple-900/40">
                <span className="block text-[10px] font-bold uppercase text-cyan-400">⚔️ Habilidades Aprendidas</span>
                <div className="space-y-1.5">
                  {validAbilities.map((ability) => (
                    <div key={ability.id} className="p-2.5 bg-[#0b0c16] border border-purple-800/40 rounded-lg flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-white text-[11px] block truncate">
                          {getTypeIcon(ability.type)} {ability.name}
                        </span>
                        <span className="text-[9px] text-amber-400 block truncate">
                          {"⭐".repeat(ability.cost)} ({ability.cost} ⭐) • Stamina: d{ability.cost * 10} • Efeito: d{ability.dieSides}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleUseAbility(ability)} className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 active:opacity-80 text-white font-bold text-[10px] rounded cursor-pointer">
                          Usar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ATRIBUTOS EXCLUSIVAMENTE COM PONTOS LIVRES DO D6 */}
            <div className="space-y-1.5 pt-2 border-t border-purple-900/40">
              <div className="flex justify-between items-center flex-wrap gap-1">
                <span className="block text-[10px] font-bold uppercase text-purple-300">Atributos</span>
                <div className="flex items-center gap-2 text-[9px]">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    freeAttributePoints > 0
                      ? "bg-amber-950 text-amber-300 border border-amber-500/60 animate-pulse"
                      : "bg-[#12131f] text-gray-400 border border-purple-900/40"
                  }`}>
                    🎲 Pts Livres: {freeAttributePoints}
                  </span>
                  <span className="text-gray-400 font-semibold">XP: <strong className="text-cyan-300 font-mono">{activeChar.xp}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  { key: "resiliencia", label: "Resiliência" },
                  { key: "vontade", label: "Vontade" },
                  { key: "iniciativa", label: "Iniciativa" },
                  { key: "precisao", label: "Precisão" },
                  { key: "forca", label: "Força" },
                  { key: "intelecto", label: "Intelecto" },
                ].map((attr) => {
                  const val = Number((activeChar.attributes as any)[attr.key]) || 0;

                  return (
                    <div key={attr.key} className="bg-[#0b0c16] p-2 rounded-lg border border-purple-900/40 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-300">{attr.label}</span>
                        <span className="text-[8px] text-amber-400 font-mono font-bold">
                          (1 Pt)
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDecreaseAttribute(attr.key as any)} disabled={val <= 0} className="w-6 h-6 bg-purple-950 text-purple-300 rounded font-bold disabled:opacity-30 cursor-pointer flex items-center justify-center">-</button>
                          <span className="text-xs font-extrabold text-cyan-300 w-4 text-center">{val}</span>
                          <button onClick={() => handleIncreaseAttribute(attr.key as any)} disabled={freeAttributePoints <= 0} className="w-6 h-6 bg-purple-950 text-purple-300 rounded font-bold disabled:opacity-30 cursor-pointer flex items-center justify-center">+</button>
                        </div>

                        {attr.key === "iniciativa" ? (
                          <button onClick={handleRollIniciativa} className="px-2 py-1 bg-cyan-950 border border-cyan-700 text-[9px] font-bold text-cyan-300 rounded cursor-pointer shrink-0" title="Rolar Iniciativa">
                            🎲 d{6 + val}
                          </button>
                        ) : (
                          <button onClick={() => triggerRoll(20, val, attr.label)} className="px-2 py-1 bg-purple-950 border border-purple-800 text-[9px] font-bold text-purple-200 rounded cursor-pointer shrink-0">
                            🎲 d20
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
