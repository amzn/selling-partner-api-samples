<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;
use Lambda\Utils\interfaces\ApiCredentialsProvider;

class LambdaInput implements JsonSerializable, ApiCredentialsProvider
{
    #[Property("API Credentials")]
    private ?ApiCredentials $apiCredentials;

    /**
     * LambdaInput constructor.
     *
     * @param ApiCredentials|null $apiCredentials
     */
    public function __construct(?ApiCredentials $apiCredentials = null)
    {
        $this->apiCredentials = $apiCredentials;
    }

    /**
     * Get API credentials.
     *
     * @return ApiCredentials
     */
    public function getApiCredentials(): ApiCredentials
    {
        return $this->apiCredentials;
    }

    /**
     * Set API credentials.
     *
     * @param ApiCredentials|null $apiCredentials
     */
    public function setApiCredentials(?ApiCredentials $apiCredentials): void
    {
        $this->apiCredentials = $apiCredentials;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'apiCredentials' => $this->apiCredentials
        ];
    }
}
