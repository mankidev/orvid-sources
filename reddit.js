var EXPLICIT = /\b(nsfw|porn\w*|nude|nudes|onlyfans|xxx|sex\w*|leak\w*|hentai|gonewild\w*|18\+)\b/i;

function tag(entry, name) {
  return (entry.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">")) || [])[1] || "";
}

function search(query, next) {
  var xml = http.get("https://www.reddit.com/search.rss?sort=relevance&include_over_18=off&q="
      + encodeURIComponent(query + " site:v.redd.it") + (next ? "&after=" + next : ""));
  var entries = xml.split("<entry>").slice(1);
  var items = [], last = null;
  entries.forEach(function (e) {
    last = tag(e, "id") || last;
    var content = util.unescape(tag(e, "content"));
    var video = (content.match(/https:\/\/v\.redd\.it\/([A-Za-z0-9]+)/) || [])[1];
    if (!video) return;
    var title = util.unescape(tag(e, "title")).replace(/\s+/g, " ").trim();
    var sub = (e.match(/<category[^>]*label="([^"]+)"/) || [])[1] || "";
    if (EXPLICIT.test(title) || EXPLICIT.test(sub)) return;
    var thumb = (e.match(/<media:thumbnail url="([^"]+)"/) || [])[1]
        || (content.match(/<img src="([^"]+)"/) || [])[1];
    items.push({
      url: "https://v.redd.it/" + video,
      title: title,
      author: sub,
      duration: -1,
      thumb: thumb ? util.unescape(thumb) : null,
      date: tag(e, "published")
    });
  });
  return { items: items, next: entries.length >= 25 && last ? last : null };
}

function resolve(url) {
  var m = url.match(/v\.redd\.it\/([A-Za-z0-9]+)/);
  if (!m) throw new Error("not a video link");
  return { url: "https://v.redd.it/" + m[1] + "/HLSPlaylist.m3u8", hls: true, referer: "https://www.reddit.com/" };
}
