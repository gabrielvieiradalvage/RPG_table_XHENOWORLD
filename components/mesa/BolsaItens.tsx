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
}

export default function BolsaItens({ roomId, currentUserId }: BolsaItensProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [character, setCharacter] = useState<any>(null);
  const [equipment, setEquipment] = useState<EquipmentSlots>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Estados de Movimentação Touch / Mouse do Ícone Flutuante
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
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

  // Sincronizar Equipamento no Supabase
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

  // --- LÓGICA DE ARRASTAR BOTÃO FLUTUANTE (MOUSE + TOUCH) ---
  const handleStartDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: clientX, y: clientY };
    initialPosRef.current = { ...position };
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasDraggedRef.current = true;
    }

    const newX = Math.max(10, Math.min(window.innerWidth - 60, initialPosRef.current.x + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 60, initialPosRef.current.y + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handleEndDrag = () => {
    setIsDragging(false);
  };

  // MOUSE EVENTS
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStartDrag(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMoveDrag(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleEndDrag();
  };

  // TOUCH EVENTS
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStartDrag(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMoveDrag(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEndDrag();
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleIconClick = () => {
    if (!hasDraggedRef.current) {
      setIsOpen(!isOpen);
    }
  };

  // --- LÓGICA DE EQUIPAR / DESEQUIPAR ---
  const handleEquipToSlot = async (slot: EquipSlotKey, itemToEquip: InventoryItem) => {
    let newEquip = { ...equipment };
    let newInv = inventory.filter((i) => i.id !== itemToEquip.id);

    // Se já houver algo no slot, devolve para o inventário
    if (newEquip[slot]) {
      newInv.push(newEquip[slot]!);
    }

    // Regra Tática para Arma de Duas Mãos vs Mão Direita / Esquerda
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
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleIconClick}
        className="fixed z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 border-2 border-amber-500 rounded-full shadow-[0_0_20px_rgba(180,83,9,0.5)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none hover:scale-105 transition-transform"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
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
                    Toque nos slots circulares para gerenciar sua armadura e armas.
                  </p>
                </div>
              </div>
              <button
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

                {/* LAYOUT CIRCULAR TÁTICO */}
                <div className="flex flex-col items-center gap-3 pt-2">
                  
                  {/* CAPEÇA */}
                  {renderSlotCircle("cabeca", "Cabeça", "🪖", "")}

                  {/* PEITO E BRAÇOS */}
                  <div className="flex items-center justify-center gap-4 sm:gap-8">
                    {renderSlotCircle("bracos", "Braços", "🥊", "")}
                    {renderSlotCircle("peito", "Peito", "🛡️", "")}
                    {renderSlotCircle("cintura", "Cintura", "🥋", "")}
                  </div>

                  {/* PERNAS */}
                  {renderSlotCircle("pernas", "Pernas", "🦵", "")}

                  {/* MÃOS E ARMA DE 2 MÃOS */}
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

              {/* MENSAGEM SE UM ITEM DO INVENTÁRIO FOR SELECIONADO PARA EQUIPAR */}
              {selectedItem && (
                <div className="p-3 bg-amber-950/90 border border-amber-500 rounded-xl space-y-2 shadow-lg animate-pulse">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-300">
                      Onde deseja equipar &quot;{selectedItem.name}&quot;?
                    </span>
                    <button
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
                      Sua mochila está vazia. Adquira armas e armaduras na aba <strong>Loja</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inventory.map((item) => (
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
                              🎒
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="font-extrabold text-amber-200 text-xs truncate">
                              {item.name}
                            </h5>
                            <p className="text-[9px] text-amber-200/60 truncate font-mono">
                              {item.description || "Item do inventário"}
                            </p>
                          </div>
                        </div>

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
                      </div>
                    ))}
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