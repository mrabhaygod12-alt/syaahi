import {NextRequest,NextResponse} from "next/server";
import {apiHandler} from "@/lib/api-handler";
import {authError,currentUser} from "@/lib/auth/server";
import {ownedScene} from "@/lib/presentations/hybrid/scene-assets";
export const GET=apiHandler(async(req:NextRequest,ctx:{params:Promise<{asset:string}>})=>{const denied=await authError(req);if(denied)return denied;const asset=await ownedScene((await currentUser(req))!.id,(await ctx.params).asset);return asset?new Response(new Uint8Array(Buffer.from(asset.bytes,"base64")),{headers:{"Content-Type":"application/octet-stream","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}}):NextResponse.json({error:"Scene not found."},{status:404});});
