import assert from "node:assert/strict";
import {
  workspaceDestination,
  workspaceScopedPath,
} from "../lib/workspace-routing";
for (const [from, to] of [
  ["/pricing?region=INR#max", "/writer/membership?region=INR#max"],
  ["/pricing/", "/writer/membership"],
  ["/support", "/writer/support"],
  ["/profile", "/writer/settings"],
  ["/reading", "/writer/reading"],
  ["/account/billing", "/writer/billing"],
  [
    "/payments/order_example?refresh=1",
    "/writer/payments/order_example?refresh=1",
  ],
  ["/subscribe/max", "/writer/subscribe/max"],
  ["/checkout/9", "/writer/membership"],
  ["/dashboard?topic=DBMS", "/writer/welcome"],
  ["/presentations/new", "/writer/welcome"],
  ["/lesson/private/notes", "/writer/welcome"],
  ["/refer", "/writer/welcome"],
  [
    "/presentations/shared/token?view=deck",
    "/presentations/shared/token?view=deck",
  ],
  ["/presentations/audience/token", "/presentations/audience/token"],
  ["/creators/university-author", "/creators/university-author"],
  ["/guides/learning-with-sources", "/guides/learning-with-sources"],
  ["/writing", "/writing"],
  ["/community?q=AI", "/community?q=AI"],
  ["/%64ashboard", "/writer/welcome"],
] as const)
  assert.equal(workspaceDestination(from, "writer"), to, from);
for (const from of [
  "/writer",
  "/write?draft=private",
  "/writer/settings",
  "/%77riter/stories",
])
  assert.equal(workspaceDestination(from, "student"), "/dashboard");
for (const workspace of ["student", "writer"] as const) {
  for (const bad of [
    undefined,
    "",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/%5cevil.test",
    "/%00evil",
    "/bad%",
    "/\nevil.test",
  ])
    assert.equal(
      workspaceDestination(bad, workspace),
      workspace === "writer" ? "/writer/welcome" : "/dashboard",
    );
  for (const publicPage of [
    "/about",
    "/privacy",
    "/terms",
    "/resources",
    "/examples",
  ])
    assert.equal(workspaceDestination(publicPage, workspace), publicPage);
}
assert.equal(workspaceScopedPath("/checkout/39"), true);
assert.equal(workspaceScopedPath("/presentations/shared/token"), false);
assert.equal(workspaceScopedPath("/creators/author"), false);
console.log(
  "Workspace destinations, encoded return paths and public-route isolation checks passed.",
);
