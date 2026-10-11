import {preview} from '@/lib/store';
export const runtime='nodejs';
export async function GET(_:Request,ctx:{params:Promise<{id:string}>}){const image=preview((await ctx.params).id);return image?new Response(new Uint8Array(image),{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store'}}):new Response(null,{status:404});}
