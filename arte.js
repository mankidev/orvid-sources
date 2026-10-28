var LANGS = ["en", "de", "fr"];
var VIDEO = /^\d{6}-\d{3}-[A-Z]$/;

function rows(body) {
  if (!body) return { data: [], next: null };
  var d = JSON.parse(body);
  var content = d.zones ? (d.zones[0] || {}).content || {} : d;
  return { data: content.data || [], next: ((content.pagination || {}).links || {}).next || null };
}

function search(query, next) {
  var urls = next ? JSON.parse(next) : LANGS.map(function (l) {
    return "https://api.arte.tv/api/emac/v4/" + l + "/web/pages/SEARCH/?mainZonePage=1&query=" + encodeURIComponent(query);
  });
  var bodies = http.all(urls);
  var items = [], seen = {}, more = [];
  bodies.forEach(function (body) {
    var r = rows(body);
    if (r.next) more.push(r.next);
    r.data.forEach(function (v) {
      if (!VIDEO.test(v.programId || "") || seen[v.programId] || (v.ageRating || 0) >= 18) return;
      if ((v.availability || {}).hasVideoStreams === false) return;
      seen[v.programId] = 1;
      var image = (v.mainImage || {}).url;
      items.push({
        url: v.url,
        title: v.subtitle ? v.title + " - " + v.subtitle : v.title,
        author: "ARTE",
        duration: v.duration || -1,
        thumb: image ? image.replace("__SIZE__", "640x360") : null
      });
    });
  });
  return { items: items, next: more.length ? JSON.stringify(more) : null };
}

function resolve(url) {
  var m = url.match(/arte\.tv\/(en|de|fr|es|pl|it)\/videos\/(\d{6}-\d{3}-[A-Z])/);
  if (!m) throw new Error("not a video link");
  var a = http.json("https://api.arte.tv/api/player/v2/config/" + m[1] + "/" + m[2]).data.attributes;
  if (((a.restriction || {}).geoblocking || {}).restrictedArea) throw new Error("video unavailable in this region");
  var streams = (a.streams || []).filter(function (s) { return /HLS/.test(s.protocol || ""); });
  if (!streams.length) throw new Error("video unavailable");
  var meta = a.metadata || {};
  return { url: streams[0].url, hls: true, title: meta.title || "", author: "ARTE" };
}
