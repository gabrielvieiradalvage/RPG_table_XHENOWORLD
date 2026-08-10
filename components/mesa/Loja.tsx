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
  image_url?: string | null;
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

  // Dados do Personagem do Jogador Atual
  const [myCharacter, setMyCharacter] = useState<any>(null);

  // Modais de Criação
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopDesc, setNewShopDesc] = useState("");
  const [newShopIcon, setNewShopIcon] = useState("🔨");

  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(10);
  const [newItemCategory, setNewItemCategory] = useState<"equipavel" | "cura" | "suporte">("equipavel");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");

  useEffect(() => {
    fetchShops();
    fetchMyCharacter();
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

  const fetchMyCharacter = async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("characters")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", currentUserId)
      .eq("is_npc", false)
      .maybeSingle();

    if (data) {
      setMyCharacter(data);
    }
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

  // COMPRAR ITEM (JOGADOR)
  const handleBuyItem = async (item: ShopItem) => {
    if (!myCharacter) {
      alert("Você precisa ter um personagem nesta mesa para comprar itens!");
      return;
    }

    const currentCoins = myCharacter.moedas ?? 0;
    if (currentCoins < item.price) {
      alert(`Moedas insuficientes! Você tem 🪙 ${currentCoins} e o item custa 🪙 ${item.price}.`);
      return;
    }

    const newCoins = currentCoins - item.price;
    const currentInventory = Array.isArray(myCharacter.inventory) ? myCharacter.inventory : [];
    const updatedInventory = [
      ...currentInventory,
      {
        id: Date.now().toString(),
        name: item.name,
        category: item.category,
        description: item.description,
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
      .eq("id", myCharacter.id);

    if (error) {
      alert("Erro na transação: " + error.message);
    } else {
      setMyCharacter((prev: any) => ({ ...prev, moedas: newCoins, inventory: updatedInventory }));
      alert(`🛒 Compra realizada! "${item.name}" foi adicionado ao inventário de ${myCharacter.name}.`);

      if (onSendMessage) {
        onSendMessage(`🛒 ${myCharacter.name} comprou "${item.name}" por 🪙 ${item.price} moedas na loja ${activeShop?.name}.`);
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
      {/* BARRA DE MOEDAS DO JOGADOR */}
      {myCharacter && (
        <div className="p-2.5 bg-[#0b0c16] border border-amber-500/40 rounded-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🎒</span>
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase">{myCharacter.name}</span>
              <span className="text-xs font-black text-amber-400 font-mono">🪙 {myCharacter.moedas ?? 0} Moedas</span>
            </div>
          </div>
          <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-full font-bold">
            {myCharacter.inventory?.length || 0} itens na bolsa
          </span>
        </div>
      )}

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
              <span className="block text-[10px] font-bold text-cyan-400 uppercase">Nova Estabelecimento</span>
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
                className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 active:from-purple-500 font-bold text-white text-xs rounded-lg"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShop(shop.id);
                        }}
                        className="p-1.5 bg-red-950/80 active:bg-red-800 text-red-300 rounded-lg text-xs"
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
                onClick={() => setActiveShop(null)}
                className="px-2 py-1 bg-[#12131f] border border-purple-800/40 hover:bg-purple-900/40 text-purple-300 rounded-lg text-xs font-bold shrink-0"
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
                    placeholder="Ex: Espada Longa"
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
                  <label className="text-[9px] text-gray-400 block mb-0.5">Classificação</label>
                  <select
                    value={newItemCategory}
                    onChange={(e: any) => setNewItemCategory(e.target.value)}
                    className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg p-1.5 text-xs text-white"
                  >
                    <option value="equipavel">⚔️ Equipável (Arma/Armadura)</option>
                    <option value="cura">🧪 Cura (Poções/Maçãs)</option>
                    <option value="suporte">💣 Suporte (Bombas/Pergaminhos)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-gray-400 block mb-0.5">URL Imagem (Opcional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newItemImageUrl}
                    onChange={(e) => setNewItemImageUrl(e.target.value)}
                    className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-gray-400 block mb-0.5">Descrição do Item / Efeitos</label>
                <input
                  type="text"
                  placeholder="Ex: Restaura 15 HP ou +2 de Dano Físico"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-cyan-600 font-bold text-white text-xs rounded-lg cursor-pointer"
              >
                Cadastrar Produto
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
                          {getCategoryBadge(item.category)}
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
                    {!isMestre && (
                      <button
                        onClick={() => handleBuyItem(item)}
                        className="flex-1 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-500 active:scale-95 text-black font-extrabold text-[11px] rounded-lg shadow transition cursor-pointer"
                      >
                        Comprar (🪙 {item.price})
                      </button>
                    )}

                    {isMestre && (
                      <>
                        <button
                          onClick={() => handleBuyItem(item)}
                          className="flex-1 py-1.5 bg-amber-950 hover:bg-amber-800 text-amber-300 border border-amber-800/50 font-bold text-[10px] rounded-lg cursor-pointer"
                        >
                          Testar Compra
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 bg-red-950/80 active:bg-red-800 text-red-300 rounded-lg text-xs"
                        >
                          🗑️
                        </button>
                      </>
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