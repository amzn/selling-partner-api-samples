<?php

namespace Lambda\Utils;

use Lambda\Utils\Model\ApiCredentials;
use Lambda\Utils\Model\EasyShipOrder;
use Lambda\Utils\Model\EasyShipOrderItem;
use Lambda\Utils\Model\StateMachineInput;
use SpApi\Model\easyship\v2022_03_23\Dimensions;
use SpApi\Model\easyship\v2022_03_23\ScheduledPackageId;
use SpApi\Model\easyship\v2022_03_23\TimeSlot;
use SpApi\Model\easyship\v2022_03_23\Weight;

class StateMachineInputConverter
{
    public static function convertFromArray(array $data): StateMachineInput
    {
        // EasyShip OrderItem
        $easyShipOrderItems = array_map(
            fn($item) => new EasyShipOrderItem(
                orderItemId: $item['orderItemId'] ?? '',
                sku: $item['sku'] ?? '',
                quantity: $item['quantity'] ?? 0,
                orderItemSerialNumbers: $item['orderItemSerialNumbers'] ?? []
            ),
            $data['easyShipOrder']['orderItems'] ?? []
        );

        // Package Dimensions
        $packageDimensions = isset($data['easyShipOrder']['packageDimensions'])
            ? new Dimensions($data['easyShipOrder']['packageDimensions'])
            : null;

        // Package Weight
        $packageWeight = isset($data['easyShipOrder']['packageWeight'])
            ? new Weight($data['easyShipOrder']['packageWeight'])
            : null;

        // EasyShipOrder
        $easyShipOrder = new EasyShipOrder(
            orderItems: $easyShipOrderItems,
            packageDimensions: $packageDimensions,
            packageWeight: $packageWeight
        );

        // TimeSlots
        $timeSlots = array_map(
        /**
         * @throws \Exception
         */ fn($slot) => new TimeSlot(
                [
                    'slot_id' => $slot['slotId'],
                    'start_time' => new \DateTime($slot['startTime']),
                    'end_time' => new \DateTime($slot['endTime']),
                    'handover_method' => $slot['handoverMethod']
                ]
            ),
            $data['timeSlots'] ?? []
        );

        // ScheduledPackageId
        $scheduledPackageId = isset($data['scheduledPackageId'])
            ? new ScheduledPackageId([
                'amazon_order_id' => $data['scheduledPackageId']['amazonOrderId'],
                'package_id' => $data['scheduledPackageId']['packageId']
            ])
            : null;

        // StateMachineInput
        return new StateMachineInput(
            apiCredentials: new ApiCredentials(
                $data['apiCredentials']['refreshToken'] ?? '',
                $data['apiCredentials']['regionCode'] ?? ''
            ),
            amazonOrderId: $data['amazonOrderId'] ?? '',
            marketplaceId: $data['marketplaceId'] ?? '',
            easyShipOrder: $easyShipOrder,
            timeSlots: $timeSlots,
            scheduledPackageId: $scheduledPackageId,
            feedId: $data['feedId'] ?? '',
            reportId: $data['reportId'] ?? '',
            labelUri: $data['labelUri'] ?? ''
        );
    }
}
