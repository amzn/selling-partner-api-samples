<?php

namespace Test\easyship;

use Src\easyship\CalculateOrderDimensionsRecipe;
use Test\util\RecipeTestCase;

class CalculateOrderDimensionsRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new CalculateOrderDimensionsRecipe();
        $this->responses = [
            "orders-getOrderItems",
            "listings-getListingsItem"
        ];
    }
}
