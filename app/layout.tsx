import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '월루로직',
  description: '기록하고 공유하는 네모로직 웹앱'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
