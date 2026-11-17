import fetch from "jest-fetch-mock";

/**
 * Mocks a fetch call with the Promise.resolve().
 * @param status the HTTP status of the mocked response.
 * @param body any body of the mocked response.
 */
export function mockResolveFetchResponse(status: number, body: object) {
  fetch.mockResponse(() =>
    Promise.resolve({
      status: status,
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Mocks a fetch call with the Promise.resolve(). The given body is not
 * serialized into Json.
 * @param status the HTTP status of the mocked response.
 * @param body any body of the mocked response.
 * @param headers the headers for the response.
 */
export function mockResolveFetchResponseNoJsonSerialization(
  status: number,
  body: any,
  headers?: any,
) {
  fetch.mockResponse(() =>
    Promise.resolve({
      status: status,
      body: body,
      headers: headers,
    }),
  );
}

/**
 * Mocks a fetch call with the Promise.reject().
 * @param status the HTTP status of the mocked response.
 */
export function mockRejectFetchResponse(status: number) {
  fetch.mockResponse(() =>
    Promise.reject({
      status: status,
    }),
  );
}

/**
 * Mocks a fetch response by introducing a delay.
 * @param status the HTTP response status
 * @param body the body of the response
 * @param delayInMillis the delay for the promise resolution.
 */
export function mockDelayedResolveFetchResponse(
  status: number,
  body: object,
  delayInMillis: number,
) {
  const delayedPromise = new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          status: status,
          body: JSON.stringify(body),
        }),
      delayInMillis,
    );
  });
  // @ts-ignore
  fetch.mockResponse(() => delayedPromise);
}
