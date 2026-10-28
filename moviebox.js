var API = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
var WEB = "https://movieboxhd.net";
var EXPLICIT = /\b(xxx|porn\w*|erotic\w*|fuck\w*|cunt|nude|nudes)\b/i;

function token() {
  var known = cache.get("token");
  if (known) return known;
  var r = http.page(API + "/home?host=movieboxhd.net", { Origin: WEB, Referer: WEB + "/" });
  var m = String(r.cookies || "").match(/(?:^|;\s*)token=([^;]+)/);
  if (!m) throw new Error("no session");
  cache.put("token", m[1], 6 * 3600 * 1000);
  return m[1];
}

function headers(referer) {
  var t = token();
  return { Origin: WEB, Referer: referer || WEB + "/", Authorization: "Bearer " + t, Cookie: "token=" + t };
}

function search(query, next) {
  query = query.replace(/(^|\s)(film|filmi|filmini|movie|movies)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  if (!query) return { items: [], next: null };
  var page = next ? parseInt(next, 10) : 1;
  var h = headers();
  h["Content-Type"] = "application/json";
  var root = JSON.parse(http.post(API + "/subject/search",
      JSON.stringify({ keyword: query, page: page, perPage: 24, subjectType: 1 }), "application/json", h));
  if (root.code !== 0 || !root.data) throw new Error("search failed");
  var items = [];
  (root.data.items || []).forEach(function (it) {
    if (it.subjectType !== 1 || !it.hasResource || it.isPornographic) return;
    if (/\b(adult|erotic|hot)\b/i.test(it.genre || "") || EXPLICIT.test(it.title || "")) return;
    var year = (it.releaseDate || "").substring(0, 4);
    var wide = it.stills && it.stills.url ? it.stills.url : it.trailer && it.trailer.cover ? it.trailer.cover.url : null;
    items.push({
      url: WEB + "/movies/" + it.detailPath + "?id=" + it.subjectId,
      title: it.title + (/^\d{4}$/.test(year) ? " (" + year + ")" : ""),
      author: it.genre ? it.genre.split(",")[0] : "",
      duration: it.duration > 0 ? it.duration : -1,
      views: -1,
      kind: "movie",
      thumb: wide || (it.cover ? it.cover.url : null)
    });
  });
  var pager = root.data.pager || {};
  return { items: items, next: pager.hasMore ? String(page + 1) : null };
}

function resolve(url) {
  var path = url.match(/\/movies\/([^?#\/]+)/);
  var id = url.match(/[?&]id=(\d+)/);
  if (!path || !id) throw new Error("video unavailable");
  var page = WEB + "/movies/" + path[1];
  var q = "?subjectId=" + id[1] + "&se=0&ep=0&detailPath=" + encodeURIComponent(path[1]);
  var play = JSON.parse(http.get(API + "/subject/play" + q, headers(page)));
  var streams = play.data && play.data.streams || [];
  var qualities = [];
  streams.forEach(function (s) {
    if (s.url && !s.vipLocked && s.format == "MP4") qualities.push({ url: s.url, height: parseInt(s.resolutions, 10) || 0 });
  });
  var subtitles = [];
  try {
    var down = JSON.parse(http.get(API + "/subject/download" + q, headers(page)));
    var d = down.data || {};
    (d.downloads || []).forEach(function (s) {
      if (s.url && !s.vipLocked && s.codecName == "h264") qualities.push({ url: s.url, height: s.resolution || 0 });
    });
    (d.captions || []).forEach(function (c) {
      if (c.url) subtitles.push({ url: c.url, lang: String(c.lan || "").replace(/^in_id$/, "id").split("_")[0], label: c.lanName || c.lan });
    });
  } catch (e) {
  }
  if (!qualities.length) throw new Error("video unavailable");
  qualities.sort(function (a, b) { return b.height - a.height; });
  return { url: qualities[0].url, hls: false, referer: WEB + "/", title: "", qualities: qualities, subtitles: subtitles };
}
