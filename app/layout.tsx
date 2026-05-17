import type { Metadata, Viewport } from 'next';
import './styles/theme.css';
import './globals.css';
import './styles/shell.css';
import './styles/library.css';
import './styles/sidebar.css';
import './styles/player.css';
import './styles/account.css';
import './styles/model.css';
import './styles/feedback.css';
import './styles/ui.css';
import './styles/stats.css';
import './styles/mobile.css';

export const metadata: Metadata = {
  title: 'instr.io',
  description: 'Frontend for importing, converting, and streaming instrumental versions of songs.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
