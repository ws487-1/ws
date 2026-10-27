/* Channel engine: a 24/7 "TV channel" made from a list of YouTube videos.
   Only the video IDs are stored. Titles and lengths are read from YouTube
   when the page loads (and cached in the browser). Everyone sees the same
   video at the same point, because the schedule comes from the server clock. */
(function () {
  // Default list. Add YouTube IDs or full links, one per entry.
  const DEFAULT_IDS = [
    "DXCtYUtjDYU",
    "uURB-vo9rZ4",
    "esqRBsVumrw",
    "tmozGmGoJuw",
    "5ZT3gTu4Sjw",
    "eBG7P-K-r1Y",
    "b3PvUHjoUJA",
  ];

  // The channel "started" at this moment. Never change it once live,
  // or everyone's schedule jumps.
  const EPOCH = Date.UTC(2026, 0, 1);

  const META_KEY = "channelMetaV1";
  const IDS_KEY = "channelCustomIds";

  /* ---------- IDs / URLs ---------- */
  function parseIds(text) {
    const out = [], seen = new Set();
    String(text || "").split(/[\s,]+/).forEach((tok) => {
      if (!tok) return;
      let id = null;
      const m = tok.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
      if (m) id = m[1];
      else if (/^[A-Za-z0-9_-]{11}$/.test(tok)) id = tok;
      if (id && !seen.has(id)) { seen.add(id); out.push(id); }
    });
    return out;
  }
  const getCustomText = () => localStorage.getItem(IDS_KEY) || "";
  function setCustomText(text) {
    if (parseIds(text).length) localStorage.setItem(IDS_KEY, text);
    else localStorage.removeItem(IDS_KEY);
  }
  function getIds() {
    const c = parseIds(getCustomText());
    return c.length ? c : DEFAULT_IDS.slice();
  }

  /* ---------- YouTube API loader ---------- */
  const ytCallbacks = [];
  function loadYT(cb) {
    if (window.YT && YT.Player) { cb(); return; }
    ytCallbacks.push(cb);
    if (document.getElementById("yt-api")) return;
    window.onYouTubeIframeAPIReady = () => ytCallbacks.splice(0).forEach((f) => f());
    const t = document.createElement("script");
    t.id = "yt-api";
    t.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(t);
  }

  /* ---------- video details (length + title), cached ---------- */
  function readCache() { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch (e) { return {}; } }
  function writeCache(c) { try { localStorage.setItem(META_KEY, JSON.stringify(c)); } catch (e) {} }

  // Cues each video in a hidden player just long enough to read its length and title.
  async function fetchMissing(missing, onProgress) {
    const result = {};
    if (!missing.length) return result;
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;height:113px;overflow:hidden;visibility:hidden";
    const inner = document.createElement("div");
    holder.appendChild(inner);
    document.body.appendChild(holder);
    let cur = null, p;
    await new Promise((res) => {
      p = new YT.Player(inner, {
        width: 200, height: 113, host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, mute: 1, origin: location.origin },
        events: {
          onReady: res,
          onStateChange: (e) => { if (cur && e.data === 5) cur.cued(); },
          onError: () => { if (cur) cur.fail(); },
        },
      });
    });
    for (const id of missing) {
      result[id] = await new Promise((resolve) => {
        let done = false, iv = null;
        const to = setTimeout(() => finish(null), 9000);
        function finish(v) {
          if (done) return;
          done = true; cur = null; clearTimeout(to); clearInterval(iv); resolve(v);
        }
        cur = {
          cued: () => {
            iv = setInterval(() => {
              const d = p.getDuration();
              if (d > 0) finish({ d: Math.round(d), t: ((p.getVideoData() || {}).title) || id });
            }, 150);
          },
          fail: () => finish(null),
        };
        p.cueVideoById(id);
      });
      if (onProgress) onProgress(Object.keys(result).length, missing.length);
    }
    try { p.destroy(); } catch (e) {}
    holder.remove();
    return result;
  }

  /* ---------- seeded shuffle ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ================= the channel ================= */
  function create(opts) {
    const api = {};
    const MIN_GAP = 3000;   // never load a new video more often than every 3s
    const MAX_FAILURES = 5; // give up after this many failures in a row
    const bad = new Set();  // videos that failed to play in this visit
    let vids = [], TOTAL = 0, clockOffset = 0;
    let player, timer, skip = 0, lastLoad = 0, failures = 0, stopped = false, started = false, current = null;
    let audio = { volume: opts.volume != null ? opts.volume : 80, muted: !!opts.muted };
    const say = (f, ...a) => { if (typeof opts[f] === "function") opts[f](...a); };
    const now = () => Date.now() + clockOffset;

    // Use the server's clock, not the visitor's.
    async function syncClock() {
      try {
        const t0 = Date.now();
        const r = await fetch(location.pathname + "?t=" + t0, { method: "HEAD", cache: "no-store" });
        const t1 = Date.now();
        const d = r.headers.get("Date");
        if (d) clockOffset = new Date(d).getTime() + (t1 - t0) / 2 - t1;
      } catch (e) { /* fall back to the local clock */ }
    }

    function rawShuffle(cycle) {
      const rand = mulberry32(cycle + 1);
      const list = vids.slice();
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    }
    function orderForCycle(cycle) { // each loop through the list has its own order
      const list = rawShuffle(cycle);
      // avoid the same video playing twice in a row across two loops
      if (vids.length > 2 && list[0].id === rawShuffle(cycle - 1).slice(-1)[0].id) {
        [list[0], list[1]] = [list[1], list[0]];
      }
      return list;
    }
    // What is on at time ms, how far in (seconds) and when it started.
    function scheduleAt(ms) {
      const t = (ms - EPOCH) / 1000;
      const cycle = Math.floor(t / TOTAL);
      let offset = t - cycle * TOTAL;
      const order = orderForCycle(cycle);
      let i = 0;
      while (i < order.length - 1 && offset >= order[i].duration) { offset -= order[i].duration; i++; }
      return { video: order[i], offset, startMs: ms - offset * 1000, cycle, index: i };
    }
    function upcoming(count) {
      const out = [];
      const cur = scheduleAt(now());
      let t = cur.startMs + cur.video.duration * 1000;
      while (out.length < count) {
        const s = scheduleAt(t + 1);
        out.push({ video: s.video, at: s.startMs });
        t = s.startMs + s.video.duration * 1000;
      }
      return out;
    }

    function applyAudio() {
      if (!player || !player.setVolume) return;
      player.setVolume(audio.volume);
      if (started) { audio.muted ? player.mute() : player.unMute(); }
    }

    function play() {
      clearTimeout(timer);
      if (stopped || !player) return;
      const wait = lastLoad + MIN_GAP - Date.now();
      if (wait > 0) { timer = setTimeout(play, wait); return; }
      lastLoad = Date.now();

      const s = scheduleAt(now());
      let video = s.video, offset = s.offset, startMs = s.startMs;
      // If this video can't play (or ended early), use the next playable one.
      let k = skip;
      let cand = k === 0 ? { video: s.video, at: s.startMs } : upcoming(k)[k - 1];
      let guard = 0;
      while (bad.has(cand.video.id) && guard++ < vids.length) { k++; cand = upcoming(k)[k - 1]; }
      if (k > 0) { video = cand.video; offset = 0; startMs = now(); }

      current = { video, startMs };
      say("onNow", current);
      player.loadVideoById({ videoId: video.id, startSeconds: Math.floor(offset) });
      const remaining = Math.max(video.duration - offset, 1);
      timer = setTimeout(() => { skip = 0; play(); }, remaining * 1000 + 500); // re-sync when this slot ends
    }

    function createPlayer() {
      const s = scheduleAt(now());
      player = new YT.Player(opts.playerEl, {
        host: "https://www.youtube-nocookie.com",
        videoId: s.video.id,
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1,
          cc_load_policy: 0, iv_load_policy: 3, fs: 0, color: "white",
          origin: location.origin, start: Math.floor(s.offset),
        },
        events: {
          onReady: () => { applyAudio(); play(); },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              failures = 0;
              try { player.unloadModule("captions"); player.unloadModule("cc"); } catch (x) {}
            }
            if (e.data === YT.PlayerState.PAUSED) player.playVideo();
            if (e.data === YT.PlayerState.ENDED) { skip++; play(); } // ended before its slot did
          },
          onError: (e) => {
            if (current) bad.add(current.video.id);
            skip = 0;
            failures++;
            if (failures >= MAX_FAILURES) {
              stopped = true; clearTimeout(timer);
              say("onMessage", "Can't play right now (YouTube error " + e.data + "). Try again in a moment.");
              return;
            }
            play();
          },
        },
      });
    }

    api.upcoming = upcoming;
    api.now = now;
    api.videos = () => vids.slice();
    api.setAudio = (volume, muted) => { audio = { volume, muted }; applyAudio(); };
    api.userInteracted = () => { started = true; applyAudio(); };
    api.resync = () => { skip = 0; failures = 0; stopped = false; bad.clear(); say("onMessage", null); lastLoad = 0; play(); };

    // Start up: clock, video details, then the player.
    (async function boot() {
      say("onStatus", "Loading...");
      await new Promise(loadYT);
      await syncClock();
      const ids = opts.ids || getIds();
      const cache = readCache();
      const missing = ids.filter((id) => !cache[id]);
      if (missing.length) {
        say("onStatus", "Loading video details...");
        const got = await fetchMissing(missing, (n, total) => say("onStatus", "Loading video details (" + n + "/" + total + ")..."));
        Object.keys(got).forEach((id) => { if (got[id]) cache[id] = got[id]; });
        writeCache(cache);
      }
      const skipped = [];
      vids = [];
      ids.forEach((id) => {
        const m = cache[id];
        if (m && m.d > 0) vids.push({ id, duration: m.d, title: m.t });
        else skipped.push(id);
      });
      say("onSkipped", skipped);
      if (!vids.length) { say("onStatus", "No playable videos."); say("onMessage", "None of the videos could be loaded."); return; }
      TOTAL = vids.reduce((s, v) => s + v.duration, 0);
      say("onLoaded", vids);
      createPlayer();
    })();

    return api;
  }

  window.Channel = { create, parseIds, getIds, getCustomText, setCustomText, DEFAULT_IDS };
})();
