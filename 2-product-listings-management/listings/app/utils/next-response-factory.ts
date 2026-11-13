import { NextResponse } from "next/server";

/**
 * Helper function to build a NextResponse.
 * @param status the HTTP status of the response
 * @param statusText the HTTP status text of the response
 * @param body body of the response.
 */
export default function nextResponse(
  status: number,
  statusText: string,
  body?: any,
) {
  return new NextResponse(body, {
    status: status,
    statusText: statusText,
  });
}
