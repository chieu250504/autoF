export const metadata = {
  title: 'FB Radar Backend API',
  description: 'Backend API Service for FB Group Keyword Radar',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#0f172a', color: '#f8fafc' }}>
        {children}
      </body>
    </html>
  );
}

