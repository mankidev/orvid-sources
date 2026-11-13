var ADULT = /\b(xxx|porn\w*|nsfw|nude|nudes|naked|onlyfans|fuck\w*|hentai|sex\w*|handjob|blowjob|rimjob|footjob|cumshot|cum|creampie|anal|strap-?on|dildo|orgasm\w*|bdsm|femdom|fetish|cbt|ballbusting|facesitting|milf|boobs|tits|pussy|cock|dick|erotic\w*|mistress\w*|dominatrix|slave\w*|spank\w*|feminization|chastity|kink\w*)\b|эроти\w*|порн\w*|голы[емхйа]\w*|секс\w*|фемдом|мистресс\w*|госпож\w*|доминатрикс|фетиш\w*|бдсм|минет|оргазм\w*|18\+/i;

function search(query, next) {
  var offset = next ? parseInt(next, 10) : 0;
  var html = http.get("https://m.my.mail.ru/video/search?q=" + encodeURIComponent(query) + (offset ? "&offset=" + offset : ""));
  var chunks = html.split('<li class="list-item');
  var items = [];
  var cards = 0;
  for (var i = 1; i < chunks.length; i++) {
    var c = chunks[i];
    var link = c.match(/#srch=[^"]*?(https:\/\/my\.mail\.ru\/[^"#]+\.html)"/);
    var id = c.match(/video\/url\/(sc\d+\/\d+)/);
    if (!link || !id) continue;
    cards++;
    var title = c.match(/list-item__title[^>]*>([^<]*)</);
    title = title ? util.unescape(title[1]).trim() : "";
    if (!title || ADULT.test(title)) continue;
    var dur = c.match(/list-item__duration">([0-9:]+)</);
    var info = c.match(/list-item__info">([^<]*)</);
    var user = link[1].match(/my\.mail\.ru\/[a-z]+\/([^\/]+)\//);
    items.push({
      url: link[1],
      title: title,
      author: user ? user[1] : "",
      duration: dur ? util.duration(dur[1]) : -1,
      views: info && /\d/.test(info[1]) ? parseInt(info[1].replace(/\D/g, ""), 10) : -1,
      thumb: "https://my.mail.ru/+/video/url/" + id[1]
    });
  }
  return { items: items, next: cards >= 20 ? String(offset + cards) : null };
}

function resolve(url) {
  var html = http.get(url.replace("//my.mail.ru/", "//m.my.mail.ru/"));
  var id = html.match(/\/\+\/video\/meta\/(\d+)/);
  if (!id) id = http.get(url).match(/\/\+\/video\/meta\/(\d+)/);
  if (!id) throw new Error("video unavailable");
  var meta = http.json("https://my.mail.ru/+/video/meta/" + id[1]);
  var list = meta.videos || [];
  if (!list.length) throw new Error("video unavailable");
  var qualities = [];
  list.forEach(function (v) {
    var h = parseInt(v.key, 10);
    var u = v.url.indexOf("//") === 0 ? "https:" + v.url : v.url;
    if (h > 0) qualities.push({ height: h, url: u });
  });
  qualities.sort(function (a, b) { return b.height - a.height; });
  var best = qualities.length ? qualities[0].url : (list[0].url.indexOf("//") === 0 ? "https:" + list[0].url : list[0].url);
  var m = meta.meta || {};
  return { url: best, hls: false, title: m.title || "", author: meta.author && meta.author.name || "", qualities: qualities };
}
