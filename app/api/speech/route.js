import speechHandler from "../../../server/api/speech";
import { getSessionAccount } from "../../../lib/auth";
import { hasProAccess } from "../../../lib/plans";
import { runLegacyApiHandler } from "../../../lib/legacy-api-adapter";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request) {
  if (!hasProAccess(await getSessionAccount())) {
    return Response.json(
      { error: "Text to speech is available on Dexter Pro." },
      { status: 403 }
    );
  }
  return runLegacyApiHandler(speechHandler, request);
}
