var BOOT = "https://boot.pluto.tv/v4/start?appName=web&appVersion=9.1.2&deviceVersion=130.0.0&deviceModel=web"
    + "&deviceMake=chrome&deviceType=web&clientModelNumber=1.0.0&clientID=";
var VOD = "https://service-vod.clusters.pluto.tv/v4/vod/";
var STITCH = "https://cfd-v4-service-stitcher-dash-use1-1.prd.pluto.tv/v2/stitch/hls/episode/";
var ADULT = { "18": 1, "NC-17": 1, "X": 1 };
var EPISODES = 6;
var SERIES = 2;

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    return (c == "x" ? r : (r & 3 | 8)).toString(16);
  });
}

function session() {
  var saved = cache.get("boot");
  if (saved) return JSON.parse(saved);
  var b = http.json(BOOT + uuid());
  if (!b.sessionToken || !(b.session || {}).activeRegion) return null;
  var s = { token: b.sessionToken, params: b.stitcherParams };
  cache.put("boot", JSON.stringify(s), 30 * 60 * 1000);
  return s;
}

function cover(v) {
  var list = v.covers || [];
  for (var i = 0; i < list.length; i++) if (list[i].aspectRatio == "16:9") return list[i].url;
  return list.length ? list[0].url : null;
}

function search(query, next) {
  var s = session();
  if (!s) {
    if (env.tor) throw new Error("Pluto TV is not available from this exit");
    return { items: [], next: null, skip: true };
  }
  var auth = { "Authorization": "Bearer " + s.token };
  var found = http.json("https://service-media-search.clusters.pluto.tv/v1/search?limit=30&q=" + encodeURIComponent(query), auth).data || [];
  var movies = [];
  found.forEach(function (x) { if (x.type == "movie" && !ADULT[x.rating]) movies.push(x.id); });
  var details = {};
  if (movies.length) {
    http.json(VOD + "items?ids=" + movies.join(","), auth).forEach(function (v) { details[v._id] = v; });
  }
  var items = [], series = 0;
  found.forEach(function (x) {
    if (ADULT[x.rating]) return;
    if (x.type == "movie" && details[x.id]) {
      var v = details[x.id];
      items.push({
        url: "https://pluto.tv/on-demand/movies/" + x.id,
        title: v.name,
        author: "Pluto TV",
        duration: Math.round((v.duration || 0) / 1000) || -1,
        thumb: cover(v)
      });
    } else if (x.type == "series" && series < SERIES) {
      series++;
      var show = http.json(VOD + "series/" + x.id + "/seasons?offset=1000&page=1", auth);
      var first = (show.seasons || [])[0];
      ((first && first.episodes) || []).slice(0, EPISODES).forEach(function (e) {
        if (ADULT[e.rating]) return;
        items.push({
          url: "https://pluto.tv/on-demand/series/" + x.id + "/episode/" + e._id,
          title: show.name + " S" + e.season + "E" + e.number + " " + e.name,
          author: show.name,
          duration: Math.round((e.duration || 0) / 1000) || -1,
          thumb: cover(e)
        });
      });
    }
  });
  return { items: items, next: null };
}

function resolve(url) {
  var m = url.match(/([0-9a-f]{24})$/);
  if (!m) throw new Error("not a video link");
  var s = session();
  if (!s) throw new Error("Pluto TV is not available from this exit");
  return {
    url: STITCH + m[1] + "/master.m3u8?" + s.params + "&jwt=" + s.token + "&masterJWTPassthrough=true",
    hls: true
  };
}
