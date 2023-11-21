import { serializeToJsonString } from "@/app/utils/serialization";

describe("Test for the serialization utility", () => {
  test("serialization test for BigInt", () => {
    const bigInt = BigInt(1234);
    expect(serializeToJsonString(bigInt)).toStrictEqual("1234");
  });

  test("serialization test for circular reference object", () => {
    const obj = {
      title: "Book",
      itself: undefined,
    };
    // @ts-ignore
    obj.itself = obj;
    expect(serializeToJsonString(obj)).toStrictEqual("");
  });

  test("serialization test for regular object", () => {
    const obj = {
      title: "Book",
    };

    expect(serializeToJsonString(obj)).toStrictEqual(
      '{\n    "title": "Book"\n}',
    );
  });
});
