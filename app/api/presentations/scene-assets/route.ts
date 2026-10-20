import {NextRequest,NextResponse} from "next/server";
import {apiHandler} from "@/lib/api-handler";
import {authError,currentUser} from "@/lib/auth/server";
import {rateLimit} from "@/lib/ratelimit";
import {uploadScene} from "@/lib/presentations/hybrid/scene-assets";
export const POST=apiHandler(async(req:NextRequest)=>{const denied=await authError(req)||await rateLimit(req,"presentation-scene",6,3600000);if(denied)return denied;try{const form=await req.formData(),file=form.get("file");if(!(file instanceof File)||file.size>4*1024*1024)throw new Error("Choose a .splinecode file under 4 MB.");return NextResponse.json(await uploadScene((await currentUser(req))!.id,file.name,Buffer.from(await file.arrayBuffer())),{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not import scene."},{status:400});}});
