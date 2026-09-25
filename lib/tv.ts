import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { MAX_CHANNEL, MAX_TEXT_LENGTH, MIN_CHANNEL } from "./constants";

const execFileAsync = promisify(execFile);

const COMMAND_TIMEOUT_MS = 15_000;
const MAX_BUFFER_BYTES = 1024 * 1024;

const PROJECT_DIR = join(homedir(), "Projects", "tv-remote-controller");

interface TvConfig {
  ip: string;
  mac: string;
  bin: string;
  tokenFile: string;
  wolBin: string;
}

function getConfig(): TvConfig {
  return {
    ip: process.env.TV_IP ?? "192.168.1.95",
    mac: process.env.TV_MAC ?? "B8:B4:09:50:4C:72",
    bin: process.env.SAMSUNGTV_BIN ?? join(PROJECT_DIR, ".venv", "bin", "samsungtv"),
    tokenFile: process.env.SAMSUNGTV_TOKEN_FILE ?? join(PROJECT_DIR, ".tv-token"),
    wolBin: process.env.WOL_BIN ?? "wakeonlan",
  };
}

interface ExecError {
  stderr?: unknown;
  code?: unknown;
  killed?: unknown;
}

/**
 * Build a clean error from execFile's rejection. Only stderr / exit metadata is
 * surfaced so command arguments (which may contain user text) are never echoed.
 */
function toTvError(error: unknown): Error {
  if (error && typeof error === "object") {
    const { stderr, code, killed } = error as ExecError;
    if (typeof stderr === "string" && stderr.trim()) {
      return new Error(stderr.trim());
    }
    if (code === "ENOENT") {
      return new Error("samsungtv CLI not found. Check SAMSUNGTV_BIN.");
    }
    if (killed) {
      return new Error("The TV did not respond in time.");
    }
  }
  return new Error("The TV command failed.");
}

async function runSamsungTv(command: string, commandArgs: string[] = []): Promise<string> {
  const { ip, bin, tokenFile } = getConfig();
  try {
    const { stdout } = await execFileAsync(
      bin,
      ["--host", ip, "--token-file", tokenFile, command, ...commandArgs],
      { timeout: COMMAND_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES },
    );
    return stdout;
  } catch (error) {
    throw toTvError(error);
  }
}

export type NavigateDirection = "up" | "down" | "left" | "right";

export async function powerOn(): Promise<string> {
  const { mac, wolBin } = getConfig();
  try {
    const { stdout } = await execFileAsync(wolBin, [mac], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    return stdout;
  } catch (error) {
    throw toTvError(error);
  }
}

export const powerOff = () => runSamsungTv("power");
export const volumeUp = () => runSamsungTv("volume-up");
export const volumeDown = () => runSamsungTv("volume-down");
export const mute = () => runSamsungTv("mute");
export const home = () => runSamsungTv("home");
export const back = () => runSamsungTv("back");
export const source = () => runSamsungTv("source");
export const guide = () => sendKey("KEY_GUIDE");
export const enter = () => runSamsungTv("enter");
export const channelUp = () => runSamsungTv("channel-up");
export const channelDown = () => runSamsungTv("channel-down");

const NAVIGATE_COMMANDS: Record<NavigateDirection, string> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

export function navigate(direction: NavigateDirection): Promise<string> {
  const command = NAVIGATE_COMMANDS[direction];
  if (!command) {
    throw new Error(`Unsupported direction: ${direction}`);
  }
  return runSamsungTv(command);
}

/**
 * Raw remote keys supported by the TV / samsungtvws CLI.
 * Only these values are ever passed through to `send-key`.
 * See the samsungtvws COMMANDS.md key reference.
 */
export const ALLOWED_KEYS = [
  "KEY_POWER",
  "KEY_HOME",
  "KEY_MENU",
  "KEY_SOURCE",
  "KEY_INFO",
  "KEY_TOOLS",
  "KEY_GUIDE",
  "KEY_RETURN",
  "KEY_UP",
  "KEY_DOWN",
  "KEY_LEFT",
  "KEY_RIGHT",
  "KEY_ENTER",
  "KEY_CHUP",
  "KEY_CHDOWN",
  "KEY_PRECH",
  "KEY_CH_LIST",
  "KEY_VOLUP",
  "KEY_VOLDOWN",
  "KEY_MUTE",
  "KEY_REWIND",
  "KEY_STOP",
  "KEY_PLAY",
  "KEY_FF",
  "KEY_REC",
  "KEY_PAUSE",
  "KEY_LIVE",
  "KEY_QUICK_REPLAY",
  "KEY_INSTANT_REPLAY",
  "KEY_0",
  "KEY_1",
  "KEY_2",
  "KEY_3",
  "KEY_4",
  "KEY_5",
  "KEY_6",
  "KEY_7",
  "KEY_8",
  "KEY_9",
] as const;

export type AllowedKey = (typeof ALLOWED_KEYS)[number];

const ALLOWED_KEY_SET: ReadonlySet<string> = new Set(ALLOWED_KEYS);

export function isAllowedKey(key: unknown): key is AllowedKey {
  return typeof key === "string" && ALLOWED_KEY_SET.has(key);
}

export function sendKey(key: string): Promise<string> {
  if (!isAllowedKey(key)) {
    throw new Error(`Key not allowed: ${key}`);
  }
  return runSamsungTv("send-key", [key]);
}

/** Thrown when untrusted input fails server-side validation. */
export class TvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TvValidationError";
  }
}

/** Validate a channel number from untrusted input. */
export function parseChannel(value: unknown): number {
  const raw =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";

  if (!/^\d+$/.test(raw)) {
    throw new TvValidationError("Channel must be a whole number.");
  }

  const channel = Number(raw);
  if (channel < MIN_CHANNEL || channel > MAX_CHANNEL) {
    throw new TvValidationError(
      `Channel must be between ${MIN_CHANNEL} and ${MAX_CHANNEL}.`,
    );
  }

  return channel;
}

/** Validate text intended for the TV IME. Spaces and punctuation are preserved. */
export function parseText(value: unknown): string {
  if (typeof value !== "string") {
    throw new TvValidationError("Text must be a string.");
  }
  if (value.includes("\0")) {
    throw new TvValidationError("Text contains an unsupported character.");
  }
  if (value.length === 0) {
    throw new TvValidationError("Text is empty.");
  }
  if (value.length > MAX_TEXT_LENGTH) {
    throw new TvValidationError(`Text must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  }
  return value;
}

/** Select a channel by number (KEY_0–KEY_9 + KEY_ENTER). */
export function setChannel(value: unknown): Promise<string> {
  const channel = parseChannel(value);
  return runSamsungTv("channel", [String(channel)]);
}

/**
 * Send text to the TV's focused IME field. The CLI's `send-text --end` flag
 * also emits SendInputEnd (end-text) after the text.
 */
export async function sendText(value: unknown, end = true): Promise<string> {
  const text = parseText(value);
  const commandArgs = end ? ["--end", "--", text] : ["--", text];
  try {
    return await runSamsungTv("send-text", commandArgs);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Could not send text (${detail}). Make sure a text field is focused on the TV.`,
    );
  }
}

export const TV_ACTIONS = [
  "powerOn",
  "powerOff",
  "volumeUp",
  "volumeDown",
  "mute",
  "home",
  "back",
  "source",
  "guide",
  "enter",
  "navUp",
  "navDown",
  "navLeft",
  "navRight",
  "channelUp",
  "channelDown",
  "setChannel",
  "sendText",
  "mediaPlay",
  "mediaPause",
  "mediaStop",
  "mediaPrev",
  "mediaNext",
  "sendKey",
] as const;

export type TvAction = (typeof TV_ACTIONS)[number];

const TV_ACTION_SET: ReadonlySet<string> = new Set(TV_ACTIONS);

export function isTvAction(action: unknown): action is TvAction {
  return typeof action === "string" && TV_ACTION_SET.has(action);
}

/**
 * Verify a media control key mapping against samsungtvws COMMANDS.md:
 * Previous -> KEY_REWIND, Next -> KEY_FF, plus KEY_PLAY / KEY_PAUSE / KEY_STOP.
 */
const MEDIA_KEYS: Partial<Record<TvAction, AllowedKey>> = {
  mediaPlay: "KEY_PLAY",
  mediaPause: "KEY_PAUSE",
  mediaStop: "KEY_STOP",
  mediaPrev: "KEY_REWIND",
  mediaNext: "KEY_FF",
};

export interface TvActionInput {
  key?: unknown;
  channel?: unknown;
  text?: unknown;
}

export async function executeAction(
  action: TvAction,
  input: TvActionInput = {},
): Promise<string> {
  switch (action) {
    case "powerOn":
      return powerOn();
    case "powerOff":
      return powerOff();
    case "volumeUp":
      return volumeUp();
    case "volumeDown":
      return volumeDown();
    case "mute":
      return mute();
    case "home":
      return home();
    case "back":
      return back();
    case "source":
      return source();
    case "guide":
      return guide();
    case "enter":
      return enter();
    case "navUp":
      return navigate("up");
    case "navDown":
      return navigate("down");
    case "navLeft":
      return navigate("left");
    case "navRight":
      return navigate("right");
    case "channelUp":
      return channelUp();
    case "channelDown":
      return channelDown();
    case "setChannel":
      return setChannel(input.channel);
    case "sendText":
      return sendText(input.text);
    case "sendKey": {
      if (!isAllowedKey(input.key)) {
        throw new TvValidationError("Missing or disallowed key");
      }
      return sendKey(input.key);
    }
    default: {
      const mediaKey = MEDIA_KEYS[action];
      if (mediaKey) {
        return sendKey(mediaKey);
      }
      throw new Error(`Unsupported action: ${action}`);
    }
  }
}
