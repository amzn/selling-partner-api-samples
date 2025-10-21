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
        "b2bdeliveryexperience-orders-getOrder",
        "b2bdeliveryexperience-orders-getOrderBuyerInfo",
        "b2bdeliveryexperience-orders-getOrderItems",
        "b2bdeliveryexperience-orders-getOrderAddress",
        "b2bdeliveryexperience-orders-confirmShipment"
        ];
    }
}
