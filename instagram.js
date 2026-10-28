var SITE = "https://www.instagram.com";
var PAGES = 3;
var BOT = { "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)" };
var FIXERS = ["https://www.kkinstagram.com/reel/", "https://www.uuinstagram.com/videos/", "https://www.eeinstagram.com/videos/"];
var INFO = ["https://www.eeinstagram.com/reel/", "https://www.uuinstagram.com/reel/"];
var ENGINES = [
  "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/html/?q=",
  "https://html.duckduckgo.com/html/?q=",
  "https://lite.duckduckgo.com/lite/?q="
].filter(function (u) { return env.tor || u.indexOf(".onion/") < 0; });

var failing = {};

function links(phrase, page) {
  var q = encodeURIComponent(phrase) + (page > 0 ? "&s=" + page * 30 + "&dc=" + (page * 30 + 1) : "");
  var last;
  for (var e = 0; e < ENGINES.length; e++) {
    if (failing[e]) continue;
    var html;
    try {
      html = http.get(ENGINES[e] + q);
    } catch (err) {
      failing[e] = true;
      last = err;
      continue;
    }
    if (html.indexOf("anomaly-modal") >= 0 || html.indexOf("bots use DuckDuckGo") >= 0) {
      failing[e] = true;
      last = new Error("Captcha needed (duckduckgo)");
      continue;
    }
    var out = [], re = /<a[^>]*uddg=([^&"']+)[^>]*>([\s\S]*?)<\/a>/g, m, hits = [];
    while ((m = re.exec(html))) hits.push({ at: m.index, end: re.lastIndex, url: decodeURIComponent(m[1]), title: text(m[2]) });
    for (var h = 0; h < hits.length; h++) {
      var until = h + 1 < hits.length ? hits[h + 1].at : html.length;
      var snippet = /class=['"]result(?:__|-)snippet['"][^>]*>([\s\S]*?)<\/(?:a|td)>/.exec(html.substring(hits[h].end, until));
      if (hits[h].title) out.push({ url: hits[h].url, title: hits[h].title, snippet: snippet ? text(snippet[1]) : "" });
    }
    return out;
  }
  throw last || new Error("Captcha needed (duckduckgo)");
}

function char(code) {
  if (code < 0x10000) return String.fromCharCode(code);
  code -= 0x10000;
  return String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
}

function text(html) {
  var plain = html.replace(/<[^>]+>/g, "")
      .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return char(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return char(parseInt(d, 10)); });
  return util.unescape(plain).replace(/\s+/g, " ").trim();
}

var MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9,
  October: 10, November: 11, December: 12 };

function item(code, title, snippet) {
  var parts = title.replace(/\s*[|-]\s*Instagram\s*$/, "").split(" | ");
  var caption = parts.length > 1 ? parts.slice(1).join(" | ") : parts[0];
  var s = /- ([A-Za-z0-9_.]+) on ([A-Z][a-z]+) (\d{1,2}), (\d{4}): "([\s\S]*)/.exec(snippet);
  var date;
  if (s && MONTHS[s[2]]) date = s[4] + "-" + ("0" + MONTHS[s[2]]).slice(-2) + "-" + ("0" + s[3]).slice(-2);
  if (s && s[5]) caption = s[5].replace(/"\.?$/, "");
  return {
    url: SITE + "/reel/" + code + "/",
    title: caption.replace(/\s*\.\.\.\s*$/, "") || "Instagram reel",
    author: s ? "@" + s[1] : parts.length > 1 ? parts[0] : "",
    duration: -1,
    thumb: SITE + "/p/" + code + "/media/?size=m",
    date: date
  };
}

function meta(html, name) {
  var m = new RegExp('(?:property|name)="' + name + '" content="([^"]*)"').exec(html || "");
  return m ? util.unescape(m[1]) : "";
}

function search(query, next) {
  var page = next ? parseInt(next, 10) : 0;
  var items = [], seen = {}, failed = 0, last;
  ["site:instagram.com/reel ", "site:instagram.com/reels "].forEach(function (prefix) {
    var found;
    try {
      found = links(prefix + query, page);
    } catch (e) {
      failed++;
      last = e;
      return;
    }
    found.forEach(function (r) {
      var c = /instagram\.com\/(?:[^\/?#]+\/)?reels?\/([A-Za-z0-9_-]{6,})/.exec(r.url);
      if (c && !seen[c[1]]) {
        seen[c[1]] = true;
        items.push(item(c[1], r.title, r.snippet));
      }
    });
  });
  if (failed == 2) throw last;
  return { items: items, next: items.length && page + 1 < PAGES ? String(page + 1) : null };
}

function code(url) {
  var m = /instagram\.com\/(?:[^\/?#]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]{6,})/.exec(url);
  if (!m) throw new Error("not a video link");
  return m[1];
}

function resolve(url) {
  var c = code(url);
  var last;
  for (var i = 0; i < FIXERS.length; i++) {
    try {
      var to = http.check(FIXERS[i] + c + (i == 0 ? "/" : "/1"), BOT).location;
      if (to && /\.(?:jpe?g|webp|heic)(?:\?|$)/.test(to)) throw new Error("video unavailable without login");
      if (to && /\.mp4(?:\?|$)/.test(to)) {
        var info = "";
        try {
          info = http.get(INFO[0] + c + "/", BOT);
        } catch (e) {
        }
        return {
          url: to,
          hls: false,
          title: meta(info, "og:description").split("\n")[0],
          author: meta(info, "twitter:title")
        };
      }
      last = new Error("video unavailable");
    } catch (e) {
      if (/without login/.test(String(e))) throw e;
      last = e;
    }
  }
  throw last;
}

function tags(url) {
  var html = http.get(INFO[0] + code(url) + "/", BOT);
  var out = [], re = /#([^\s#&]+)/g, m;
  var text = meta(html, "og:description");
  while ((m = re.exec(text)) && out.length < 6) out.push(m[1]);
  return { tags: out };
}
