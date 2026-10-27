var SITE = "https://www.kwai.com";
var H = { "User-Agent": "Mozilla/5.0 (Android 14; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0" };
var EXPLICIT = /\b(xxx|porn\w*|nsfw|nude|nudes|onlyfans|fuck\w*|putaria|safad\w*|pelad\w*|novinha\w*|gostos\w*)\b/i;

function blocks(html) {
  var out = [];
  var re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
  var m;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch (e) {
    }
  }
  return out;
}

function creator(v) {
  var c = v.creator && v.creator.mainEntity;
  return c ? c.name || c.alternateName || "" : "";
}

function views(v) {
  var s = v.interactionStatistic || [];
  for (var i = 0; i < s.length; i++) {
    var t = s[i].interactionType;
    if (t && /WatchAction/.test(t["@type"] || t)) return s[i].userInteractionCount;
  }
  return -1;
}

function title(v) {
  var d = (v.description || "").replace(/\s+/g, " ").trim();
  if (d.replace(/#\S+/g, "").trim().length >= 3) return d;
  var n = (v.name || "").replace(/^.*?Áudio original criado por [^.]*\.\s*/, "").trim();
  return n || d || creator(v);
}

function item(v) {
  if (!v || !v.url || !v.contentUrl) return null;
  var t = title(v);
  if (EXPLICIT.test(t) || EXPLICIT.test(v.transcript || "")) return null;
  var thumb = v.thumbnailUrl;
  return {
    url: v.url,
    title: t,
    author: creator(v),
    duration: v.duration ? util.duration(v.duration) : -1,
    views: views(v),
    thumb: thumb && thumb.length ? thumb[0] : thumb,
    date: v.uploadDate
  };
}

function search(query, next) {
  var html = http.get(SITE + "/discover/" + encodeURIComponent(query.trim().toLowerCase()), H);
  var items = [];
  blocks(html).forEach(function (d) {
    if (!d.mainEntityOfPage || !d.itemListElement) return;
    d.itemListElement.forEach(function (v) {
      var x = item(v);
      if (x) items.push(x);
    });
  });
  return { items: items, next: null };
}

function resolve(url) {
  var html = http.get(url, H);
  var list = blocks(html);
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    if (v["@type"] == "VideoObject" && v.contentUrl) {
      return { url: v.contentUrl, hls: false, title: title(v), author: creator(v), referer: SITE + "/" };
    }
  }
  throw new Error("video unavailable");
}
