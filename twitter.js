var RESERVED = /^(?:search|hashtag|i|home|explore|intent|share|settings|login|signup|tos|privacy|messages|notifications|compose)$/i;
var ENGINES = [
  "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/html/?q=",
  "https://html.duckduckgo.com/html/?q="
].filter(function (u) { return env.tor || u.indexOf(".onion/") < 0; });
var PROFILES = 3;

function links(phrase) {
  var last;
  for (var e = 0; e < ENGINES.length; e++) {
    try {
      var html = http.get(ENGINES[e] + encodeURIComponent(phrase));
      if (html.indexOf("anomaly-modal") >= 0) throw new Error("Captcha needed (duckduckgo)");
      var out = [], re = /uddg=([^&"]+)/g, m;
      while ((m = re.exec(html))) out.push(decodeURIComponent(m[1]));
      return out;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

function clean(text) {
  return (text || "").replace(/https:\/\/t\.co\/\w+/g, "").replace(/\s+/g, " ").trim();
}

function seconds(ms) {
  return ms > 0 ? Math.round(ms / 1000) : -1;
}

function timeline(html) {
  var m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html || "");
  if (!m) return [];
  var entries = ((((JSON.parse(m[1]).props || {}).pageProps || {}).timeline || {}).entries) || [];
  var items = [];
  entries.forEach(function (e) {
    var t = (e.content || {}).tweet;
    if (!t || !t.user || t.possibly_sensitive || t.user.possibly_sensitive) return;
    var media = ((t.extended_entities || {}).media || []).filter(function (x) { return x.type == "video"; });
    if (!media.length) return;
    var v = media[0];
    items.push({
      url: "https://x.com/" + t.user.screen_name + "/status/" + t.id_str,
      title: clean(t.full_text || t.text) || "@" + t.user.screen_name,
      author: t.user.name || t.user.screen_name,
      avatar: t.user.profile_image_url_https,
      duration: seconds((v.video_info || {}).duration_millis),
      thumb: v.media_url_https,
      date: t.created_at ? new Date(t.created_at).toISOString() : undefined
    });
  });
  return items;
}

function fx(id) {
  return "https://api.fxtwitter.com/status/" + id;
}

function fromFx(body) {
  var t;
  try {
    t = JSON.parse(body).tweet;
  } catch (e) {
    return null;
  }
  if (!t || t.possibly_sensitive || t.sensitive) return null;
  var videos = t.media && t.media.videos;
  if (!videos || !videos.length) return null;
  return {
    url: "https://x.com/" + t.author.screen_name + "/status/" + t.id,
    title: clean(t.text) || "@" + t.author.screen_name,
    author: t.author.name || t.author.screen_name,
    avatar: t.author.avatar_url,
    duration: videos[0].duration > 0 ? Math.round(videos[0].duration) : -1,
    thumb: videos[0].thumbnail_url,
    date: t.created_timestamp,
    views: t.views
  };
}

function search(query, next) {
  var names = [], statuses = [], seenName = {}, seenStatus = {};
  var handle = /^@?([A-Za-z0-9_]{1,15})$/.exec(query.trim());
  if (handle) {
    names.push(handle[1]);
    seenName[handle[1].toLowerCase()] = true;
  }
  try {
    links("site:x.com " + query).forEach(function (link) {
      var s = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/.exec(link);
      if (s && !seenStatus[s[2]]) {
        seenStatus[s[2]] = true;
        statuses.push(s[2]);
      }
      var p = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[\/?#]|$)/.exec(link);
      if (p && !RESERVED.test(p[1]) && !seenName[p[1].toLowerCase()] && names.length < PROFILES) {
        seenName[p[1].toLowerCase()] = true;
        names.push(p[1]);
      }
    });
  } catch (e) {
    if (!names.length) throw e;
  }
  var urls = names.map(function (n) { return "https://syndication.twitter.com/srv/timeline-profile/screen-name/" + n; })
      .concat(statuses.map(fx));
  var bodies = http.all(urls);
  var items = [], seen = {};
  for (var i = 0; i < bodies.length; i++) {
    var found = i < names.length ? timeline(bodies[i]) : [fromFx(bodies[i])];
    found.forEach(function (it) {
      if (it && !seen[it.url]) {
        seen[it.url] = true;
        items.push(it);
      }
    });
  }
  return { items: items, next: null };
}

function resolve(url) {
  var m = /(?:x|twitter)\.com\/[^\/]+\/status\/(\d+)/.exec(url);
  if (!m) throw new Error("not a post");
  var t = http.json(fx(m[1])).tweet;
  var videos = t && t.media && t.media.videos;
  if (!videos || !videos.length) throw new Error("no video in this post");
  var v = videos[0], cap = env.tor ? 720 : 1080, best = null;
  (v.variants || []).forEach(function (x) {
    if (x.content_type != "video/mp4") return;
    var size = /\/(\d+)x(\d+)\//.exec(x.url);
    var h = size ? Math.min(parseInt(size[1], 10), parseInt(size[2], 10)) : 0;
    if (h <= cap && (!best || x.bitrate > best.bitrate)) best = x;
  });
  var file = best ? best.url : v.url;
  if (!file) throw new Error("no stream");
  return { url: file, hls: /\.m3u8/.test(file), title: clean(t.text), author: t.author.name || t.author.screen_name };
}
