/**
 * A helper method to serialize a given object into Json string.
 * @param data any data which needs to be serialized.
 */
export function serializeToJsonString(data: any) {
  if (typeof data === "bigint") {
    return (data as BigInt).toString(10);
  }

  try {
    return JSON.stringify(data, null, 4);
  } catch (error) {
    console.log("Unable to serialize the given data due to error : " + error);
    return "";
  }
}
