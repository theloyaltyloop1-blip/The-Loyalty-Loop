S=$1; rm -rf $S/c $S/o $S/a
MOCK=1 ROLES=consumer node crawl.mjs $S/c >/dev/null; MOCK=1 ROLES=business_owner node crawl.mjs $S/o >/dev/null; MOCK=1 ROLES=admin,brand_head node crawl.mjs $S/a >/dev/null
for d in c o a; do echo "== $d"; node -e 'for(const x of require(process.argv[1]))if(x.w==1280){const l=x.issues.find(i=>i.t=="_len");const e=x.issues.find(i=>i.t=="jserror");console.log(x.r,"->",l.url,l.n,e?e.tag:"")}' $S/$d/results.json; done
