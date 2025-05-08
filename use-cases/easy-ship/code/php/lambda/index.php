<?php

use Lambda\CreateScheduledPackageHandler;
use Lambda\GetFeedDocumentHandler;
use Lambda\GetReportDocumentHandler;
use Lambda\GetScheduledPackageHandler;
use Lambda\InventoryCheckHandler;
use Lambda\ListHandoverSlotsHandler;
use Lambda\ProcessNotificationHandler;
use Lambda\RetrieveOrderHandler;
use Lambda\SubmitFeedRequestHandler;
use Lambda\SubscribeNotificationsHandler;
use Lambda\UrlRedirectHandler;
use Lambda\Utils\LambdaContext;

require __DIR__ . '/../vendor/autoload.php';

return function ($event) {
    // Retrieve Lambda function name from environment variables
    $lambdaFunctionName = getenv('AWS_LAMBDA_FUNCTION_NAME') ?: 'Unknown';
    $lambdaBaseName = explode('-', $lambdaFunctionName)[0];

    // Map of available handlers
    $handlerMap = [
        'EASYSHIPCreateScheduledPackageLambdaFunction' => CreateScheduledPackageHandler::class,
        'EASYSHIPGetFeedDocumentLambdaFunction' => GetFeedDocumentHandler::class,
        'EASYSHIPGetReportDocumentLambdaFunction' => GetReportDocumentHandler::class,
        'EASYSHIPGetScheduledPackageLambdaFunction' => GetScheduledPackageHandler::class,
        'EASYSHIPInventoryCheckLambdaFunction' => InventoryCheckHandler::class,
        'EASYSHIPListHandoverSlotsLambdaFunction' => ListHandoverSlotsHandler::class,
        'EASYSHIPProcessNotificationLambdaFunction' => ProcessNotificationHandler::class,
        'EASYSHIPRetrieveOrderLambdaFunction' => RetrieveOrderHandler::class,
        'EASYSHIPSubmitFeedRequestLambdaFunction' => SubmitFeedRequestHandler::class,
        'EASYSHIPSubscribeNotificationsLambdaFunction' => SubscribeNotificationsHandler::class,
        'EASYSHIPUrlRedirectLambdaFunction' => UrlRedirectHandler::class,
    ];

    if (!isset($handlerMap[$lambdaBaseName])) {
        return ["error" => "Unknown handler"];
    }

    try {
        $handler = new $handlerMap[$lambdaBaseName]();
        $context = new LambdaContext();
        return $handler->handleRequest($event, $context);
    } catch (Exception $e) {
        error_log("ERROR: Exception in $lambdaBaseName: " . $e->getMessage());
        return [
            "error" => "Exception in $lambdaBaseName",
            "message" => $e->getMessage()
        ];
    }
};