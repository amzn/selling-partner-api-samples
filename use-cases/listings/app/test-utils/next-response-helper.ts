import { NextResponse } from "next/server";

/**
 * Helper function which is used to verify the status of the NextResponse and
 * the response body.
 * @param nextResponse the next response object.
 * @param expectedStatus the expected status of the NextResponse.
 * @param verifyBody true if the body of the NextResponse should be verified.
 */
export async function verifyStatusAndBody(
  nextResponse: NextResponse,
  expectedStatus: number,
  verifyBody: boolean,
) {
  expect(nextResponse.status).toStrictEqual(expectedStatus);
  if (verifyBody) {
    const responseBody = await nextResponse.json();
    expect(responseBody).toMatchSnapshot();
  }
}
