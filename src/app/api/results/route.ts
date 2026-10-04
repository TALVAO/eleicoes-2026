import { readView } from '@/server/read-model';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const view = await readView(new URL(request.url).searchParams);
    if (!view)
      return Response.json(
        { message: 'Abrangência indisponível na configuração oficial.' },
        { status: 400 },
      );
    return Response.json(view, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { message: 'Não foi possível consultar os dados oficiais agora.' },
      { status: 503 },
    );
  }
}
