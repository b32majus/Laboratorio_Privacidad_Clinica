# Issue #91 / REC-11 — U2a visual GO and U3a activation (2026-10-13)

**Authority: documented owner decision, not a product change.**
Supersedes ONLY the pre-GO execution-status wording of
docs/handoffs/ISSUE91_TANDA_A_REVIEW_BATCH_C087_20261012.md.
All literal U3a implementation instructions, scope, tests and STOP rules
in section 3 and section 4 of that handoff remain authoritative.

- Human-accepted U2a candidate: 6c28de22efecbd4022f5abbeb5181e533edb87c9
  (parent fe72dac8112b71da7c222ea5e1b55c0d603a28c1).
- Cora independently inspected the real populated 24-detection screenshot
  at 1440x900 and 375x800 against the Sophilux B V1 frozen previews and
  gave GO for the composition of U2a, not for the complete visual polish.
- On 2026-10-13 the human owner explicitly answered SI to approving
  U2a with the actual mobile order inspector first -> document ->
  findings, retaining the current finish and deferring overall aesthetic
  refinement to a separately authorized later stage.
- U1 remains accepted, frozen and not reopened; its 2/2 corrections remain
  consumed. U2a is accepted for its bounded visual-composition unit;
  no implicit approval for unrelated functional or visual changes.
- **U3a is now READY_TO_LAUNCH**, with exactly ONE fresh complex implementer,
  never the U2a worker. Its first real populated 12-document witness
  (10 synthetic TXT + two genuine PDF read failures) and the prescribed
  focused tests are mandatory; then STOP at
  READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U3A.
- The original Tanda A handoff is historical when it says U2a must run
  first and U3a is BLOCKED; that gate is now satisfied by this explicit
  Cora + human GO. There is no permission to repeat U2a or alter its
  approved CSS/JSX under U3a.
- U4-U7, Standards/Spec, push, PR, merge, deployment and #91 closure
  remain unauthorized. Any unexpected material defect requires HUMAN STOP.

**Fixed working frontier after this docs-only record:** the SHA of the
recording commit, whose parent must equal the accepted U2a SHA above.
The next U3a bounded product commit builds upon that clean docs-only
frontier, with the accepted U2a SHA preserved as its ancestor.
