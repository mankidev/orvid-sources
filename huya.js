var ROWS = 20;
var EXPLICIT = /\b(nsfw|porn\w*|nude|nudes|xxx|sex\w*|hentai)\b|福利|擦边|裸/i;

function https(u) {
  return u ? String(u).replace(/^http:\/\//, "https://") : null;
}

function search(query, next) {
  var start = next ? parseInt(next, 10) : 0;
  var d = http.json("https://search.cdn.huya.com/?m=Search&do=getSearchContent&uid=0&v=4&typ=-5&livestate=0&rows="
      + ROWS + "&start=" + start + "&q=" + encodeURIComponent(query));
  var docs = (((d.response || {})["122"]) || {}).docs || [];
  var items = [];
  docs.forEach(function (v) {
    if (!v.vid || EXPLICIT.test(v.title || "")) return;
    items.push({
      url: "https://www.huya.com/video/play/" + v.vid + ".html",
      title: util.unescape(String(v.title || "").replace(/<[^>]+>/g, "")),
      author: v.user_nickname || "",
      duration: -1,
      views: util.number(String(v.play_sum || "-1")),
      thumb: https(v.cover),
      date: v.uptime ? v.uptime.replace(" ", "T") + ":00+08:00" : null
    });
  });
  return { items: items, next: docs.length >= ROWS ? String(start + ROWS) : null };
}

function resolve(url) {
  var m = url.match(/video\/play\/(\d+)\.html/);
  if (!m) throw new Error("not a video link");
  var d = http.json("https://liveapi.huya.com/moment/getMomentContent?uid=&videoId=" + m[1]);
  var info = ((d.data || {}).moment || {}).videoInfo || {};
  var defs = (info.definitions || []).filter(function (x) { return x.url; });
  if (!defs.length) throw new Error("video unavailable");
  defs.sort(function (a, b) { return (parseInt(b.definition, 10) || 0) - (parseInt(a.definition, 10) || 0); });
  return {
    url: https(defs[0].url),
    hls: /\.m3u8/.test(defs[0].url),
    referer: "https://www.huya.com/",
    title: info.videoTitle || "",
    author: info.nickName || info.actorNick || "",
    qualities: defs.map(function (x) { return { url: https(x.url), height: parseInt(x.defName, 10) || 0 }; })
  };
}
