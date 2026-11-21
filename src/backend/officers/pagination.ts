import { IdSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";

export function pageOptions(params:URLSearchParams) {
  const cursor=params.get("cursor");
  const text=params.get("limit") ?? "20";
  if (!/^[1-9][0-9]?$|^100$/.test(text) || (cursor!==null && !IdSchema.safeParse(cursor).success)) throw new AuthFailure("VALIDATION_FAILED");
  return {cursor,limit:Number(text)};
}
export function page<T extends {id:string}>(items:T[],limit:number) {
  return {items:items.slice(0,limit),nextCursor:items.length>limit ? items[limit-1].id : null};
}
