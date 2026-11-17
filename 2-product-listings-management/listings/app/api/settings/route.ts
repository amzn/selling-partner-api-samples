import { ResourceNotFoundException } from "@aws-sdk/client-secrets-manager";
import { NextRequest } from "next/server";
import nextResponse from "@/app/utils/next-response-factory";
import { buildSecretsManagerClient } from "@/app/utils/aws-clients-factory";
import { SETTINGS_KEY, US_WEST_2 } from "@/app/constants/global";
import { serializeToJsonString } from "@/app/utils/serialization";

const client = buildSecretsManagerClient(US_WEST_2);

export const dynamic = "force-dynamic";

/**
 * Performs a getSecretValue operation on AWS Secret Manager.
 */
export async function GET() {
  try {
    const response = await client.getSecretValue({
      SecretId: SETTINGS_KEY,
    });
    return nextResponse(
      200,
      "OK",
      JSON.stringify({
        settings: response.SecretString,
      }),
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      console.log(`Secret ID not found`);
      return nextResponse(404, "The Secret is not found in the AWS Account.");
    }
    console.log(error);
    return nextResponse(500, "Internal Server Error");
  }
}

/**
 * Performs a createSecret operation on AWS Secret Manager.
 * @param request
 * The settings should be present in the headers of the request under the key "settings"
 */
export async function POST(request: NextRequest) {
  try {
    const settings = request.headers.get(SETTINGS_KEY);
    if (!settings) {
      return nextResponse(
        400,
        "Invalid Inputs. Settings cannot be empty|null|undefined.",
      );
    }
    await client.createSecret({
      Name: SETTINGS_KEY,
      SecretString: settings,
    });
    return nextResponse(200, "OK", serializeToJsonString({ data: {} }));
  } catch (error) {
    console.log(error);
    return nextResponse(500, "Internal Server Error");
  }
}

/**
 * Performs a putSecret operation on AWS Secret Manager.
 * @param request
 * The settings should be present in the headers of the request under the key "settings"
 */
export async function PUT(request: NextRequest) {
  try {
    const settings = request.headers.get(SETTINGS_KEY);

    if (!settings) {
      return nextResponse(
        400,
        "Invalid Inputs. Settings cannot be empty|null|undefined.",
      );
    }
    await client.putSecretValue({
      SecretId: SETTINGS_KEY,
      SecretString: settings,
    });
    return nextResponse(200, "OK", serializeToJsonString({ data: {} }));
  } catch (error) {
    console.log(error);
    return nextResponse(500, "Internal Server Error");
  }
}
