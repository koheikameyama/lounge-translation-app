# セットアップ手順

## ✅ 完了済み

- Cloudflare Pagesプロジェクト作成
- 本番環境へ初回デプロイ
- YouTube API キー設定
- 本番データベーススキーマ適用

**本番URL**: https://lounge-translation-app.pages.dev

## GitHub Secrets 設定（必須）

以下のSecretsをGitHubリポジトリに追加してください：

### 1. CLOUDFLARE_API_TOKEN

Cloudflare API Tokenを作成:

1. https://dash.cloudflare.com/profile/api-tokens にアクセス
2. "Create Token" をクリック
3. "Edit Cloudflare Workers" テンプレートを選択
4. Permissions を以下のように設定:
   - Account > Cloudflare Pages: Edit
   - Account > D1: Edit
5. "Continue to summary" → "Create Token"
6. 表示されたトークンをコピー

GitHubリポジトリの **Settings → Secrets and variables → Actions** で:
- Name: `CLOUDFLARE_API_TOKEN`
- Value: (コピーしたトークン)

### 2. CLOUDFLARE_ACCOUNT_ID

GitHubリポジトリの **Settings → Secrets and variables → Actions** で:
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: `f8348d8ba504aa3c35574d7a9a599a3c`

### 3. YOUTUBE_API_KEY

GitHubリポジトリの **Settings → Secrets and variables → Actions** で:
- Name: `YOUTUBE_API_KEY`
- Value: `AIzaSyBsnk1KsfPQo0G7qelCwHk1wSBBEpGVLVo`

### 4. CLOUDFLARE_API_URL

GitHubリポジトリの **Settings → Secrets and variables → Actions** で:
- Name: `CLOUDFLARE_API_URL`
- Value: `https://lounge-translation-app.pages.dev`

## 動作確認

1. GitHubで上記4つのSecretsを設定
2. このリポジトリをpush
3. **Actions** タブで "Deploy to Cloudflare Pages" ワークフローが自動実行されることを確認
4. 成功したら https://lounge-translation-app.pages.dev にアクセス

## 自動同期のテスト

GitHub → **Actions** → "Sync YouTube Videos" → **Run workflow** で手動実行してテスト。

成功すれば、以降は毎日JST 9:00に自動実行されます。
