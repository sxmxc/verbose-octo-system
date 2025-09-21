Open the repo and load `ai/ops/codex.md` as your system/developer prompt. 
Use it for all steps in this session and future sessions.

Follow the Work loop:

1) Read: 
- ai/ops/codex.md 
- docs/TODO.yaml
- ai/state/progress.json
- ai/state/journal.md

2) Select the next task from docs/TODO.yaml (highest priority todo with no unmet dependencies). 
Explain your selection briefly, citing Context items. 

3) Plan the smallest possible PR (≤500 lines) to satisfy the task acceptance criteria.

4) Propose exact file changes you will make.  
Output filenames and discription of change. 
5) After proposal, output the updates you will make to: 
- docs/TODO.yaml (move task to in_progress or done),
- ai/state/progress.json (increment step, set last_task_id, update coverage placeholders),
- ai/state/journal.md (append a dated entry with Context references).

6) Stop and wait for me to give approval to apply changes. Do not proceed to another task until I confirm. 

Begin with step 1 and then present step 2 (task selection) and step 3 (plan).
If modifying a Toolkit, DO NOT modify the Toolbox framework. 
If modifying the Toolbox framework, DO NOT modify any Toolkits. 
If you must, ask for approval and provide reason.
Use context7 MCP to ensure code accuracy and illiminate hallucinations.