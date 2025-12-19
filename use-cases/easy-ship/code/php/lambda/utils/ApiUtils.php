<?php

namespace Lambda\Utils;

use InvalidArgumentException;

use Lambda\Utils\Model\ApiCredentials;
use RuntimeException;
use SpApi\Api\easyship\v2022_03_23\EasyShipApi;
use SpApi\Api\feeds\v2021_06_30\FeedsApi;
use SpApi\Api\notifications\v1\NotificationsApi;
use SpApi\Api\orders\v0\OrdersV0Api;
use SpApi\Api\reports\v2021_06_30\ReportsApi;
use SpApi\AuthAndAuth\LWAAuthorizationCredentials;
use Lambda\Utils\Interfaces\ApiCredentialsProvider;
use Aws\SecretsManager\SecretsManagerClient;
use Aws\Exception\AwsException;
use SpApi\Configuration;

class ApiUtils
{
    // Set OPT_OUT = true to disable User-Agent tracking
    public const bool OPT_OUT = false;

    /**
     * Common methods
     */


    /**
     * Retrieves the SP-API endpoint URL based on the given region code.
     *
     * This method uses a list of valid region configurations stored in the
     * environment variable `VALID_SP_API_REGION_CONFIG`. The region code must
     * match one of the keys in this configuration. If the region code is invalid,
     * an exception is thrown.
     *
     * @param string $regionCode The region code (e.g., 'us-west-2') to look up.
     * @return string The corresponding SP-API endpoint URL.
     * @throws InvalidArgumentException If the provided region code is not valid.
     */
    private static function getSpApiEndpoint(string $regionCode): string
    {
        $validRegions = Constants::VALID_SP_API_REGION_CONFIG;

        if (!isset($validRegions[$regionCode])) {
            throw new InvalidArgumentException(
                sprintf(
                    "Region Code %s is not valid. Value must be one of %s",
                    $regionCode,
                    implode(', ', array_keys($validRegions))
                )
            );
        }

        return $validRegions[$regionCode];
    }

    /**
     * Sets the User-Agent header for the given API client.
     *
     * If the static `OPT_OUT` flag is set to `false`, this method will
     * configure the User-Agent header for the provided API client.
     * The User-Agent format includes the application name, version,
     * and programming language.
     *
     * @param object $apiClient The API client instance to configure.
     * @return void
     */
    private static function setUserAgent(object $apiClient): void
    {
        if (!self::OPT_OUT) {
            $apiClient->setUserAgent("Easy Ship Sample App/1.0/PHP");
        }
    }

    /**
     * Retrieves a secret value from AWS Secrets Manager.
     *
     * This method fetches the secret value associated with the given secret ID from AWS Secrets Manager.
     * If the secret is found, it returns the value as a string. If the secret is not found or an error occurs,
     * it logs the error and returns `null`.
     *
     * @param string $secretId The AWS Secrets Manager secret ID.
     *
     * @return string|null The secret value as a string, or `null` if the secret could not be retrieved.
     *
     * @throws Aws\Exception\AwsException If there is an issue retrieving the secret.
     */
    private static function getSecretString(string $secretId): ?string
    {
        try {
            $client = new SecretsManagerClient([
                'version' => 'latest',
                'region' => getenv('AWS_REGION')
            ]);

            $result = $client->getSecretValue([
                'SecretId' => $secretId
            ]);

            return $result['SecretString'] ?? null;
        } catch (AwsException $e) {
            error_log("ERROR: Failed to retrieve secret: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Creates and returns an instance of the specified API class.
     *
     * @param string $apiClass The fully qualified class name of the API (e.g., EasyShipApi::class).
     * @param ApiCredentialsProvider $provider An instance of ApiCredentialsProvider for fetching API credentials.
     * @param bool $isGrantless
     * @return object An instance of the requested API class.
     * @throws \Exception
     */
    public static function getApi(string $apiClass, ApiCredentialsProvider $provider, bool $isGrantless): object
    {
        $credentials = $provider->getApiCredentials();

        $lwaAuthorizationCredentials = self::createLWACredentials($credentials, $isGrantless);

        $config = self::createConfiguration($lwaAuthorizationCredentials, $credentials->getRegionCode());

        if (!class_exists($apiClass)) {
            throw new \InvalidArgumentException("Invalid API class: $apiClass");
        }

        return new $apiClass($config, null, null);
    }

    /**
     * Creates an instance of LWAAuthorizationCredentials.
     *
     * @param ApiCredentials $credentials An associative array containing 'clientId', 'clientSecret', and 'refreshToken'.
     * @param bool $isGrantless
     * @return LWAAuthorizationCredentials The created LWA credentials instance.
     */
    private static function createLWACredentials(ApiCredentials $credentials, bool $isGrantless): LWAAuthorizationCredentials
    {
        $secretJson = self::getSecretString(getenv(Constants::SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
        $secretData = $secretJson ? json_decode($secretJson, true) : [];

        $clientId = $secretData['AppClientId'];
        $clientSecret = $secretData['AppClientSecret'];

        if (empty($clientId) || empty($clientSecret)) {
            throw new RuntimeException("Missing clientId or clientSecret in LWAAuthorizationCredentials.");
        }

        $credentialsConfig = [
            "clientId" => $clientId,
            "clientSecret" => $clientSecret,
            'endpoint' => Constants::LWA_ENDPOINT
        ];
        if ($isGrantless) {
            $credentialsConfig["scopes"] = [Constants::LWA_NOTIFICATIONS_SCOPE];
        } else {
            $credentialsConfig["refreshToken"] = $credentials->getRefreshToken();
        }
        return new LWAAuthorizationCredentials($credentialsConfig);
    }

    /**
     * Creates a Configuration instance for the API client.
     *
     * @param LWAAuthorizationCredentials $lwaAuthorizationCredentials The LWA credentials for authentication.
     * @param string $regionCode The region code to determine the API endpoint (e.g., 'us-west-2').
     * @return Configuration The configured instance.
     */
    private static function createConfiguration(
        LWAAuthorizationCredentials $lwaAuthorizationCredentials,
        string $regionCode
    ): Configuration {
        $config = new Configuration([], $lwaAuthorizationCredentials);
        $config->setHost(self::getSpApiEndpoint($regionCode));
        if (!self::OPT_OUT) {
            $config->setUserAgent("Easy Ship Sample App/1.0/PHP");
        }

        return $config;
    }

    /**
     * Retrieves an instance of the EasyShip API client.
     *
     * @param ApiCredentialsProvider $provider An instance of ApiCredentialsProvider to fetch API credentials.
     * @return EasyShipApi The EasyShip API client instance.
     * @throws \Exception
     */
    public static function getEasyShipApi(ApiCredentialsProvider $provider): EasyShipApi
    {
        return self::getApi(EasyShipApi::class, $provider, false);
    }

    /**
     * Retrieves an instance of the Feeds API client.
     *
     * @param ApiCredentialsProvider $provider An instance of ApiCredentialsProvider to fetch API credentials.
     * @return FeedsApi The Feeds API client instance.
     * @throws \Exception
     */
    public static function getFeedsApi(ApiCredentialsProvider $provider): FeedsApi
    {
        return self::getApi(FeedsApi::class, $provider, false);
    }

    /**
     * Retrieves an instance of the Reports API client.
     *
     * @param ApiCredentialsProvider $provider An instance of ApiCredentialsProvider to fetch API credentials.
     * @return ReportsApi The Reports API client instance.
     * @throws \Exception
     */
    public static function getReportsApi(ApiCredentialsProvider $provider): ReportsApi
    {
        return self::getApi(ReportsApi::class, $provider, false);
    }

    /**
     * Retrieves an instance of the Orders API client.
     *
     * @param ApiCredentialsProvider $provider An instance of ApiCredentialsProvider to fetch API credentials.
     * @return OrdersV0Api
     * @throws \Exception
     */
    public static function getOrdersApi(ApiCredentialsProvider $provider): OrdersV0Api
    {
        return self::getApi(OrdersV0Api::class, $provider, false);
    }

    /**
     * Retrieves an instance of the Notifications API client.
     *
     * This method allows specifying whether the Notifications API client should
     * operate in grantless mode.
     *
     * @param ApiCredentialsProvider $provider An instance of ApiCredentialsProvider to fetch API credentials.
     * @param bool $isGrantless Whether to use grantless access for the API.
     * @return NotificationsApi
     * @throws \Exception
     */
    public static function getNotificationsApi(ApiCredentialsProvider $provider, bool $isGrantless): NotificationsApi
    {
        return self::getApi(NotificationsApi::class, $provider, $isGrantless);
    }
}
