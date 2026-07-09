import { describe, expect, it, vi } from "vitest";
import {
  getAudioSourceCapabilities,
  requestAudioSourcePermission,
  requestAudioSourceStream
} from "@/lib/audio-source";

function mediaStreamWithStop(stop = vi.fn()): MediaStream {
  const audioTrack = { kind: "audio", stop } as unknown as MediaStreamTrack;
  return {
    getAudioTracks: () => [audioTrack],
    getTracks: () => [audioTrack]
  } as unknown as MediaStream;
}

function navigatorWithMediaDevices(input: {
  getUserMedia?: ReturnType<typeof vi.fn>;
  getDisplayMedia?: ReturnType<typeof vi.fn>;
}): Navigator {
  return {
    mediaDevices: input
  } as unknown as Navigator;
}

describe("audio source permissions", () => {
  it("detects microphone and display capture capabilities", () => {
    const navigatorLike = navigatorWithMediaDevices({
      getUserMedia: vi.fn(),
      getDisplayMedia: vi.fn()
    });

    expect(getAudioSourceCapabilities(navigatorLike)).toMatchObject([
      { source: "microphone", available: true, permissionApi: "getUserMedia" },
      { source: "browser_tab", available: true, permissionApi: "getDisplayMedia" },
      { source: "system_audio", available: true, permissionApi: "getDisplayMedia" },
      { source: "dummy", available: true, permissionApi: "mock" }
    ]);
  });

  it("requests microphone permission with getUserMedia and stops the stream", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue(mediaStreamWithStop(stop));
    const getDisplayMedia = vi.fn();
    const navigatorLike = navigatorWithMediaDevices({ getUserMedia, getDisplayMedia });

    await expect(requestAudioSourcePermission("microphone", navigatorLike)).resolves.toMatchObject({
      ok: true,
      activeSource: "microphone",
      permissionApi: "getUserMedia"
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("requests microphone stream without stopping it so STT can consume the track", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue(mediaStreamWithStop(stop));
    const navigatorLike = navigatorWithMediaDevices({ getUserMedia });

    const result = await requestAudioSourceStream("microphone", navigatorLike);

    expect(result).toMatchObject({
      ok: true,
      activeSource: "microphone",
      permissionApi: "getUserMedia"
    });
    expect(result.stream?.getAudioTracks()).toHaveLength(1);
    expect(stop).not.toHaveBeenCalled();
  });

  it("requests browser tab audio with getDisplayMedia and stops the stream", async () => {
    const stop = vi.fn();
    const getDisplayMedia = vi.fn().mockResolvedValue(mediaStreamWithStop(stop));
    const navigatorLike = navigatorWithMediaDevices({
      getUserMedia: vi.fn(),
      getDisplayMedia
    });

    await expect(requestAudioSourcePermission("browser_tab", navigatorLike)).resolves.toMatchObject({
      ok: true,
      activeSource: "browser_tab",
      permissionApi: "getDisplayMedia"
    });
    expect(getDisplayMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("falls back and stops display stream when the shared tab has no audio track", async () => {
    const stop = vi.fn();
    const stream = {
      getAudioTracks: () => [],
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    const navigatorLike = navigatorWithMediaDevices({
      getDisplayMedia
    });

    await expect(requestAudioSourceStream("browser_tab", navigatorLike)).resolves.toMatchObject({
      ok: false,
      activeSource: "dummy",
      reason: "no_audio_track"
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("falls back to dummy when permission is denied", async () => {
    const navigatorLike = navigatorWithMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(new Error("denied"))
    });

    await expect(requestAudioSourcePermission("microphone", navigatorLike)).resolves.toMatchObject({
      ok: false,
      activeSource: "dummy",
      reason: "denied"
    });
  });

  it("falls back to dummy when display capture is unsupported", async () => {
    const navigatorLike = navigatorWithMediaDevices({
      getUserMedia: vi.fn()
    });

    await expect(requestAudioSourcePermission("system_audio", navigatorLike)).resolves.toMatchObject({
      ok: false,
      activeSource: "dummy",
      reason: "unsupported",
      permissionApi: "getDisplayMedia"
    });
  });

  it("stops every acquired stream when permission is requested repeatedly", async () => {
    const stops = [vi.fn(), vi.fn(), vi.fn()];
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(mediaStreamWithStop(stops[0]))
      .mockResolvedValueOnce(mediaStreamWithStop(stops[1]))
      .mockResolvedValueOnce(mediaStreamWithStop(stops[2]));
    const navigatorLike = navigatorWithMediaDevices({ getUserMedia });

    await Promise.all([
      requestAudioSourcePermission("microphone", navigatorLike),
      requestAudioSourcePermission("microphone", navigatorLike),
      requestAudioSourcePermission("microphone", navigatorLike)
    ]);

    expect(stops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });

  it("falls back safely when device is missing or permission is revoked mid-flow", async () => {
    const navigatorLike = navigatorWithMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(new DOMException("NotFoundError"))
    });

    await expect(requestAudioSourcePermission("microphone", navigatorLike)).resolves.toMatchObject({
      ok: false,
      activeSource: "dummy",
      reason: "denied"
    });
  });
});
