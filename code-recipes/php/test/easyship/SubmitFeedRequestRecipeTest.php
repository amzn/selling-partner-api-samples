<?php

namespace Test\easyship;

use Src\easyship\SubmitFeedRequestRecipe;
use Test\util\RecipeTestCase;

class SubmitFeedRequestRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new SubmitFeedRequestRecipe();
        $this->responses = [
            "feeds-createFeedDocument",
            "feeds-createFeed",
            "feeds-createFeed"
        ];
    }
}
