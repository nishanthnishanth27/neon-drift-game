import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { NeonRunner, type GameState } from "@/game/neonRunner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Drift — 3D Endless Runner" },
      {
        name: "description",
        content:
          "Neon Drift is a fast 3D endless runner: dodge colorful obstacles, collect coins and chase your high score through a vibrant city.",
      },
      { property: "og:title", content: "Neon Drift — 3D Endless Runner" },
      {
        property: "og:description",
        content:
          "Run, dodge and collect coins in a colorful 3D endless runner game. Play in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

function Game() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<NeonRunner | null>(null);
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [best, setBest] = useState(0);
  const [state, setState] = useState<GameState>("ready");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!mount.current) return;
    const g = new NeonRunner(mount.current, {
      onScore: setScore,
      onSpeed: setSpeed,
      onState: setState,
    });
    game.current = g;
    return () => g.dispose();
  }, []);

  useEffect(() => {
    if (state === "over") setBest((b) => Math.max(b, score));
  }, [state, score]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-sky-300 to-amber-100">
      <h1 className="sr-only">Neon Drift — 3D endless runner game</h1>
      
      {/* Game canvas */}
      <div ref={mount} className="absolute inset-0" />
      
      {/* Ambient overlay */}
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-[0.02] bg-gradient-radial" />

      {/* HUD - Top Score and Speed */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-6">
        <div className="backdrop-blur-md bg-white/10 rounded-2xl px-5 py-3 border border-white/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Score</p>
          <p className="text-3xl font-black text-white drop-shadow-lg">{score.toString().padStart(6, "0")}</p>
        </div>
        
        <div className="backdrop-blur-md bg-white/10 rounded-2xl px-5 py-3 border border-white/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Speed</p>
          <p className="text-3xl font-black text-white drop-shadow-lg">{speed}</p>
        </div>
      </div>

      {/* Start/Game Over Screen */}
      {state !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="mx-6 max-w-md rounded-3xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 p-8 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-2">
                {state === "over" ? "🏁 Run Over" : "🎮 Ready?"}
              </p>
              <h2 className="text-5xl font-black text-white drop-shadow-2xl mb-2">NEON DRIFT</h2>
              <p className="text-sm text-white/90">Endless Runner</p>
            </div>

            {/* Content */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-8 text-center">
              {state === "over" ? (
                <>
                  <div className="mb-6">
                    <p className="text-white/70 text-sm mb-4">Final Score</p>
                    <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">
                      {score}
                    </p>
                    <div className="flex gap-4 justify-center mb-4">
                      <div className="flex-1 bg-white/5 rounded-lg p-3 border border-white/10">
                        <p className="text-xs text-white/50">Best Score</p>
                        <p className="text-2xl font-bold text-purple-400">{Math.max(best, score)}</p>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-lg p-3 border border-white/10">
                        <p className="text-xs text-white/50">Distance</p>
                        <p className="text-2xl font-bold text-cyan-400">{Math.floor(score / 5)}m</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-white/70 text-base mb-4 leading-relaxed">
                    🏃 Dodge obstacles • 🪙 Collect coins • 🚀 Survive the acceleration
                  </p>
                </>
              )}

              {/* Action Button */}
              <button
                className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 active:scale-95 text-slate-900 font-black uppercase tracking-widest py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl mb-4 text-lg"
                onClick={() => game.current?.start()}
              >
                {state === "over" ? "Run Again" : "Launch Game"}
              </button>

              {/* Controls info */}
              <p className="text-xs text-white/50 leading-relaxed">
                ⌨️ Arrow Keys / A · D to move  •  📱 Tap left/right to steer
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Controls - Bottom */}
      {state === "playing" && (
        <div className="absolute inset-x-0 bottom-0 flex gap-4 p-5 pointer-events-auto">
          <button
            className="flex-1 backdrop-blur-md bg-cyan-400/20 hover:bg-cyan-400/30 active:bg-cyan-400/40 text-white font-bold text-2xl py-4 rounded-2xl border-2 border-cyan-400/50 hover:border-cyan-400 transition-all duration-150 shadow-lg active:scale-95"
            aria-label="Move left"
            onClick={() => game.current?.move(-1)}
          >
            ◀
          </button>
          <button
            className="flex-1 backdrop-blur-md bg-blue-400/20 hover:bg-blue-400/30 active:bg-blue-400/40 text-white font-bold text-2xl py-4 rounded-2xl border-2 border-blue-400/50 hover:border-blue-400 transition-all duration-150 shadow-lg active:scale-95"
            aria-label="Move right"
            onClick={() => game.current?.move(1)}
          >
            ▶
          </button>
        </div>
      )}
    </main>
  );
}
