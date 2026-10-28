var SITE = "https://duckduckgo.com";

function token(query) {
  var key = "vqd:" + query;
  var known = cache.get(key);
  if (known) return known;
  var page = http.get(SITE + "/?q=" + encodeURIComponent(query) + "&ia=videos&kp=1");
  var m = /vqd=["']?([\d-]+)/.exec(page);
  if (!m) throw new Error("DuckDuckGo gave no search token");
  cache.put(key, m[1], 600000);
  return m[1];
}

function search(query, next) {
  if (!query) return { items: [], next: null };
  var path = next || "v.js?l=us-en&o=json&q=" + encodeURIComponent(query) + "&vqd=" + token(query) + "&f=,,,&p=1";
  var data = http.json(SITE + "/" + path, { "Referer": SITE + "/" });
  var items = [];
  (data.results || []).forEach(function (r) {
    if (!r.content) return;
    items.push({
      url: r.content,
      title: r.title || "",
      author: r.uploader || r.publisher || "",
      duration: r.duration ? util.duration(r.duration) : -1,
      views: r.statistics && r.statistics.viewCount ? r.statistics.viewCount : -1,
      thumb: r.images ? r.images.medium || r.images.large : null,
      date: r.published || null
    });
  });
  return { items: items, next: items.length && data.next ? data.next : null };
}
