import re

with open('frontend/app/globals.css', 'r') as f:
    css = f.read()

tokens = """
@layer components {
  .liquid-glass {
    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.5);
    box-shadow:
      0 25px 50px -12px rgba(0,0,0,0.05),
      inset 0 1px 1px rgba(255,255,255,0.8),
      inset 0 -1px 20px rgba(0,229,255,0.05);
  }
  .dark .liquid-glass {
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      0 25px 50px -12px rgba(0,0,0,0.3),
      inset 0 1px 1px rgba(255,255,255,0.05),
      inset 0 -1px 20px rgba(0,229,255,0.03);
  }
  .heavy-glass {
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(25px);
    border: 1px solid rgba(255,255,255,0.8);
    box-shadow:
      0 30px 60px -15px rgba(25,28,29,0.08),
      inset 0 0 0 1px rgba(255,255,255,1);
  }
  .dark .heavy-glass {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow:
      0 30px 60px -15px rgba(0,0,0,0.2),
      inset 0 0 0 1px rgba(255,255,255,0.03);
  }
  .milled-ceramic {
    background: #ffffff;
    border: 1px solid rgba(225,227,228,0.6);
    box-shadow:
      0 15px 35px rgba(0,0,0,0.02),
      inset 0 2px 4px rgba(0,0,0,0.01);
  }
  .dark .milled-ceramic {
    background: #0F172A;
    border: 1px solid rgba(148,163,184,0.12);
    box-shadow:
      0 15px 35px rgba(0,0,0,0.15),
      inset 0 2px 4px rgba(0,0,0,0.1);
  }
  .micro-etch {
    background-image:
      linear-gradient(rgba(186,201,204,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(186,201,204,0.08) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .misty-cyan-glow {
    background: radial-gradient(circle at center, rgba(0,229,255,0.12) 0%, transparent 70%);
  }
  .glow-cyan {
    box-shadow: 0 0 40px rgba(0,229,255,0.3);
  }
  .brackets::before,
  .brackets::after {
    content: "";
    position: absolute;
    width: 10px;
    height: 10px;
    pointer-events: none;
    opacity: 0.3;
  }
  .brackets::before {
    top: 1.5rem; left: 1.5rem;
    border-top: 1px solid currentColor;
    border-left: 1px solid currentColor;
  }
  .brackets::after {
    top: 1.5rem; right: 1.5rem;
    border-top: 1px solid currentColor;
    border-right: 1px solid currentColor;
  }
  .protocol-tag {
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    color: #94a3b8;
  }
  .version-tag {
    font-family: 'Fira Code', monospace;
    font-size: 8px;
    color: #94a3b8;
    position: absolute;
    top: 1.5rem;
    right: 3rem;
    letter-spacing: 0.15em;
    opacity: 0.5;
  }
"""

css = css.replace('@layer components {\n  .glass-panel', tokens + '\n  .glass-panel')

with open('frontend/app/globals.css', 'w') as f:
    f.write(css)
