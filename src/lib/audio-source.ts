import type { AudioSourceType } from "@/lib/types";

export type AudioSourceCapability = {
  source: AudioSourceType;
  label: string;
  available: boolean;
  permissionApi: "getUserMedia" | "getDisplayMedia" | "mock";
};

export type AudioSourcePermissionResult =
  | {
      ok: true;
      requestedSource: AudioSourceType;
      activeSource: AudioSourceType;
      permissionApi: AudioSourceCapability["permissionApi"];
      message: string;
    }
  | {
      ok: false;
      requestedSource: AudioSourceType;
      activeSource: "dummy";
      permissionApi: AudioSourceCapability["permissionApi"];
      reason: "unsupported" | "denied" | "no_audio_track";
      message: string;
    };

export type AudioSourceStreamResult =
  | (Extract<AudioSourcePermissionResult, { ok: true }> & {
      stream: MediaStream | null;
    })
  | (Extract<AudioSourcePermissionResult, { ok: false }> & {
      stream: null;
    });

export function getAudioSourceCapabilities(navigatorLike?: Navigator): AudioSourceCapability[] {
  const mediaDevices = navigatorLike?.mediaDevices;
  return [
    {
      source: "microphone",
      label: "マイク",
      available: Boolean(mediaDevices?.getUserMedia),
      permissionApi: "getUserMedia"
    },
    {
      source: "browser_tab",
      label: "Webタブ音声",
      available: Boolean(mediaDevices?.getDisplayMedia),
      permissionApi: "getDisplayMedia"
    },
    {
      source: "system_audio",
      label: "システム音声",
      available: Boolean(mediaDevices?.getDisplayMedia),
      permissionApi: "getDisplayMedia"
    },
    {
      source: "dummy",
      label: "ダミー文字起こし",
      available: true,
      permissionApi: "mock"
    }
  ];
}

export function isBrowserAudioSource(source: AudioSourceType): boolean {
  return source === "microphone" || source === "browser_tab" || source === "system_audio";
}

export function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function hasAudioTrack(stream: MediaStream): boolean {
  return stream.getAudioTracks().length > 0;
}

export async function requestAudioSourceStream(
  source: AudioSourceType,
  navigatorLike?: Navigator
): Promise<AudioSourceStreamResult> {
  const capability = getAudioSourceCapabilities(navigatorLike).find((item) => item.source === source);

  if (!capability) {
    return {
      ok: false,
      requestedSource: source,
      activeSource: "dummy",
      permissionApi: "mock",
      reason: "unsupported",
      message: "音声ソースを判定できないため、ダミー文字起こしへ切り替えました。",
      stream: null
    };
  }

  if (source === "dummy") {
    return {
      ok: true,
      requestedSource: source,
      activeSource: source,
      permissionApi: "mock",
      message: "ダミー文字起こしを使用します。",
      stream: null
    };
  }

  if (!capability.available) {
    return {
      ok: false,
      requestedSource: source,
      activeSource: "dummy",
      permissionApi: capability.permissionApi,
      reason: "unsupported",
      message: `${capability.label}はこのブラウザで利用できないため、ダミー文字起こしへ切り替えました。`,
      stream: null
    };
  }

  try {
    let stream: MediaStream | undefined;
    if (source === "microphone") {
      stream = await navigatorLike?.mediaDevices.getUserMedia({ audio: true });
    } else {
      stream = await navigatorLike?.mediaDevices.getDisplayMedia({
        audio: true,
        video: true
      });
    }

    if (!stream || !hasAudioTrack(stream)) {
      if (stream) stopMediaStream(stream);
      return {
        ok: false,
        requestedSource: source,
        activeSource: "dummy",
        permissionApi: capability.permissionApi,
        reason: "no_audio_track",
        message: `${capability.label}の音声トラックを取得できないため、ダミー文字起こしへ切り替えました。`,
        stream: null
      };
    }

    return {
      ok: true,
      requestedSource: source,
      activeSource: source,
      permissionApi: capability.permissionApi,
      message: `${capability.label}の音声ストリームを取得しました。`,
      stream
    };
  } catch {
    return {
      ok: false,
      requestedSource: source,
      activeSource: "dummy",
      permissionApi: capability.permissionApi,
      reason: "denied",
      message: `${capability.label}の権限が拒否されたため、ダミー文字起こしへ切り替えました。`,
      stream: null
    };
  }
}

export async function requestAudioSourcePermission(
  source: AudioSourceType,
  navigatorLike?: Navigator
): Promise<AudioSourcePermissionResult> {
  const result = await requestAudioSourceStream(source, navigatorLike);
  if (result.stream) {
    stopMediaStream(result.stream);
  }

  if (result.ok) {
    return {
      ok: true,
      requestedSource: result.requestedSource,
      activeSource: result.activeSource,
      permissionApi: result.permissionApi,
      message: result.message
    };
  }

  return {
    ok: false,
    requestedSource: result.requestedSource,
    activeSource: result.activeSource,
    permissionApi: result.permissionApi,
    reason: result.reason,
    message: result.message
  };
}
