<?php
namespace Test\b2bdeliveryexperience;

use Src\b2bdeliveryexperience\BusinessDeliveryExperienceRecipe;
use Test\util\RecipeTestCase;

class BusinessDeliveryExperienceRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new BusinessDeliveryExperienceRecipe();
        $this->responses = [
            "orders-getOrder",
            "orders-getOrderBuyerInfo",
            "orders-getOrderItems",
            "orders-getOrderAddress",
            "orders-confirmShipment",
        ];
    }
}
