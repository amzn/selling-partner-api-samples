<?php

namespace Lambda;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Lambda\Utils\Constants;
use Lambda\Utils\LambdaContext;
use Lambda\Utils\Model\StateMachineInput;
use Lambda\Utils\StateMachineInputConverter;
use SpApi\Model\easyship\v2022_03_23\Dimensions;
use SpApi\Model\easyship\v2022_03_23\Weight;

class InventoryCheckHandler
{
    /**
     * @throws \Exception
     */
    public function handleRequest(array $event, LambdaContext $context): StateMachineInput
    {
        $input = StateMachineInputConverter::convertFromArray($event);
        $logger = $context->getLogger();
        $logger->info('InventoryCheck Lambda input: ' . json_encode($event, JSON_PRETTY_PRINT));

        $packageWeightValue = 0;
        $packageWeightUnit = '';
        $packageLength = 0;
        $packageWidth = 0;
        $packageHeight = 0;
        $packageSizeUnit = '';

        $dynamoDb = new DynamoDbClient([
            'region' => getenv('AWS_REGION'),
            'version' => 'latest'
        ]);

        foreach ($input->getEasyShipOrder()->getOrderItems() as $orderItem) {
            // Retrieve the item from DynamoDB by SKU
            $key = [
                Constants::INVENTORY_TABLE_HASH_KEY_NAME => ['S' => $orderItem->getSku()]
            ];

            try {
                $result = $dynamoDb->getItem([
                    'TableName' => getenv(Constants::INVENTORY_TABLE_NAME_ENV_VARIABLE),
                    'Key' => $key
                ]);

                $item = $result['Item'];

                if ($item === null) {
                    $logger->error(sprintf("Item not found for SKU: %s", $orderItem->getSku()));
                    throw new \Exception(sprintf(
                        "Item not found for SKU {%s} in DynamoDB",
                        $orderItem->getSku()
                    ));
                }

                $stock = $item[Constants::INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME]['N'];
                if ((int)$stock < $orderItem->getQuantity()) {
                    throw new \Exception(sprintf(
                        "Stock level for SKU {%s} is not enough to fulfill the requested quantity",
                        $orderItem['sku']
                    ));
                }

                $itemWeightValue = (int)$item[Constants::INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME]['N'];
                $itemWeightUnit = $item[Constants::INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME]['S'];

                $itemLength = (int)$item[Constants::INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME]['N'];
                $itemWidth = (int)$item[Constants::INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME]['N'];
                $itemHeight = (int)$item[Constants::INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME]['N'];
                $itemSizeUnit = $item[Constants::INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME]['S'];

                // Package weight is calculated by adding the individual weights
                $packageWeightValue += $itemWeightValue;
                $packageWeightUnit = $itemWeightUnit;

                // Package size is calculated by adding the individual sizes
                $packageLength += $itemLength;
                $packageWidth += $itemWidth;
                $packageHeight += $itemHeight;
                $packageSizeUnit = $itemSizeUnit;
            } catch (DynamoDbException $e) {
                $logger->error("Unable to get item: " . $e->getMessage());
                throw $e;
            }
        }

        $packageWeight = new Weight([
            'value' => $packageWeightValue,
            'unit' => $packageWeightUnit
        ]);

        $input->getEasyShipOrder()->setPackageWeight($packageWeight);

        $packageDimensions = new Dimensions([
            'length' => $packageLength,
            'width' => $packageWidth,
            'height' => $packageHeight,
            'unit' => $packageSizeUnit
        ]);

        $input->getEasyShipOrder()->setPackageDimensions($packageDimensions);

        return $input;
    }
}
