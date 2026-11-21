import type { ReactNode } from 'react';

export default function AdminAuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[440px]">{children}</div>
    </main>
  );
}
