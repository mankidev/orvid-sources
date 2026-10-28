# Orvid sources

Source repository for [Orvid](https://github.com/mankidev/orvid). Orvid ships without sources. To add this repository, open Filters → Repositories → Add repository in Orvid and paste:

```
https://raw.githubusercontent.com/mankidev/orvid-sources/main/
```

## Other repositories

Orvid also lists these under Filters → Repositories once this repository is added.

| Repository | Link |
|---|---|
| Orvid secret (18+) | `https://raw.githubusercontent.com/mankidev/orvid-sources-secret/main/` |

## Source format

Each source is one JSON file with an `id`, a `name` and one of three bodies:

- `engine`: turns on a source built into Orvid, such as `youtube`.
- `html`: describes a site's search page with a card marker and regular expressions for link, title, thumbnail, duration and views. Orvid finds the stream in the video page (`<source>` tags, KVS players, an optional `iframe`).
- `script`: a JavaScript file with `search(query, next)` and `resolve(url)`. Scripts run in a sandbox and reach the network only through `http.get`, `http.post` and `http.json`, which go over Tor. `util.duration`, `util.number` and `util.unescape` parse common page text.

`match` is the regular expression for the source's video links, `adult` marks 18+ sources, `weight` (0.1 to 1) sets how high results rank and `lang` limits a source to queries in one script (`cyrillic`, `arabic`, `hangul`).

For sites that answer slowly over Tor, `html.timeout` (5 to 60 seconds, default 15) sets how long Orvid waits, `html.maxHeight` caps the video quality, and `hedge` (1 to 6) sends each request over that many Tor circuits at once. Orvid keeps the circuit that answered first and plays the video through it.

A source with `"portal": true` needs no `match` and keeps every link it finds. Links from sites Orvid knows play through that source, other pages through Orvid's generic player. `"torless": true` turns a source off while Tor is on. The DuckDuckGo and Yandex sources use both, because search engines block Tor. While Tor is off, they see your IP address and your search. `"torPlayback": false` keeps a source searchable over Tor but shows a note that its videos do not play there.

`search` returns `{items: [{url, title, author, duration, views, thumb, date}], next}`. It can return `skip: true` with no items when the query does not suit the source, such as a Telegram search that is not a channel name. `resolve` returns `{url, hls, referer, title, author, subtitles}`, where `subtitles` is a list of `{url, lang, label}` WebVTT or SRT files.

## Build

```sh
python3 tools/build.py
```

The script hashes every file into `index.json` and signs it into `index.sig` with the EC key in `ORVID_SOURCES_KEY` (default `~/keys/orvid-sources.pem`). Orvid pins the key the first time a repository is added and refuses updates signed with another key.

## License

GPL-3.0-or-later.
