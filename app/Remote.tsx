"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TvAction =
  | "powerOn"
  | "powerOff"
  | "volumeUp"
  | "volumeDown"
  | "mute"
  | "home"
  | "back"
  | "source"
  | "enter"
  | "navUp"
  | "navDown"
  | "navLeft"
  | "navRight"
  | "channelUp"
  | "channelDown"
  | "mediaPlay"
  | "mediaPause"
  | "mediaStop"
  | "mediaPrev"
  | "mediaNext";

type Status = { tone: "ok" | "error"; text: string };

async function callTv(action: TvAction): Promise<void> {
  const response = await fetch("/api/tv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status})`);
  }
}

function Key({
  label,
  sub,
  ariaLabel,
  variant = "key",
  className,
  onPress,
}: {
  label: string;
  sub?: string;
  ariaLabel?: string;
  variant?: "key" | "on" | "off" | "ok" | "ghost";
  className?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      className={`key key--${variant}${className ? ` ${className}` : ""}`}
      onClick={onPress}
    >
      <span className="key__label">{label}</span>
      {sub ? <span className="key__sub">{sub}</span> : null}
    </button>
  );
}

export default function Remote() {
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const run = useCallback(async (action: TvAction, label: string) => {
    setPending((count) => count + 1);
    try {
      await callTv(action);
      setStatus({ tone: "ok", text: label });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Command failed",
      });
    } finally {
      setPending((count) => count - 1);
    }

    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setStatus(null), 1800);
  }, []);

  const key = (action: TvAction, label: string) => () => void run(action, label);
  const busy = pending > 0;

  return (
    <>
      <main className="remote" aria-label="Samsung TV remote">
        <header className="remote__header">
          <div>
            <h1 className="remote__title">Samsung TV</h1>
            <p className="remote__subtitle">S90D OLED · 77&quot;</p>
          </div>
          <div
            className={`status${busy ? " status--busy" : ""}${
              status?.tone === "error" ? " status--error" : ""
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="status__dot" />
            {busy ? "Sending…" : status?.tone === "error" ? "Error" : "Ready"}
          </div>
        </header>

        <div className="power">
          <Key label="On" variant="on" onPress={key("powerOn", "Power on")} />
          <Key label="Off" variant="off" onPress={key("powerOff", "Power off")} />
        </div>

        <div className="dpad">
          <Key className="dpad__up" label="↑" ariaLabel="Up" onPress={key("navUp", "Up")} />
          <Key
            className="dpad__left"
            label="←"
            ariaLabel="Left"
            onPress={key("navLeft", "Left")}
          />
          <Key
            className="dpad__ok"
            label="OK"
            variant="ok"
            ariaLabel="OK / Enter"
            onPress={key("enter", "OK")}
          />
          <Key
            className="dpad__right"
            label="→"
            ariaLabel="Right"
            onPress={key("navRight", "Right")}
          />
          <Key
            className="dpad__down"
            label="↓"
            ariaLabel="Down"
            onPress={key("navDown", "Down")}
          />
        </div>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <Key label="Back" sub="Return" onPress={key("back", "Back")} />
          <Key label="Home" onPress={key("home", "Home")} />
        </div>

        <p className="section-label">Volume</p>
        <div className="grid-2">
          <Key label="Vol −" onPress={key("volumeDown", "Volume down")} />
          <Key label="Vol +" onPress={key("volumeUp", "Volume up")} />
        </div>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <Key label="Mute" variant="ghost" onPress={key("mute", "Mute")} />
          <Key label="Source" variant="ghost" onPress={key("source", "Source")} />
        </div>

        <p className="section-label">Channel</p>
        <div className="grid-2">
          <Key label="CH −" onPress={key("channelDown", "Channel down")} />
          <Key label="CH +" onPress={key("channelUp", "Channel up")} />
        </div>

        <p className="section-label">Playback</p>
        <div className="media">
          <Key label="Prev" ariaLabel="Previous" onPress={key("mediaPrev", "Previous")} />
          <Key label="Play" ariaLabel="Play" onPress={key("mediaPlay", "Play")} />
          <Key label="Pause" ariaLabel="Pause" onPress={key("mediaPause", "Pause")} />
          <Key label="Stop" ariaLabel="Stop" onPress={key("mediaStop", "Stop")} />
          <Key label="Next" ariaLabel="Next" onPress={key("mediaNext", "Next")} />
        </div>
      </main>

      {status ? (
        <div className={`toast toast--${status.tone}`} role="status" aria-live="polite">
          {status.text}
        </div>
      ) : null}
    </>
  );
}
