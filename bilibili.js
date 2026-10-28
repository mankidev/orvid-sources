var API = "https://api.bilibili.com/x/";
var REF = { "Referer": "https://www.bilibili.com/" };
var EXPLICIT = /\b(nsfw|porn\w*|nude|nudes|xxx|sex\w*|hentai|r-?18)\b|福利|擦边|裸/i;

function clean(s) {
  return util.unescape(String(s || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function search(query, next) {
  var page = next ? parseInt(next, 10) : 1;
  var d = http.json(API + "web-interface/search/type?search_type=video&page=" + page + "&keyword=" + encodeURIComponent(query), REF);
  if (d.code !== 0) throw new Error("bilibili search refused (" + d.code + ")");
  var data = d.data || {};
  var items = [];
  (data.result || []).forEach(function (v) {
    if (!v.bvid || v.is_pay || v.is_charge_video || v.badgepay) return;
    var title = clean(v.title);
    if (EXPLICIT.test(title)) return;
    items.push({
      url: "https://www.bilibili.com/video/" + v.bvid,
      title: title,
      author: clean(v.author),
      duration: util.duration(String(v.duration || "")),
      views: v.play || -1,
      thumb: v.pic ? (v.pic.indexOf("//") == 0 ? "https:" + v.pic : v.pic) : null,
      date: v.pubdate ? new Date(v.pubdate * 1000).toISOString() : null
    });
  });
  return { items: items, next: page < (data.numPages || 0) ? String(page + 1) : null };
}

function resolve(url) {
  var m = url.match(/video\/(BV[0-9A-Za-z]{10})/);
  if (!m) throw new Error("not a video link");
  var part = parseInt((url.match(/[?&]p=(\d+)/) || [])[1] || "1", 10);
  var pages = http.json(API + "player/pagelist?bvid=" + m[1]).data || [];
  var page = pages[Math.max(0, Math.min(pages.length - 1, part - 1))];
  if (!page) throw new Error("video unavailable");
  var play = http.json(API + "player/playurl?bvid=" + m[1] + "&cid=" + page.cid
      + "&qn=64&fnval=1&platform=html5&high_quality=1", REF);
  var durl = ((play.data || {}).durl || [])[0];
  if (play.code !== 0 || !durl) throw new Error("video unavailable");
  var out = { url: durl.url, hls: false, referer: "https://www.bilibili.com/", title: page.part || "" };
  if (durl.backup_url && durl.backup_url.length) out.fallback = { url: durl.backup_url[0] };
  return out;
}
