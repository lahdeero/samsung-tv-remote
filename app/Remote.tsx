"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { MAX_CHANNEL, MAX_TEXT_LENGTH, MIN_CHANNEL } from "@/lib/constants";

type TvAction =
  | "powerOn"
  | "powerOff"
  | "volumeUp"
  | "volumeDown"
  | "mute"
  | "home"
  | "back"
  | "source"
  | "guide"
  | "enter"
  | "navUp"
  | "navDown"
  | "navLeft"
  | "navRight"
  | "channelUp"
  | "channelDown"
  | "setChannel"
  | "sendText"
  | "mediaPlay"
  | "mediaPause"
  | "mediaStop"
  | "mediaPrev"
  | "mediaNext";

type Status = { tone: "ok" | "error"; text: string };

type CommandPayload = { channel?: number; text?: string };

async function callTv(action: TvAction, payload: CommandPayload = {}): Promise<void> {
  const response = await fetch("/api/tv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
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

function stopEnterPropagation(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.stopPropagation();
  }
}

export default function Remote() {
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [channel, setChannel] = useState("");
  const [text, setText] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showStatus = useCallback((next: Status) => {
    setStatus(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setStatus(null), 1800);
  }, []);

  const run = useCallback(
    async (action: TvAction, label: string, payload?: CommandPayload) => {
      setPending((count) => count + 1);
      try {
        await callTv(action, payload);
        showStatus({ tone: "ok", text: label });
      } catch (error) {
        showStatus({
          tone: "error",
          text: error instanceof Error ? error.message : "Command failed",
        });
      } finally {
        setPending((count) => count - 1);
      }
    },
    [showStatus],
  );

  const key = (action: TvAction, label: string) => () => void run(action, label);
  const busy = pending > 0;

  const submitChannel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = channel.trim();

    if (!/^\d+$/.test(value)) {
      showStatus({ tone: "error", text: "Enter a channel number." });
      return;
    }

    const numeric = Number(value);
    if (numeric < MIN_CHANNEL || numeric > MAX_CHANNEL) {
      showStatus({
        tone: "error",
        text: `Channel must be between ${MIN_CHANNEL} and ${MAX_CHANNEL}.`,
      });
      return;
    }

    void run("setChannel", `Channel ${numeric}`, { channel: numeric });
  };

  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (text.length === 0) {
      showStatus({ tone: "error", text: "Type some text first." });
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      showStatus({
        tone: "error",
        text: `Text must be ${MAX_TEXT_LENGTH} characters or fewer.`,
      });
      return;
    }

    void run("sendText", "Text sent to TV", { text });
  };

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
          <Key
            className="key--wide"
            label="Guide"
            variant="ghost"
            onPress={key("guide", "Guide")}
          />
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
        <form className="input-row" style={{ marginTop: 10 }} onSubmit={submitChannel}>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Channel"
            aria-label="Channel number"
            value={channel}
            onChange={(event) => setChannel(event.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={stopEnterPropagation}
          />
          <button type="submit" className="key key--go">
            Go
          </button>
        </form>

        <p className="section-label">Text input</p>
        <form className="input-row" onSubmit={submitText}>
          <input
            className="input"
            type="text"
            placeholder="Type text for TV…"
            aria-label="Text to send to the TV"
            maxLength={MAX_TEXT_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={stopEnterPropagation}
          />
          <button type="submit" className="key key--go">
            Send
          </button>
        </form>
        <p className="hint">Focus a text field on the TV before sending.</p>

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
