#!/usr/bin/env python3
"""Conservatively consolidate real source/code/test witness reviews; never infer PASS from file existence."""
import json,csv,re,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent
statuses={"SEMANTIC_PASS","PARTIAL","ACCEPTED_DEBT","SUPERSEDED","FUTURE","GOVERNANCE_93","HUMAN_REQUIRED","UNVERIFIED","CONTRADICTION"}
pattern=re.compile(r'([\w./-]+\.(?:tsx|ts|mjs|js|md|css|json|txt)):(\d+)')
all_rows=[]
warnings=[]
for group in ["A1","A2","B","C"]:
 expected=json.loads((OUT/f"INPUT_{group}.json").read_text())
 audited=json.loads((OUT/f"AUDIT_{group}.json").read_text())
 exp_ids=[r["id"] for r in expected]
 got_ids=[r["id"] for r in audited]
 assert len(exp_ids)==len(set(exp_ids))==len(got_ids)==len(set(got_ids)),(group,"duplicate count")
 assert set(got_ids)==set(exp_ids),(group,"missing",set(exp_ids)-set(got_ids),"extra",set(got_ids)-set(exp_ids))
 amap={r["id"]:r for r in audited}
 for src in expected:
  r=amap[src["id"]]
  state=r.get("status")
  if state not in statuses:
   warnings.append(f'{r["id"]}: invalid status {state!r}')
   state="UNVERIFIED"
  witness=r.get("witness","")
  matches=pattern.findall(witness)
  found_test=False
  refs=[]
  for p,n in matches:
   path=ROOT/p
   if not path.is_file():
    warnings.append(f'{r["id"]}: nonexistent file {p}')
    continue
   try:
    line=int(n)
    nlines=sum(1 for _ in path.open(encoding="utf-8",errors="replace"))
    if line<1 or line>nlines:
     warnings.append(f'{r["id"]}: out of range {p}:{n} ({nlines})')
     continue
   except OSError: continue
   refs.append(f"{p}:{n}")
   if "/test" in p or ".test." in p or p.startswith("e2e/") or p.startswith("scripts/ci/"):
    found_test=True
  if state=="SEMANTIC_PASS" and not found_test:
   warnings.append(f'{r["id"]}: reviewer PASS lacks assertion/test location; conservatively PARTIAL')
   state="PARTIAL"
  if state in ("SUPERSEDED","ACCEPTED_DEBT") and not witness:
   warnings.append(f'{r["id"]}: accepted decision lacks documented witness; conservatively UNVERIFIED')
   state="UNVERIFIED"
  all_rows.append({
   "section":src["section"],"id":src["id"],"source_line":src["source_line"],
   "objective_verbatim":src["objective_verbatim"],"verdict_historical":src["verdict_historical"],
   "r9_status":src["status_r9_evidence"],"r11_status":state,
   "witness_reviewer":witness,"citations_validated":";".join(refs),
   "reason":r.get("semantic_reason",""),"residual_gap":r.get("residual_gap",""),
   "next_action":r.get("next_action","")
  })
assert len(all_rows)==142 and len({r["id"] for r in all_rows})==142
# Independent curator evidence: correcting reviewer omissions without overwriting
# source-scope judgments or silently hiding the raw reviewer statuses.
curations=json.loads((OUT/"ADJUDICACIONES_CORA.json").read_text())
curation_by_id={r["id"]:r for r in curations}
assert len(curations)==len(curation_by_id) and set(curation_by_id)<=set(r["id"] for r in all_rows)
curated_statuses=statuses|{"STRUCTURAL_PASS","VISUAL_HUMAN_APPROVED_SCOPED","ACCEPTED_NONBLOCKING_TARGET_GAP"}
for r in all_rows:
 c=curation_by_id.get(r["id"])
 r["curated_status"]=c["status"] if c else r["r11_status"]
 r["curation_evidence"]=c["evidence"] if c else ""
 r["curation_reason"]=c["reason"] if c else ""
 if not c:continue
 assert c["status"] in curated_statuses,r["id"]
 evidence_refs=pattern.findall(c["evidence"])
 assert evidence_refs,(r["id"],"no file:line witness in curation")
 for fn,ln in evidence_refs:
  f=ROOT/fn
  assert f.is_file(),(r["id"],"nonexistent",fn)
  assert 1<=int(ln)<=sum(1 for _ in f.open(encoding="utf-8")), (r["id"],"invalid line",fn,ln)
assert len(all_rows)==142 and sum(r["curated_status"] in ("SEMANTIC_PASS","STRUCTURAL_PASS","VISUAL_HUMAN_APPROVED_SCOPED") for r in all_rows)>=104
fields=list(all_rows[0])
with (OUT/"MATRIZ_142_R11.csv").open("w",encoding="utf-8",newline="") as f:
 writer=csv.DictWriter(f,fieldnames=fields,lineterminator="\n");writer.writeheader();writer.writerows(all_rows)
summary={"candidate":"8e1fa978ef1f5589ee2632c9c1fa5a6f0efa9680",
         "rows":len(all_rows),"sections":dict(collections.Counter(r["section"] for r in all_rows)),
         "status_counts":dict(collections.Counter(r["r11_status"] for r in all_rows)),
         "status_by_id":{s:[r["id"] for r in all_rows if r["r11_status"]==s] for s in sorted(statuses)},
         "curated_status_counts":dict(collections.Counter(r["curated_status"] for r in all_rows)),
         "curated_status_by_id":{s:[r["id"] for r in all_rows if r["curated_status"]==s] for s in sorted(curated_statuses)},
         "curated_count":len(curations),
         "reviewed_base_sha":"8e1fa978ef1f5589ee2632c9c1fa5a6f0efa9680",
         "patch_sha_before_documentation":"bb7567a",
         "reviewer_warning_count":len(warnings),"reviewer_warnings":warnings,
         "method":"SEMANTIC_PASS only if reviewer cites check in test/CI/E2E and actual file:line exists. Tests all green on RC1 GitHub, but line existence is not independent human acceptance. Never infer PASS from an existing file."}
(OUT/"RESUMEN_R11.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"rows":142,"status_counts":summary["status_counts"],"curated_status_counts":summary["curated_status_counts"],"warnings":warnings[:40]},ensure_ascii=False,indent=2))
