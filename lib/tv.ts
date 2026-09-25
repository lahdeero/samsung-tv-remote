import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

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

async function runSamsungTv(command: string, commandArgs: string[] = []): Promise<string> {
  const { ip, bin, tokenFile } = getConfig();
  const { stdout } = await execFileAsync(
    bin,
    ["--host", ip, "--token-file", tokenFile, command, ...commandArgs],
    { timeout: COMMAND_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES },
  );
  return stdout;
}

export type NavigateDirection = "up" | "down" | "left" | "right";

export async function powerOn(): Promise<string> {
  const { mac, wolBin } = getConfig();
  const { stdout } = await execFileAsync(wolBin, [mac], {
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return stdout;
}

export const powerOff = () => runSamsungTv("power");
export const volumeUp = () => runSamsungTv("volume-up");
export const volumeDown = () => runSamsungTv("volume-down");
export const mute = () => runSamsungTv("mute");
export const home = () => runSamsungTv("home");
export const back = () => runSamsungTv("back");
export const source = () => runSamsungTv("source");
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

export const TV_ACTIONS = [
  "powerOn",
  "powerOff",
  "volumeUp",
  "volumeDown",
  "mute",
  "home",
  "back",
  "source",
  "enter",
  "navUp",
  "navDown",
  "navLeft",
  "navRight",
  "channelUp",
  "channelDown",
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

export async function executeAction(action: TvAction, key?: string): Promise<string> {
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
    case "sendKey": {
      if (!isAllowedKey(key)) {
        throw new Error("Missing or disallowed key");
      }
      return sendKey(key);
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
