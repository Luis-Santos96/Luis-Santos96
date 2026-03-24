#!/usr/bin/env python3
"""Parse full-exam-bank.md into questions.json used by the PWA.

Usage:
  python tools/parse_md_to_json.py path/to/full-exam-bank.md public/data/questions.json

Notes:
- Supports options A-F.
- Expects an "# Answer Key" section with "**N.** Answer: **X**" lines.
"""

import re, json, sys
from pathlib import Path

def main(inp: str, out: str):
    md = Path(inp).read_text(encoding='utf-8')

    weights = {}
    ws = re.search(r"\*\*Domain weights:\*\*\s*(.*?)
---", md, re.S)
    if ws:
        for line in ws.group(1).splitlines():
            m=re.match(r"-\s*(.+?):\s*~?(\d+)%", line.strip())
            if m:
                weights[m.group(1).strip()] = int(m.group(2))

    parts = md.split('# Answer Key')
    q_part = parts[0]
    a_part = parts[1] if len(parts)>1 else ''

    domains=[]
    questions={}
    current=None
    lines=q_part.splitlines()
    i=0
    while i < len(lines):
        line=lines[i]
        dm=re.match(r"^##\s+Domain\s+(\d+):\s+(.+?)\s*$", line)
        if dm:
            name=dm.group(2).strip(); num=int(dm.group(1))
            did=re.sub(r"[^a-z0-9]+","-",name.lower()).strip('-')
            current={'number':num,'name':name,'id':did,'weight':weights.get(name)}
            domains.append(current)
            i+=1
            continue

        qm=re.match(r"^\*\*(\d+)\.\*\*\s*(.+)$", line)
        if qm and current:
            qid=int(qm.group(1)); qtext=qm.group(2).strip(); opts={}
            i+=1
            while i < len(lines):
                l=lines[i]
                if re.match(r"^\*\*\d+\.\*\*\s+", l) or re.match(r"^##\s+Domain\s+", l) or l.strip().startswith('---'):
                    break
                om=re.match(r"^\s*([A-F])\)\s+(.*)$", l)
                if om:
                    opts[om.group(1)] = om.group(2).strip()
                else:
                    if l.strip() and not l.strip().startswith('>'):
                        qtext += ' ' + l.strip()
                i+=1
            questions[qid]={'id':qid,'domainId':current['id'],'domainName':current['name'],'text':qtext,'options':opts,'correct':None,'explanation':None,'difficulty':3}
            continue

        i+=1

    al=a_part.splitlines(); idx=0
    while idx < len(al):
        line=al[idx]
        am=re.match(r"^\*\*(\d+)\.\*\*\s+Answer:\s+\*\*([A-F])\*\*", line)
        if am:
            qid=int(am.group(1)); corr=am.group(2)
            idx+=1
            expl=[]
            while idx < len(al) and not re.match(r"^\*\*\d+\.\*\*\s+Answer:\s+\*\*[A-F]\*\*", al[idx]):
                l=al[idx]
                if l.strip().startswith('>'):
                    expl.append(l.strip().lstrip('>').strip())
                elif expl and l.strip():
                    expl.append(l.strip())
                idx+=1
            if qid in questions:
                questions[qid]['correct']=corr
                questions[qid]['explanation']=' '.join(expl).strip() if expl else None
            continue
        idx+=1

    # fill missing weights best effort
    if any(d.get('weight') is None for d in domains):
        for d in domains:
            if d.get('weight') is None:
                for k,v in weights.items():
                    if k.lower() in d['name'].lower() or d['name'].lower() in k.lower():
                        d['weight']=v
                        break

    exam_meta={'title':'Databricks Certified Data Engineer Associate','questionCount':len(questions),'examQuestions':45,'examMinutes':90,
               'domainWeights':{d['name']:d.get('weight') for d in domains if d.get('weight') is not None}}

    dataset={'meta':exam_meta,'domains':domains,'questions':[questions[k] for k in sorted(questions)]}

    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Wrote {out} with {len(dataset['questions'])} questions")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
