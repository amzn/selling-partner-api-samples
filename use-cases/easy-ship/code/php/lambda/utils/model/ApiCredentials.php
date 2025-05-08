<?php

namespace Lambda\Utils\Model;

use JsonSerializable;
use Lambda\attributes\Property;

class ApiCredentials implements JsonSerializable
{
    #[Property("API Refresh Token")]
    private ?string $refreshToken;

    #[Property("API Region Code")]
    private string $regionCode;

    /**
     * ApiCredentials constructor.
     *
     * @param string|null $refreshToken
     * @param string $regionCode
     */
    public function __construct(?string $refreshToken = null, string $regionCode = '')
    {
        $this->refreshToken = $refreshToken;
        $this->regionCode = $regionCode;
    }

    /**
     * Get the refresh token.
     *
     * @return string|null
     */
    public function getRefreshToken(): ?string
    {
        return $this->refreshToken;
    }

    /**
     * Set the refresh token.
     *
     * @param string|null $refreshToken
     */
    public function setRefreshToken(?string $refreshToken): void
    {
        $this->refreshToken = $refreshToken;
    }

    /**
     * Get the region code.
     *
     * @return string
     */
    public function getRegionCode(): string
    {
        return $this->regionCode;
    }

    /**
     * Set the region code.
     *
     * @param string $regionCode
     */
    public function setRegionCode(string $regionCode): void
    {
        $this->regionCode = $regionCode;
    }

    // Implement JsonSerializable
    public function jsonSerialize(): array
    {
        return [
            'refreshToken' => $this->refreshToken,
            'regionCode' => $this->regionCode
        ];
    }
}
