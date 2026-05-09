# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業するときに参照する文脈情報。

## プロジェクト概要

YouTube動画(主に[英語思考ラウンジ](https://www.youtube.com/@englishinthelounge/videos)等の瞬間英作文系チャンネル)から日本語/英語の文ペアを取り込んで、毎日の翻訳練習タイムを記録する個人用学習アプリ。

**意図的に backend なし、auth なし、ユーザー間共有なし**。データは各ユーザーのブラウザ `localStorage` にのみ存在する。これは設計判断であり、「クラウド同期」「ユーザー登録」等の追加は明示的な依頼がない限り行わないこと。

## 全体構成

2つの独立コンポーネントから成る:

```
[Webアプリ] ← bulk-import (paste) ← [Pythonスクリプト] → YouTube
   localStorage                          stdout (JSON)
```

- **Webアプリ** (リポジトリ直下) — 練習・記録・閲覧のフロントエンド
- **`scripts/fetch_transcript.py`** — 字幕取得とペア化のCLI

両者は**ファイル(JSON)経由でしか繋がっていない**。Webアプリから直接YouTubeを叩く設計にはしない (CORS、レート制限、APIキー露出のため)。

## 開発コマンド

```bash
# Web
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # ビルド成果物のローカル確認

# Python (scripts/)
pip install -r requirements.txt
python fetch_transcript.py "<URL>"
python fetch_transcript.py --channel @handle --limit N --api-key KEY
```

リント・フォーマット・テストは現時点で未設定。追加する場合は package.json の scripts に登録すること。

## アーキテクチャ

### 状態管理 (Web)

- **単一ストア**: `App.jsx` のトップレベル `data` state に全状態を保持
- **永続化**: `localStorage` のキー `lounge-translation-app-v1` に JSON.stringify したものを書き込む
- **書き込み口は1箇所**: `persist(newData)` 関数。これ以外で localStorage を直接変更しない
- **読み込み**: 起動時の `useEffect` で1回だけ。以降はメモリ上の state がソース・オブ・トゥルース

### データスキーマ

```ts
{
  sentences: Array<{
    id: string,            // uid()で生成
    jp: string,            // 日本語文
    en: string,            // 英語文
    source: string,        // 動画URL等 (空文字可)
    createdAt: number,     // Date.now()
  }>,
  sessions: Array<{
    id: string,
    date: string,          // 'YYYY-MM-DD' (ローカルタイム)
    attempts: Array<{
      sentenceId: string,
      ms: number,          // 思い出すまでにかかった時間
      result: 'got' | 'close' | 'miss',
    }>,
  }>,
}
```

**日付は文字列**(`YYYY-MM-DD`)で保存している点に注意。Date オブジェクトのシリアライズ問題を避けるため。タイムゾーンは端末ローカル。

**1日1セッション**: 同じ日に複数回練習しても `sessions` 配列内の同じ日付エントリの `attempts` に追記される (`PracticeView` の保存処理を参照)。

### スキーマ変更時のルール

データ形状を変えるときは:

1. STORAGE_KEY のバージョン suffix を上げる (`-v1` → `-v2`)
2. もしくは `useEffect` の load 部に migration ロジックを追加して旧データを変換
3. 黙って breaking change を入れると既存ユーザーのデータが消えるので避ける

### View ルーティング

`view` state (`'home' | 'practice' | 'sentences' | 'history'`) で切り替え。React Router 等は使っていない。URL に状態は残らない。Viewを増やすときは:

1. `Header` の `tabs` 配列に追加
2. `App` の `<main>` 内で条件レンダリング
3. View コンポーネント本体を実装

### 練習タイマーのライフサイクル

`PracticeView` が複雑なので注意:

- `phase`: `'ready'` → `'timing'` → `'revealed'` → 次の問題で `'ready'` に戻る、最後で `'done'`
- `'timing'` 開始時に `setStartTs(Date.now())`、`setInterval` で50ms毎に `now` を更新
- `'revealed'` で interval を止めて、ユーザーの自己評価を待つ
- `'done'` 到達時に `attempts` をその日のセッションへ書き込む。`sessionSavedRef` で二重保存を防ぐ

## 字幕スクリプト (`scripts/fetch_transcript.py`)

### モード

- **URLモード**: 動画URL/IDを引数 or stdin から受け取り、各動画の字幕を取得
- **チャンネルモード**: `--channel` + APIキーで、チャンネルのアップロード一覧を YouTube Data API v3 で取得 → 各動画の字幕を取得

### ペア化ヒューリスティック

字幕セグメントを順に走査し、「日本語っぽいセグメントの直後に英語っぽいセグメントが来たら1ペア」とする (`pair_segments` 関数)。日本語/英語の判定はひらがな・カタカナ・漢字とラテン文字の出現数で行う簡易判定。

**前提**: 動画の字幕がほぼ「JP→EN→JP→EN…」の交互構造。瞬間英作文系チャンネルではこれがハマる。会話形式や混在動画では精度が落ちるため、出力JSONはアプリへインポート前に人間がチェックする運用。

このヒューリスティックを変更するなら、必ず複数の実動画でテストしてから入れること(瞬間英作文系・会話系・解説系それぞれで挙動を確認)。

### 字幕取得

`youtube-transcript-api` 経由 (= YouTubeの非公開 timedtext エンドポイント)。公式 YouTube Data API の captions エンドポイントは:

- 自動生成字幕(ASR)はそもそも一覧に出ない
- 手動字幕はオーナーOAuth認証が必須

…の制約で第三者の字幕は取れないため、非公式経路を使っている。**この事情は変えられないので、「公式APIに置き換えて」という指示が来てもそれは技術的に不可能と返答すること**。

### YouTube Data API の使い所

`channels.list` (チャンネル解決) と `playlistItems.list` (動画一覧) のみ。クォータ消費は最小限 (1000本取っても20ユニット程度)。`captions` エンドポイントは上記の理由で使っていない。

## 技術スタック

- **React 19** — `createRoot`, StrictMode 使用。レガシー API は使わない
- **Vite 6** — ビルドツール。設定はほぼデフォルト
- **Tailwind CSS v4** — `@tailwindcss/vite` プラグイン経由で設定。`tailwind.config.js` も `postcss.config.js` も**ない**(v4はゼロコンフィグが基本)。`src/index.css` に `@import "tailwindcss"` だけで動く
- **lucide-react** — アイコン
- **Google Fonts** — `App.jsx` 内の `<style>` タグで `@import` (パフォーマンス改善するなら `index.html` の `<link>` に移してもよい)

### Tailwind v4 の注意点

- v3との違いを把握すること: `tailwind.config.js` がデフォルトで不要、テーマカスタマイズは `@theme` ブロックを CSS 内に書く
- v3用の記法をそのまま入れないこと

## コーディング規約

- **単一ファイル構成**: 現状 `App.jsx` が1ファイル。1000行を超えてきたらコンポーネント分割を検討するが、現時点では1ファイルのままで OK
- **インラインスタイル併用**: Tailwind ユーティリティで足りない動的な値(背景色の動的切替など)は `style={{}}` で書いている。これは意図的
- **絵文字・装飾過多のUI禁止**: 既存のトーン(エディトリアル風、Fraunces serif + amber accent)を崩さない
- **新規依存追加は慎重に**: バンドルサイズに直結する。アイコンは `lucide-react` から取る、UIライブラリ(Material UI 等)は入れない

## やってはいけないこと

- **localStorage 以外への永続化を勝手に追加しない** (Firebase, Supabase 等)
- **データシェーピング** を黙って変えない (上記スキーマ変更ルール参照)
- **公式 YouTube API を字幕取得に使おうとしない** (技術的に無理)
- **`window.storage`** を使わない(これはClaudeのartifact環境固有のAPIで、ブラウザでは存在しない)
- **`<form>` を React コンポーネントで使わない** (Enterキーでの誤submitを避けるため、ボタン+onClickを使用)

## よくあるタスク

### 文の新フィールド追加 (例: タグ)

1. `App.jsx` の `emptyData()` の seed データに `tags: []` を追加
2. `SentencesView` の入力欄を追加
3. `PracticeView` で表示したければ `current.tags` を参照
4. スキーマ変更扱いになるので STORAGE_KEY を `-v2` に変更 or migration を書く

### View 追加

`tabs` 配列に追加 → `App` の条件レンダリング追加 → コンポーネント本体実装。

### スクリプトの拡張

`fetch_transcript.py` に新しいモードを追加するときは `argparse` の subcommand ではなく現状のフラグ方式を踏襲(シンプルさ優先)。
