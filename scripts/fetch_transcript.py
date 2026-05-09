#!/usr/bin/env python3
"""
fetch_transcript.py
-------------------
YouTube動画から字幕を取得し、日本語/英語のペアを推定してJSONで出力する。

2つのモードがある:

[1] URLモード (APIキー不要)
    python fetch_transcript.py URL1 URL2 ... > sentences.json
    cat urls.txt | python fetch_transcript.py > sentences.json

[2] チャンネルモード (YouTube Data API v3キー必要)
    python fetch_transcript.py --channel @englishinthelounge --api-key KEY > out.json
    python fetch_transcript.py --channel @englishinthelounge --limit 10 > out.json
    python fetch_transcript.py --channel UCf3kGfjmYIyXMW7G9TG_IPA --limit 5 > out.json

    APIキーは環境変数 YOUTUBE_API_KEY からも読める。
    チャンネル指定は @handle / channel_id / チャンネルURL のいずれでもOK。

APIキーの取得方法 (5分):
    1. https://console.cloud.google.com/ でプロジェクト作成
    2. APIs & Services → Library で "YouTube Data API v3" を有効化
    3. Credentials → Create Credentials → API key
    無料枠: 1日10000ユニット (動画一覧取得は1リクエスト=1ユニット)

依存:
    pip install youtube-transcript-api

出力フォーマット:
    [{"jp": "...", "en": "...", "source": "https://..."}]
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import urlparse, parse_qs

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    sys.stderr.write("先に `pip install youtube-transcript-api` を実行してください\n")
    sys.exit(1)


# ---------- video id helpers ----------

def to_video_id(s):
    s = s.strip()
    if "youtu.be/" in s:
        return urlparse(s).path.lstrip("/").split("/")[0]
    if "youtube.com" in s:
        qs = parse_qs(urlparse(s).query)
        if "v" in qs:
            return qs["v"][0]
        parts = urlparse(s).path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] in ("shorts", "embed"):
            return parts[1]
    return s


# ---------- text classification ----------

JP_RE = re.compile(r"[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]")
EN_RE = re.compile(r"[A-Za-z]")


def is_jp(text):
    j = len(JP_RE.findall(text))
    e = len(EN_RE.findall(text))
    return j > 0 and j >= e


def is_en(text):
    j = len(JP_RE.findall(text))
    e = len(EN_RE.findall(text))
    return e > 2 and j == 0


def clean(text):
    text = text.replace("\n", " ").replace("[音楽]", "").replace("[Music]", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------- transcript ----------

def fetch_transcript(video_id):
    """日本語 → 英語 → なんでもの順で字幕を試す"""
    for langs in [["ja"], ["en"], None]:
        try:
            if langs is None:
                return YouTubeTranscriptApi.get_transcript(video_id)
            return YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
        except Exception:
            continue
    return []


def pair_segments(segments):
    """連続するJP/ENセグメントをペア化"""
    cleaned = [clean(s["text"]) for s in segments]
    cleaned = [c for c in cleaned if c]

    pairs = []
    i = 0
    while i < len(cleaned) - 1:
        a, b = cleaned[i], cleaned[i + 1]
        if is_jp(a) and is_en(b):
            pairs.append({"jp": a, "en": b})
            i += 2
        elif is_en(a) and is_jp(b):
            pairs.append({"jp": b, "en": a})
            i += 2
        else:
            i += 1
    return pairs


# ---------- YouTube Data API v3 ----------

API_BASE = "https://www.googleapis.com/youtube/v3"


def api_get(endpoint, params, api_key):
    params = {**params, "key": api_key}
    url = f"{API_BASE}/{endpoint}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.stderr.write(f"[api error {e.code}] {endpoint}: {body[:400]}\n")
        sys.exit(2)


def resolve_channel(channel_arg, api_key):
    """@handle / channel_id / URL を受け取り (channel_id, uploads_playlist_id) を返す"""
    arg = channel_arg.strip()

    # URLからhandleやchannel_idを抽出
    if arg.startswith("http"):
        path = urlparse(arg).path.strip("/")
        parts = path.split("/")
        if parts and parts[0].startswith("@"):
            arg = parts[0]
        elif len(parts) >= 2 and parts[0] == "channel":
            arg = parts[1]

    if arg.startswith("UC") and len(arg) == 24:
        params = {"part": "contentDetails", "id": arg}
    elif arg.startswith("@"):
        params = {"part": "contentDetails", "forHandle": arg}
    else:
        params = {"part": "contentDetails", "forHandle": "@" + arg}

    data = api_get("channels", params, api_key)
    items = data.get("items", [])
    if not items:
        sys.stderr.write(f"チャンネルが見つかりません: {channel_arg}\n")
        sys.exit(2)
    return items[0]["id"], items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def list_uploads(uploads_playlist_id, api_key, limit=None):
    """uploads playlistから (video_id, title) を新しい順にyield"""
    page_token = None
    fetched = 0
    while True:
        params = {
            "part": "contentDetails,snippet",
            "playlistId": uploads_playlist_id,
            "maxResults": 50,
        }
        if page_token:
            params["pageToken"] = page_token
        data = api_get("playlistItems", params, api_key)
        for item in data.get("items", []):
            yield item["contentDetails"]["videoId"], item["snippet"]["title"]
            fetched += 1
            if limit is not None and fetched >= limit:
                return
        page_token = data.get("nextPageToken")
        if not page_token:
            return


# ---------- main ----------

def process_video(vid, out):
    """1動画分を処理してoutに追加。戻り値はペア数"""
    url = f"https://www.youtube.com/watch?v={vid}"
    segs = fetch_transcript(vid)
    if not segs:
        return 0
    pairs = pair_segments(segs)
    for p in pairs:
        out.append({"jp": p["jp"], "en": p["en"], "source": url})
    return len(pairs)


def main():
    parser = argparse.ArgumentParser(
        description="YouTube動画から日本語/英語ペアを抽出してJSONで出力",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="使い方の詳細はファイル冒頭のdocstringを参照。",
    )
    parser.add_argument("urls", nargs="*", help="動画URL/ID (URLモード)")
    parser.add_argument("--channel", help="チャンネルURL / @handle / channel_id (チャンネルモード)")
    parser.add_argument("--api-key", default=os.environ.get("YOUTUBE_API_KEY"),
                        help="YouTube Data APIキー (環境変数 YOUTUBE_API_KEY からも読込)")
    parser.add_argument("--limit", type=int, default=None,
                        help="チャンネルモード時の動画数上限 (省略時は全件)")
    args = parser.parse_args()

    out = []

    if args.channel:
        if not args.api_key:
            sys.stderr.write("チャンネルモードには --api-key または YOUTUBE_API_KEY 環境変数が必要\n")
            sys.exit(1)
        sys.stderr.write(f"チャンネルを解決中: {args.channel}\n")
        channel_id, uploads = resolve_channel(args.channel, args.api_key)
        sys.stderr.write(f"  channel_id = {channel_id}\n  uploads    = {uploads}\n")
        suffix = f" (最新{args.limit}本)" if args.limit else ""
        sys.stderr.write(f"動画一覧を取得中{suffix}...\n")

        videos = list(list_uploads(uploads, args.api_key, args.limit))
        sys.stderr.write(f"{len(videos)}本見つかった。字幕を取得していく...\n\n")

        ok, skip = 0, 0
        for vid, title in videos:
            n = process_video(vid, out)
            label = title[:50] + ("…" if len(title) > 50 else "")
            if n > 0:
                ok += 1
                sys.stderr.write(f"  [ok]   {vid}  {n:3d} pairs  {label}\n")
            else:
                skip += 1
                sys.stderr.write(f"  [skip] {vid}  字幕なし   {label}\n")
        sys.stderr.write(f"\n完了: {ok}本処理 / {skip}本スキップ / 合計 {len(out)} pairs\n")

    else:
        # URLモード
        inputs = args.urls
        if not inputs:
            if sys.stdin.isatty():
                parser.print_help(sys.stderr)
                sys.exit(1)
            inputs = [line.strip() for line in sys.stdin if line.strip()]

        for raw in inputs:
            vid = to_video_id(raw)
            n = process_video(vid, out)
            if n > 0:
                sys.stderr.write(f"[ok]   {vid}: {n} pairs\n")
            else:
                sys.stderr.write(f"[skip] {vid}: 字幕なし\n")

    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
