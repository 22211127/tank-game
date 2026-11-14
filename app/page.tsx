"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "@/game/engine";
import { render } from "@/game/render";
import { HEIGHT, Phase, WIDTH } from "@/game/types";

export default function TankGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem("tank-highscore") || 0);
    if (!Number.isNaN(stored)) setHighScore(stored);
  }, []);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const game = new Game();
    gameRef.current = game;

    const loop = (now: number) => {
      const dt = Math.min(64, now - (lastRef.current || now));
      lastRef.current = now;
      game.update(dt);
      render(ctx, game);

      // sync react state (throttled by comparing)
      setPhase((p) => (p === game.state.phase ? p : game.state.phase));
      setScore((sc) => (sc === game.state.score ? sc : game.state.score));
      setLevel((lv) => (lv === game.state.level ? lv : game.state.level));

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // persist high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem("tank-highscore", String(score));
      } catch {}
    }
  }, [score, highScore]);

  // keyboard input
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          " ",
        ].includes(k)
      ) {
        e.preventDefault();
      }
      if (k === "p" || k === "P") {
        if (game.state.phase === "playing") game.state.phase = "paused";
        else if (game.state.phase === "paused") game.state.phase = "playing";
        return;
      }
      if (k === "Enter") {
        if (game.state.phase === "menu" || game.state.phase === "gameover" || game.state.phase === "win") {
          game.start(1);
        } else if (game.state.phase === "levelclear") {
          game.nextLevel();
        }
        return;
      }
      if (k === " ") {
        game.pressFire();
      }
      game.keyDown(k);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") game.releaseFire();
      game.keyUp(e.key);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const blur = () => game.keys.clear();
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const startGame = useCallback(() => {
    gameRef.current?.start(1);
  }, []);

  const nextLevel = useCallback(() => {
    gameRef.current?.nextLevel();
  }, []);

  const resume = useCallback(() => {
    if (gameRef.current?.state.phase === "paused") gameRef.current.state.phase = "playing";
  }, []);

  return (
    <main>
      <div className="game-shell">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />

        {phase === "menu" && (
          <div className="overlay">
            <h1>跑男爬爬虾大战</h1>
            <p>保卫基地，消灭所有敌方坦克！</p>
            <div className="keys">
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 移动</span>
              <span><kbd>空格</kbd> / <kbd>J</kbd> 开火</span>
              <span><kbd>P</kbd> 暂停</span>
              <span><kbd>Enter</kbd> 开始</span>
            </div>
            {highScore > 0 && <p>最高分：<b style={{ color: "#ffd23f" }}>{highScore}</b></p>}
            <button onClick={startGame}>开始游戏</button>
          </div>
        )}

        {phase === "paused" && (
          <div className="overlay">
            <h1>暂停</h1>
            <p>按 <kbd style={{ padding: "2px 7px", borderRadius: 5, background: "#1e2a36", border: "1px solid #3a4d60" }}>P</kbd> 继续</p>
            <button onClick={resume}>继续游戏</button>
          </div>
        )}

        {phase === "levelclear" && (
          <div className="overlay">
            <h1 style={{ color: "#7ee787" }}>关卡完成！</h1>
            <p>得分：{score} · 即将进入第 {level + 1} 关</p>
            <button onClick={nextLevel}>下一关</button>
          </div>
        )}

        {phase === "gameover" && (
          <div className="overlay">
            <h2>游戏结束</h2>
            <p>本局得分：{score}　最高分：{highScore}</p>
            <button onClick={startGame}>重新开始</button>
          </div>
        )}

        {phase === "win" && (
          <div className="overlay">
            <h1 style={{ color: "#7ee787" }}>胜利！</h1>
            <p>得分：{score}</p>
            <button onClick={startGame}>再玩一次</button>
          </div>
        )}
      </div>
    </main>
  );
}
