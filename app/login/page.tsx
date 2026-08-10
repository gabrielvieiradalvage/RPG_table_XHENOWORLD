"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "register" | "recovery";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Listener para capturar o login do Google instantaneamente no client
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/dashboard");
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://rpg-table-xhenoworld.vercel.app/auth/callback",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao conectar com o Google.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `https://rpg-table-xhenoworld.vercel.app/login`,
        });

        if (error) throw error;

        setSuccessMsg("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      } else if (mode === "register") {
        const formattedUsername = username.trim().toLowerCase();

        if (formattedUsername.length < 3) {
          throw new Error("O nome de usuário deve ter pelo menos 3 caracteres.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: formattedUsername,
            },
          },
        });

        if (error) {
          if (error.message.includes("unique") || error.message.includes("profiles_username_key")) {
            throw new Error("Este Nome de Usuário já está em uso por outro aventureiro.");
          }
          throw error;
        }

        if (data?.user && data?.session === null) {
          setSuccessMsg("Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.");
        } else {
          setSuccessMsg("Conta criada com sucesso! Redirecionando...");
          setTimeout(() => router.push("/dashboard"), 1500);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("E-mail ou senha incorretos.");
          }
          throw error;
        }

        router.push("/dashboard");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro ao processar a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "register";

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080811] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))] p-4 sm:p-6 lg:p-8">
      <div
        className={`w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-[#12131f]/80 backdrop-blur-md border rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 min-h-[580px] ${
          isRegister ? "border-orange-500/40 shadow-orange-950/30" : "border-purple-900/40 glow-purple"
        }`}
      >
        <div className="relative hidden md:flex flex-col justify-end p-8 bg-purple-950/20 overflow-hidden border-r border-purple-900/30 group">
          <img
            src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop"
            alt="Xhenosworld Banner"
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080811] via-[#080811]/40 to-transparent" />

          <div className="relative z-10 space-y-2">
            <span
              className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit inline-block backdrop-blur-sm border transition-colors duration-300 ${
                isRegister
                  ? "text-orange-400 bg-orange-950/80 border-orange-800/80"
                  : "text-cyan-400 bg-cyan-950/70 border-cyan-800/60"
              }`}
            >
              {isRegister ? "Novo Jogador" : "Mesa Virtual & IA"}
            </span>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              {mode === "register"
                ? "Inicie sua jornada cósmica."
                : mode === "recovery"
                ? "Recupere o acesso à mesa."
                : "Forje o seu próprio destino."}
            </h2>
            <p className="text-gray-300 text-xs leading-relaxed max-w-sm">
              Conecte-se com seu grupo, navegue por mapas táticos e use o poder do cosmos para guiar sua jornada.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-12 bg-[#12131f]/90">
          <div className="text-left mb-6">
            <h1
              className={`text-3xl font-extrabold tracking-wider text-transparent bg-clip-text transition-all duration-300 ${
                isRegister
                  ? "bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400"
                  : "bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400"
              }`}
            >
              XHENOSWORLD
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {mode === "login" && "Entre com suas credenciais para retornar."}
              {mode === "register" && "Crie sua conta de jogador para iniciar."}
              {mode === "recovery" && "Digite seu e-mail para redefinir a senha."}
            </p>
          </div>

          {mode !== "recovery" && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0b0c16] hover:bg-[#181a2e] border border-purple-800/50 hover:border-cyan-400 rounded-xl text-white text-xs font-bold transition flex items-center justify-center gap-3 cursor-pointer shadow-md disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.2 0 11.5 0 14s.7 4.8 1.9 6.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                  />
                </svg>
                <span>Continuar com o Google</span>
              </button>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-900/40" />
                </div>
                <span className="relative px-3 bg-[#12131f] text-[10px] text-gray-500 uppercase tracking-widest">
                  OU
                </span>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              className={`mb-4 p-3 rounded-xl border text-xs ${
                isRegister
                  ? "bg-orange-950/60 border-orange-800/80 text-orange-300"
                  : "bg-cyan-950/60 border-cyan-800/80 text-cyan-300"
              }`}
            >
              ✨ {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-orange-400 mb-1.5">
                  Nome de Usuário (Nick)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: MestreDosMundos"
                  className="w-full px-4 py-3 bg-[#0b0c16] border border-orange-800/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition text-sm"
                />
              </div>
            )}

            <div>
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isRegister ? "text-orange-400" : "text-purple-300"
                }`}
              >
                E-mail do Jogador
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={`w-full px-4 py-3 bg-[#0b0c16] border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition text-sm ${
                  isRegister
                    ? "border-orange-800/50 focus:border-orange-400 focus:ring-orange-400"
                    : "border-purple-800/50 focus:border-cyan-400 focus:ring-cyan-400"
                }`}
              />
            </div>

            {mode !== "recovery" && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    className={`block text-xs font-semibold uppercase tracking-wider ${
                      isRegister ? "text-orange-400" : "text-purple-300"
                    }`}
                  >
                    Senha
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("recovery")}
                      className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 bg-[#0b0c16] border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition text-sm ${
                    isRegister
                      ? "border-orange-800/50 focus:border-orange-400 focus:ring-orange-400"
                      : "border-purple-800/50 focus:border-cyan-400 focus:ring-cyan-400"
                  }`}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 text-white font-bold rounded-xl transition duration-300 shadow-lg hover:scale-[1.01] active:scale-95 cursor-pointer mt-2 disabled:opacity-50 text-sm flex items-center justify-center gap-2 ${
                isRegister
                  ? "bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 shadow-orange-950/50"
                  : "bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 glow-blue"
              }`}
            >
              {loading ? (
                <span>Carregando...</span>
              ) : mode === "login" ? (
                "Entrar na Mesa"
              ) : mode === "register" ? (
                "Criar Personagem"
              ) : (
                "Enviar E-mail de Recuperação"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500 border-t border-purple-900/30 pt-4">
            {mode === "login" && (
              <>
                Ainda não tem conta?{" "}
                <button
                  onClick={() => switchMode("register")}
                  className="text-orange-400 font-semibold hover:underline ml-1 cursor-pointer"
                >
                  Criar Conta
                </button>
              </>
            )}

            {mode === "register" && (
              <>
                Já possui uma conta?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="text-cyan-400 font-semibold hover:underline ml-1 cursor-pointer"
                >
                  Fazer Login
                </button>
              </>
            )}

            {mode === "recovery" && (
              <button
                onClick={() => switchMode("login")}
                className="text-cyan-400 font-semibold hover:underline cursor-pointer"
              >
                ← Voltar para o Login
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}