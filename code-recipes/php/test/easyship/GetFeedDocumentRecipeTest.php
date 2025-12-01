<?php

namespace Test\easyship;

use Src\easyship\GetFeedDocumentRecipe;
use Test\util\RecipeTestCase;

class GetFeedDocumentRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new GetFeedDocumentRecipe();
        $this->responses = [
            "feeds-getFeed",
            "feeds-getFeedDocument",
            ""
        ];
    }
}
