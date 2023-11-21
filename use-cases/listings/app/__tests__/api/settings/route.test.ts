import {
  CreateSecretCommand,
  GetSecretValueCommand,
  InvalidRequestException,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManager,
} from "@aws-sdk/client-secrets-manager";
import "isomorphic-fetch";
import { mockClient } from "aws-sdk-client-mock";
import { GET, POST, PUT } from "@/app/api/settings/route";
import { NextRequest } from "next/server";

const mockSecretsManagerClient = mockClient(SecretsManager);

describe("Test GET", () => {
  beforeEach(() => {
    mockSecretsManagerClient.reset();
  });

  test("returns 200 on successful secret Get", async () => {
    mockSecretsManagerClient.on(GetSecretValueCommand).resolves({
      VersionId: "versionId",
      SecretString: "verySecret",
    });

    const resp = await GET();
    const data = await resp.json();
    expect(data.settings).toStrictEqual("verySecret");
    expect(resp.status).toStrictEqual(200);
  });

  test("returns 404 on ResourceNotFoundException", async () => {
    mockSecretsManagerClient
      .on(GetSecretValueCommand)
      .rejects(
        new ResourceNotFoundException({ message: "null", $metadata: {} }),
      );

    const resp = await GET();
    expect(resp.status).toStrictEqual(404);
  });

  test("returns 500 on other exception", async () => {
    mockSecretsManagerClient
      .on(GetSecretValueCommand)
      .rejects(new InvalidRequestException({ message: "null", $metadata: {} }));

    let request = new NextRequest("http://localhost:3000/api/settings", {
      headers: {
        secretName: "name",
      },
    });

    const resp = await GET();
    expect(resp.status).toStrictEqual(500);
  });
});

describe("Test POST", () => {
  beforeEach(() => {
    mockSecretsManagerClient.reset();
  });

  test("returns 200 on successful Update", async () => {
    mockSecretsManagerClient.on(CreateSecretCommand).resolves({
      VersionId: "versionId",
    });

    let request = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: {
        settings: "secret",
      },
    });

    const resp = await POST(request);
    expect(resp.status).toStrictEqual(200);
  });

  test("returns 400 on missing params", async () => {
    let request = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: {},
    });

    const resp = await POST(request);
    expect(resp.status).toStrictEqual(400);
  });

  test("returns 500 on other exceptions", async () => {
    mockSecretsManagerClient
      .on(CreateSecretCommand)
      .rejects(new InvalidRequestException({ message: "null", $metadata: {} }));

    let request = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: {
        settings: "secret",
      },
    });

    const resp = await POST(request);
    expect(resp.status).toStrictEqual(500);
  });
});

describe("Test PUT", () => {
  beforeEach(() => {
    mockSecretsManagerClient.reset();
  });

  test("returns 200 on successful Create", async () => {
    mockSecretsManagerClient.on(PutSecretValueCommand).resolves({
      VersionId: "versionId",
    });

    let request = new NextRequest("http://localhost:3000/api/settings", {
      method: "PUT",
      headers: {
        secretName: "name",
        settings: "secret",
      },
    });

    const resp = await PUT(request);
    expect(resp.status).toStrictEqual(200);
  });

  test("returns 400 on missing params", async () => {
    let request = new NextRequest("http://localhost:3000/api/settings", {
      method: "PUT",
      headers: {},
    });

    const resp = await PUT(request);
    expect(resp.status).toStrictEqual(400);
  });

  test("returns 500 on other exceptions", async () => {
    mockSecretsManagerClient.rejects(
      new InvalidRequestException({ message: "null", $metadata: {} }),
    );

    let request = new NextRequest("http://localhost:3000/api/settings", {
      method: "PUT",
      headers: {
        settings: "secret",
      },
    });

    const resp = await PUT(request);
    expect(resp.status).toStrictEqual(500);
  });
});
