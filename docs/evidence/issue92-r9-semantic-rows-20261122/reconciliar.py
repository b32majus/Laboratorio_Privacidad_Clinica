#!/usr/bin/env python3
"""Conservative REC12 R9 material reconciliation: NO inferred functional PASS.
Read-only historical sources; writes its new evidence directory only.
Each of the 142 rows retains the ORIGINAL verbatim objective and rationale.
Never changes frozen matrix, original tests, product, or other evidence.
"""
from pathlib import Path
from collections import Counter
import csv
import json
import re

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
MATRIX = ROOT / "docs/audits/2026-10-recovery-traceability-matrix.md"
R1 = ROOT / "docs/evidence/issue92-r1-reconciliacion-20261121/EVIDENCIA_POR_FILA.csv"
lines = MATRIX.read_text(encoding="utf-8").splitlines()
original = list(csv.DictReader(R1.open(encoding="utf-8")))
ledger = {r["id"]: r for r in original}
assert len(original) == len(ledger) == 142

# Statuses are R9's *confidence in the specific new corroboration*,
# NOT the historical/official status of the clause or overall recovery.
positive = {
    "QA-002": ("TESTIGO_FOCAL_R8", "R8 13 source contracts (12 direct + #11 under D-024), 22/22 live E2E; cannot certify all QA scope"),
    "QA-003": ("TESTIGO_FOCAL_R8", "R8 network-invariant live flow + planted fetch/XHR, 22/22 joint PASS"),
    "FUNC-001": ("TESTIGO_FOCAL_R8", "R8 review-export real exact Safe bytes and reviewed state, 22/22 joint PASS"),
    "FUNC-002": ("TESTIGO_FOCAL_R8", "R8 batch navigation still pending and explicit decision makes completion, 22/22 joint PASS"),
    "FILE-002": ("TESTIGO_FOCAL_R8", "R8 live text-layer and scanned PDF refused with no job, 22/22 joint PASS"),
    "BATCH-001": ("TESTIGO_FOCAL_R8", "R8 real failed-item preservation and recovery, 22/22 joint PASS"),
    "STRUCT-001": ("TESTIGO_FOCAL_R8", "R8 composed structured Unknown is pending and blocks export, 22/22 joint PASS"),
    "UX-013": ("CANDIDATO_POSITIVO_R9_CONTRADICE_MATRIZ", "R9 actual ReviewWorkspace keyboard dispatcher A/M/K/F, Alt+Up/Down; 72/72 component tests, real Review-productivity E2E; historical OPEN_RECOVERY/never implemented is stale"),
    "UX-015": ("TESTIGO_FOCAL_R6", "R6 mobile 375/320 with 32 columns/19 pending + 4/4 contract E2E, single patient-ID"),
    "PDR-04": ("TESTIGO_FOCAL_R6", "R6 inspected four-column comparative table and first viewport active inspector; mobile real capture + E2E"),
    "UX-005": ("TESTIGO_HUMANO_VISUAL_R3_R6", "Human-approved Sophilux and R6 visual composition; does not certify every state/layout"),
    "H-02": ("TESTIGO_HUMANO_VISUAL_R3_R6", "Human-approved Sophilux B V1 and R6 visual comparison"),
    "CI-001": ("CONTROL_REMOTO_VERIFICADO_R7", "R7 GitHub CI run 44903478299 success at 3.0-main@46bce0a; workflow does npm test, candidate R9 not merged"),
    "GOV-002": ("CONTROL_REMOTO_VERIFICADO_R7", "R7 GitHub API: 3.0-main protected/enforcement everyone, checks validate/e2e/CodeQL/Secret Scan; local not merged"),
    "H-01": ("TESTIGO_FOCAL_R7_PARCIAL", "R7 F7/F9/R7 9/9 real Spanish E2E, rare inaccessible cases not universally tested"),
    "PDR-08": ("TESTIGO_FOCAL_R7_PARCIAL", "R7 two Spanish rare error/result failures corrected, all error/ARIA states not universal"),
}
explicit_open = {
    "GOV-001": ("DECISION_HUMANA_O_GOV_PENDIENTE", "Default branch main vs canonical 3.0-main; do not change without human GO"),
    "DOC-001": ("CIERRE_GOBERNANZA_93", "Documentation must reconcile against final merged product under #93"),
    "HOST-001": ("CIERRE_GOBERNANZA_93", "Origin/deployment final smoke and headers after #92"),
    "HOST-002": ("CIERRE_GOBERNANZA_93", "Origin/deployment final smoke and headers after #92"),
    "H-03": ("TARGET_VISUAL_NO_SUPERSEDED", "JetBrains Mono proposed, default font-mono used, human supersession not recorded"),
    "PERF-002": ("EVIDENCIA_PARCIAL_CON_DEUDA", "Core benchmarks+some lazy modules, not all exporters or composed responsiveness; GAP-01 accepted post-recovery only"),
    "H-01": ("TESTIGO_FOCAL_R7_PARCIAL", "Spanish real cases R7 positive, exhaustive locale/ARIA variants not established"),
    "PDR-08": ("TESTIGO_FOCAL_R7_PARCIAL", "Spanish real cases R7 positive, exhaustive locale/ARIA variants not established"),
}
# Known *accepted* historical disposition is preserved, NOT transformed to PASS
known_debt = {"STRUCT-003", "ARCH-003", "ARCH-005", "CODE-002",
              "HOST-003", "HOST-004", "HOST-005", "PRODUCT-007",
              "PRODUCT-008", "PRODUCT-009", "PRODUCT-010",
              "PRODUCT-011", "PRODUCT-012", "PRODUCT-013"}
superseded = {"UX-016", "H-36"}

def rows_of_section(label, start, end):
    a = next(i for i, l in enumerate(lines) if l.startswith(start))
    b = next(i for i in range(a + 1, len(lines)) if lines[i].startswith(end))
    found = []
    for lineno in range(a, b):
        line = lines[lineno]
        if not line.startswith("| `"):
            continue
        cells = [x.strip() for x in line.split("|")[1:-1]]
        item_id = cells[0].replace("`", "")
        assert item_id in ledger, (label, item_id)
        if label == "A":
            assert len(cells) == 8
            objective, old_verdict, blocker, rationale = (
                cells[2], cells[4].replace("**", ""), cells[5], cells[7]
            )
        elif label == "B":
            assert len(cells) in (7, 8)
            objective, old_verdict, blocker, rationale = (
                cells[1], cells[4].replace("**", ""), cells[5],
                cells[3] + (" | " + cells[7] if len(cells) == 8 else "")
            )
        else:
            assert len(cells) == 6
            objective, old_verdict, blocker, rationale = (
                cells[1], "NO_VERDICT_COLUMN", cells[3], cells[2] + " | " + cells[5]
            )
        old = ledger[item_id]
        file_refs = [x for x in old["testigos_actuales"].split(";") if x]
        valid_refs = [x for x in file_refs if (ROOT / x).is_file()]
        absent_refs = [x for x in file_refs if not (ROOT / x).is_file()]
        if item_id in explicit_open:
            status, new_evidence = explicit_open[item_id]
        elif item_id in positive:
            status, new_evidence = positive[item_id]
        elif item_id in known_debt:
            status, new_evidence = "DEUDA_O_FUTURO_CONSERVADO", "Historical partial/future disposition preserved, no automatic closure"
        elif item_id in superseded:
            status, new_evidence = "SUPERSESSION_HUMANA_PREVIA", "Review the original human decision; does not imply feature implemented"
        elif item_id in ("UX-001", "UX-007", "UX-002"):
            status, new_evidence = "TESTIGO_PREVIO_SIN_RECHECK_R9", "Prior R4/R5 product evidence exists; no fresh clause-wide adjudication"
        else:
            status, new_evidence = "TESTIGO_PREVIO_SIN_RECHECK_R9", "Existing linked test may support part of objective, but not semantically reverified here"
        found.append({
            "section": label, "id": item_id, "source_line": lineno + 1,
            "objective_verbatim": objective, "verdict_historical": old_verdict,
            "recovery_blocker_historical": blocker,
            "rationale_historical": rationale,
            "r1_treatment": old["tratamiento_R1"],
            "witnesses_r1_existing": ";".join(valid_refs),
            "witnesses_r1_missing": ";".join(absent_refs),
            "witness_count_existing": len(valid_refs),
            "status_r9_evidence": status,
            "new_reconciliation": new_evidence,
            "clause_closed_by_r9": "NO"
        })
    return found

rows = (
    rows_of_section("A", "## A.", "## B.") +
    rows_of_section("B", "## B.", "## C.") +
    rows_of_section("C", "## C.", "## D.")
)
assert [sum(x["section"]==s for x in rows) for s in "ABC"] == [88,42,12]
assert len(rows) == len({x["id"] for x in rows}) == 142
assert {x["id"] for x in rows} == set(ledger)

out = OUT / "MATRIZ_142_R9.csv"
fields = list(rows[0])
with out.open("w",encoding="utf-8",newline="") as f:
    writer=csv.DictWriter(f,fieldnames=fields,lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
summary = {
    "candidate": "3728f0b",
    "source_matrix": str(MATRIX.relative_to(ROOT)),
    "source_r1": str(R1.relative_to(ROOT)),
    "total_rows": 142,
    "sections": dict(Counter(x["section"] for x in rows)),
    "evidence_status_counts": dict(Counter(x["status_r9_evidence"] for x in rows)),
    "missing_witness_files_count": sum(len(x["witnesses_r1_missing"].split(";")) for x in rows if x["witnesses_r1_missing"]),
    "rows_with_empty_r1_witness": [x["id"] for x in rows if not x["witnesses_r1_existing"]],
    "candidate_positive_specific": sorted(positive),
    "known_discrepancies": [
        {"id":"UX-013","previous_claim":"shortcuts never implemented","current_fact":"real Review keyboard dispatcher + test"},
        {"id":"GOV-002","previous_claim":"3.0-main not protected","current_fact":"GitHub branch protected by required checks"},
        {"id":"CI-001","previous_claim":"CI does not run npm test","current_fact":"workflow and 2026-11-21 remote run did run full npm test"},
        {"id":"QA-002","previous_claim":"13 P1Q-04 cases non-enumerable","current_fact":"R8 source lines 365-377 and 22/22 composed E2E"},
        {"id":"PERF-002","previous_claim":"heavy parsers/exporters fully lazy","current_fact":"composed memory/responsiveness not proven, partial only"}
    ],
    "limitation": "This is NOT 142 clauses functionally reverified. 142 verbatim original objectives+historic status+existing file references are reconciled; statuses distinguish direct focal corroboration from mere witness pointers."
}
(OUT/"RESUMEN_142_R9.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print("R9_142_RECONCILIATION_WRITTEN",out)
print(json.dumps(summary,ensure_ascii=False,indent=2))
