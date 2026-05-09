# Lounge Translation Log

YouTube動画から日本語/英語の文ペアを取り込んで、毎日の瞬間英作文の練習タイムを記録できる学習アプリ。

[英語思考ラウンジ](https://www.youtube.com/@englishinthelounge/videos) などの瞬間英作文系チャンネルとの併用を想定。

## 構成

- **Webアプリ** (リポジトリ直下) — React 19 + Vite + Tailwind v4 のSPA。タイマー付き練習モード、文管理、履歴グラフ。データはブラウザの `localStorage` に保存。
- **`scripts/fetch_transcript.py`** — YouTubeから字幕を取得してJP/ENペアを推定したJSONを出力するPythonスクリプト。

## Quick start

### Webアプリを動かす

```bash
npm install
npm run dev
```

http://localhost:5173 を開く。

### 字幕を一括取得

```bash
cd scripts
pip install -r requirements.txt

# 単発URL
python fetch_transcript.py "https://www.youtube.com/watch?v=XXXXX" > sentences.json

# チャンネル一括 (要 YouTube Data API key)
export YOUTUBE_API_KEY=AIzaSy...
python fetch_transcript.py --channel @englishinthelounge --limit 10 > sentences.json
```

詳しい使い方は `scripts/fetch_transcript.py` の冒頭docstring参照。

### アプリへインポート

`sentences.json` の中身をアプリの **Sentences タブ → 右上 "Bulk import"** に貼り付け → プレビュー確認 → 一括追加。

## GitHub で管理する手順

```bash
# このディレクトリで
git init
git add .
git commit -m "Initial commit"

# GitHubで新規空リポジトリを作成してから
git remote add origin https://github.com/<your-name>/lounge-translation-app.git
git branch -M main
git push -u origin main
```

## デプロイ

[Vercel](https://vercel.com/) / [Netlify](https://www.netlify.com/) / [Cloudflare Pages](https://pages.cloudflare.com/) のいずれでも、GitHubリポジトリを連携するだけで自動デプロイされる。設定:

- Build command: `npm run build`
- Output directory: `dist`

データは各ユーザーのブラウザにのみ保存されるので、サーバ側の設定は不要。

## ディレクトリ構成

```
.
├── README.md
├── .gitignore
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   └── index.css
└── scripts/
    ├── fetch_transcript.py
    └── requirements.txt
```

## Tech stack

- React 19, Vite, Tailwind CSS v4
- lucide-react (icons)
- Fraunces / Plus Jakarta Sans / Noto Serif JP / JetBrains Mono (Google Fonts経由)
- Python 3.9+, youtube-transcript-api

## YouTube APIキーの取得

`--channel` モードで使う場合のみ必要。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. **APIs & Services → Library** で "YouTube Data API v3" を有効化
3. **Credentials → Create Credentials → API key** でキー発行

無料枠は1日10,000ユニット。動画一覧取得は50本につき1ユニット程度なので、個人利用には十分余裕がある。字幕本文の取得は `youtube-transcript-api` (非公式エンドポイント) 経由なのでクォータ消費はゼロ。

## ライセンス

未設定。個人利用前提。必要に応じて [MIT](https://choosealicense.com/licenses/mit/) などを追加してください。
