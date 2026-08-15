import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { NeonRunner, type GameState } from "@/game/neonRunner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Drift — 3D Endless Tunnel Racer" },
      {
        name: "description",
        content:
          "Neon Drift is a fast 3D browser racer: dodge glowing blocks, grab energy orbs and chase your high score through an infinite synthwave tunnel.",
      },
      { property: "og:title", content: "Neon Drift — 3D Endless Tunnel Racer" },
      {
        property: "og:description",
        content:
          "Dodge, drift and collect energy orbs in an infinite synthwave tunnel. Playable in your browser.",
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
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <h1 className="sr-only">Neon Drift — 3D endless tunnel racer</h1>
      <div ref={mount} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 scanlines" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <div>
          <p className="hud-label">Score</p>
          <p className="hud-value glow-cyan">{score.toString().padStart(5, "0")}</p>
        </div>
        <div className="text-right">
          <p className="hud-label">Speed</p>
          <p className="hud-value glow-magenta">{speed}</p>
        </div>
      </div>

      {state !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in">
          <div className="mx-6 max-w-sm rounded-2xl border border-border/60 bg-card/70 p-7 text-center shadow-[0_0_60px_-10px_var(--glow-cyan)]">
            <p className="hud-label">{state === "over" ? "Run terminated" : "Ready"}</p>
            <h2 className="title-neon mt-1 text-4xl">NEON DRIFT</h2>
            {state === "over" ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Score <span className="glow-cyan font-semibold">{score}</span> · Best{" "}
                <span className="glow-magenta font-semibold">{Math.max(best, score)}</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Dodge the pylons, collect energy orbs, survive the acceleration.
              </p>
            )}
            <button className="btn-neon mt-6" onClick={() => game.current?.start()}>
              {state === "over" ? "Run again" : "Launch"}
            </button>
            <p className="mt-4 text-xs text-muted-foreground">
              Arrow keys / A · D — or tap the left or right side of the screen
            </p>
          </div>
        </div>
      )}

      {state === "playing" && (
        <div className="absolute inset-x-0 bottom-0 flex gap-3 p-5">
          <button className="btn-pad" aria-label="Move left" onClick={() => game.current?.move(-1)}>
            ◀
          </button>
          <button className="btn-pad" aria-label="Move right" onClick={() => game.current?.move(1)}>
            ▶
          </button>
        </div>
      )}
    </main>
  );
}
