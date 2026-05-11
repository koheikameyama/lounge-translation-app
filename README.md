# Lounge Translation Log

Google DriveのPDFから日本語/英語の文ペアを取り込んで、毎日の瞬間英作文の練習タイムを記録できる学習アプリ。

[英語思考ラウンジ](https://www.youtube.com/@englishinthelounge/videos) などの瞬間英作文系チャンネルのPDFとの併用を想定。

## 構成

- **Webアプリ** (リポジトリ直下) — React 19 + Vite + Tailwind v4 のSPA。タイマー付き練習モード、文管理、履歴グラフ。データはブラウザの `localStorage` に保存。
- **`scripts/fetch_from_drive.py`** — Google DriveフォルダからPDFを取得してJP/ENペアを推定したJSONを出力するPythonスクリプト。

## Quick start

### Webアプリを動かす

```bash
npm install
npm run dev
```

http://localhost:5173 を開く。

### Google DriveからPDFを一括取得

```bash
cd scripts
pip install -r requirements.txt

# 初回のみ: Google Cloud Consoleで認証情報をセットアップ
# 1. https://console.cloud.google.com/ でプロジェクト作成
# 2. APIs & Services → Library で "Google Drive API" を有効化
# 3. Credentials → Create Credentials → OAuth client ID (Desktop app)
# 4. credentials.json をダウンロードして scripts/ に配置

# Google DriveフォルダからPDF取得
python fetch_from_drive.py "https://drive.google.com/drive/folders/FOLDER_ID" > sentences.json

# 2回目以降は差分のみ取得（新規/更新されたファイルのみ）
python fetch_from_drive.py "FOLDER_ID" > sentences.json

# 全ファイル再取得
python fetch_from_drive.py "FOLDER_ID" --all > sentences.json
```

詳しい使い方は `scripts/fetch_from_drive.py` の冒頭docstring参照。

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

### Cloudflare Pages + D1 (推奨)

Cloudflare Pagesにデプロイし、D1データベースでGoogle Driveから自動更新を実現します。

#### 1. Cloudflare Pagesにデプロイ

1. [Cloudflare Pages](https://pages.cloudflare.com/) にログイン
2. **Create a project** → **Connect to Git** → GitHubリポジトリを選択
3. ビルド設定:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Save and Deploy**

#### 2. D1データベース作成

```bash
# Cloudflare CLIインストール（未インストールの場合）
npm install -g wrangler

# ログイン
wrangler login

# D1データベース作成
wrangler d1 create lounge-translation-db

# データベースIDをコピーして wrangler.toml に記載
```

#### 3. スキーマ適用とマイグレーション

```bash
# 初回: スキーマ作成
wrangler d1 execute lounge-translation-db --file=schema.sql

# マイグレーション実行
wrangler d1 execute lounge-translation-db --file=migrations/0001_add_source_to_sentences.sql
```

#### 4. Pages と D1 を連携

1. Cloudflare Dashboard → **Workers & Pages** → デプロイしたプロジェクト
2. **Settings** → **Bindings** → **Add binding**
3. Variable name: `DB`、D1 Database: `lounge-translation-db`
4. **Save**

#### 5. GitHub Secrets設定（自動更新用）

GitHub リポジトリの **Settings** → **Secrets and variables** → **Actions** で以下を追加:

| Secret名 | 説明 | 取得方法 |
|---------|------|---------|
| `GOOGLE_DRIVE_CREDENTIALS` | Google Drive API認証情報 | `scripts/credentials.json` の内容をコピー |
| `GOOGLE_DRIVE_TOKEN` | Google Drive認証トークン | `scripts/token.json` の内容をコピー（初回fetch実行後に生成される） |
| `GOOGLE_DRIVE_FOLDER_ID` | PDFフォルダID | `1dAsgdLJvpdMuVYgolwBIjmIrbvy2Twxs` |
| `CLOUDFLARE_API_URL` | Workers API URL | `https://your-project.pages.dev/api/sentences` |

#### 6. 自動更新の動作確認

GitHub リポジトリの **Actions** タブから **Sync PDF Data** ワークフローを手動実行して確認。

---

### その他のプラットフォーム（静的サイトのみ）

[Vercel](https://vercel.com/) / [Netlify](https://www.netlify.com/) でもデプロイ可能ですが、D1データベースとの連携はできません。

- Build command: `npm run build`
- Output directory: `dist`

データは各ユーザーのブラウザのlocalStorageに保存されます。

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
├── scripts/
│   ├── fetch_from_drive.py      # Google Drive → PDF → JSON（推奨）
│   ├── fetch_transcript.py      # YouTube → 字幕 → JSON（レガシー）
│   ├── requirements.txt
│   ├── credentials.json         # Google Drive API認証（gitignore）
│   ├── token.json              # 認証トークン（自動生成、gitignore）
│   └── .drive_cache.json       # ダウンロード履歴（自動生成、gitignore）
└── pdf/                        # ローカルPDFファイル置き場（オプション）
```

## Tech stack

- React 19, Vite, Tailwind CSS v4
- lucide-react (icons)
- Fraunces / Plus Jakarta Sans / Noto Serif JP / JetBrains Mono (Google Fonts経由)
- Python 3.9+
  - Google Drive API (google-api-python-client, google-auth, google-auth-oauthlib)
  - pdfplumber (PDF解析)

## Google Drive API認証の設定

`fetch_from_drive.py` を使う場合に必要。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. **APIs & Services → Library** で "Google Drive API" を有効化
3. **Credentials → Create Credentials → OAuth client ID** を選択
   - Application type: **Desktop app**
   - Name: 任意（例: "Lounge Translation App"）
4. 作成後、**Download JSON** ボタンで `credentials.json` をダウンロード
5. ダウンロードした `credentials.json` を `scripts/` ディレクトリに配置

初回実行時にブラウザで認証画面が開きます。認証後、`token.json` が自動生成され、以降は自動で認証されます。

## ライセンス

未設定。個人利用前提。必要に応じて [MIT](https://choosealicense.com/licenses/mit/) などを追加してください。
