import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseCatalogRepository } from "./catalog-repository";

function fixture() {
  const rows=Array.from({length:501},(_,i)=>({id:String(i),sku:String(i),name:i===500?"Café pasta":"Rijst",supermarket:"Hoogvliet",source_url:"https://example.test/product",updated_at:"2026-09-24T00:00:00Z",current_price:null}));
  let fail=false;
  const range=vi.fn(async(start:number,end:number)=>fail?{error:{code:"57014"},data:null}:{error:null,data:rows.slice(start,end+1)});
  const builder={select:()=>builder,eq:()=>builder,order:()=>builder,range};
  const rpc=vi.fn(()=>{throw Error("Planner must not repeatedly rank the catalog")});
  const client={from:()=>builder,rpc} as unknown as SupabaseClient;
  return {client,range,rpc,setFailure:(value:boolean)=>{fail=value;}};
}
describe("exhaustive planner catalog reads",()=>{
  it("shares a full bounded-page snapshot across concurrent searches, including late candidates",async()=>{
    const f=fixture();const repository=new SupabaseCatalogRepository(f.client);
    const [pasta,rice]=await Promise.all([repository.searchCandidates("cafe pasta"),repository.searchCandidates("rijst")]);
    expect(pasta.products.map(p=>p.id)).toEqual(["500"]);
    expect(pasta.products[0].currentPrice).toBeNull();
    expect(rice.products).toHaveLength(500);
    expect(f.range.mock.calls).toEqual([[0,249],[250,499],[500,749]]);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects failed reads and retries; no partial snapshot becomes a valid plan",async()=>{
    const f=fixture();const repository=new SupabaseCatalogRepository(f.client);
    f.setFailure(true);await expect(repository.searchCandidates("pasta")).rejects.toThrow();
    f.setFailure(false);expect((await repository.searchCandidates("pasta")).products).toHaveLength(1);
  });
  it("expires the shared snapshot so later planning can read new prices",async()=>{
    const f=fixture();let now=0;const repository=new SupabaseCatalogRepository(f.client,()=>now);
    await repository.searchCandidates("pasta");await repository.searchCandidates("rijst");expect(f.range).toHaveBeenCalledTimes(3);
    now=60001;await repository.searchCandidates("pasta");expect(f.range).toHaveBeenCalledTimes(6);
  });
});
