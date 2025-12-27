import os
import shutil
import re
import datetime

# Configuration
SOURCE_DIR = "."
DIST_DIR = "dist"
COPYRIGHT_HEADER = f"// © {datetime.datetime.now().year} City Pave. All Rights Reserved. Unauthorized copying is prohibited."

# Files to ignore
IGNORE_PATTERNS = [
    "build.py",
    ".git",
    ".DS_Store",
    "dist",
    "node_modules",
    "README.md",
    "task.md",
    "context_for_gemini.md",
    "implementation_plan.md",
    "walkthrough.md",
    "setup_test_user.js",
    "developer_setup.html"
]

def minify_js(content):
    # Remove single-line comments
    content = re.sub(r'//.*', '', content)
    # Remove multi-line comments
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    # Remove whitespace (basic)
    # Note: Aggressive whitespace removal in JS can break things if semicolons are missing.
    # We will do safe minification: remove leading/trailing whitespace and empty lines.
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    return ' '.join(lines)

def minify_html(content):
    # Remove comments
    content = re.sub(r'<!--[\s\S]*?-->', '', content)
    # Remove whitespace between tags
    content = re.sub(r'>\s+<', '><', content)
    return content.strip()

def build():
    print(f"🚀 Starting Build Process...")
    
    # 1. Clean Dist
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)
    print(f"✅ Cleaned {DIST_DIR}/ directory")

    # 2. Process Files
    file_count = 0
    for root, dirs, files in os.walk(SOURCE_DIR):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_PATTERNS]
        
        for file in files:
            if file in IGNORE_PATTERNS or file.startswith('.'):
                continue
                
            src_path = os.path.join(root, file)
            rel_path = os.path.relpath(src_path, SOURCE_DIR)
            dest_path = os.path.join(DIST_DIR, rel_path)
            
            # Create dest directory
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            # Process based on extension
            if file.endswith('.js'):
                with open(src_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                minified = minify_js(content)
                with open(dest_path, 'w', encoding='utf-8') as f:
                    f.write(f"{COPYRIGHT_HEADER}\n{minified}")
            
            elif file.endswith('.html'):
                with open(src_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                minified = minify_html(content)
                with open(dest_path, 'w', encoding='utf-8') as f:
                    # HTML comments are visible, so we don't prepend JS header, 
                    # but we could add a comment if needed.
                    f.write(f"<!-- {COPYRIGHT_HEADER} -->\n{minified}")
            
            else:
                # Copy other assets (css, images) as is
                shutil.copy2(src_path, dest_path)
            
            file_count += 1

    print(f"✅ Processed {file_count} files")
    print(f"🎉 Build Complete! Protected code is in '{DIST_DIR}/'")

if __name__ == "__main__":
    build()
