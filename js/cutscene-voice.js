/**
 * Cutscene dialogue via Web Speech API (browser TTS). Same text as on screen.
 * Works on HTTPS (e.g. Vercel); requires a user gesture before first speak (Play flow satisfies this).
 */
(function () {
  "use strict";

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  function getVoices() {
    if (!synth) return [];
    try {
      return synth.getVoices();
    } catch (_) {
      return [];
    }
  }

  function pickVoice(speaker) {
    const list = getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
    if (list.length === 0) return getVoices()[0] || null;

    const nameMatch = (re) => list.find((v) => re.test(v.name));

    if (speaker === "overserver") {
      return (
        nameMatch(/male|daniel|fred|thomas|david|arthur|james|mark|richard/i) ||
        list[Math.min(list.length - 1, Math.floor(list.length * 0.72))]
      );
    }
    if (speaker === "nova") {
      return (
        nameMatch(/female|samantha|victoria|karen|susan|zira|sarah|linda|hazel/i) ||
        list[Math.min(list.length - 1, Math.floor(list.length * 0.28))]
      );
    }
    if (speaker === "system") {
      return nameMatch(/zira|samantha|microsoft/i) || list[0];
    }
    if (speaker === "director") {
      return (
        nameMatch(/male|daniel|fred|thomas|david|james|mark/i) ||
        list[Math.min(list.length - 1, Math.floor(list.length * 0.55))]
      );
    }
    return list[Math.floor(list.length * 0.45)] || list[0];
  }

  function speak(speaker, text) {
    if (!synth || !text) return;
    try {
      synth.cancel();
    } catch (_) {}

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const v = pickVoice(speaker);
    if (v) u.voice = v;

    if (speaker === "overserver") {
      u.pitch = 0.74;
      u.rate = 0.9;
    } else if (speaker === "nova") {
      u.pitch = 1.06;
      u.rate = 1.03;
    } else if (speaker === "system") {
      u.pitch = 0.92;
      u.rate = 0.93;
    } else if (speaker === "director") {
      u.pitch = 0.84;
      u.rate = 0.94;
    } else {
      u.pitch = 1;
      u.rate = 0.98;
    }

    try {
      synth.speak(u);
    } catch (_) {}
  }

  function cancel() {
    if (!synth) return;
    try {
      synth.cancel();
    } catch (_) {}
  }

  if (synth) {
    try {
      getVoices();
    } catch (_) {}
    synth.onvoiceschanged = function () {
      try {
        getVoices();
      } catch (_) {}
    };
  }

  window.GRPCutsceneVoice = { speak, cancel, getVoices };
})();
