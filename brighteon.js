var EXPLICIT = /\b(xxx|porn\w*|nsfw|nude|nudes|onlyfans|fuck\w*|hentai)\b/i;

function search(query, next) {
  var page = next ? parseInt(next, 10) : 1;
  var root = http.json("https://www.brighteon.com/api-v3/search?query=" + encodeURIComponent(query) + "&page=" + page);
  var items = [];
  var seen = {};
  (root.videos || []).forEach(function (v) {
    var a = v.addInfo || {};
    if (!v.id || seen[v.id] || v.isPremium || v.isAudio || v.isUpcoming || a.isForSale || a.isPremium || a.isTrailer) return;
    if (EXPLICIT.test(v.title || "") || EXPLICIT.test((v.tags || []).join(" "))) return;
    seen[v.id] = 1;
    items.push({
      url: "https://www.brighteon.com/" + v.id,
      title: v.title,
      author: a.channelName,
      duration: v.duration ? Math.round(v.duration / 1000) : -1,
      views: v.videoView,
      thumb: a.thumbnail,
      date: v.createdAt
    });
  });
  return { items: items, next: items.length && page < (root.pages || 0) ? String(page + 1) : null };
}

function resolve(url) {
  var html = http.get(url);
  var m = /"src":"(https:\/\/video\.brighteon\.com\/[^"]+\.m3u8)"/.exec(html);
  if (!m) throw new Error("video unavailable");
  var t = /<meta property="og:title" content="([^"]*)"/.exec(html);
  return { url: m[1], hls: true, title: t ? t[1] : "" };
}
