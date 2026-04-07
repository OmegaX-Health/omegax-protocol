import os
import re
import glob

components = glob.glob('frontend/components/*-workbench.tsx')

for path in components:
    with open(path, 'r') as f:
        content = f.read()

    # Apply heavy-glass and brackets to the main panels
    content = content.replace('ceramic-panel', 'heavy-glass brackets')
    content = content.replace('workbench-table-card-embedded', 'workbench-table-card-embedded milled-ceramic')
    
    with open(path, 'w') as f:
        f.write(content)

print("Patched components")
