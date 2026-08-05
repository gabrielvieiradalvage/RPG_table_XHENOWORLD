"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Campos do Perfil
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sub-painel de Enquadramento da Foto
  const [avatarZoom, setAvatarZoom] = useState<number>(100);
  const [avatarX, setAvatarX] = useState<number>(0);
  const [avatarY, setAvatarY] = useState<number>(0);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUser(user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      if (profile.username) setUsername(profile.username);
      if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      if (profile.avatar_zoom) setAvatarZoom(profile.avatar_zoom);
      if (profile.avatar_x) setAvatarX(profile.avatar_x);
      if (profile.avatar_y) setAvatarY(profile.avatar_y);
      if (profile.age) setAge(profile.age);
      if (profile.description) setDescription(profile.description);
    }

    setLoading(false);
  };

  // Upload direto de arquivo do computador para o Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingImg(true);
    const fileName = `${user.id}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage.from("avatars").upload(fileName, file);

    if (error) {
      alert("Erro ao fazer upload da foto: " + error.message);
      setUploadingImg(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
    setAvatarUrl(urlData.publicUrl);
    setUploadingImg(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSuccessMsg("");

    const updates = {
      id: user.id,
      username: username.trim(),
      avatar_url: avatarUrl.trim(),
      avatar_zoom: avatarZoom,
      avatar_x: avatarX,
      avatar_y: avatarY,
      age: age === "" ? null : Number(age),
      description: description.trim(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(updates);

    setSaving(false);

    if (error) {
      alert("Erro ao salvar perfil: " + error.message);
    } else {
      setSuccessMsg("🔥 Perfil forjado e salvo com sucesso!");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0507] text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0507] text-white p-4 sm:p-6 md:p-12 selection:bg-red-600 selection:text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header da Página com Tema Vermelho */}
        <div className="flex items-center justify-between border-b border-red-900/50 pb-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-3.5 py-2 bg-[#170a0e] hover:bg-red-950/60 border border-red-800/50 hover:border-red-500 rounded-xl text-xs font-semibold text-red-300 transition cursor-pointer flex items-center gap-1.5"
          >
            ← Voltar ao Painel
          </button>
          <h1 className="text-xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-500">
            PERFIL DO JOGADOR
          </h1>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className="bg-[#14080c] border border-red-900/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_30px_rgba(153,27,27,0.15)]"
        >
          {/* SEÇÃO DA FOTO E EDITOR DE ENQUADRAMENTO */}
          <div className="bg-[#1d0b11] border border-red-900/50 rounded-2xl p-5 space-y-4">
            <span className="block text-xs font-bold text-red-400 uppercase tracking-widest text-center">
              📸 Foto de Perfil & Enquadramento
            </span>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              
              {/* Preview Circular da Foto com Zoom e Posição */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-red-600 shadow-[0_0_20px_rgba(225,29,72,0.4)] relative bg-[#0a0507] flex items-center justify-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      draggable={false}
                      style={{
                        transform: `scale(${avatarZoom / 100}) translate(${avatarX}px, ${avatarY}px)`,
                        transformOrigin: "center center",
                      }}
                      className="w-full h-full object-cover transition-transform duration-75 select-none pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-red-900 to-rose-700 flex items-center justify-center text-4xl font-extrabold text-white">
                      {username ? username.charAt(0).toUpperCase() : "X"}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                  Visualização no Chat
                </span>
              </div>

              {/* Controles de Upload e Enquadramento (Sub-painel) */}
              <div className="flex-1 w-full space-y-3 bg-[#110609] p-4 rounded-xl border border-red-950">
                
                {/* Upload por Arquivo ou URL */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-300 uppercase">
                    Carregar Nova Imagem
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1 px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold rounded-xl text-center transition cursor-pointer">
                      {uploadingImg ? "Carregando..." : "📁 Escolher do PC"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingImg}
                      />
                    </label>
                  </div>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Ou cole a URL da imagem aqui..."
                    className="w-full px-3 py-1.5 bg-[#170a0e] border border-red-900/40 rounded-xl text-white text-xs placeholder-gray-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>

                {/* Sliders de Ajuste Fino de Posição */}
                {avatarUrl && (
                  <div className="space-y-2 pt-2 border-t border-red-900/30 text-[10px]">
                    <span className="block font-bold text-rose-400 uppercase">
                      ⚙️ Enquadrar Imagem (Zoom & Posição)
                    </span>

                    {/* Slider Zoom */}
                    <div>
                      <div className="flex justify-between text-gray-400 mb-0.5">
                        <span>🔍 Zoom / Escala</span>
                        <span className="font-mono text-red-400">{avatarZoom}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="300"
                        step="5"
                        value={avatarZoom}
                        onChange={(e) => setAvatarZoom(Number(e.target.value))}
                        className="w-full accent-red-600 cursor-pointer"
                      />
                    </div>

                    {/* Slider Posição Horizontal (X) */}
                    <div>
                      <div className="flex justify-between text-gray-400 mb-0.5">
                        <span>↔️ Mover Horizontal (Esq / Dir)</span>
                        <span className="font-mono text-red-400">{avatarX}px</span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={avatarX}
                        onChange={(e) => setAvatarX(Number(e.target.value))}
                        className="w-full accent-red-600 cursor-pointer"
                      />
                    </div>

                    {/* Slider Posição Vertical (Y) */}
                    <div>
                      <div className="flex justify-between text-gray-400 mb-0.5">
                        <span>↕️ Mover Vertical (Cima / Baixo)</span>
                        <span className="font-mono text-red-400">{avatarY}px</span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={avatarY}
                        onChange={(e) => setAvatarY(Number(e.target.value))}
                        className="w-full accent-red-600 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => { setAvatarZoom(100); setAvatarX(0); setAvatarY(0); }}
                      className="text-[9px] text-gray-500 hover:text-red-400 underline cursor-pointer pt-1"
                    >
                      Resetar Enquadramento
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DADOS DO PERFIL */}
          <div className="space-y-4">
            {/* Campo Nick */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-red-300 mb-1">
                Apelido / Nick de Jogador
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: MestreDosMagoz"
                className="w-full px-4 py-2.5 bg-[#170a0e] border border-red-800/40 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-red-500 text-sm font-semibold"
              />
            </div>

            {/* Campo Idade */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-red-300 mb-1">
                Idade
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                placeholder="Ex: 24"
                className="w-full px-4 py-2.5 bg-[#170a0e] border border-red-800/40 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-red-500 text-sm font-mono"
              />
            </div>

            {/* Campo Descrição/Biografia */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-red-300 mb-1">
                Biografia do Aventureiro
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva suas preferências de RPG, histórico como Mestre/Jogador ou estilo de jogo..."
                className="w-full px-4 py-2.5 bg-[#170a0e] border border-red-800/40 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-red-500 text-sm leading-relaxed resize-none font-sans"
              />
            </div>
          </div>

          {/* Botão Salvar com Efeito Rubro */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-red-700 via-rose-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.4)] transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Forjando Perfil..." : "💾 Salvar Perfil de Aventureiro"}
          </button>

          {successMsg && (
            <p className="text-center text-rose-400 font-bold text-xs animate-pulse">
              {successMsg}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}