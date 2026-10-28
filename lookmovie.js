var SITE = "https://www.lookmovie2.to";

var LANGS = { english: "en", turkish: "tr", german: "de", french: "fr", spanish: "es", italian: "it", portuguese: "pt",
  russian: "ru", arabic: "ar", persian: "fa", dutch: "nl", polish: "pl", romanian: "ro", greek: "el", hebrew: "he",
  hungarian: "hu", czech: "cs", swedish: "sv", norwegian: "no", danish: "da", finnish: "fi", bulgarian: "bg",
  croatian: "hr", serbian: "sr", bosnian: "bs", japanese: "ja", korean: "ko", chinese: "zh", indonesian: "id",
  vietnamese: "vi", thai: "th", hindi: "hi", ukrainian: "uk", estonian: "et", latvian: "lv", lithuanian: "lt",
  macedonian: "mk", icelandic: "is", malayalam: "ml", slovenian: "sl", slovak: "sk", malay: "ms" };

function text(s) {
  return util.unescape(String(s || "")).replace(/\s+/g, " ").trim();
}

function search(query, next) {
  query = query.replace(/(^|\s)(film|filmi|filmini|movie|movies)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  if (!query) return { items: [], next: null };
  var page = next ? parseInt(next, 10) : 1;
  var html = http.get(SITE + "/movies/search/?q=" + encodeURIComponent(query) + (page > 1 ? "&page=" + page : ""));
  var items = [];
  var seen = {};
  var cards = html.split('<div class="movie-item-style-2');
  for (var i = 1; i < cards.length; i++) {
    var b = cards[i];
    var link = b.match(/href="(\/movies\/view\/[^"]+)"/);
    if (!link || seen[link[1]]) continue;
    seen[link[1]] = true;
    var title = b.match(/<h6>\s*<a[^>]*>([^<]+)<\/a>/) || b.match(/alt="([^"]+)"/);
    var year = b.match(/<p class="year">(\d{4})<\/p>/);
    var thumb = b.match(/data-src="(\/images\/[^"]+)"/);
    items.push({
      url: SITE + link[1],
      title: (title ? text(title[1]) : "") + (year ? " (" + year[1] + ")" : ""),
      author: "",
      duration: -1,
      views: -1,
      kind: "movie",
      thumb: thumb ? SITE + thumb[1] : null
    });
  }
  var more = html.indexOf("page=" + (page + 1)) >= 0;
  return { items: items, next: more && items.length > 0 ? String(page + 1) : null };
}

function resolve(url) {
  var view = http.get(url);
  var play = view.match(/href="(\/movies\/play\/[^"]+)"/);
  if (!play) throw new Error("video unavailable");
  var page = http.get(SITE + play[1], { Referer: url });
  var id = page.match(/id_movie:\s*(\d+)/);
  var hash = page.match(/hash:\s*"([^"]+)"/);
  var expires = page.match(/expires:\s*(\d+)/);
  if (!id || !hash || !expires) throw new Error("video unavailable");
  var root = http.json(SITE + "/api/v1/security/movie-access?id_movie=" + id[1] + "&hash=" + hash[1] + "&expires=" + expires[1],
      { "X-Requested-With": "XMLHttpRequest", Referer: SITE + play[1] });
  if (!root.success || !root.streams) throw new Error("video unavailable");
  var qualities = [];
  ["1080p", "720p", "480p", "360p"].forEach(function (k) {
    if (root.streams[k]) qualities.push({ url: root.streams[k], height: parseInt(k, 10) });
  });
  if (!qualities.length) throw new Error("video unavailable");
  var subtitles = [];
  var have = {};
  (root.subtitles || []).forEach(function (s) {
    if (!s || !s.file) return;
    var name = text(s.language);
    var lang = LANGS[name.toLowerCase()] || null;
    var key = lang || name;
    if (have[key]) return;
    have[key] = true;
    subtitles.push({ url: s.file.indexOf("http") == 0 ? s.file : SITE + s.file, lang: lang, label: name });
  });
  var title = page.match(/<title>Watch movie (.+?) on lookmovie/);
  return { url: qualities[0].url, hls: true, referer: SITE + "/", title: title ? text(title[1]) : "",
    qualities: qualities, subtitles: subtitles };
}
