import Image from "next/image";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <Image src="/mark.svg" alt="asocial" width={40} height={40} />
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
