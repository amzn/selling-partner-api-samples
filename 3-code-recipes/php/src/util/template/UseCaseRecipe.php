<?php

namespace Src\util\template;

use SpApi\Api\awd\v2024_05_09\AwdApi;
use Src\util\Recipe;

// TODO: Add brief description about the use case of this recipe
// TODO: Rename class and move it into the right folder (e.g. awd use cases are placed in awd folder)
// TODO: Apply all TODOs, and remove them before commiting.
class UseCaseRecipe extends Recipe
{

    // TODO: Replace with the necessary API client
    private AwdApi $awdApi;

    public function __construct()
    {
        parent::__construct();
        // TODO: Replace with the necessary API client
        $this->awdApi = new AwdApi($this->config);
    }

    /* TODO: Create a dedicated method for each step in your use case. The start-method should be used to orchestrate the
        steps accordingly and add any necessary code to glue the steps together. */
    public function start(): void
    {
        $this->stepOne();
        $this->stepTwo();
        $this->stepThree();
    }

    /* TODO: Methods for each step should be added below. Use meaningful method names to make the code as readable as
        possible. Keep each method short and concise. */
    private function stepOne(): void
    {}
    private function stepTwo(): void
    {}
    private function stepThree(): void
    {}
}
