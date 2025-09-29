<?php
namespace Test\util;

use GuzzleHttp\Client;
use PHPUnit\Framework\TestCase;
use Src\util\Constants;
use Src\util\Recipe;

abstract class RecipeTestCase extends TestCase
{
    protected Recipe $recipe;
    protected array $responses;

    public function testRecipe(): void
    {
        $this->expectNotToPerformAssertions();
        $this->instructBackendMock();
        $this->recipe->start();
    }

    private function instructBackendMock(): void
    {
        $client = new Client(['headers' => ['Content-Type' => 'application/json']]);
        $client->request(
            'POST',
            Constants::BACKEND_URL . "/responses",
            ['body' => json_encode($this->responses)]
        );
    }
}
