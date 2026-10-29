var SITE = "https://kinoleha.net";
var BLOCK = /эрот|порн|секс|xxx/i;

function search(query, next) {
  var p = http.get(SITE + "/search/" + encodeURIComponent(query.toLowerCase()));
  var re = /<a title='([^']+)' href='(\/(?:film|ab)\/[^']+)'><div class='lefilm'><div class='lefilmfon'>\s*<img src='([^']+)'/g;
  var items = [];
  var m;
  while ((m = re.exec(p))) {
    var title = util.unescape(m[1]);
    if (BLOCK.test(title)) continue;
    items.push({ url: SITE + m[2], title: title, author: "KinoLeha", duration: -1, thumb: SITE + m[3], kind: "movie" });
  }
  return { items: items, next: null };
}

function resolve(url) {
  var p = http.get(url);
  var src = p.match(/og:video" content="([^"]+)"/);
  if (!src) throw new Error("video unavailable");
  var title = p.match(/<h1>([^<]+)<\/h1>/);
  return { url: src[1], hls: false, referer: SITE + "/", title: title ? util.unescape(title[1]) : null };
}
