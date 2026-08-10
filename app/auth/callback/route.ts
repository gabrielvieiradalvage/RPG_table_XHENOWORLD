import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  
  // URL blindada de produção
  const baseUrl = "https://rpg-table-xhenosworld.vercel.app";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Contexto de leitura apenas
            }
          },
        },
      }
    );

    // Troca o código OAuth por uma sessão de cookie
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redireciona diretamente para o Dashboard após validar a sessão
  return NextResponse.redirect(`${baseUrl}/dashboard`);
}