var SITE = "https://kick.com";
var H = { Accept: "application/json" };
var EXPLICIT = /\b(xxx|porn\w*|nsfw|nude|nudes|onlyfans|fuck\w*)\b/i;
var RISQUE = /bikini|hot-tub/i;

function clean(title, cat) {
  if (EXPLICIT.test(title || "")) return false;
  return !(cat && RISQUE.test((cat.slug || "") + " " + (cat.name || "")));
}

function clip(c) {
  if (!c || !c.id || !c.channel || !clean(c.title, c.category)) return null;
  return {
    url: SITE + "/" + c.channel.slug + "/clips/" + c.id,
    title: c.title || c.channel.username,
    author: c.channel.username || c.channel.slug,
    duration: c.duration || -1,
    views: c.views || c.view_count || -1,
    thumb: c.thumbnail_url,
    date: c.created_at
  };
}

function live(l) {
  if (!l || !l.channel || !clean(l.title, l.category)) return null;
  return {
    url: SITE + "/" + l.channel.slug,
    title: l.title || l.channel.slug,
    author: l.channel.slug,
    duration: -1,
    views: l.viewer_count || -1,
    thumb: l.thumbnail ? l.thumbnail.src : null,
    date: l.start_time
  };
}

function push(items, x) { if (x) items.push(x); }

function search(query, next) {
  var state = next ? JSON.parse(next) : null;
  var items = [];
  if (state) {
    var more = http.json(SITE + state.path + "&cursor=" + encodeURIComponent(state.cursor), H);
    (more.clips || []).forEach(function (c) { push(items, clip(c)); });
    return { items: items, next: more.nextCursor ? JSON.stringify({ path: state.path, cursor: more.nextCursor }) : null };
  }
  var root = http.json(SITE + "/api/search?searched_word=" + encodeURIComponent(query), H);
  var q = query.toLowerCase().trim();
  var channels = (root.channels || []).filter(function (c) { return !c.is_banned && c.slug; })
      .sort(function (x, y) { return (y.followers_count || 0) - (x.followers_count || 0); });
  var exact = channels.filter(function (c) { return c.slug.toLowerCase() == q.replace(/\s+/g, ""); })[0];
  var cat = (root.categories || []).filter(function (c) { return (c.name || "").toLowerCase().indexOf(q) == 0; })[0];
  var plan = [];
  if (exact) plan.push(exact);
  if (cat) plan.push(cat);
  if (channels[0] && channels[0] != exact) plan.push(channels[0]);
  for (var i = 0; i < plan.length && !items.length; i++) {
    var isCat = plan[i] === cat;
    try {
      if (isCat) {
        var ls = http.json("https://web.kick.com/api/v1/livestreams?limit=8&sort=viewer_count_desc&category_id=" + cat.id, H);
        ((ls.data && ls.data.livestreams) || []).forEach(function (l) { push(items, live(l)); });
      } else if (plan[i].isLive) {
        var d = http.json(SITE + "/api/v2/channels/" + plan[i].slug + "/livestream", H).data;
        if (d) push(items, live({ channel: { slug: plan[i].slug }, title: d.session_title, category: d.category, viewer_count: d.viewer_count, thumbnail: d.thumbnail, start_time: d.created_at }));
      }
    } catch (e) {}
    var path = isCat ? "/api/v2/categories/" + cat.slug + "/clips?sort=view&time=month"
        : "/api/v2/channels/" + plan[i].slug + "/clips?sort=view&time=all";
    var page = http.json(SITE + path, H);
    (page.clips || []).forEach(function (c) { push(items, clip(c)); });
    if (items.length) return { items: items, next: page.nextCursor ? JSON.stringify({ path: path, cursor: page.nextCursor }) : null };
  }
  return { items: items, next: null };
}

function resolve(url) {
  var c = url.match(/\/clips\/(clip_[A-Za-z0-9]+)/);
  if (c) {
    var r = http.json(SITE + "/api/v2/clips/" + c[1], H).clip;
    if (!r || !r.video_url) throw new Error("video unavailable");
    return { url: r.video_url, hls: true, referer: SITE + "/", title: r.title || "", author: r.channel ? r.channel.username : "" };
  }
  var slug = url.match(/kick\.com\/([A-Za-z0-9_-]+)/);
  if (!slug) throw new Error("not a video link");
  var ch = http.json(SITE + "/api/v1/channels/" + slug[1], H);
  if (!ch.playback_url || !ch.livestream) throw new Error("channel is offline");
  return { url: ch.playback_url, hls: true, referer: SITE + "/", title: ch.livestream.session_title || "", author: ch.user ? ch.user.username : slug[1] };
}
