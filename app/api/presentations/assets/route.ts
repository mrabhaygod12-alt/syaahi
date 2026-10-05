import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { uploadWritingImage } from "@/lib/writing/images";
import { rateLimit } from "@/lib/ratelimit";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) || (await rateLimit(req, "deck-image", 8, 60000));
  if (denied) return denied;
  try {
    const data = await req.formData(),
      file = data.get("image");
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024)
      throw new Error("Choose an image under 4 MB.");
    return NextResponse.json(
      await uploadWritingImage(
        (await currentUser(req))!.id,
        new Uint8Array(await file.arrayBuffer()),
        String(data.get("alt") || ""),
      ),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
});
