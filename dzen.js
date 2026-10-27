var SITE = "https://dzen.ru";
var EXPLICIT = /\b(xxx|porn\w*|nsfw|nude|nudes|onlyfans|fuck\w*|эротик\w*|порн\w*|голы[емх]\w*|18\+)/i;

function contentId(v) {
  return v && v.video_info && v.video_info.video_content_id;
}

function item(it) {
  var v = it.video;
  var id = contentId(v);
  if (!id || !it.title || EXPLICIT.test(it.title)) return null;
  var src = it.source || {};
  return {
    url: SITE + "/embed/" + id,
    title: it.title.replace(/\s+/g, " ").trim(),
    author: src.title || "",
    avatar: src.logo,
    duration: v.duration > 0 ? v.duration : -1,
    views: v.views > 0 ? v.views : -1,
    thumb: it.image,
    date: it.publication_date ? new Date(it.publication_date * 1000).toISOString() : null
  };
}

function search(query, next) {
  var root = http.json(next || SITE + "/api/v3/launcher/zen-search?query=" + encodeURIComponent(query)
      + "&type_filter=video%2Cshort");
  var items = [];
  (root.items || []).forEach(function (it) {
    var x = it.video ? item(it) : null;
    if (x) items.push(x);
  });
  var more = root.more && root.more.link;
  return { items: items, next: more && items.length ? more : null };
}

function resolve(url) {
  var m = /dzen\.ru\/embed\/([A-Za-z0-9_-]+)/.exec(url);
  if (!m) throw new Error("not a video");
  var html = http.get(SITE + "/embed/" + m[1]);
  var hls = /https:(?:\\?\/){2}vd\d+\.okcdn\.ru\/video\.m3u8[^"]*/.exec(html);
  if (!hls) throw new Error("video unavailable");
  var media = hls[0].replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
  var title = /<title>([^<]*)<\/title>/.exec(html);
  return { url: media, hls: true, title: title ? title[1].replace(/\s*\|\s*Дзен.*$/, "").trim() : "" };
}
