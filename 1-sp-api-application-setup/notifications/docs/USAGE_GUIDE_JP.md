# 使用ガイド: SP-API 通知サンプルソリューション

このドキュメントは、スキルレベルやシステム環境に応じてこのソリューションをどのように活用できるかを具体的に紹介します。

本READMEからも参照可能：

- [DEPLOYMENT_JP.md](./DEPLOYMENT_JP.md) – セットアップ & デプロイガイド

このドキュメントは、メインの [日本語ガイド](../README_JP.md) を補完する形で、Amazon SP-API 通知の活用シナリオ、アーキテクチャ設計、Java 実装例を提供します。

---

## このソリューションでできること

このソリューションは、SP-API 通知を活用したエンドツーエンドの処理パイプラインを構築・テストするための手段を提供します。
スキルレベルやシステム要件に応じて、以下のように始められます：

### 初級者向け
SP-API がどのようなイベントメッセージを送ってくるかを理解するには、**Internal パターンのデフォルト構成**で通知をログに出力して確認します。

```json
{
  "NotificationTypes": [
    {
      "NotificationType": "ORDER_CHANGE"
    },
    {
      "NotificationType": "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"
    }
  ]
}
```
- 上記の構成でデプロイ
- 対応する Lambda 関数の CloudWatch Logs を確認
- **通知構造とタイミングを理解するための最適な方法です。**

### 中級者向け
ユースケースや通知タイプ（NotificationTypes）が明確になったら、通知をどこへ転送するかを決定します。
システム環境に応じて適切な転送先を選択してください：

#### AWS を使用している場合：
**CrossPlatform → AWS SQS または AWS EventBridge** を選択
- 既に SQS ベースのマイクロサービスや EventBridge 連携を使っている環境に最適です。

#### GCP を使用している場合：
**CrossPlatform → GCP Pub/Sub** を使用
- 通知を直接 GCP のトピックに転送します。Secrets Manager を通じた認証情報の管理が必要です。

[GCP 用 SecretsManager キー生成手順](../app/tools/gcp/README.md)

#### Azure を使用している場合：
**CrossPlatform → Azure Storage Queue または Azure Service Bus** を使用
- 単純な処理には Storage Queue、大規模なメッセージングには Service Bus が適しています。

[Azure Storage Queue 用キー生成](../app/tools/azure/storage-queue/README.md)  
[Azure Service Bus 用キー生成](../app/tools/azure/sb-queue/README.md)

#### オンプレミス／ハイブリッド構成の場合：
**Webhook** を使用
- HTTP POST による通知転送。認証トークンを含むカスタムヘッダーの設定も可能です。

すべてのパターンで、任意の Lambda 処理や DLQ（デッドレターキュー）処理を組み合わせることが可能です。

### 上級者向け
通知を AWS 内部でフルに処理したい場合、**Step Functions + Lambda の組み合わせ**によってワークフローを構築できます。

- 定義ファイル：`step-functions/order-change-step-functions-workflow-definition.json`
- 対応ハンドラ：`code/java/src/main/java/lambda/process/internal/orderchange`

---

## Lambda ハンドラ実装例

通知処理の中核となる Lambda を実装する手順は以下の通りです：

1. `RequestHandler<Map<String, Object>, String>` を実装
2. SP-API イベントのペイロードを解析
3. 任意の処理（ログ出力、外部サービス連携、Step Functions 呼び出しなど）を実行

```java
public class SQSNotificationsOrderChangeHandler implements RequestHandler<Map<String, Object>, String> {
    private static final Gson gson = new Gson();

    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Received event: " + gson.toJson(input));

        // EventBridge の detail 抽出
        Map<String, Object> detail = (Map<String, Object>) input.get("detail");
        if (detail == null) {
            logger.log("No detail found in event");
            return "Missing detail";
        }

        String orderId = (String) ((Map<String, Object>) detail.get("OrderChangeNotification")).get("AmazonOrderId");
        logger.log("Processing order ID: " + orderId);

        return "Processed orderId: " + orderId;
    }
}
```

### Lambda で実装できる次のステップ例

- メールやメッセージ通知（在庫不足・注文受信時など）
- 売上集計や配送時間の計算などの業務ロジック
- SP-API 経由での Amazon 側データ更新（価格・在庫）
- 社内DB・ERP・CRMへのデータ反映
- 複数出品者間での通知重複排除（SKU単位）
- 複数店舗を跨いだ価格一括管理・数量調整処理

`lambda.subscription`, `lambda.process.*` にある他の実装例も参考にしてください。

---

### Java から Step Function を呼び出す例
```java
StartExecutionRequest request = new StartExecutionRequest()
        .withStateMachineArn(stateMachineArn)
        .withInput(gson.toJson(inputForStepFunction))
        .withName("execution-" + UUID.randomUUID());

StartExecutionResult result = stepFunctionsClient.startExecution(request);
```

---

## Step Functions 統合ガイド

より高度な処理フローを作成するには、以下のように Step Functions を app-config に記述します：

```json
{
  "StepFunctions": {
    "OrderNotification": {
      "Lambdas": [
        "lambda.process.internal.orderchange.stepfunctions.RetrieveOrderHandler",
        "lambda.process.internal.orderchange.stepfunctions.SendNotificationHandler"
      ],
      "Definitions": "step-functions/order-change-step-functions-workflow-definition.json"
    }
  }
}
```

### 注意点：

- `Lambdas`：Step Function 定義の呼び出し順にクラスパスを記述してください
- `Definitions`：ASL形式（Amazon States Language）のJSONファイルパスを指定
- LambdaのARNはStep Function定義内と一致させる必要があります

### 認証情報の受け渡し
通知を受信した最初のLambdaから、認証情報（SP-APIトークン、SellerId等）をStep Functionへ渡す設計となっています。
そのため、ワークフロー内の各 Lambda はその入力から認証情報を受け取るように設計されている必要があります。

実装例：
- `step-functions/order-change-step-functions-workflow-definition.json`
- `lambda/process/internal/orderchange/stepfunctions/`

この設計により、処理フローのモジュール化・ログ追跡・拡張性の高い通知処理が可能になります。

---

## 参考資料

- [SP-API Notifications API リファレンス](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)
- [SP-API ユースケースガイド](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)
- [Step Functions 公式ドキュメント](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [AWS Lambda Java ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html)

---

セットアップ・デプロイ手順については [DEPLOYMENT_JP.md](./DEPLOYMENT_JP.md) を参照してください。
