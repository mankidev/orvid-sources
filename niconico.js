var EXPLICIT = /\b(nsfw|porn\w*|nude|nudes|xxx|sex\w*|hentai|r-?18)\b|エロ|えっち|えちえち|おっぱい/i;

function server(html, fail) {
  var m = html.match(/name="server-response" content="([^"]+)"/);
  if (!m) throw new Error(fail);
  return JSON.parse(util.unescape(m[1])).data.response;
}

function search(query, next) {
  var page = next ? parseInt(next, 10) : 1;
  var r = server(http.get("https://www.nicovideo.jp/search/" + encodeURIComponent(query) + "?sort=v&order=d&page=" + page), "no search data");
  var data = (r.$getSearchVideoV2 || {}).data || {};
  var items = [];
  (data.items || []).forEach(function (v) {
    if (!v.id || v.requireSensitiveMasking || v.isPaymentRequired || EXPLICIT.test(v.title || "")) return;
    var owner = v.owner || {};
    items.push({
      url: "https://www.nicovideo.jp/watch/" + v.id,
      title: v.title,
      author: owner.name || "",
      duration: v.duration || -1,
      views: (v.count || {}).view || -1,
      thumb: (v.thumbnail || {}).nHdUrl || (v.thumbnail || {}).listingUrl || (v.thumbnail || {}).url,
      date: v.registeredAt
    });
  });
  return { items: items, next: data.hasNext ? String(page + 1) : null };
}

function best(list) {
  var pick = null;
  (list || []).forEach(function (x) {
    if (x.isAvailable && (!pick || x.qualityLevel > pick.qualityLevel)) pick = x;
  });
  return pick;
}

function resolve(url) {
  var m = url.match(/watch\/((?:sm|so|nm)\d+)/);
  if (!m) throw new Error("not a video link");
  var page = http.page("https://www.nicovideo.jp/watch/" + m[1]);
  var d = server(page.body, "video unavailable").$watchV4.data;
  var media = d.media || {};
  var video = best((media.contents || {}).videos);
  var audio = best((media.contents || {}).audios);
  if (!media.accessRightKey || !video || !audio) throw new Error("video unavailable");
  var rights = http.page("https://nvapi.nicovideo.jp/v1/watch/" + m[1] + "/access-rights/hls?actionTrackId="
      + encodeURIComponent(d.client.watchTrackId), {
    "X-Frontend-Id": "6",
    "X-Frontend-Version": "0",
    "X-Request-With": "nicovideo",
    "X-Access-Right-Key": media.accessRightKey,
    "Cookie": page.cookies
  }, JSON.stringify({ outputs: [[video.id, audio.id]] }), "application/json");
  var answer = JSON.parse(rights.body || "{}");
  if (!answer.data || !answer.data.contentUrl) throw new Error("video unavailable");
  return {
    url: answer.data.contentUrl,
    hls: true,
    cookie: rights.cookies,
    referer: "https://www.nicovideo.jp/",
    title: (d.video || {}).title || "",
    author: ((d.owner || {}).nickname) || ""
  };
}
