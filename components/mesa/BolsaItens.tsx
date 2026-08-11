"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type EquipSlotKey =
  | "cabeca"
  | "peito"
  | "bracos"
  | "pernas"
  | "cintura"
  | "maoDireita"
  | "maoEsquerda"
  | "duasMaos";

export interface InventoryItem {
  id: string;
  name: string;
  category: "equipavel" | "cura" | "suporte" | string;
  description: string;
  effect_value?: number;
  image_url?: string | null;
  bought_at?: string;
  slotRecommended?: EquipSlotKey;
}

export interface EquipmentSlots {
  cabeca?: InventoryItem | null;
  peito?: InventoryItem | null;
  bracos?: InventoryItem | null;
  pernas?: InventoryItem | null;
  cintura?: InventoryItem | null;
  maoDireita?: InventoryItem | null;
  maoEsquerda?: InventoryItem | null;
  duasMaos?: InventoryItem | null;
}

interface BolsaItensProps {
  roomId: string;
  currentUserId: string;
  onSendMessage?: (text: string) => void;
}

export default function BolsaItens({ roomId, currentUserId, onSendMessage }: BolsaItensProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [character, setCharacter] = useState<any>(null);
  const [equipment, setEquipment] = useState<EquipmentSlots>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Posição e controle de Drag sem vazamento de escopo via useRef
  const [position, setPosition] = useState({ x: 16, y: 100 });
  const posRef = useRef(position);
  posRef.current = position;

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    fetchCharacterData();
  }, [roomId, currentUserId]);

  const fetchCharacterData = async () => {
    if (!currentUserId || !roomId) return;

    const { data } = await supabase
      .from("characters")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", currentUserId)
      .eq("is_npc", false)
      .maybeSingle();

    if (data) {
      setCharacter(data);
      setInventory(Array.isArray(data.inventory) ? data.inventory : []);
      setEquipment(data.attributes?.equipment || {});
    }
  };

  const saveEquipmentAndInventory = async (
    newEquip: EquipmentSlots,
    newInv: InventoryItem[]
  ) => {
    if (!character) return;

    setEquipment(newEquip);
    setInventory(newInv);

    const updatedAttributes = {
      ...(character.attributes || {}),
      equipment: newEquip,
    };

    await supabase
      .from("characters")
      .update({
        attributes: updatedAttributes,
        inventory: newInv,
      })
      .eq("id", character.id);
  };

  // --- ARRASTO ROBUSTO E SEM VAZAMENTO DE LISTENERS (PC & MOBILE) ---
  const handleStartDrag = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: clientX, y: clientY };
    initialPosRef.current = { ...posRef.current };
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      hasDraggedRef.current = true;
    }

    const maxX = typeof window !== "undefined" ? window.innerWidth - 60 : 300;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 60 : 500;

    const newX = Math.max(10, Math.min(maxX, initialPosRef.current.x + deltaX));
    const newY = Math.max(10, Math.min(maxY, initialPosRef.current.y + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handleEndDrag = () => {
    isDraggingRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStartDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleStartDrag(touch.clientX, touch.clientY);
    }
  };

  // Ouvintes de evento estáticos anexados uma única vez ao window
  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleMoveDrag(e.clientX, e.clientY);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        handleEndDrag();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches.length > 0) {
        const touch = e.touches[0];
        handleMoveDrag(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      if (isDraggingRef.current) {
        handleEndDrag();
      }
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleIconClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!hasDraggedRef.current) {
      setIsOpen((prev) => !prev);
    }
  };

  // --- EQUIPAR ITEM NAS ARMADURAS/ARMAS ---
  const handleEquipToSlot = async (slot: EquipSlotKey, itemToEquip: InventoryItem) => {
    let newEquip = { ...equipment };
    let newInv = inventory.filter((i) => i.id !== itemToEquip.id);

    if (newEquip[slot]) {
      newInv.push(newEquip[slot]!);
    }

    if (slot === "duasMaos") {
      if (newEquip.maoDireita) {
        newInv.push(newEquip.maoDireita);
        newEquip.maoDireita = null;
      }
      if (newEquip.maoEsquerda) {
        newInv.push(newEquip.maoEsquerda);
        newEquip.maoEsquerda = null;
      }
    } else if (slot === "maoDireita" || slot === "maoEsquerda") {
      if (newEquip.duasMaos) {
        newInv.push(newEquip.duasMaos);
        newEquip.duasMaos = null;
      }
    }

    newEquip[slot] = itemToEquip;
    setSelectedItem(null);
    await saveEquipmentAndInventory(newEquip, newInv);
  };

  const handleUnequipSlot = async (slot: EquipSlotKey) => {
    const itemInSlot = equipment[slot];
    if (!itemInSlot) return;

    let newEquip = { ...equipment };
    newEquip[slot] = null;

    let newInv = [...inventory, itemInSlot];
    await saveEquipmentAndInventory(newEquip, newInv);
  };

  // --- USAR ITEM CONSUMÍVEL (CURA OU SUPORTE) ---
  const handleUseConsumableItem = async (itemToUse: InventoryItem) => {
    if (!character) return;

    const newInv = inventory.filter((i) => i.id !== itemToUse.id);

    if (itemToUse.category === "cura") {
      const healAmount = itemToUse.effect_value || 10;
      const maxHp = Number(character.max_hp) || 20;
      const currentHp = Number(character.current_hp) || 0;
      const newHp = Math.min(maxHp, currentHp + healAmount);

      setCharacter((prev: any) => ({ ...prev, current_hp: newHp, inventory: newInv }));
      setInventory(newInv);

      await supabase
        .from("characters")
        .update({
          current_hp: newHp,
          inventory: newInv,
        })
        .eq("id", character.id);

      alert(`🧪 ${character.name} usou "${itemToUse.name}" e recuperou +${healAmount} HP! (HP: ${newHp}/${maxHp})`);

      if (onSendMessage) {
        onSendMessage(`🧪 ${character.name} usou o item consumível "${itemToUse.name}" e recuperou +${healAmount} HP! (❤️ HP Atual: ${newHp}/${maxHp})`);
      }
    } else {
      setCharacter((prev: any) => ({ ...prev, inventory: newInv }));
      setInventory(newInv);

      await supabase
        .from("characters")
        .update({ inventory: newInv })
        .eq("id", character.id);

      alert(`💣 ${character.name} usou "${itemToUse.name}"!`);

      if (onSendMessage) {
        onSendMessage(`💣 ${character.name} usou o item de suporte "${itemToUse.name}"! (Efeito Tático: ${itemToUse.description || "Ativado"})`);
      }
    }
  };

  const renderSlotCircle = (
    slotKey: EquipSlotKey,
    label: string,
    iconDefault: string,
    customClass: string
  ) => {
    const item = equipment[slotKey];

    return (
      <div className={`flex flex-col items-center gap-1 ${customClass}`}>
        <button
          type="button"
          onClick={() => (item ? handleUnequipSlot(slotKey) : null)}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center relative transition shadow-md cursor-pointer ${
            item
              ? "bg-amber-950 border-amber-400 text-amber-100 shadow-amber-900/50 hover:scale-105"
              : "bg-[#0b0c16]/90 border-amber-900/60 text-amber-700 hover:border-amber-500/60"
          }`}
          title={item ? `${item.name} (Clique para remover)` : `Slot: ${label}`}
        >
          {item?.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full rounded-full object-cover border border-amber-500/50"
            />
          ) : item ? (
            <span className="text-xs font-bold truncate px-1 text-center">{item.name.substring(0, 3)}</span>
          ) : (
            <span className="text-lg sm:text-xl opacity-60">{iconDefault}</span>
          )}

          {item && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-black">
              ✕
            </span>
          )}
        </button>
        <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-tighter text-center">
          {label}
        </span>
      </div>
    );
  };

  if (!character) return null;

  return (
    <>
      {/* BOTÃO FLUTUANTE MARROM (BOLSA DE ITENS) */}
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleIconClick}
        className="fixed z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 border-2 border-amber-500 rounded-full shadow-[0_0_20px_rgba(180,83,9,0.6)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none hover:scale-105 transition-transform"
      >
        <span className="text-2xl select-none">🎒</span>
        {inventory.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-black font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-black shadow">
            {inventory.length}
          </span>
        )}
      </div>

      {/* PAINEL / MODAL DE EQUIPAMENTOS & INVENTÁRIO */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#120d08] border-2 border-amber-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_0_30px_rgba(180,83,9,0.4)] text-white">
            
            {/* HEADER DA BOLSA */}
            <div className="p-3 sm:p-4 bg-[#1f130b] border-b border-amber-800/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎒</span>
                <div>
                  <h3 className="font-extrabold text-amber-300 text-sm sm:text-base uppercase tracking-wider">
                    Equipamentos de {character.name}
                  </h3>
                  <p className="text-[10px] text-amber-200/60">
                    Gerencie suas armaduras, armas e consumíveis adquiridos nas lojas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 bg-amber-950 hover:bg-amber-900 border border-amber-600 text-amber-300 rounded-full font-bold flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* CORPO DO PAINEL */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-6">
              
              {/* DISPOSIÇÃO DE SLOTS CIRCULARES DE ARMADURA E ARMAS */}
              <div className="bg-[#0b0704] border border-amber-900/60 p-4 rounded-2xl space-y-3 relative">
                <span className="block text-center text-[10px] font-black uppercase text-amber-400 tracking-widest pb-1 border-b border-amber-900/40">
                  🛡️ Corpo & Slots de Equipamento
                </span>

                <div className="flex flex-col items-center gap-3 pt-2">
                  {renderSlotCircle("cabeca", "Cabeça", "🪖", "")}

                  <div className="flex items-center justify-center gap-4 sm:gap-8">
                    {renderSlotCircle("bracos", "Braços", "🥊", "")}
                    {renderSlotCircle("peito", "Peito", "🛡️", "")}
                    {renderSlotCircle("cintura", "Cintura", "🥋", "")}
                  </div>

                  {renderSlotCircle("pernas", "Pernas", "🦵", "")}

                  <div className="w-full pt-3 border-t border-amber-900/40 space-y-2">
                    <span className="block text-center text-[9px] font-bold text-amber-300/80 uppercase">
                      ⚔️ Mãos & Armas
                    </span>
                    <div className="flex items-center justify-around gap-2">
                      {renderSlotCircle("maoEsquerda", "Mão Esq. (Leve)", "🛡️", "")}
                      {renderSlotCircle("duasMaos", "2 Mãos (Pesada)", "🪓", "scale-110")}
                      {renderSlotCircle("maoDireita", "Mão Dir. (Leve)", "🗡️", "")}
                    </div>
                  </div>
                </div>
              </div>

              {/* SELEÇÃO DE SLOT PARA ITEM EQUIPÁVEL */}
              {selectedItem && selectedItem.category === "equipavel" && (
                <div className="p-3 bg-amber-950/90 border border-amber-500 rounded-xl space-y-2 shadow-lg animate-pulse">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-300">
                      Onde deseja equipar &quot;{selectedItem.name}&quot;?
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="text-[10px] text-amber-400 font-bold underline"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(
                      [
                        { key: "cabeca", label: "🪖 Cabeça" },
                        { key: "peito", label: "🛡️ Peito" },
                        { key: "bracos", label: "🥊 Braços" },
                        { key: "cintura", label: "🥋 Cintura" },
                        { key: "pernas", label: "🦵 Pernas" },
                        { key: "maoDireita", label: "🗡️ Mão Direita" },
                        { key: "maoEsquerda", label: "🛡️ Mão Esquerda" },
                        { key: "duasMaos", label: "🪓 Duas Mãos" },
                      ] as const
                    ).map((slotBtn) => (
                      <button
                        key={slotBtn.key}
                        type="button"
                        onClick={() => handleEquipToSlot(slotBtn.key, selectedItem)}
                        className="px-2.5 py-1 bg-amber-700 hover:bg-amber-600 active:bg-amber-800 text-black font-black text-[10px] rounded-lg transition cursor-pointer"
                      >
                        {slotBtn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SEÇÃO DE MOCHILA / ITENS COMPRADOS NAS LOJAS */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                  📦 Bolsa de Itens Adquiridos ({inventory.length})
                </span>

                {inventory.length === 0 ? (
                  <div className="p-4 bg-[#0b0704] border border-dashed border-amber-900/40 rounded-xl text-center">
                    <p className="text-xs text-amber-200/50">
                      Sua mochila está vazia. Adquira armas, armaduras e poções na aba <strong>Loja</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inventory.map((item) => {
                      const isEquipable = item.category === "equipavel";

                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 bg-[#0b0704] border rounded-xl flex items-center justify-between gap-2 transition ${
                            selectedItem?.id === item.id
                              ? "border-amber-400 bg-amber-950/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              : "border-amber-900/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-9 h-9 object-cover rounded-lg border border-amber-700/50 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 bg-amber-950 border border-amber-800 rounded-lg flex items-center justify-center text-sm shrink-0">
                                {item.category === "cura" ? "🧪" : item.category === "suporte" ? "💣" : "⚔️"}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h5 className="font-extrabold text-amber-200 text-xs truncate">
                                {item.name}
                              </h5>
                              <p className="text-[9px] text-amber-200/60 truncate font-mono">
                                {item.category === "cura" && item.effect_value
                                  ? `Restaura +${item.effect_value} HP`
                                  : item.description || "Consumível"}
                              </p>
                            </div>
                          </div>

                          {isEquipable ? (
                            <button
                              type="button"
                              onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                              className={`px-3 py-1.5 font-bold text-[10px] rounded-lg transition shrink-0 cursor-pointer ${
                                selectedItem?.id === item.id
                                  ? "bg-amber-400 text-black"
                                  : "bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-700/60"
                              }`}
                            >
                              {selectedItem?.id === item.id ? "Selecionado" : "Equipar ➔"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUseConsumableItem(item)}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white font-extrabold text-[10px] rounded-lg shadow transition shrink-0 cursor-pointer"
                            >
                              {item.category === "cura" ? "Usar 🧪" : "Usar 💣"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}