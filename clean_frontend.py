import os
import re

files = [
    'frontend/components/plans-workbench.tsx',
    'frontend/components/capital-workbench.tsx',
    'frontend/components/governance-workbench.tsx',
    'frontend/components/oracles-workbench.tsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the aside block
    content = re.sub(r'\s*<aside className="workbench-rail">.*?</aside>\n', '\n', content, flags=re.DOTALL)
    
    # Remove the workbench-summary-strip block
    content = re.sub(r'\s*<div className="workbench-summary-strip">.*?</div>\n', '\n', content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Updated files successfully")
