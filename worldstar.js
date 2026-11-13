var API = "https://api-mobile.worldstar.com/search/suggestion?pageSize=40&filter=relevance&clean=false&searchTerm=";
var EXPLICIT = /\b(xxx|porn\w*|nsfw|nude|nudes|naked|onlyfans|fuck\w*|sex\w*|hentai)\b/i;

function search(query, next) {
  var root = http.json(API + encodeURIComponent(query) + (next ? "&pageCursor=" + encodeURIComponent(next) : ""));
  var v = root.videos || {};
  var items = [];
  (v.result || []).forEach(function (x) {
    if (!x.encryptedVCode || x.uncut || EXPLICIT.test(x.title || "")) return;
    items.push({ url: "https://worldstarhiphop.com/videos/" + x.encryptedVCode + "/" + (x.slug || ""),
      title: util.unescape(x.title || ""), author: "WorldStar",
      duration: x.duration ? Math.round(x.duration) : -1,
      views: x.numberOfViews || -1, thumb: x.imageLarge || x.imageUrl, date: x.postedTimestamp });
  });
  return { items: items, next: v.hasNext && v.pageCursor && (v.result || []).length ? v.pageCursor : null };
}

function resolve(url) {
  var code = url.match(/videos\/(wshh[A-Za-z0-9]+)/);
  if (!code) throw new Error("video unavailable");
  var page = /videos\/wshh[A-Za-z0-9]+\/[a-z0-9-]+/.test(url) ? url.replace(/^https?:\/\/(?:www\.)?worldstar\.com\//, "https://worldstarhiphop.com/") : null;
  if (!page) {
    var hop = http.check("https://worldstarhiphop.com/videos/" + code[1]).location;
    page = hop ? (hop.indexOf("http") === 0 ? hop : "https://worldstarhiphop.com" + hop) : "https://worldstarhiphop.com/videos/" + code[1];
  }
  var html = http.get(page).replace(/\\"/g, '"');
  var at = html.indexOf('"encryptedVCode":"' + code[1] + '"');
  if (at < 0) throw new Error("video unavailable");
  var obj = html.substr(at, 6000);
  if (/"uncut":true/.test(obj.split('"tags"')[0])) throw new Error("video unavailable");
  var file = obj.match(/"desktopVideoFile":"([^"]+)"/) || obj.match(/"videoFile":"([^"]+)"/);
  if (!file) throw new Error("video unavailable");
  var mobile = obj.match(/"videoFile":"([^"]+)"/);
  var title = obj.match(/"title":"((?:[^"\\]|\\.)*)"/);
  var out = { url: file[1], hls: false, title: title ? JSON.parse("\"" + title[1] + "\"") : "", author: "WorldStar" };
  if (mobile && mobile[1] !== file[1]) out.fallback = { url: mobile[1], hls: false };
  return out;
}
