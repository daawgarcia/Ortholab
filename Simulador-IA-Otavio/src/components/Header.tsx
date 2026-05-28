import Image from "next/image";

export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Image
          src="/logo-ea.webp"
          alt="Esthetic Aligner - Powered by AI"
          width={280}
          height={62}
          className="h-10 w-auto object-contain"
          priority
        />

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          IA Online
        </div>
      </div>
    </header>
  );
}
