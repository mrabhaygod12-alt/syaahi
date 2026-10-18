// Backwards-compatible entry points; catalogs are isolated by credential.
import {
  gatewayCatalog,
  gatewayModel,
  type CatalogModel,
} from "./gateway-catalog";
export type GatewayModel = CatalogModel;
export const radoxModels = (key: string) => gatewayCatalog("radox", key);
export const radoxModel = (key: string, id: string, streaming = false) =>
  gatewayModel("radox", key, id, streaming);
