import { productFacts } from "@/lib/product-facts";
export function GET() {
  return Response.json(productFacts(), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
