var EXPLICIT = /\b(adults?|ullu|xxx|porn\w*|nsfw|nude|nudes|onlyfans|fuck\w*|18\+|sex\w*|leak\w*|erotic\w*|hentai)\b/i;

function text(s) {
  return util.unescape(String(s || "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function channels(query) {
  var name = query.replace(/^@/, "").replace(/^https?:\/\/t\.me\/(?:s\/)?/, "").replace(/\/.*$/, "").trim();
  return /^[A-Za-z0-9_]{5,32}$/.test(name) ? [name] : [];
}

function posts(ch, before) {
  var html = http.get("https://t.me/s/" + ch + (before ? "?before=" + before : ""));
  var title = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || ch;
  if (EXPLICIT.test(title)) return { items: [], before: null };
  var items = [];
  var parts = html.split('class="tgme_widget_message ');
  for (var i = 1; i < parts.length; i++) {
    var p = parts[i];
    if (p.indexOf("<video") < 0) continue;
    var post = (p.match(/data-post="([A-Za-z0-9_]+\/\d+)"/) || [])[1];
    if (!post) continue;
    var body = text((p.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    if (EXPLICIT.test(body)) continue;
    items.push({
      url: "https://t.me/" + post,
      title: body ? body.substring(0, 140) : text(title),
      author: text(title),
      duration: util.duration((p.match(/message_video_duration[^>]*>([0-9:]+)</) || [])[1] || ""),
      views: util.number((p.match(/tgme_widget_message_views">([^<]+)</) || [])[1] || "-1"),
      thumb: (p.match(/message_video_thumb" style="background-image:url\('([^']+)'\)/) || [])[1],
      date: (p.match(/<time datetime="([^"]+)"/) || [])[1]
    });
  }
  var more = html.match(/tme_messages_more[^>]*data-before="(\d+)"/);
  return { items: items.reverse(), before: more ? more[1] : null };
}

function search(query, next) {
  var list = next ? JSON.parse(next) : channels(query).map(function (c) { return [c, null]; });
  if (!list.length) return { items: [], next: null, skip: true };
  var items = [], rest = [];
  list.forEach(function (e) {
    try {
      var r = posts(e[0], e[1]);
      items = items.concat(r.items);
      if (r.before && r.items.length) rest.push([e[0], r.before]);
    } catch (x) {}
  });
  return { items: items, next: rest.length ? JSON.stringify(rest) : null };
}

function resolve(url) {
  var m = url.match(/t\.me\/(?:s\/)?([A-Za-z0-9_]+)\/(\d+)/);
  if (!m) throw new Error("not a video link");
  var html = http.get("https://t.me/" + m[1] + "/" + m[2] + "?embed=1&mode=tme");
  var src = html.match(/<video[^>]*src="([^"]+)"/);
  if (!src) throw new Error("video unavailable");
  var body = text((html.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
  return { url: util.unescape(src[1]), hls: false, referer: "https://t.me/", title: body.substring(0, 140), author: m[1] };
}
