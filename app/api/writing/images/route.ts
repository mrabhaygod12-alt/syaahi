import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { authError, currentUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/ratelimit";
import { uploadWritingImage } from "@/lib/writing/images";
import { writerAccess } from "@/lib/writing/profile";
export const runtime = "nodejs";
export const POST = apiHandler(async (req: NextRequest) => {
  const denied =
    (await authError(req)) ||
    (await rateLimit(req, "writing-upload", 8, 60000));
  if (denied) return denied;
  const access = await writerAccess((await currentUser(req))!.id);
  if (access) return access;
  try {
    const data = await req.formData(),
      file = data.get("image"),
      alt = data.get("alt");
    if (
      !(file instanceof File) ||
      typeof alt !== "string" ||
      file.size > 4 * 1024 * 1024
    )
      throw new Error("Choose a JPEG, PNG or WebP image under 4 MB.");
    return NextResponse.json(
      await uploadWritingImage(
        (await currentUser(req))!.id,
        new Uint8Array(await file.arrayBuffer()),
        alt,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Image upload failed.",
      },
      { status: 400 },
    );
  }
});
