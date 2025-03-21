import "../polyfills";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center p-24 ${inter.className}`}
    >
        <img src="/ossotna-FC-logo.svg" alt="Ossotna Logo" className="h-10 mr-2" />
    </main>
  );
}
