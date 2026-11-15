var SITE = "https://miruro.to";
var EXPLICIT = /\b(hentai|xxx|porn\w*|erotic\w*|uncensored)\b/i;
var EPISODE = /^(.*\S)\s+(?:ep|eps|episode|episodio|épisode|folge|bölüm|bolum|серия|эпизод)\.?\s*(\d{1,4})$/i;
var LANGS = { english: "en", turkish: "tr", german: "de", french: "fr", spanish: "es", italian: "it", portuguese: "pt",
  russian: "ru", arabic: "ar", persian: "fa", dutch: "nl", polish: "pl", romanian: "ro", greek: "el", hebrew: "he",
  hungarian: "hu", czech: "cs", swedish: "sv", norwegian: "no", danish: "da", finnish: "fi", bulgarian: "bg",
  croatian: "hr", serbian: "sr", japanese: "ja", korean: "ko", chinese: "zh", indonesian: "id", indonesia: "id", vietnamese: "vi",
  thai: "th", hindi: "hi", ukrainian: "uk", malay: "ms", melayu: "ms", catalan: "ca", tagalog: "tl", filipino: "tl" };

function unflatten(arr) {
  var memo = {};
  function hydrate(i) {
    if (i < 0) return null;
    if (memo.hasOwnProperty(i)) return memo[i];
    var v = arr[i];
    var r;
    if (v instanceof Array) {
      if (v.length && typeof v[0] == "string") {
        memo[i] = v[0] == "Date" ? v[1] : null;
        return memo[i];
      }
      r = [];
      memo[i] = r;
      for (var k = 0; k < v.length; k++) r.push(hydrate(v[k]));
      return r;
    }
    if (v && typeof v == "object") {
      r = {};
      memo[i] = r;
      for (var key in v) if (v.hasOwnProperty(key)) r[key] = hydrate(v[key]);
      return r;
    }
    memo[i] = v;
    return v;
  }
  return hydrate(0);
}

function payloads(text) {
  var out = [];
  var lines = String(text).split("\n");
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    var d = JSON.parse(lines[i]);
    if (d.type == "redirect") out.push({ redirect: d.location });
    else if (d.type == "chunk") out.push(unflatten(d.data));
    else if (d.type == "data") {
      (d.nodes || []).forEach(function (n) {
        if (n && n.data) out.push(unflatten(n.data));
      });
    }
  }
  return out;
}

function name(t) {
  if (!t) return "";
  return t.english || t.romaji || t.native || "";
}

function original(t, shown) {
  var romaji = t && t.romaji ? String(t.romaji) : "";
  if (!romaji || romaji.toLowerCase() == String(shown).toLowerCase()) return "";
  return romaji;
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "anime";
}

function search(query, next) {
  var q = query.replace(/(^|\s)(anime|animes|izle)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  var episode = 0;
  var m = q.match(EPISODE);
  if (m) {
    q = m[1];
    episode = parseInt(m[2], 10);
  }
  if (!q) return { items: [], next: null };
  var root = payloads(http.get(SITE + "/search/__data.json?q=" + encodeURIComponent(q) + (next ? "&cursor=" + encodeURIComponent(next) : "")));
  var page = null;
  for (var i = 0; i < root.length; i++) {
    if (root[i] && root[i].items instanceof Array && root[i].mode) page = root[i];
  }
  if (!page) throw new Error("search failed");
  var items = [];
  page.items.forEach(function (a) {
    if (!a || !a.id || a.is_adult) return;
    var title = name(a.title);
    if (!title || EXPLICIT.test(title) || EXPLICIT.test(a.description || "")) return;
    var counts = a.episode_counts || {};
    var have = Math.max(counts.sub || 0, counts.dub || 0);
    if (!have) return;
    var ep = episode > 0 && episode <= have ? episode : 1;
    var series = a.format != "MOVIE" && (a.episode_count || have) > 1;
    items.push({
      url: SITE + "/watch/" + a.id + "/" + slug(a.title && a.title.romaji || title) + "?ep=" + ep,
      title: series ? title + " - Episode " + ep : title,
      author: original(a.title, title) || (a.season_year ? (a.format || "Anime") + " " + a.season_year : (a.format || "Anime")),
      duration: a.episode_duration_minutes > 0 ? a.episode_duration_minutes * 60 : -1,
      views: -1,
      kind: a.format == "MOVIE" ? "movie" : null,
      thumb: a.banner_url || a.background_url || a.cover_url || null
    });
  });
  return { items: items, next: page.hasMore && page.nextCursor ? String(page.nextCursor) : null };
}

function providers(sources, track) {
  var out = [];
  (sources.tracks || []).forEach(function (t) {
    if (t && t.track == track) (t.providers || []).forEach(function (p) {
      var found = playable(p);
      if (found) out.push(found);
    });
  });
  return out;
}

function playable(provider) {
  var streams = [];
  (provider.servers || []).forEach(function (s) {
    var ref = s.headers && (s.headers.Referer || s.headers.Origin) || null;
    (s.streams || []).forEach(function (st) {
      if (st && st.url && (st.format == "hls" || /\.m3u8/.test(st.url))) streams.push({ url: st.url, referer: ref });
    });
  });
  if (!streams.length) return null;
  var main = streams[0];
  var fallback = null;
  for (var i = 1; i < streams.length; i++) {
    if (streams[i].referer == main.referer && streams[i].url != main.url) {
      fallback = streams[i].url;
      break;
    }
  }
  return { url: main.url, referer: main.referer, fallback: fallback, captions: provider.subtitles || [] };
}

function language(c) {
  var label = String(c.label || "");
  var word = label.toLowerCase().replace(/^bahasa\s+/, "").match(/^[a-z]+/);
  if (word && LANGS[word[0]]) return LANGS[word[0]];
  return null;
}

function subtitles(found) {
  var picked = [];
  var seen = {};
  found.captions.forEach(function (c) {
    if (!c || !c.file || /forced|signs/i.test(c.label || "")) return;
    var lang = language(c);
    var key = lang || c.label || c.file;
    if (seen[key] >= (lang == "en" ? 3 : 1) || picked.length >= 12) return;
    seen[key] = (seen[key] || 0) + 1;
    picked.push({ url: c.file, lang: lang, label: c.label || lang || "" });
  });
  if (!picked.length) return [];
  var heads = {};
  if (found.referer) heads.Referer = found.referer;
  if (found.referer) heads.Origin = found.referer.replace(/\/$/, "");
  heads.Range = "bytes=0-255";
  var bodies = http.all(picked.map(function (c) { return c.url; }), heads);
  var out = [];
  for (var i = 0; i < picked.length; i++) {
    var head = String(bodies[i] || "").replace(/^\uFEFF/, "").replace(/^\s+/, "");
    if (/^WEBVTT/.test(head)) out.push(picked[i]);
    else if (/^\d+\s*\r?\n\s*\d+:\d\d:\d\d[,.]\d+\s*-->/.test(head)) {
      picked[i].url += "#.srt";
      out.push(picked[i]);
    }
  }
  return out;
}

function pick(sources) {
  var soft = providers(sources, "ssub");
  var firstSoft = null;
  for (var i = 0; i < soft.length; i++) {
    if (!soft[i].captions.length) continue;
    soft[i].subtitles = subtitles(soft[i]);
    var english = soft[i].subtitles.some(function (c) { return c.lang == "en"; });
    if (english) return soft[i];
    if (!firstSoft && soft[i].subtitles.length) firstSoft = soft[i];
    break;
  }
  var hard = providers(sources, "sub");
  if (hard.length) {
    hard[0].subtitles = [];
    return hard[0];
  }
  if (firstSoft) return firstSoft;
  if (soft.length) {
    soft[0].subtitles = soft[0].subtitles || [];
    return soft[0];
  }
  var dub = providers(sources, "dub");
  if (dub.length) {
    dub[0].subtitles = [];
    return dub[0];
  }
  return null;
}

function resolve(url) {
  var m = url.match(/\/watch\/([A-Za-z0-9_-]+)\/([^?#\/]+)(?:\?[^#]*?\bep=(\d+))?/);
  if (!m) throw new Error("video unavailable");
  var ep = m[3] || "1";
  var path = "/watch/" + m[1] + "/" + m[2];
  var root = payloads(http.get(SITE + path + "/__data.json?ep=" + ep + "&x-sveltekit-invalidated=01"));
  if (root.length == 1 && root[0].redirect) {
    var moved = String(root[0].redirect).match(/^(\/watch\/[A-Za-z0-9_-]+\/[^?#\/]+)/);
    if (!moved || moved[1] == path) throw new Error("video unavailable");
    root = payloads(http.get(SITE + moved[1] + "/__data.json?ep=" + ep + "&x-sveltekit-invalidated=01"));
  }
  var sources = null;
  var media = null;
  var episode = null;
  for (var i = 0; i < root.length; i++) {
    var d = root[i];
    if (!d) continue;
    if (d.redirect) throw new Error("video unavailable");
    if (d.tracks instanceof Array) sources = d;
    if (d.media && d.media.title) media = d.media;
    if (d.currentEpisode) episode = d.currentEpisode;
  }
  if (!sources) throw new Error("video unavailable");
  var found = pick(sources);
  if (!found) throw new Error("video unavailable");
  var title = media ? name(media.title) : "";
  if (title && media.format != "MOVIE" && (media.episodes || 0) != 1) {
    title += " - Episode " + ep + (episode && episode.title ? ": " + episode.title : "");
  }
  var out = { url: found.url, hls: true, referer: found.referer, title: title, author: "Miruro", subtitles: found.subtitles || [] };
  if (found.fallback) out.fallback = { url: found.fallback, hls: true };
  return out;
}

function tags(url) {
  var m = url.match(/\/watch\/[A-Za-z0-9_-]+\/([^?#\/]+)/);
  return { tags: m ? [m[1].replace(/-/g, " ")] : [] };
}
