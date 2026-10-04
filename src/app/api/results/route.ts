import { readView } from '@/server/read-model';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type CachedView = { expires: number; view: Awaited<ReturnType<typeof readView>> };
const cached = new Map<string, CachedView>();
const pending = new Map<string, Promise<CachedView>>();
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const key = new URLSearchParams({
      scope: params.get('scope') ?? 'br',
      office: params.get('office') ?? '1',
      ...(params.get('municipality') ? { municipality: params.get('municipality')! } : {}),
    }).toString();
    let entry = cached.get(key);
    if (!entry || entry.expires <= Date.now()) {
      let loading = pending.get(key);
      if (!loading) {
        loading = readView(new URLSearchParams(key))
          .then((view) => {
            const value = { expires: Date.now() + 2000, view };
            if (view) {
              if (cached.size >= 100) cached.delete(cached.keys().next().value!);
              cached.set(key, value);
            }
            return value;
          })
          .finally(() => pending.delete(key));
        pending.set(key, loading);
      }
      entry = await loading;
    }
    const view = entry.view;
    if (!view)
      return Response.json(
        { message: 'Abrangência indisponível na configuração oficial.' },
        { status: 400 },
      );
    return Response.json(view, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=2, must-revalidate' },
    });
  } catch {
    return Response.json(
      { message: 'Não foi possível consultar os dados oficiais agora.' },
      { status: 503 },
    );
  }
}
