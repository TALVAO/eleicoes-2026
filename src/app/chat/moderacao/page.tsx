import { ChatModeration } from '@/components/chat-moderation';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Moderação — Eleições 2026',
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main id="main" className="container">
      <ChatModeration />
    </main>
  );
}
