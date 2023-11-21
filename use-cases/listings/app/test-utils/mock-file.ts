import { JSON_FILE_TYPE } from "@/app/constants/global";

const JSON_FEED_NAME = "feed.json";

export function createFile(
  fileContent: string,
  fileName: string,
  fileType: string,
) {
  const file = new File([fileContent], fileName, { type: fileType });
  file.text = () =>
    new Promise((resolve) => {
      resolve(fileContent);
    });
  return file;
}

export function createEmptyJsonFile(): File {
  return createFile("", JSON_FEED_NAME, JSON_FILE_TYPE);
}

export function createJsonFile(fileContent: string): File {
  return createFile(fileContent, JSON_FEED_NAME, JSON_FILE_TYPE);
}
