import translateHandler from "../../../server/api/translate";
import { runLegacyApiHandler } from "../../../lib/legacy-api-adapter";

export const maxDuration = 30;

export function POST(request) {
  return runLegacyApiHandler(translateHandler, request);
}
