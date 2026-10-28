var BOARD = "wsg";
var API = "https://a.4cdn.org/" + BOARD + "/";
var MEDIA = "https://i.4cdn.org/" + BOARD + "/";
var PER_PAGE = 2;
var BLOCK = /\b(nsfw|lewd|porn\w*|nude\w*|nsfl|ecchi|hentai|coom\w*|thots?|sexy|sex\w*|bikinis?|lingerie|twerk\w*|booty|ass|thicc|thick|tits|boobs?|feet|e-?girls?|onlyfans|leak\w*|tiktok|dance|dancing|gay|trans|tranny|transgender|trap|femboy\w*|sissy|lesbians?|futa\w*|gore|cartel|executions?|beheading)\b/i;

function text(html) {
  return util.unescape(String(html || "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, " ")).replace(/>>\d+/g, " ").replace(/\s+/g, " ").trim();
}

function catalog() {
  var body = cache.get("catalog", true);
  if (!body) {
    body = http.get(API + "catalog.json");
    cache.put("catalog", body, 300000, true);
  }
  var threads = [];
  JSON.parse(body).forEach(function (page) { threads = threads.concat(page.threads); });
  return threads;
}

function matches(query) {
  var words = query.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; }).map(function (w) {
    return new RegExp("(^|[^a-z0-9])" + w.replace(/[^a-z0-9]/g, "\\$&") + "(?:s|es)?(?![a-z0-9])");
  });
  if (!words.length) return [];
  var need = Math.ceil(words.length / 2), out = [];
  catalog().forEach(function (t) {
    if (t.sticky) return;
    var sub = text(t.sub).toLowerCase(), all = sub + " " + text(t.com).toLowerCase();
    if (BLOCK.test(all)) return;
    var hit = 0, score = 0;
    words.forEach(function (w) {
      if (!w.test(all)) return;
      hit++;
      score += w.test(sub) ? 2 : 1;
    });
    if (hit >= need) out.push({ no: t.no, sub: text(t.sub), score: score, replies: t.replies || 0 });
  });
  out.sort(function (a, b) { return b.score - a.score || b.replies - a.replies; });
  return out;
}

function label(p) {
  var name = String(p.filename || "");
  if (/[a-z]{3}/i.test(name) && !/^(download|video|image|file|untitled)\b/i.test(name)) return util.unescape(name).replace(/[_.]+/g, " ").trim();
  var com = text(p.com);
  return com ? com.substring(0, 90) : "";
}

function search(query, next) {
  var start = next ? parseInt(next, 10) : 0;
  var found = matches(query);
  var page = found.slice(start, start + PER_PAGE);
  if (!page.length) return { items: [], next: null };
  var bodies = http.all(page.map(function (t) { return API + "thread/" + t.no + ".json"; }));
  var items = [];
  page.forEach(function (t, i) {
    var posts;
    try { posts = JSON.parse(bodies[i]).posts; } catch (e) { return; }
    var subject = t.sub || text(posts[0].com).substring(0, 60) || "/" + BOARD + "/";
    posts.forEach(function (p) {
      if (p.ext != ".webm" && p.ext != ".mp4") return;
      if (p.filedeleted || BLOCK.test(String(p.filename || "") + " " + text(p.com))) return;
      items.push({
        url: MEDIA + p.tim + p.ext,
        title: label(p) || subject,
        author: subject,
        duration: -1,
        thumb: MEDIA + p.tim + "s.jpg",
        date: p.time
      });
    });
  });
  return { items: items, next: start + PER_PAGE < found.length ? String(start + PER_PAGE) : null };
}

function resolve(url) {
  var m = url.match(/i\.4cdn\.org\/(\w+)\/(\d+)\.(webm|mp4)/);
  if (!m) throw new Error("not a video link");
  return { url: "https://i.4cdn.org/" + m[1] + "/" + m[2] + "." + m[3], hls: false, referer: "https://boards.4chan.org/" };
}
