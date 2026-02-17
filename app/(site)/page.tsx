import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Brickify AI</h1>
      <p className="max-w-2xl text-muted-foreground">
        Upload a photo and transform it into a LEGO-style 3D brick model.
      </p>
      <div className="flex gap-3">
        <Link
          href="/create"
          className="rounded-md bg-black px-5 py-3 text-sm font-medium text-white"
        >
          Start Creating
        </Link>
        <Link
          href="/checkout"
          className="rounded-md border border-black px-5 py-3 text-sm font-medium"
        >
          Checkout
        </Link>
      </div>
    </main>
  );
}
