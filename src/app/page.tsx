import { ElectionPage, type SearchParams } from '@/components/election-page';
export const dynamic = 'force-dynamic';
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <ElectionPage tab="brasil" searchParams={searchParams} />;
}
