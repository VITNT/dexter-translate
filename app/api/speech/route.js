import speechHandler from "../../../server/api/speech";
import { runLegacyApiHandler } from "../../../lib/legacy-api-adapter";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request) {
  return runLegacyApiHandler(speechHandler, request);
}
