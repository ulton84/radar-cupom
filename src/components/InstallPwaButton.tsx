"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Verifica se já está em modo PWA standalone
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 hover:border-emerald-400 transition-all cursor-pointer"
        title="Instalar aplicativo Radar Cupom"
      >
        <Download className="h-3.5 w-3.5 text-emerald-600" />
        <span>Instalar App</span>
      </button>

      {/* Modal explicativo caso o navegador não suporte prompt automático (ex: Safari iOS) */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Instalar no seu celular</h3>
                <p className="text-xs text-slate-500">Tenha o app direto na sua tela</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div>
                <p className="font-bold text-slate-800 mb-0.5">📱 No Celular (Android / Chrome):</p>
                <p>Toque nos <strong>3 pontinhos</strong> do navegador e escolha <strong>"Instalar aplicativo"</strong>.</p>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <p className="font-bold text-slate-800 mb-0.5">🍎 No iPhone (Safari):</p>
                <p>Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima) e depois em <strong>"Adicionar à Tela de Início"</strong>.</p>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <p className="font-bold text-slate-800 mb-0.5">💻 No Computador (Chrome/Edge):</p>
                <p>Clique no ícone de <strong>Instalar</strong> no canto direito da barra de endereços (onde digita o link).</p>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="mt-5 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
