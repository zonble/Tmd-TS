import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
vi.mock("jzz", () => {
  const fn: any = () => ({
    synth: { Tiny: () => ({}) },
    openMidiOut: () => Promise.resolve({}),
  });
  fn.synth = { Tiny: () => ({}) };
  fn.MIDI = { SMF: () => ({}) };
  return { default: fn };
});
vi.mock("jzz-synth-tiny", () => ({ default: () => {} }));
vi.mock("jzz-midi-smf", () => ({ default: () => {} }));
vi.mock("soundfont-player", () => ({ default: {} }));

import { tmdPlayer } from "../web/src/midi-player.js";

describe("TMD Player Replay & End-of-Track Invariants (TDD)", () => {
  beforeEach(() => {
    tmdPlayer.stop(false);
  });

  it("restarts from beginning when togglePause() is called after playback has ended", () => {
    // Mock currentPlayer
    const mockPlayer = {
      playing: false,
      paused: false,
      durationMS: () => 10000,
      positionMS: () => 0,
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      jumpMS: vi.fn(),
    };

    (tmdPlayer as any).currentPlayer = mockPlayer;
    (tmdPlayer as any).isEndedState = true;
    (tmdPlayer as any).isPausedState = false;

    expect(tmdPlayer.isEnded()).toBe(true);
    expect(tmdPlayer.getPosition()).toBe(10); // duration in seconds

    // Act: user clicks Play (togglePause) after player reached the end
    tmdPlayer.togglePause();

    // Assert: should seek to 0 and start playing from the beginning
    expect(mockPlayer.jumpMS).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(tmdPlayer.isEnded()).toBe(false);
  });

  it("restarts from beginning when resume() is called at or near the end of track", () => {
    const mockPlayer = {
      playing: false,
      paused: true,
      durationMS: () => 10000,
      positionMS: () => 9900, // 9.9s of 10s (within 0.2s of end)
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      jumpMS: vi.fn(),
    };

    (tmdPlayer as any).currentPlayer = mockPlayer;
    (tmdPlayer as any).isEndedState = false;
    (tmdPlayer as any).isPausedState = true;

    // Act: user clicks play/resumes when paused at the end
    tmdPlayer.resume();

    // Assert: must seek to 0 and play from beginning
    expect(mockPlayer.jumpMS).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("restarts from beginning when togglePause() is called while paused at end of track", () => {
    const mockPlayer = {
      playing: false,
      paused: true,
      durationMS: () => 10000,
      positionMS: () => 10000, // exactly at end
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      jumpMS: vi.fn(),
    };

    (tmdPlayer as any).currentPlayer = mockPlayer;
    (tmdPlayer as any).isEndedState = false;
    (tmdPlayer as any).isPausedState = true;

    tmdPlayer.togglePause();

    expect(mockPlayer.jumpMS).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("preserves player bar visibility and sets play icon on playback end in playerBar.ts", () => {
    const playerBarPath = path.join(__dirname, "../web/src/ui/playerBar.ts");
    const content = fs.readFileSync(playerBarPath, "utf-8");

    // onEnd should not hide the bar (should not have tmdPlayerBar.style.display = "none" inside onEnd)
    const onEndMatch = content.match(/onEnd:\s*\(\)\s*=>\s*\{([\s\S]*?)\}/);
    expect(onEndMatch).not.toBeNull();
    const onEndBody = onEndMatch![1];

    expect(onEndBody).not.toContain('tmdPlayerBar.style.display = "none"');
    expect(onEndBody).toMatch(/playerBtnPause\.textContent\s*=\s*["']▶["']/);
  });
});
