var LIST = "https://iptv-org.github.io/api/streams.json";
var PAGE = 40;

function streams() {
  var kept = cache.get(LIST, true);
  if (kept) return JSON.parse(kept);
  var list = JSON.parse(http.get(LIST, { "Accept-Encoding": "gzip" })).filter(function (s) {
    return /^https:/.test(s.url || "") && !s.user_agent;
  }).map(function (s) {
    return { url: s.url, title: s.title, channel: s.channel, referrer: s.referrer, quality: s.quality };
  });
  cache.put(LIST, JSON.stringify(list), 3600000, true);
  return list;
}

function search(query, next) {
  var offset = next ? parseInt(next, 10) : 0;
  var all = streams();
  var words = query.toLowerCase().split(/\s+/).filter(function (w) { return w; });
  var hits = [];
  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    var tokens = (s.title || s.channel || "").toLowerCase().split(/[^0-9a-z\u00c0-\uffff]+/);
    var ok = true;
    for (var k = 0; k < words.length && ok; k++) {
      ok = false;
      for (var t = 0; t < tokens.length && !ok; t++) ok = tokens[t].indexOf(words[k]) == 0;
    }
    if (ok) hits.push(s);
  }
  var items = hits.slice(offset, offset + PAGE).map(function (s) {
    var country = /\.([a-z]{2})(@|$)/.exec(s.channel || "");
    return {
      url: "https://iptv-org.github.io/watch#" + encodeURIComponent(s.url) + "|" + encodeURIComponent(s.referrer || ""),
      title: s.title || s.channel,
      author: [country ? country[1].toUpperCase() : "", s.quality || ""].filter(function (x) { return x; }).join(", "),
      duration: -1
    };
  });
  return { items: items, next: offset + PAGE < hits.length ? String(offset + PAGE) : null };
}

function resolve(url) {
  var m = /iptv-org\.github\.io\/watch#([^|]+)\|(.*)$/.exec(url);
  if (!m) throw new Error("not a stream");
  var stream = decodeURIComponent(m[1]);
  var referer = decodeURIComponent(m[2]);
  return { url: stream, hls: /\.m3u8/.test(stream), title: "", referer: referer || null };
}
