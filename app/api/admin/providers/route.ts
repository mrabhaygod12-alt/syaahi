import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { adminScopes } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/ratelimit";
import { gatewaySetup, gatewayKeys, isGateway } from "@/lib/ai/gateway-config";
import { gatewayCatalog } from "@/lib/ai/gateway-catalog";
export const GET = apiHandler(async (req: Request) => {
  const user = await currentUser(req);
  if (!adminScopes(user).users)
    return NextResponse.json(
      { error: "Verified administrator access required." },
      { status: 403 },
    );
  const denied = await rateLimit(req, "admin-provider-catalog", 12, 60000);
  if (denied) return denied;
  const query = new URL(req.url).searchParams,
    type = query.get("provider");
  if (!type)
    return NextResponse.json({
      providers: gatewaySetup(),
      statisticsOnly: {
        name: "AntSeedStats",
        url: "https://antseedstats.com/",
      },
    });
  if (!isGateway(type))
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  const keys = gatewayKeys(type);
  if (!keys.length)
    return NextResponse.json(
      { error: "Configure this provider’s server-side API key first." },
      { status: 409 },
    );
  const offset = Number(query.get("offset") || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 4000)
    return NextResponse.json(
      { error: "Invalid catalog page." },
      { status: 400 },
    );
  for (let i = 0; i < keys.length; i++) {
    try {
      const models = await gatewayCatalog(type, keys[i]);
      return NextResponse.json({
        provider: type,
        models: models.slice(offset, offset + 50),
        total: models.length,
        nextOffset: offset + 50 < models.length ? offset + 50 : null,
        notice:
          "Catalog metadata is a gateway claim. Pricing and account access must be confirmed before generation.",
      });
    } catch (error) {
      const status = Number((error as { status?: number })?.status) || 0;
      if ([401, 403].includes(status) && i + 1 < keys.length) continue;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "Provider quota is cooling down. Retry later."
              : status === 401 || status === 403
                ? "The provider did not authorize this key."
                : "The model catalog could not be verified. Check the provider configuration.",
        },
        {
          status: status === 429 ? 429 : 502,
          headers: status === 429 ? { "Retry-After": "60" } : {},
        },
      );
    }
  }
  return NextResponse.json(
    { error: "No usable provider key." },
    { status: 502 },
  );
});
