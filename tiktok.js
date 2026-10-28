var SITE = "https://www.tiktok.com";
var PAGES = 3;

var ENGINES = [
  "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/html/?q=",
  "https://html.duckduckgo.com/html/?q=",
  "https://lite.duckduckgo.com/lite/?q="
].filter(function (u) { return env.tor || u.indexOf(".onion/") < 0; });

var failing = {};

function links(text, page) {
  var q = encodeURIComponent(text) + (page > 0 ? "&s=" + page * 30 + "&dc=" + (page * 30 + 1) : "");
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
    var out = [], re = /uddg=([^&"]+)/g, m;
    while ((m = re.exec(html))) out.push(decodeURIComponent(m[1]));
    return out;
  }
  throw last || new Error("Captcha needed (duckduckgo)");
}

function ddg(query, page) {
  var ids = [], seen = {}, failed = 0, last;
  ["site:tiktok.com/video ", "site:tiktok.com "].forEach(function (prefix) {
    var found;
    try {
      found = links(prefix + query, page);
    } catch (e) {
      failed++;
      last = e;
      return;
    }
    found.forEach(function (link) {
      var v = /tiktok\.com\/(?:@[^\/?#]+\/)?video\/(\d+)/.exec(link);
      if (v && !seen[v[1]]) {
        seen[v[1]] = true;
        ids.push(v[1]);
      }
    });
  });
  if (failed == 2) throw last;
  return ids;
}

function search(query, next) {
  var page = next ? parseInt(next, 10) : 0;
  var ids = ddg(query, page);
  var bodies = http.all(ids.map(function (id) {
    return SITE + "/oembed?url=" + encodeURIComponent(SITE + "/video/" + id);
  }));
  var items = [];
  for (var i = 0; i < ids.length; i++) {
    if (!bodies[i]) continue;
    var o;
    try {
      o = JSON.parse(bodies[i]);
    } catch (e) {
      continue;
    }
    if (!o.author_url) continue;
    items.push({
      url: o.author_url + "/video/" + ids[i],
      title: o.title || "",
      author: o.author_name || "",
      duration: -1,
      thumb: o.thumbnail_url
    });
  }
  return { items: items, next: ids.length && page + 1 < PAGES ? String(page + 1) : null };
}

function canonical(url) {
  if (/(?:vm|vt)\.tiktok\.com\//.test(url)) {
    var to = http.check(url).location;
    if (!to) throw new Error("video unavailable");
    url = to;
  }
  var m = /tiktok\.com\/(@[^\/?#]+)\/video\/(\d+)/.exec(url);
  if (m) return SITE + "/" + m[1] + "/video/" + m[2];
  var id = /video\/(\d+)/.exec(url);
  if (!id) throw new Error("not a video link");
  var o = http.json(SITE + "/oembed?url=" + encodeURIComponent(SITE + "/video/" + id[1]));
  if (!o.author_url) throw new Error("video unavailable");
  return o.author_url + "/video/" + id[1];
}

function detail(url) {
  var page = http.page(canonical(url));
  var m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(page.body);
  if (!m) throw new Error("Captcha needed (tiktok page without data)");
  var scope = JSON.parse(m[1])["__DEFAULT_SCOPE__"] || {};
  var d = scope["webapp.video-detail"];
  if (!d || d.statusCode !== 0 || !d.itemInfo) throw new Error("video unavailable");
  return { item: d.itemInfo.itemStruct, cookies: page.cookies };
}

function resolve(url) {
  var d = detail(url);
  var video = d.item.video || {};
  if (!video.playAddr) throw new Error("no stream");
  var author = d.item.author || {};
  return {
    url: video.playAddr,
    hls: false,
    title: d.item.desc || "",
    author: author.nickname || author.uniqueId || "",
    referer: SITE + "/",
    cookie: d.cookies
  };
}

function tags(url) {
  var d = detail(url);
  var out = [];
  (d.item.challenges || []).forEach(function (c) { if (c.title) out.push(c.title); });
  return { tags: out };
}
