#!/usr/bin/env python3
"""
fetch_from_drive.py
-------------------
Google DriveフォルダからPDFを取得し、日本語/英語のペアを抽出してJSONで出力する。

使い方:
    1. 初回のみ: Google Cloud Consoleで認証情報をセットアップ
       - https://console.cloud.google.com/ でプロジェクト作成
       - APIs & Services → Library で "Google Drive API" を有効化
       - Credentials → Create Credentials → OAuth client ID (Desktop app)
       - credentials.json をダウンロードして scripts/ に配置

    2. 実行:
       python fetch_from_drive.py <FOLDER_ID> > sentences.json
       python fetch_from_drive.py <FOLDER_URL> > sentences.json
       python fetch_from_drive.py --all > sentences.json  # 全ファイル再取得

       初回実行時にブラウザで認証が求められる。
       認証後、token.json が作成され、以降は自動で認証される。

    3. 差分取得:
       .drive_cache.json にダウンロード済みファイルの情報を保存。
       2回目以降は新規/更新されたファイルのみ処理する。
       --all フラグで全ファイルを再取得。

依存:
    pip install -r requirements.txt

出力フォーマット:
    [{"jp": "...", "en": "...", "source": "<filename>"}]
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    import pdfplumber
except ImportError as e:
    sys.stderr.write(f"必要なライブラリがインストールされていません: {e}\n")
    sys.stderr.write("先に `pip install -r requirements.txt` を実行してください\n")
    sys.exit(1)


# ---------- 設定 ----------

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'
CACHE_FILE = '.drive_cache.json'


# ---------- text classification ----------

JP_RE = re.compile(r"[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]")
EN_RE = re.compile(r"[A-Za-z]")


def is_jp(text):
    """日本語が含まれるか判定"""
    j = len(JP_RE.findall(text))
    e = len(EN_RE.findall(text))
    return j > 0 and j >= e


def is_en(text):
    """英語が主体か判定"""
    j = len(JP_RE.findall(text))
    e = len(EN_RE.findall(text))
    return e > 2 and j == 0


def clean(text):
    """テキストをクリーニング"""
    text = text.replace("\n", " ").replace("[音楽]", "").replace("[Music]", "")
    # Remove Q○○ patterns (Q01, Q001, Q１, Q○○, Q〇〇, etc.) from beginning
    text = re.sub(r"^[Qq][0-9０-９○◯〇]+[\s:：]*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------- pairing ----------

def pair_lines(lines):
    """
    テキスト行のリストから日英ペアを抽出。
    連続するJP/ENをペア化する。
    """
    cleaned = [clean(line) for line in lines]
    cleaned = [c for c in cleaned if c and len(c) > 2]

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


# ---------- Google Drive API ----------

def authenticate():
    """Google Drive APIの認証を行う"""
    creds = None
    token_path = Path(__file__).parent / TOKEN_FILE
    creds_path = Path(__file__).parent / CREDENTIALS_FILE

    # token.json が存在する場合は読み込み
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    # 認証が無効または存在しない場合
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                sys.stderr.write(f"エラー: {CREDENTIALS_FILE} が見つかりません。\n")
                sys.stderr.write("Google Cloud Consoleで認証情報をダウンロードして配置してください。\n")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)

        # token.json に保存
        token_path.write_text(creds.to_json())

    return build('drive', 'v3', credentials=creds)


def extract_folder_id(folder_arg):
    """URLまたはIDからフォルダIDを抽出"""
    folder_arg = folder_arg.strip()
    if folder_arg.startswith("http"):
        # https://drive.google.com/drive/folders/1dAsgdLJvpdMuVYgolwBIjmIrbvy2Twxs
        match = re.search(r'/folders/([a-zA-Z0-9_-]+)', folder_arg)
        if match:
            return match.group(1)
    return folder_arg


def list_pdfs(service, folder_id):
    """指定フォルダ内のPDFファイル一覧を取得"""
    query = f"'{folder_id}' in parents and mimeType='application/pdf' and trashed=false"
    results = service.files().list(
        q=query,
        fields="files(id, name, modifiedTime)",
        orderBy="name"
    ).execute()
    return results.get('files', [])


def download_pdf(service, file_id):
    """PDFファイルをメモリにダウンロード"""
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)
    return fh


# ---------- PDF processing ----------

def extract_text_from_pdf(pdf_bytes):
    """PDFからテキストを抽出"""
    lines = []
    with pdfplumber.open(pdf_bytes) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.extend(text.split('\n'))
    return lines


# ---------- API upload ----------

def upload_to_api(sentences, api_url):
    """
    データをCloudflare Workers APIにアップロード
    """
    try:
        data = json.dumps(sentences, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(
            api_url,
            data=data,
            headers={
                'Content-Type': 'application/json',
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            return True, result
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return False, f"HTTP {e.code}: {body[:200]}"
    except Exception as e:
        return False, str(e)


# ---------- cache ----------

def load_cache():
    """キャッシュファイルを読み込み"""
    cache_path = Path(__file__).parent / CACHE_FILE
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    return {}


def save_cache(cache):
    """キャッシュファイルに保存"""
    cache_path = Path(__file__).parent / CACHE_FILE
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser(
        description="Google DriveフォルダからPDFを取得し日本語/英語ペアを抽出してJSONで出力",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="使い方の詳細はファイル冒頭のdocstringを参照。",
    )
    parser.add_argument("folder", nargs="?", help="Google DriveフォルダのIDまたはURL")
    parser.add_argument("--all", action="store_true", help="全ファイルを再取得（キャッシュ無視）")
    parser.add_argument("--upload-url", help="Cloudflare Workers APIのURL（指定するとアップロード）")
    args = parser.parse_args()

    if not args.folder:
        parser.print_help(sys.stderr)
        sys.exit(1)

    # 認証
    sys.stderr.write("Google Driveに接続中...\n")
    service = authenticate()

    # フォルダID取得
    folder_id = extract_folder_id(args.folder)
    sys.stderr.write(f"フォルダID: {folder_id}\n")

    # PDFファイル一覧取得
    sys.stderr.write("PDFファイル一覧を取得中...\n")
    files = list_pdfs(service, folder_id)
    sys.stderr.write(f"{len(files)}個のPDFファイルが見つかりました。\n\n")

    if not files:
        sys.stderr.write("PDFファイルが見つかりませんでした。\n")
        print(json.dumps([], ensure_ascii=False, indent=2))
        return

    # キャッシュ読み込み
    cache = {} if args.all else load_cache()
    new_cache = {}
    out = []

    # 各ファイルを処理
    processed = 0
    skipped = 0

    for file in files:
        file_id = file['id']
        file_name = file['name']
        modified_time = file['modifiedTime']

        # キャッシュチェック（差分取得）
        if file_id in cache and cache[file_id]['modifiedTime'] == modified_time:
            sys.stderr.write(f"  [skip] {file_name} (変更なし)\n")
            new_cache[file_id] = cache[file_id]
            skipped += 1
            continue

        # PDFダウンロード
        sys.stderr.write(f"  [fetch] {file_name} ...")
        try:
            pdf_bytes = download_pdf(service, file_id)
            lines = extract_text_from_pdf(pdf_bytes)
            pairs = pair_lines(lines)

            # 出力に追加
            for p in pairs:
                out.append({"jp": p["jp"], "en": p["en"], "source": file_name})

            sys.stderr.write(f" {len(pairs)}ペア取得\n")

            # キャッシュ更新
            new_cache[file_id] = {
                'name': file_name,
                'modifiedTime': modified_time,
                'pairs': len(pairs)
            }
            processed += 1

        except Exception as e:
            sys.stderr.write(f" エラー: {e}\n")
            skipped += 1

    # キャッシュ保存
    save_cache(new_cache)

    sys.stderr.write(f"\n完了: {processed}ファイル処理 / {skipped}ファイルスキップ / 合計 {len(out)}ペア\n")

    # API アップロード
    if args.upload_url and out:
        sys.stderr.write(f"\nAPIにアップロード中: {args.upload_url}\n")
        success, result = upload_to_api(out, args.upload_url)
        if success:
            sys.stderr.write(f"アップロード成功: {len(out)}ペアをアップロードしました\n")
        else:
            sys.stderr.write(f"アップロード失敗: {result}\n")
            sys.exit(1)

    # JSON出力
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
