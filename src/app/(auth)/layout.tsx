export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <p className="mb-8 text-center font-condensed text-4xl font-bold tracking-wide">
        ALM<span className="text-brand">O</span>RE
      </p>
      {children}
    </main>
  );
}
