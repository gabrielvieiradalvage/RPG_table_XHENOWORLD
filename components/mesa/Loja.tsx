"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Shop {
  id: string;
  room_id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ShopItem {
  id: string;
  shop_id: string;
  room_id: string;
  name: string;
  price: number;
  category: "equipavel" | "cura" | "suporte";
  description: string;
  effect_value?: number;
  image_url?: string | null;
}

interface CharacterOption {
  id: string;
  name: string;
  user_id: string;
  is_npc: boolean;
  moedas?: number;
  inventory?: any[];
}

interface LojaProps {
  roomId: string;
  isMestre: boolean;
  currentUserId?: string;
  onSendMessage?: (text: string) => void;
}

export default function Loja({ roomId, isMestre, currentUserId, onSendMessage }: LojaProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de Categoria
  const [categoryFilter, setCategoryFilter] = useState<"todos" | "equipavel" | "cura" | "suporte">("todos");

  // Lista de Personagens e Personagem Selecionado para Compra
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>("");

  // Modais de Criação (Mestre)
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopDesc, setNewShopDesc] = useState("");
  const [newShopIcon, setNewShopIcon] = useState("🔨");

  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(10);
  const [newItemCategory, setNewItemCategory] = useState<"equipavel" | "cura" | "suporte">("equipavel");
  const [newItemEffectValue, setNewItemEffectValue] = useState<number>(10);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    fetchShops();
    fetchRoomCharacters();
  }, [roomId, currentUserId]);

  useEffect(() => {
    if (activeShop) {
      fetchShopItems(activeShop.id);
    }
  }, [activeShop]);

  const fetchShops = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("room_shops")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setShops(data as Shop[]);
    }
    setLoading(false);
  };

  const fetchShopItems = async (shopId: string) => {
    const { data, error } = await supabase
      .from("shop_items")
      .select("*")
      .eq("shop_id", shopId)
      .order("price", { ascending: true });

    if (!error && data) {
      setItems(data as ShopItem[]);
    }
  };

  const fetchRoomCharacters = async () => {
    const { data, error } = await supabase
      .from("characters")
      .select("id, name, user_id, is_npc, moedas, inventory")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const charList = data as CharacterOption[];
      setCharacters(charList);

      // Prioriza a ficha do usuário autenticado se houver
      const myChar = charList.find((c) => c.user_id === currentUserId && !c.is_npc);
      setSelectedCharId((prev) => {
        if (prev && charList.some((c) => c.id === prev)) return prev;
        return myChar ? myChar.id : charList[0].id;
      });
    } else {
      setCharacters([]);
      setSelectedCharId("");
    }
  };

  const activeCharacter = characters.find((c) => c.id === selectedCharId) || null;

  // UPLOAD DE IMAGEM DO ITEM
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isMestre) return;

    setIsUploadingImage(true);
    const fileName = `${roomId}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("itens").upload(fileName, file);

    if (error) {
      alert("Erro ao enviar imagem: " + error.message);
    } else {
      const { data: urlData } = supabase.storage.from("itens").getPublicUrl(fileName);
      setNewItemImageUrl(urlData.publicUrl);
    }
    setIsUploadingImage(false);
  };

  // CRIAR LOJA (MESTRE)
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim() || !isMestre) return;

    const newShop = {
      room_id: roomId,
      name: newShopName.trim(),
      description: newShopDesc.trim(),
      icon: newShopIcon || "🏪",
    };

    const { data, error } = await supabase
      .from("room_shops")
      .insert([newShop])
      .select()
      .single();

    if (error) {
      alert("Erro ao criar loja: " + error.message);
    } else if (data) {
      setShops((prev) => [...prev, data]);
      setNewShopName("");
      setNewShopDesc("");
      setIsCreatingShop(false);
    }
  };

  // EXCLUIR LOJA (MESTRE)
  const handleDeleteShop = async (shopId: string) => {
    if (!confirm("Deseja apagar esta loja e todos os seus produtos?")) return;

    const { error } = await supabase.from("room_shops").delete().eq("id", shopId);
    if (!error) {
      setShops((prev) => prev.filter((s) => s.id !== shopId));
      if (activeShop?.id === shopId) setActiveShop(null);
    }
  };

  // CRIAR PRODUTO (MESTRE)
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShop || !newItemName.trim() || !isMestre) return;

    const newItem = {
      shop_id: activeShop.id,
      room_id: roomId,
      name: newItemName.trim(),
      price: Number(newItemPrice),
      category: newItemCategory,
      description: newItemDesc.trim(),
      effect_value: Number(newItemEffectValue) || 0,
      image_url: newItemImageUrl.trim() || null,
    };

    const { data, error } = await supabase
      .from("shop_items")
      .insert([newItem])
      .select()
      .single();

    if (error) {
      alert("Erro ao criar produto: " + error.message);
    } else if (data) {
      setItems((prev) => [...prev, data]);
      setNewItemName("");
      setNewItemDesc("");
      setNewItemImageUrl("");
      setIsCreatingItem(false);
    }
  };

  // EXCLUIR PRODUTO (MESTRE)
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Deseja remover este produto do estoque?")) return;

    const { error } = await supabase.from("shop_items").delete().eq("id", itemId);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  // COMPRAR ITEM (JOGADOR OU MESTRE)
  const handleBuyItem = async (item: ShopItem) => {
    if (!activeCharacter) {
      alert("Selecione um personagem na barra superior para realizar a compra!");
      return;
    }

    const currentCoins = activeCharacter.moedas ?? 0;
    if (currentCoins < item.price) {
      alert(`Moedas insuficientes! ${activeCharacter.name} possui 🪙 ${currentCoins} e o item custa 🪙 ${item.price}.`);
      return;
    }

    const newCoins = currentCoins - item.price;
    const currentInventory = Array.isArray(activeCharacter.inventory) ? activeCharacter.inventory : [];
    const updatedInventory = [
      ...currentInventory,
      {
        id: Date.now().toString(),
        name: item.name,
        category: item.category,
        description: item.description,
        effect_value: item.effect_value || 0,
        image_url: item.image_url,
        bought_at: new Date().toISOString(),
      },
    ];

    const { error } = await supabase
      .from("characters")
      .update({
        moedas: newCoins,
        inventory: updatedInventory,
      })
      .eq("id", activeCharacter.id);

    if (error) {
      alert("Erro na transação: " + error.message);
    } else {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === activeCharacter.id
            ? { ...c, moedas: newCoins, inventory: updatedInventory }
            : c
        )
      );

      alert(`🛒 Compra realizada! "${item.name}" foi adicionado à mochila de ${activeCharacter.name}.`);

      if (onSendMessage) {
        onSendMessage(`🛒 ${activeCharacter.name} comprou "${item.name}" por 🪙 ${item.price} moedas na loja ${activeShop?.name || "Mercado"}.`);
      }
    }
  };

  const filteredItems = items.filter((item) => {
    if (categoryFilter === "todos") return true;
    return item.category === categoryFilter;
  });

  const getCategoryBadge = (category: ShopItem["category"]) => {
    switch (category) {
      case "equipavel":
        return <span className="bg-purple-950 text-purple-300 border border-purple-700/60 px-1.5 py-0.5 rounded text-[9px] font-bold">⚔️ Equipável</span>;
      case "cura":
        return <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.5 rounded text-[9px] font-bold">🧪 Cura</span>;
      case "suporte":
        return <span className="bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-1.5 py-0.5 rounded text-[9px] font-bold">💣 Suporte</span>;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-xs text-purple-300">Carregando Mercado...</div>;
  }

  return (
    <div className="space-y-3.5 text-xs text-white w-full max-w-full">
      {/* SELETOR E CARTEIRA DO PERSONAGEM ATIVO NA LOJA */}
      <div className="p-2.5 bg-[#0b0c16] border border-amber-500/40 rounded-xl space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base shrink-0">🎒</span>
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">
              Comprando com:
            </label>
          </div>
          {activeCharacter && (
            <span className="text-xs font-black text-amber-400 font-mono shrink-0">
              🪙 {activeCharacter.moedas ?? 0} Moedas
            </span>
          )}
        </div>

        {characters.length > 0 ? (
          <select
            value={selectedCharId}
            onChange={(e) => setSelectedCharId(e.target.value)}
            className="w-full bg-[#12131f] border border-amber-800/40 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-amber-400"
          >
            <optgroup label="🛡️ Personagens">
              {characters.filter((c) => !c.is_npc).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user_id === currentUserId ? "⭐ (Meu) " : "🛡️ "} {c.name} (🪙 {c.moedas ?? 0} Moedas)
                </option>
              ))}
            </optgroup>
            {characters.some((c) => c.is_npc) && (
              <optgroup label="👹 NPCs / Criaturas">
                {characters.filter((c) => c.is_npc).map((c) => (
                  <option key={c.id} value={c.id}>
                    👹 {c.name} (🪙 {c.moedas ?? 0} Moedas)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <p className="text-[10px] text-amber-300/80">
            Nenhum personagem encontrado nesta mesa. Crie uma ficha na aba <strong>Ficha</strong> para poder comprar.
          </p>
        )}
      </div>

      {/* VISÃO 1: LISTA DE LOJAS DA SALA */}
      {!activeShop ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-1 border-b border-purple-900/40">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
              🏪 Mercado & Lojas ({shops.length})
            </span>
            {isMestre && (
              <button
                type="button"
                onClick={() => setIsCreatingShop(!isCreatingShop)}
                className="px-2.5 py-1 bg-purple-900/50 active:bg-purple-800 border border-purple-700/60 text-purple-200 text-[10px] font-bold rounded-lg transition cursor-pointer"
              >
                {isCreatingShop ? "✕ Cancelar" : "➕ Criar Loja"}
              </button>
            )}
          </div>

          {/* FORMULÁRIO DE CRIAR LOJA */}
          {isCreatingShop && isMestre && (
            <form onSubmit={handleCreateShop} className="p-3 bg-[#0b0c16] border border-purple-800/50 rounded-xl space-y-2.5">
              <span className="block text-[10px] font-bold text-cyan-400 uppercase">Novo Estabelecimento</span>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Ícone (Ex: ⚔️, 🧪)"
                  value={newShopIcon}
                  onChange={(e) => setNewShopIcon(e.target.value)}
                  className="col-span-1 bg-[#12131f] border border-purple-900/50 rounded-lg px-2 py-1.5 text-center text-xs text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Nome da Loja (Ex: Ferraria)"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="col-span-3 bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <input
                type="text"
                placeholder="Descrição (Ex: Armas e Armaduras)"
                value={newShopDesc}
                onChange={(e) => setNewShopDesc(e.target.value)}
                className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 active:from-purple-500 font-bold text-white text-xs rounded-lg cursor-pointer"
              >
                Confirmar Criação
              </button>
            </form>
          )}

          {shops.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8 bg-[#0b0c16] rounded-xl border border-dashed border-purple-900/40">
              Nenhuma loja aberta na mesa.{isMestre ? " Clique em '+ Criar Loja'." : " Aguarde o Mestre abrir uma loja."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {shops.map((shop) => (
                <div
                  key={shop.id}
                  onClick={() => setActiveShop(shop)}
                  className="p-3 bg-[#0b0c16] border border-purple-900/40 hover:border-cyan-400 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl p-2 bg-[#12131f] border border-purple-800/40 rounded-xl shrink-0">
                      {shop.icon || "🏪"}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-white text-xs truncate">{shop.name}</h4>
                      <p className="text-[10px] text-gray-400 truncate">{shop.description || "Produtos variados"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800/50 text-[10px] font-bold rounded-lg">
                      Entrar ➔
                    </span>
                    {isMestre && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShop(shop.id);
                        }}
                        className="p-1.5 bg-red-950/80 active:bg-red-800 text-red-300 rounded-lg text-xs cursor-pointer"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VISÃO 2: PRODUTOS DENTRO DA LOJA SELECIONADA */
        <div className="space-y-3">
          {/* HEADER DA LOJA ATIVA */}
          <div className="p-3 bg-[#0b0c16] border border-cyan-800/50 rounded-xl flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setActiveShop(null)}
                className="px-2 py-1 bg-[#12131f] border border-purple-800/40 hover:bg-purple-900/40 text-purple-300 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
              >
                ← Voltar
              </button>
              <div className="min-w-0">
                <h3 className="font-extrabold text-cyan-300 text-xs truncate flex items-center gap-1.5">
                  <span>{activeShop.icon}</span> {activeShop.name}
                </h3>
                <p className="text-[9px] text-gray-400 truncate">{activeShop.description}</p>
              </div>
            </div>

            {isMestre && (
              <button
                type="button"
                onClick={() => setIsCreatingItem(!isCreatingItem)}
                className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-cyan-600 active:opacity-80 text-white text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
              >
                {isCreatingItem ? "✕ Fechar" : "➕ Criar Produto"}
              </button>
            )}
          </div>

          {/* FORMULÁRIO DE CRIAR PRODUTO */}
          {isCreatingItem && isMestre && (
            <form onSubmit={handleCreateItem} className="p-3 bg-[#0b0c16] border border-purple-800/50 rounded-xl space-y-2.5">
              <span className="block text-[10px] font-bold text-cyan-400 uppercase">Novo Produto no Estoque</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-400 block mb-0.5">Nome do Item</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Poção de HP / Bomba de Fumaça"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-400 block mb-0.5">Preço (Moedas 🪙)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-400 block mb-0.5">Classificação Tática</label>
                  <select
                    value={newItemCategory}
                    onChange={(e: any) => setNewItemCategory(e.target.value)}
                    className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg p-1.5 text-xs text-white"
                  >
                    <option value="equipavel">⚔️ Equipável (Arma/Armadura)</option>
                    <option value="cura">🧪 Cura (Restaura HP Instantâneo)</option>
                    <option value="suporte">💣 Suporte (Consumível/Efeito Tático)</option>
                  </select>
                </div>

                {newItemCategory !== "equipavel" ? (
                  <div>
                    <label className="text-[9px] text-amber-400 font-bold block mb-0.5">
                      {newItemCategory === "cura" ? "Cura de HP (Valor)" : "Intensidade do Efeito"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newItemEffectValue}
                      onChange={(e) => setNewItemEffectValue(Number(e.target.value))}
                      placeholder="Ex: 15 para +15 HP"
                      className="w-full bg-[#12131f] border border-amber-800/60 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">Imagem do Produto</label>
                    <label className="flex items-center justify-center gap-1.5 bg-[#12131f] border border-purple-900/50 hover:border-cyan-400 rounded-lg px-2 py-1.5 text-xs text-gray-300 cursor-pointer transition truncate">
                      <span>🖼️</span>
                      <span className="truncate">
                        {isUploadingImage ? "Enviando..." : newItemImageUrl ? "Imagem OK ✓" : "Upload Imagem"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleItemImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {newItemCategory !== "equipavel" && (
                <div>
                  <label className="text-[9px] text-gray-400 block mb-0.5">Imagem do Produto</label>
                  <label className="flex items-center justify-center gap-1.5 bg-[#12131f] border border-purple-900/50 hover:border-cyan-400 rounded-lg px-2 py-1.5 text-xs text-gray-300 cursor-pointer transition truncate">
                    <span>🖼️</span>
                    <span className="truncate">
                      {isUploadingImage ? "Enviando..." : newItemImageUrl ? "Imagem Carregada ✓" : "Upload Imagem"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleItemImageUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {newItemImageUrl && (
                <div className="flex items-center gap-2 p-1.5 bg-[#12131f] border border-purple-900/40 rounded-lg">
                  <img src={newItemImageUrl} alt="Prévia" className="w-8 h-8 object-cover rounded border border-purple-500/50 shrink-0" />
                  <span className="text-[9px] text-emerald-400 truncate flex-1 font-mono">Imagem anexada!</span>
                  <button
                    type="button"
                    onClick={() => setNewItemImageUrl("")}
                    className="text-[10px] text-red-400 hover:text-red-300 px-1 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div>
                <label className="text-[9px] text-gray-400 block mb-0.5">Descrição do Item / Efeitos Táticos</label>
                <input
                  type="text"
                  placeholder="Ex: Restaura 15 HP ou Causa cegueira por 1 turno"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isUploadingImage}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-cyan-600 font-bold text-white text-xs rounded-lg cursor-pointer disabled:opacity-50"
              >
                Cadastrar Produto no Estoque
              </button>
            </form>
          )}

          {/* BARRA DE FILTROS DE CATEGORIA */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {(["todos", "equipavel", "cura", "suporte"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-[10px] font-bold capitalize rounded-lg border whitespace-nowrap transition cursor-pointer shrink-0 ${
                  categoryFilter === cat
                    ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                    : "bg-[#0b0c16] border-purple-900/40 text-gray-400 hover:text-white"
                }`}
              >
                {cat === "todos" ? "🌐 Todos" : cat === "equipavel" ? "⚔️ Equipáveis" : cat === "cura" ? "🧪 Cura" : "💣 Suporte"}
              </button>
            ))}
          </div>

          {/* GRID DE PRODUTOS */}
          {filteredItems.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8 bg-[#0b0c16] rounded-xl border border-dashed border-purple-900/40">
              Nenhum produto nesta categoria.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#0b0c16] border border-purple-900/40 rounded-xl flex flex-col justify-between gap-2.5 min-w-0"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-9 h-9 object-cover rounded-lg border border-purple-800/40 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 bg-[#12131f] border border-purple-800/40 rounded-lg flex items-center justify-center text-sm shrink-0">
                            {item.category === "equipavel" ? "⚔️" : item.category === "cura" ? "🧪" : "💣"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h5 className="font-extrabold text-white text-xs truncate">{item.name}</h5>
                          <div className="flex items-center gap-1 flex-wrap">
                            {getCategoryBadge(item.category)}
                            {item.category === "cura" && item.effect_value && (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 font-mono">
                                +{item.effect_value} HP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-black text-amber-400 font-mono shrink-0">
                        🪙 {item.price}
                      </span>
                    </div>

                    <p className="text-[10px] text-gray-300 leading-relaxed font-mono line-clamp-2">
                      {item.description || "Sem descrição."}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-purple-900/30">
                    <button
                      type="button"
                      onClick={() => handleBuyItem(item)}
                      className="flex-1 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-500 active:scale-95 text-black font-extrabold text-[11px] rounded-lg shadow transition cursor-pointer"
                    >
                      Comprar (🪙 {item.price})
                    </button>

                    {isMestre && (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 bg-red-950/80 active:bg-red-800 text-red-300 rounded-lg text-xs cursor-pointer shrink-0"
                        title="Remover produto do estoque"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
