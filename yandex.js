var SITE = "https://yandex.com";

function objectAt(text, start) {
  var depth = 0, quoted = false;
  for (var i = start; i < text.length; i++) {
    var c = text.charAt(i);
    if (quoted) {
      if (c == "\\") i++;
      else if (c == "\"") quoted = false;
    } else if (c == "\"") quoted = true;
    else if (c == "{") depth++;
    else if (c == "}" && --depth == 0) return text.substring(start, i + 1);
  }
  return null;
}

function clip(text, id) {
  var at = text.indexOf("\"" + id + "\":{\"videoId\":\"" + id + "\",\"title\"");
  if (at < 0) return null;
  var body = objectAt(text, text.indexOf("{", at));
  try {
    return body ? JSON.parse(body) : null;
  } catch (e) {
    return null;
  }
}

function poster(text, id) {
  var m = new RegExp("\"" + id + "\":\\{\"videoId\":\"" + id + "\",\"docid\"[^{}]*?\"preview\":\\{\"posterSrc\":\"([^\"]+)\"").exec(text);
  return m ? (m[1].indexOf("//") == 0 ? "https:" + m[1] : m[1]) : null;
}

function search(query, next) {
  if (!query) return { items: [], next: null };
  var page = next ? parseInt(next, 10) : 0;
  var text = http.get(SITE + "/video/search?text=" + encodeURIComponent(query) + "&family=yes&p=" + page);
  if (/SmartCaptcha|showcaptcha/.test(text) && text.indexOf("\"videoSnippet\"") < 0) throw new Error("Captcha needed (Yandex)");
  var ids = [], seen = {};
  var re = /"type":"videoSnippet","props":\{"videoId":"(\d+)"/g, m;
  while ((m = re.exec(text))) {
    if (!seen[m[1]]) {
      seen[m[1]] = true;
      ids.push(m[1]);
    }
  }
  var items = [];
  ids.forEach(function (id) {
    var c = clip(text, id);
    if (!c || !c.host || !c.host.href || c.isAdultDoc) return;
    var url = c.host.href.replace(/^http:\/\//, "https://");
    items.push({
      url: url,
      title: c.cleanTitle || (c.title || "").replace(/\u0007[\[\]]/g, ""),
      author: c.host.secondPart && c.host.secondPart.name ? c.host.secondPart.name : c.host.title || "",
      duration: c.duration && c.duration.value ? c.duration.value : -1,
      views: c.views && c.views.text ? util.number(c.views.text) : -1,
      thumb: poster(text, id),
      date: c.modifyTime ? Math.round(c.modifyTime / 1000) : null
    });
  });
  return { items: items, next: items.length ? String(page + 1) : null };
}
