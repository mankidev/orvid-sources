var BASE = "https://twit.tv";

function shows(slugs) {
  var out = {};
  var missing = [];
  slugs.forEach(function (s) {
    var hit = cache.get("show:" + s, true);
    if (hit) out[s] = JSON.parse(hit);
    else missing.push(s);
  });
  if (!missing.length) return out;
  var bodies = http.all(missing.map(function (s) { return BASE + "/shows/" + s; }));
  missing.forEach(function (s, i) {
    var p = bodies[i] || "";
    var img = p.match(/og:image" content="([^"]+)"/);
    var name = p.match(/og:title" content="([^|"]+)/);
    var info = {
      thumb: img ? img[1].replace("twit_album_art_1400x1400", "twit_album_art_300x300") : null,
      name: name ? util.unescape(name[1]).trim() : s
    };
    if (p) cache.put("show:" + s, JSON.stringify(info), 86400000, true);
    out[s] = info;
  });
  return out;
}

function search(query, next) {
  var page = next ? parseInt(next, 10) : 1;
  var p = http.get(BASE + "/search/" + encodeURIComponent(query) + (page > 1 ? "?page=" + page : ""));
  var re = /<h3 class="title"><a href="\/shows\/([^\/"]+)\/episodes\/([^"]+)">([\s\S]*?)<\/a>/g;
  var found = [];
  var m;
  while ((m = re.exec(p))) found.push(m);
  var info = shows(found.map(function (f) { return f[1]; }).filter(function (s, i, a) { return a.indexOf(s) == i; }));
  var items = found.map(function (f) {
    var s = info[f[1]] || {};
    return {
      url: BASE + "/shows/" + f[1] + "/episodes/" + f[2],
      title: util.unescape(f[3].replace(/<[^>]+>/g, "")).trim(),
      author: s.name,
      duration: -1,
      thumb: s.thumb
    };
  });
  var pages = p.match(/Displaying page (\d+) of (\d+)/);
  return { items: items, next: pages && +pages[1] < +pages[2] ? String(page + 1) : null };
}

function resolve(url) {
  var p = http.get(url);
  var src = p.match(/"contentUrl":"([^"]+\.mp4)"/);
  if (!src) throw new Error("video unavailable");
  var title = p.match(/og:title" content="([^"]+?)(?: \| TWiT\.TV)?"/);
  var show = p.match(/"partOfSeries":\{[^}]*"name":"([^"]+)"/);
  return {
    url: src[1].replace(/\\\//g, "/").replace(/^https:\/\/pscrb\.fm\/rss\/p\//, "https://"),
    hls: false,
    title: title ? util.unescape(title[1]) : null,
    author: show ? show[1] : null
  };
}
