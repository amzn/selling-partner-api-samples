#  SP-API 通知サンプルソリューション（Java + AWS CDK）

このプロジェクトは、[Amazon SP-API 通知](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference) を活用し、AWS サービスと Java を用いたイベント駆動・マルチクラウド統合のパイプラインを構築するサンプルソリューションです。

Amazon出品者向けに、スケーラブルかつセキュアで拡張性の高い通知処理パイプラインを提供します。内部処理ワークフロー、Webhook 転送、GCP Pub/Sub や Azure Service Bus などの外部クラウド連携に対応しています。

See also from the README in other language:
- [README.md](README.md) – English Developer guide
- [README.md](README_CN.md) – 中文开发者指南

---

## このソリューションでできること

SP-API通知を自社システムに統合するための、導入から応用までを支援します。初心者から上級者まで、様々なユースケースに対応しています。

📘ユースケース別の実装例については、[USAGE_GUIDE_JP.md](docs/USAGE_GUIDE_JP.md) をご参照ください。

---

## 主な機能

- Lambda 関数による通知タイプの Subscribe / Unsubscribe
- 通知イベントを以下の宛先に転送可能：
    - AWS SQS / EventBridge
    - GCP Pub/Sub
    - Azure Storage Queue / Service Bus
    - HTTP Webhook（オプションで認証ヘッダー付き）
- AWS Step Functions による内部処理オーケストレーション
- Secrets Manager を活用したセキュアなクレデンシャル管理
- CDK + Bash スクリプトによる完全自動化デプロイ

---

## ディレクトリ構成

```text
src/SPAPINotificationsSampleSolution/
│
├── app/                          # ランタイム設定とデプロイスクリプト
│   ├── config/                   # 設定ファイル & サンプル
│   │   ├── app-config.json
│   │   ├── notification-type-definition.json
│   │   └── example/             # 各通知パターンの設定例
│   ├── scripts/                 # デプロイスクリプト
│   │   ├── java/
│   │   ├── shared/
│   │   └── iam-policy.json
│   ├── sp-api-app-cdk/          # AWS CDK インフラ（TypeScript）
│   │   ├── lib/
│   │   ├── bin/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── step-functions/          # Step Function 定義ファイル
│   │   └── order-change-step-functions-workflow-definition.json
│   └── tools/                   # GCP / Azure 用 SecretsManager 登録スクリプト
│       ├── aws/                 # AWSリソース生成支援ツール
│       ├── gcp/                 # GCPキー用Secrets生成ツール
│       └── azure/               # Azureキー用Secrets生成ツール
│
├── code/java/                   # JavaベースのLambdaコード
│   ├── pom.xml                  # Maven構成
│   └── src/main/java/lambda/
│       ├── common/              # 共通定数、モデル、認証情報管理
│       ├── subscription/        # 通知Subscribe/Unsubscribeハンドラ
│       ├── process/             # 通知処理（内部/外部/Webhook）
│       └── utils/               # SecretsManagerやStep Functions支援コード
│
├── docs/                        # ドキュメント
│   ├── DEPLOYMENT.md            # 英語のデプロイ手順
│   ├── DEPLOYMENT_JP.md         # 日本語のデプロイ手順
│   └── secret-example.csv       # 認証情報CSVの例
```

---

## クイックスタート

- [DEPLOYMENT_JP.md](docs/DEPLOYMENT_JP.md) – 日本語による導入手順

1. 事前準備：AWS CLI、Node.js (14+)、Maven、GitBash (Windows)、jq をインストール
2. [SP-APIアプリの登録](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
3. `app/config/app-config.json` を編集し、`client_secrets.csv` を準備
4. デプロイ：
   ```bash
   cd app/scripts/java
   bash java-app.sh
   ```
5. 通知購読：デプロイ後、Lambda `SPAPISubscribeNotificationsLambdaFunction-<suffix>` を AWS Console または CLI から呼び出す

---

## コンポーネント構成

| コンポーネント          | 説明                                                                 |
|------------------------|----------------------------------------------------------------------|
| **Secrets Manager**    | SP-APIの認証トークンや出品者情報を安全に管理                        |
| **Lambda (Java)**      | 通知の登録・処理・転送・DLQ処理を実行                                |
| **SQS/EventBridge**    | 通知を受け取り、他のサービスへルーティング                           |
| **Step Functions**     | 通知に対する一連の処理を状態遷移で管理                               |
| **DynamoDB**           | 通知設定や認証情報の保存に利用                                       |
| **CDK (TypeScript)**   | app-config.json に基づきAWSリソースを自動構築                         |

---

## Subscribe Lambda の入力例

```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["SELLERID123", "SELLERID456"]
}
```

実行対象: `SPAPISubscribeNotificationsLambdaFunction-<suffix>`

---

## ドキュメント一覧

- [DEPLOYMENT_JP.md](docs/DEPLOYMENT_JP.md) – 日本語による導入手順
- [secret-example.csv](docs/secret-example.csv) – 出品者ごとの認証情報CSVサンプル
- [notification-type-definition.json](app/config/notification-type-definition.json) – 通知タイプ定義一覧

---

## クリーンアップ

すべてのAWSリソースを削除するには：

```bash
bash java-app-clean.sh
```

これにより、Lambda・SQS・Secrets・Step Functions・CDKスタックがすべて削除されます。

---

##  開発メモ

- Java 17 + Maven 対応
- Lambdaハンドラは `lambda.subscription`, `lambda.process`, `lambda.utils` 配下に配置
- 複数出品者登録・DLQ処理にも対応
- SecretsManagerの制限に応じて認証情報は分割して保存

---