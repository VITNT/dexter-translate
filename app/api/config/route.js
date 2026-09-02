import configHandler from "../../../server/api/config";
import { runLegacyApiHandler } from "../../../lib/legacy-api-adapter";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export function GET(request) {
  return runLegacyApiHandler(configHandler, request);
}
