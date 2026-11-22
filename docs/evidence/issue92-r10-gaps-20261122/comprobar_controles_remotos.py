"""Reproducible REC-12 R10 read-only public security + GitHub status snapshot."""
import datetime,json,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
REPO="b32majus/Laboratorio_Privacidad_Clinica"
ORIGIN="https://laboratorio-privacidad-clinica.onrender.com/"
def call(*args):
 return subprocess.run(args,capture_output=True,text=True)
def getjson(*args):
 p=call(*args)
 if p.returncode:raise RuntimeError("read-only failed: "+p.stderr[:150])
 return json.loads(p.stdout)
head=call("curl","-sS","-I","--max-time","25",ORIGIN)
if head.returncode:raise RuntimeError("origin HEAD failed: "+head.stderr[:100])
raw=head.stdout.replace("\r","")
blocks=[x for x in raw.split("\n\n") if x.startswith("HTTP/")]
assert blocks
lines=blocks[-1].splitlines()
headers={}
for line in lines[1:]:
 if ":" in line:
  k,v=line.split(":",1);headers[k.lower()]=v.strip()
checks={
 "status_200":"200" in lines[0],
 "referrer_no_referrer":headers.get("referrer-policy")=="no-referrer",
 "frame_ancestors_none":"frame-ancestors 'none'" in headers.get("content-security-policy",""),
 "connect_self":"connect-src 'self'" in headers.get("content-security-policy",""),
 "x_frame_deny":headers.get("x-frame-options")=="DENY",
}
assert all(checks.values()),checks
branch=getjson("gh","api",f"repos/{REPO}/branches/3.0-main")
repo=getjson("gh","api",f"repos/{REPO}")
runs={}
for key,runid in [("ci",44903478299),("codeql",44903478279),("secret_scan",44903478292)]:
 r=getjson("gh","run","view",str(runid),"-R",REPO,"--json","headSha,conclusion,status")
 runs[key]={"run_id":runid,"conclusion":r["conclusion"],"headSha":r["headSha"]}
 assert r["conclusion"]=="success" and r["headSha"]==branch["commit"]["sha"]
alerts=call("gh","api",f"repos/{REPO}/dependabot/alerts?state=open")
try:a=json.loads(alerts.stdout or "{}")
except json.JSONDecodeError:a={}
msg=a.get("message") if isinstance(a,dict) else None
dep_state="DISABLED_REPORTED" if msg=="Dependabot alerts are disabled for this repository." else ("API_OK" if alerts.returncode==0 else "INCONCLUSIVE")
package=json.loads((ROOT/"package.json").read_text())
dependencies={**package.get("dependencies",{}),**package.get("devDependencies",{})}
collector=[x for x in dependencies if x.startswith("@vitest/coverage") or x in ("c8","nyc","istanbul")]
result={
 "observed_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
 "origin":{"url":ORIGIN,"method":"HEAD","status":lines[0],"assertions":checks,"csp":headers.get("content-security-policy"),"referrer_policy":headers.get("referrer-policy"),"x_frame_options":headers.get("x-frame-options")},
 "github":{"repo":REPO,"branch":"3.0-main","sha":branch["commit"]["sha"],"protected":branch["protected"],"default_branch":repo["default_branch"],"runs":runs,"dependabot_alerts":{"state":dep_state,"github_message":msg,"api_success":alerts.returncode==0}},
 "coverage":{"collector_dependencies":collector,"source_line_branch_coverage_measured":False},
 "limits":["Public HEAD proves headers at time of request, not deployed HEAD after future R10 merge","GitHub runs apply to remote SHA only","Dependabot alert status differs from .github/dependabot.yml weekly update configuration","No code coverage measurement or dependency change performed","No patient data, no GitHub mutations"]
}
out=OUT/"CONTROLES_REMOTOS_R10.json"
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print("REMOTE_R10_OK",checks,"sha",branch["commit"]["sha"][:8],"dependabot",dep_state,"coverage_measured=NO")
