var SITE = "https://coverr.co";

function search(query, next) {
  var page = next ? parseInt(next, 10) : 1;
  var data = http.json(SITE + "/api/videos?query=" + encodeURIComponent(query) + "&page=" + page + "&urls=true");
  var items = [];
  (data.hits || []).forEach(function (h) {
    if (!h.urls || !h.urls.mp4) return;
    items.push({
      url: h.urls.mp4,
      title: h.title || "",
      author: "Coverr",
      duration: h.duration ? Math.round(parseFloat(h.duration)) : -1,
      views: h.views ? parseInt(h.views, 10) : -1,
      thumb: h.thumbnail || h.poster,
      date: h.published_at || null
    });
  });
  return { items: items, next: items.length && page < (data.pages || 0) ? String(page + 1) : null };
}

function resolve(url) {
  return { url: url, hls: false, referer: SITE + "/", title: "", author: "Coverr" };
}
