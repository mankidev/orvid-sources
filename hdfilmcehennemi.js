var SITE = "https://www.hdfilmcehennemi.nl";
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function atob(s) {
  s = String(s).replace(/[^A-Za-z0-9+\/]/g, "");
  var out = "", bits = 0, value = 0;
  for (var i = 0; i < s.length; i++) {
    value = (value << 6) | B64.indexOf(s.charAt(i));
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 255);
    }
  }
  return out;
}

function btoa(s) {
  var out = "";
  for (var i = 0; i < s.length; i += 3) {
    var a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
    out += B64.charAt(a >> 2) + B64.charAt(((a & 3) << 4) | (b >> 4))
        + (isNaN(b) ? "=" : B64.charAt(((b & 15) << 2) | (c >> 6))) + (isNaN(c) ? "=" : B64.charAt(c & 63));
  }
  return out;
}

var NAMED = { uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", ccedil: "ç", Ccedil: "Ç", auml: "ä", Auml: "Ä", szlig: "ß",
  eacute: "é", Eacute: "É", egrave: "è", ecirc: "ê", aacute: "á", agrave: "à", acirc: "â", iacute: "í", icirc: "î",
  oacute: "ó", ocirc: "ô", uacute: "ú", ucirc: "û", ntilde: "ñ", Ntilde: "Ñ", hellip: "…", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " " };

function text(s) {
  return String(s || "").replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&([a-zA-Z]+);/g, function (m, n) { return NAMED.hasOwnProperty(n) ? NAMED[n] : m; })
      .replace(/\s+/g, " ").trim();
}

function search(query, next) {
  query = query.replace(/(^|\s)(film|filmi|filmini|movie|movies)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  if (!query) return { items: [], next: null };
  var root = http.json(SITE + "/search?q=" + encodeURIComponent(query), { "X-Requested-With": "fetch", "Content-Type": "application/json" });
  var items = [];
  (root.results || []).forEach(function (h) {
    var link = h.match(/href="(https:\/\/www\.hdfilmcehennemi\.nl\/[^"]+\/)"/);
    var type = h.match(/<span class="type">([^<]+)<\/span>/);
    if (!link || !type || type[1].trim() != "Film") return;
    var title = h.match(/<h4 class="title">([^<]+)<\/h4>/);
    var year = h.match(/<span class="year">(\d{4})<\/span>/);
    var thumb = h.match(/ src="(https:\/\/[^"]+)"/);
    items.push({
      url: link[1],
      title: (title ? text(title[1]) : "") + (year ? " (" + year[1] + ")" : ""),
      author: "",
      duration: -1,
      views: -1,
      kind: "movie",
      thumb: thumb ? thumb[1].replace("/images/thumb/poster/", "/images/list/poster/").replace(/(@2x)?\.webp$/, "@2x.webp") : null
    });
  });
  return { items: items, next: null };
}

function decode(html, host) {
  var name = html.match(/file:\s*([A-Za-z0-9_$]+)\s*,\s*type:\s*"hls"/);
  if (!name) return null;
  var scripts = html.match(/<script type="text\/javascript">[\s\S]*?<\/script>/g) || [];
  var assign = new RegExp("var " + name[1].replace(/\$/g, "\\$") + "\\s*=\\s*[A-Za-z0-9_$]+\\([^;]*\\);");
  for (var i = 0; i < scripts.length; i++) {
    var m = assign.exec(scripts[i]);
    if (!m) continue;
    var body = scripts[i].replace(/^<script type="text\/javascript">/, "");
    body = body.substring(0, body.indexOf(m[0]) + m[0].length);
    var location = { hostname: host, host: host, href: "https://" + host + "/", protocol: "https:", origin: "https://" + host };
    var document = { referrer: SITE + "/", cookie: "", domain: host, location: location };
    var navigator = { userAgent: "Mozilla/5.0", language: "tr-TR" };
    var win = { location: location, document: document, navigator: navigator, atob: atob, btoa: btoa };
    win.window = win;
    win.self = win;
    win.top = win;
    var run = new Function("http", "util", "cache", "env", "__get", "__post", "__check", "__all", "__page",
        "__cacheGet", "__cachePut", "__call", "location", "document", "navigator", "window", "self", "top", "atob", "btoa",
        body + "\nreturn " + name[1] + ";");
    return String(run(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, location, document, navigator, win, win, win, atob, btoa));
  }
  return null;
}

var LANGS = { turkish: "tr", english: "en", french: "fr", german: "de", spanish: "es", italian: "it", russian: "ru", arabic: "ar" };

function tracks(html) {
  var m = html.match(/tracks:\s*(\[[^\]]*\])/);
  if (!m) return [];
  var list;
  try { list = JSON.parse(m[1]); } catch (e) { return []; }
  var out = [];
  list.forEach(function (t) {
    if (!t || !t.file || (t.kind && t.kind != "captions" && t.kind != "subtitles")) return;
    var label = text(t.label || "");
    var key = label.toLowerCase();
    var lang = LANGS[key] || (t.file.match(/-([a-z]{2})-[^\/]*\.vtt/) || [])[1] || null;
    out.push({ url: t.file, lang: lang, label: label });
  });
  return out;
}

function resolve(url) {
  var page = http.get(url);
  var frame = page.match(/data-src="(https:\/\/[^"]+\/video\/embed\/[^"]+)"/) || page.match(/<iframe[^>]+src="(https:\/\/[^"]+\/video\/embed\/[^"]+)"/);
  if (!frame) throw new Error("video unavailable");
  var embed = frame[1].replace(/&amp;/g, "&");
  var host = embed.match(/^https:\/\/([^\/]+)/)[1];
  var html = http.get(embed, { Referer: url });
  var media = decode(html, host);
  if (!media || !/^https?:\/\//.test(media)) throw new Error("video unavailable");
  var title = page.match(/<meta property="og:title" content="([^"]*)"/);
  return { url: media, hls: true, referer: "https://" + host + "/", title: title ? text(title[1]) : "", subtitles: tracks(html) };
}
