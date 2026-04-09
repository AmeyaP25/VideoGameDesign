/**
 * Online party: Supabase Realtime broadcast (no server code required).
 * Host runs the game; joiner sends P2 input and applies state snapshots from host.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

let supabase = null;
let channel = null;
let myId = "";
let partyCode = "";
let isHost = false;
let peerPresent = false;
let subscribed = false;

const remoteInput = { ix: 0, iy: 0, fire: false };
let pendingState = null;
let onStartHandler = null;
let onNextLevelHandler = null;
let onPeerHandler = null;

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

function configured() {
  const u = window.NETPLAY_SUPABASE_URL;
  const k = window.NETPLAY_SUPABASE_ANON_KEY;
  return typeof u === "string" && u.length > 10 && typeof k === "string" && k.length > 20;
}

function ensureClient() {
  if (!configured()) return null;
  if (!supabase) {
    supabase = createClient(window.NETPLAY_SUPABASE_URL, window.NETPLAY_SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 30 } },
    });
  }
  return supabase;
}

function handleBroadcast({ payload }) {
  if (!payload || payload.from === myId) return;
  const t = payload.t;
  if (t === "hi") {
    peerPresent = true;
    if (payload.name) window.__netPartnerName = String(payload.name).slice(0, 16);
    if (onPeerHandler) onPeerHandler({ name: payload.name || "Player", host: !!payload.host });
    if (isHost) send({ t: "hi", from: myId, name: window.__netDisplayName || "Player", host: true });
    return;
  }
  if (t === "inp") {
    remoteInput.ix = +payload.ix || 0;
    remoteInput.iy = +payload.iy || 0;
    remoteInput.fire = !!payload.fire;
    return;
  }
  if (t === "st") {
    pendingState = payload.d;
    return;
  }
  if (t === "go") {
    if (onStartHandler) onStartHandler({ levelIndex: payload.lv | 0 });
    return;
  }
  if (t === "nx") {
    if (onNextLevelHandler) onNextLevelHandler();
    return;
  }
}

export async function createParty() {
  const client = ensureClient();
  if (!client) throw new Error("not configured");
  await leaveParty();
  myId = crypto.randomUUID();
  partyCode = genCode();
  isHost = true;
  peerPresent = false;
  remoteInput.ix = remoteInput.iy = 0;
  remoteInput.fire = false;
  channel = client.channel("party-" + partyCode, {
    config: { broadcast: { ack: false }, private: false },
  });
  channel.on("broadcast", { event: "m" }, handleBroadcast);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Subscribe timed out — enable Realtime in Supabase and check your network."));
      }
    }, 25000);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        finish(() => {
          subscribed = true;
          resolve({ code: partyCode, id: myId });
        });
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        finish(() =>
          reject(new Error((err && err.message) || `Realtime: ${status}`))
        );
      }
    });
  });
}

export async function joinParty(code) {
  const client = ensureClient();
  if (!client) throw new Error("not configured");
  const c = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (c.length < 4) throw new Error("invalid code");
  await leaveParty();
  myId = crypto.randomUUID();
  partyCode = c;
  isHost = false;
  peerPresent = false;
  remoteInput.ix = remoteInput.iy = 0;
  remoteInput.fire = false;
  channel = client.channel("party-" + partyCode, {
    config: { broadcast: { ack: false }, private: false },
  });
  channel.on("broadcast", { event: "m" }, handleBroadcast);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Subscribe timed out — enable Realtime in Supabase and check your network."));
      }
    }, 25000);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        finish(() => {
          subscribed = true;
          send({ t: "hi", from: myId, name: window.__netDisplayName || "Player", host: false });
          resolve({ code: partyCode, id: myId });
        });
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        finish(() =>
          reject(new Error((err && err.message) || `Realtime: ${status}`))
        );
      }
    });
  });
}

export function resetRemoteInput() {
  remoteInput.ix = 0;
  remoteInput.iy = 0;
  remoteInput.fire = false;
}

export async function leaveParty() {
  pendingState = null;
  peerPresent = false;
  subscribed = false;
  window.__netPartnerName = "";
  resetRemoteInput();
  if (channel && supabase) {
    try {
      await supabase.removeChannel(channel);
    } catch (_) {}
  }
  channel = null;
}

export function send(payload) {
  if (!channel || !subscribed) return;
  const body = Object.assign({ from: myId }, payload);
  channel.send({ type: "broadcast", event: "m", payload: body }).catch(() => {});
}

export function broadcastGameStart(levelIndex) {
  if (!isHost) return;
  send({ t: "go", lv: levelIndex | 0 });
}

export function broadcastNextLevel() {
  if (!isHost) return;
  send({ t: "nx" });
}

export function sendState(data) {
  if (!isHost) return;
  send({ t: "st", d: data });
}

export function sendInput(ix, iy, fire) {
  if (isHost) return;
  send({ t: "inp", ix, iy, fire: !!fire });
}

export function getRemoteInput() {
  return remoteInput;
}

export function consumePendingState() {
  const p = pendingState;
  pendingState = null;
  return p;
}

export function getPartyCode() {
  return partyCode;
}

export function getIsHost() {
  return isHost;
}

export function isPeerPresent() {
  return peerPresent;
}

export function setHandlers(h) {
  onStartHandler = h && h.onStart;
  onNextLevelHandler = h && h.onNextLevel;
  onPeerHandler = h && h.onPeer;
}

export function netConfigured() {
  return configured();
}

window.GRPParty = {
  createParty,
  joinParty,
  leaveParty,
  resetRemoteInput,
  send,
  broadcastGameStart,
  broadcastNextLevel,
  sendState,
  sendInput,
  getRemoteInput,
  consumePendingState,
  getPartyCode,
  getIsHost,
  isPeerPresent,
  setHandlers,
  netConfigured,
};
