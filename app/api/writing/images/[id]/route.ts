import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentUser } from "@/lib/auth/server";
import { imageIsPublished, writingImage } from "@/lib/writing/images";
export const GET = apiHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").at(-1)!;
  const image = await writingImage(id);
  if (
    !image ||
    ((await currentUser(req))?.id !== image.owner &&
      !(await imageIsPublished(id, image.owner)))
  )
    return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
