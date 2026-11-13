import re
from collections import OrderedDict

INPUT = r"C:\Users\hi\mowakkil-live-reference\live-ref\assets\styles.css"
OUTPUT = r"C:\Users\hi\mowakkil\styles-analysis.txt"

with open(INPUT, "r", encoding="utf-8") as f:
    content = f.read()

# إزالة التعليقات (/* ... */)
content_no_comments = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)

# استخراج كل تعريف (selector { ... })
# ملاحظة: ده تحليل بسيط، مش perfect، لكن كفاية
pattern = r"([^{}]+?)\s*\{([^{}]*)\}"
matches = re.findall(pattern, content_no_comments)

# تجميع التعريفات (نحتفظ بآخر تعريف لكل selector)
selectors = OrderedDict()
duplicates = {}

for selector, body in matches:
    selector = selector.strip()
    # تجاهل @media و @keyframes
    if selector.startswith("@") or selector.startswith("from") or selector.startswith("to"):
        continue
    
    if selector in selectors:
        if selector not in duplicates:
            duplicates[selector] = []
        duplicates[selector].append(selectors[selector])
    
    selectors[selector] = body.strip()

# كتابة التقرير
with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write("=== CSS Analysis Report ===\n")
    f.write(f"Input: {INPUT}\n")
    f.write(f"Total selectors: {len(selectors)}\n")
    f.write(f"Duplicates: {len(duplicates)}\n\n")
    
    f.write("=== Duplicated Selectors (آخر تعريف بيكسب) ===\n\n")
    for sel, old_bodies in duplicates.items():
        f.write(f"[{sel}]\n")
        f.write(f"  عدد التعريفات: {len(old_bodies) + 1}\n")
        f.write(f"  التعريف الأخير: {selectors[sel][:200]}...\n\n")
    
    f.write("\n\n=== Final CSS (كل selector بتعريفه الأخير) ===\n\n")
    for sel, body in selectors.items():
        f.write(f"{sel} {{\n{body}\n}}\n\n")

print(f"Report saved to: {OUTPUT}")
print(f"Total selectors: {len(selectors)}")
print(f"Duplicates: {len(duplicates)}")