#!/usr/bin/env python3
"""
XiaomeiTech PDF generation tool.

Usage:
  python scripts/generate_pdf.py -c pdf-configs/datasheet.yaml
  python scripts/generate_pdf.py -c pdf-configs/datasheet.yaml -o custom.pdf

For batch generation:
  for f in pdf-configs/*.yaml; do python scripts/generate_pdf.py -c "$f"; done
"""

import argparse
import logging
import os
import re
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# Fix Windows console encoding for Chinese output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# On Windows, ensure GTK3-Runtime is at the front of PATH so WeasyPrint
# finds the correct Pango/Cairo DLLs (avoids conflicts with Inkscape/GTKWave).
_gdk_fix_applied = False
if sys.platform == "win32":
    _gtk_dirs = [
        r"C:\Program Files\GTK3-Runtime Win64\bin",
        r"C:\Program Files\GTK3-Runtime\bin",
    ]
    for _d in _gtk_dirs:
        if os.path.isdir(_d):
            try:
                os.add_dll_directory(_d)
            except Exception:
                pass
            # Also move GTK3 to front of PATH
            _path = os.environ.get("PATH", "")
            _parts = _path.split(os.pathsep)
            _parts = [p for p in _parts if _d not in p]
            os.environ["PATH"] = os.pathsep.join([_d] + _parts)
            _gdk_fix_applied = True
            break

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader
from pikepdf import Pdf

try:
    from weasyprint import CSS, HTML
except OSError as exc:
    print(f"ERROR: WeasyPrint cannot load (missing system libraries): {exc}")
    print("On Windows, install GTK3 Runtime: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer")
    print("On Linux (CI), install: libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# Suppress noisy DEBUG logs from WeasyPrint's dependencies
for _noisy in ("weasyprint", "fontTools", "PIL", "cssselect2", "tinycss2"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "pdf-templates"


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------


def load_config(path):
    """Load a YAML config file and resolve all paths relative to ROOT."""
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    raw["_config_dir"] = str(path.parent)
    raw["_config_name"] = path.stem
    _set_defaults(raw)
    _resolve_paths(raw)
    return raw


def _set_defaults(cfg):
    cfg.setdefault("company", "")
    cfg.setdefault("company_en", "")
    cfg.setdefault("brand", "#dc2626")
    cfg.setdefault("year", str(datetime.now().year))
    cfg.setdefault("output", f"pdf-out/{cfg.get('_config_name', 'output')}.pdf")
    cfg.setdefault("cover", {})
    cfg.setdefault("ending", {})
    cfg.setdefault("content", {})
    cfg.setdefault("appendices", [])
    cfg.setdefault("content_order", [])
    cfg.setdefault("pdf", {})
    pdf = cfg["pdf"]
    pdf.setdefault("format", "A4")
    pdf.setdefault("margin", {"top": 94, "right": 57, "bottom": 94, "left": 57})
    pdf.setdefault("font_family", "HarmonyOS Sans SC, SimHei, sans-serif")
    pdf.setdefault("font_dir", "docs/public/fonts")
    pdf.setdefault("header", {"left": cfg["company"], "right": cfg.get("title", "")})
    pdf.setdefault("footer", {"center": "page / topage"})


def _resolve_paths(cfg):
    """Make relative paths absolute (relative to config file directory or ROOT)."""
    base = Path(cfg["_config_dir"])
    for key in ("cover", "ending"):
        tpl = cfg.get(key, {})
        if tpl.get("template"):
            p = Path(tpl["template"])
            if not p.is_absolute():
                p = _find(p, base)
            try:
                cfg[key]["template"] = Path(p).relative_to(ROOT).as_posix()
            except ValueError:
                cfg[key]["template"] = Path(p).as_posix()
    content = cfg.get("content", {})
    if content.get("base_dir"):
        p = Path(content["base_dir"])
        content["base_dir"] = str(p if p.is_absolute() else ROOT / p)
    else:
        content["base_dir"] = str(ROOT / "markdown")
    content.setdefault("files", [])
    # Appendices
    resolved = []
    for a in cfg.get("appendices", []):
        p = Path(a)
        resolved.append(str(p if p.is_absolute() else _find(p, base)))
    cfg["appendices"] = resolved
    # Font dir
    fd = Path(cfg["pdf"]["font_dir"])
    cfg["pdf"]["font_dir"] = str(fd if fd.is_absolute() else ROOT / fd)
    # Output
    out = Path(cfg["output"])
    cfg["output"] = str(out if out.is_absolute() else ROOT / out)


def _find(path, base_dir):
    """Try to find a file: relative to base_dir, then relative to ROOT."""
    cand = base_dir / path
    if cand.exists():
        return cand
    cand2 = ROOT / path
    if cand2.exists():
        return cand2
    return str(path)


# ---------------------------------------------------------------------------
# Template rendering (Jinja2)
# ---------------------------------------------------------------------------


def make_env():
    """Create a Jinja2 environment loading templates from TEMPLATE_DIR and ROOT."""
    return Environment(
        loader=FileSystemLoader([str(TEMPLATE_DIR), str(ROOT)]),
        autoescape=False,
    )


def render_template(env, template_rel, variables):
    """Render a Jinja2 template to HTML string."""
    if not template_rel:
        return ""
    p = Path(template_rel)
    if p.is_absolute():
        # Load absolute path directly
        tpl = Environment().from_string(p.read_text(encoding="utf-8"))
        return tpl.render(variables)
    tmpl = env.get_template(str(template_rel))
    return tmpl.render(variables)


# ---------------------------------------------------------------------------
# Markdown → HTML
# ---------------------------------------------------------------------------


def _make_md():
    return markdown.Markdown(
        extensions=[
            "tables",
            "fenced_code",
            "codehilite",
            "toc",
            "attr_list",
            "admonition",
        ],
        extension_configs={
            "codehilite": {"guess_lang": False, "css_class": "highlight"},
            "toc": {"permalink": False},
        },
    )


def collect_markdown_files(file_list, base_dir):
    """Walk file_list entries (files or dirs) and return ordered list of .md paths."""
    base = Path(base_dir)
    collected = []
    for entry in file_list:
        entry = str(entry)
        if "*" in entry or "?" in entry:
            # Glob pattern relative to base
            for p in sorted(base.glob(entry)):
                if p.suffix == ".md":
                    collected.append(p)
        else:
            p = base / entry
            if p.is_dir():
                for f in sorted(p.rglob("*.md")):
                    collected.append(f)
            elif p.suffix == ".md" and p.exists():
                collected.append(p)
            else:
                # Try as glob pattern
                found = list(sorted(base.glob(entry)))
                for f in found:
                    if f.suffix == ".md" and f not in collected:
                        collected.append(f)
                if not found:
                    log.warning("No markdown files found for: %s", entry)
    # Deduplicate while preserving order
    seen = set()
    uniq = []
    for p in collected:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    return uniq


def _process_wavedrom_blocks(html_text):
    """Replace wavedrom code blocks with inline SVG rendered by the wavedrom library."""
    try:
        import wavedrom
    except ImportError:
        log.warning("wavedrom library not available, skipping waveform rendering")
        return html_text

    def _render_block(m):
        code = m.group(1)
        try:
            data = json_loads_relaxed(code)
            svg = wavedrom.render(data)
            return f'<div class="wavedrom-figure">{svg}</div>'
        except Exception as exc:
            log.warning("Failed to render wavedrom block: %s", exc)
            return f"<pre><code>{code}</code></pre>"

    # Match <pre><code class="language-wavedrom">...</code></pre>
    pattern = r'<pre><code class="language-wavedrom">(.*?)</code></pre>'
    return re.sub(pattern, _render_block, html_text, flags=re.DOTALL)


def json_loads_relaxed(text):
    """JSON parse that tolerates unquoted keys (JS-style)."""
    import json

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try js2py or just eval as last resort
        pass
    # Simple key quoting for common patterns
    fixed = re.sub(r"(\s*?)(\w+)(\s*?):", r'\1"\2"\3:', text)
    return json.loads(fixed)


def _resolve_image_paths(html_text, md_file_path, base_dir):
    """Convert relative image src to absolute file:// paths for WeasyPrint."""
    md_dir = Path(md_file_path).parent

    def _fix_src(m):
        src = m.group(1)
        if src.startswith(("http://", "https://", "data:", "file://", "/")):
            return m.group(0)
        candidate = md_dir / src
        if candidate.exists():
            return f'src="{candidate.as_uri()}"'
        # Try relative to base_dir
        candidate2 = Path(base_dir) / src
        if candidate2.exists():
            return f'src="{candidate2.as_uri()}"'
        return m.group(0)

    return re.sub(r'src="([^"]+)"', _fix_src, html_text)


def convert_content_to_html(config):
    """Convert configured markdown files + appendices into a single HTML body."""
    content = config.get("content", {})
    base_dir = content["base_dir"]
    file_list = content.get("files", [])
    appendices = config.get("appendices", [])

    md = _make_md()
    parts = []

    # Main content
    for md_path in collect_markdown_files(file_list, base_dir):
        rel = Path(md_path).relative_to(base_dir)
        log.info("  [md] %s", rel)
        text = Path(md_path).read_text(encoding="utf-8")
        # Strip VitePress frontmatter (YAML between --- delimiters)
        text = _strip_frontmatter(text)
        # Strip Vue <script setup> blocks
        text = _strip_vue_blocks(text)
        html = md.convert(text)
        html = _resolve_image_paths(html, md_path, base_dir)
        html = _process_wavedrom_blocks(html)
        parts.append(html)
        md.reset()

    # Appendices (reusable content)
    for app_path in appendices:
        p = Path(app_path)
        if p.exists():
            log.info("  [appendix] %s", p.name)
            text = p.read_text(encoding="utf-8")
            text = _strip_frontmatter(text)
            html = md.convert(text)
            parts.append(html)
            md.reset()
        else:
            log.warning("Appendix not found: %s", app_path)

    return "\n".join(parts)


def _strip_frontmatter(text):
    """Remove YAML frontmatter (--- ... ---) from markdown text."""
    if text.startswith("---"):
        idx = text.find("---", 3)
        if idx != -1:
            return text[idx + 3 :].lstrip("\n")
    return text


def _strip_vue_blocks(text):
    """Remove <script setup>...</script> blocks from markdown."""
    return re.sub(r"<script\s+setup\b.*?</script>", "", text, flags=re.DOTALL)


# ---------------------------------------------------------------------------
# CSS generation
# ---------------------------------------------------------------------------

_FONT_FACES_CSS = """
@font-face {{
  font-family: 'HarmonyOS Sans SC';
  src: url('{font_dir}/HarmonyOS_Sans_SC_Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}}
@font-face {{
  font-family: 'HarmonyOS Sans SC';
  src: url('{font_dir}/HarmonyOS_Sans_SC_Bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
}}
"""

_CONTENT_CSS_TMPL = """
@page {{
  size: {format};
  margin: {margin_top}pt {margin_right}pt {margin_bottom}pt {margin_left}pt;

  @top-left {{
    content: "{header_left}";
    font-family: {font_family};
    font-size: 9pt;
    color: {brand};
    padding-top: 20pt;
  }}
  @top-right {{
    content: "{header_right}";
    font-family: {font_family};
    font-size: 9pt;
    color: #5f778e;
    padding-top: 20pt;
  }}
  @bottom-left {{
    content: "{footer_left}";
    font-family: {font_family};
    font-size: 7pt;
    color: #999;
  }}
  @bottom-center {{
    content: counter(page) " / " counter(pages);
    font-family: {font_family};
    font-size: 7pt;
    color: #999;
  }}
}}

@page :first {{
  @top-left {{ content: none; }}
  @top-right {{ content: none; }}
}}

body {{
  font-family: {font_family};
  font-size: 11pt;
  line-height: 1.7;
  color: #222;
}}

h1 {{
  font-size: 22pt;
  color: {brand};
  border-bottom: 2px solid {brand};
  padding-bottom: 6pt;
  margin-top: 24pt;
  margin-bottom: 12pt;
  page-break-before: always;
}}
h1:first-of-type {{ page-break-before: avoid; }}

h2 {{
  font-size: 16pt;
  color: #333;
  margin-top: 20pt;
  margin-bottom: 8pt;
}}
h3 {{
  font-size: 13pt;
  color: #555;
  margin-top: 16pt;
  margin-bottom: 6pt;
}}
h4 {{
  font-size: 11pt;
  color: #666;
  margin-top: 12pt;
  margin-bottom: 4pt;
}}

p {{ margin: 6pt 0; }}

table {{
  width: 100%;
  border-collapse: collapse;
  margin: 10pt 0;
  font-size: 9pt;
  page-break-inside: avoid;
}}
th, td {{
  border: 1px solid #ccc;
  padding: 4pt 8pt;
  text-align: left;
}}
th {{
  background-color: #f5f5f5;
  font-weight: bold;
}}

pre {{
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  padding: 8pt 12pt;
  font-size: 8pt;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  page-break-inside: avoid;
}}
code {{
  font-family: 'Courier New', Courier, monospace;
  font-size: 9pt;
  background: #f0f0f0;
  padding: 1pt 3pt;
}}
pre code {{
  background: transparent;
  padding: 0;
}}

blockquote {{
  border-left: 3px solid {brand};
  margin: 10pt 0;
  padding: 6pt 12pt;
  color: #666;
  background: #fafafa;
  page-break-inside: avoid;
}}

img {{
  max-width: 100%;
  height: auto;
  page-break-inside: avoid;
}}

hr {{
  border: none;
  border-top: 1px solid #ddd;
  margin: 16pt 0;
}}

ul, ol {{ margin: 6pt 0; padding-left: 24pt; }}
li {{ margin: 2pt 0; }}

.highlight {{ margin: 10pt 0; }}
.highlight pre {{ margin: 0; }}

.wavedrom-figure {{
  margin: 12pt 0;
  text-align: center;
  page-break-inside: avoid;
}}
.wavedrom-figure svg {{
  max-width: 100%;
  height: auto;
}}

/* Admonition blocks (compatible with VitePress ::: syntax) */
.admonition {{
  border-left: 4px solid #999;
  padding: 8pt 12pt;
  margin: 10pt 0;
  background: #f8f8f8;
  page-break-inside: avoid;
}}
.admonition.info {{ border-color: #4493f8; background: #f0f6ff; }}
.admonition.tip {{ border-color: #3fb950; background: #f0fff4; }}
.admonition.warning {{ border-color: #d29922; background: #fffcf0; }}
.admonition.danger {{ border-color: {brand}; background: #fff5f5; }}

/* Appendix separator */
.appendix-separator {{
  page-break-before: always;
  border-top: 2px solid {brand};
  margin-top: 20pt;
  padding-top: 10pt;
}}
"""


def build_content_css(config):
    pdf = config["pdf"]
    m = pdf["margin"]
    header = pdf.get("header", {})
    footer = pdf.get("footer", {})
    footer_left = footer.get("left", f"© {config['year']} {config['company_en']}")

    return _CONTENT_CSS_TMPL.format(
        format=pdf["format"],
        margin_top=m["top"],
        margin_right=m["right"],
        margin_bottom=m["bottom"],
        margin_left=m["left"],
        header_left=header.get("left", config["company"]),
        header_right=header.get("right", config.get("title", "")),
        footer_left=footer_left,
        brand=config["brand"],
        font_family=pdf["font_family"],
    )


def build_font_faces(config):
    font_uri = Path(config["pdf"]["font_dir"]).resolve().as_uri()
    return _FONT_FACES_CSS.format(font_dir=font_uri)


# ---------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------


def html_to_pdf(html_content, output_path, extra_css=None):
    """Render HTML to PDF via WeasyPrint, returns output_path."""
    doc = HTML(string=html_content)
    css_list = []
    if extra_css:
        css_list.append(CSS(string=extra_css))
    doc.write_pdf(output_path, stylesheets=css_list or None)
    log.info("  → %s", output_path)
    return output_path


def merge_pdfs(pdf_paths, output_path):
    """Merge multiple PDF files into one using pikepdf."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    merged = Pdf.new()
    for p in pdf_paths:
        if not Path(p).exists():
            log.warning("PDF not found, skipping: %s", p)
            continue
        src = Pdf.open(p)
        merged.pages.extend(src.pages)
        src.close()
    merged.save(str(output_path))
    merged.close()
    log.info("  Merged → %s", output_path)
    return str(output_path)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def _inject_font_css(html_str, font_css):
    """Inject @font-face CSS into an HTML document before </head>."""
    return html_str.replace("</head>", f"<style>{font_css}</style></head>")


def _suppress_noisy_loggers():
    """Suppress DEBUG/INFO spam from WeasyPrint's dependencies."""
    noise_prefixes = ("fontTools", "weasyprint", "PIL", "cssselect2", "tinycss2")
    for name in logging.root.manager.loggerDict:
        if name.startswith(noise_prefixes):
            logging.getLogger(name).setLevel(logging.WARNING)


def generate_pdf(config):
    env = make_env()
    temp_dir = Path(tempfile.mkdtemp(prefix="pdfgen_"))
    temp_pdfs = []

    # Build font CSS once for all parts
    font_css = build_font_faces(config)

    # Suppress noisy logs (must be called after lazy loggers are created)
    if logging.getLogger().level > logging.DEBUG:
        _suppress_noisy_loggers()

    try:
        # 1. Cover page
        cover = config.get("cover", {})
        cover_tpl = cover.get("template", "")
        cover_path = None
        if cover_tpl:
            log.info("[cover] %s", Path(cover_tpl).name)
            cover_vars = _build_variables(config, cover)
            cover_html = render_template(env, cover_tpl, cover_vars)
            cover_html = _inject_font_css(cover_html, font_css)
            cover_path = str(temp_dir / "cover.pdf")
            html_to_pdf(cover_html, cover_path)
            temp_pdfs.append(cover_path)

        # 2. Body content from markdown
        log.info("[body] converting markdown...")
        body_html = convert_content_to_html(config)
        content_css = build_content_css(config)
        # Wrap in full HTML document for WeasyPrint
        body_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8">
<style>{font_css}{content_css}</style>
</head>
<body>
{body_html}
</body>
</html>"""
        body_path = str(temp_dir / "body.pdf")
        html_to_pdf(body_html, body_path)
        temp_pdfs.append(body_path)

        # 3. Ending page
        ending = config.get("ending", {})
        ending_tpl = ending.get("template", "")
        if ending_tpl:
            log.info("[ending] %s", Path(ending_tpl).name)
            ending_vars = _build_variables(config, ending)
            ending_html = render_template(env, ending_tpl, ending_vars)
            ending_html = _inject_font_css(ending_html, font_css)
            ending_path = str(temp_dir / "ending.pdf")
            html_to_pdf(ending_html, ending_path)
            temp_pdfs.append(ending_path)

        # 4. Merge all PDFs
        output = config["output"]
        log.info("[merge] combining %d parts...", len(temp_pdfs))
        merge_pdfs(temp_pdfs, output)
        log.info("[done] %s", output)

    finally:
        # Cleanup temp dir
        import shutil

        shutil.rmtree(temp_dir, ignore_errors=True)


def _build_variables(config, section):
    """Build the variables dict for Jinja2 template rendering."""
    vars_dict = {
        "COMPANY": config["company"],
        "COMPANY_EN": config["company_en"],
        "BRAND": config["brand"],
        "YEAR": config["year"],
        "MONTH": datetime.now().strftime("%m"),
        "DAY": datetime.now().strftime("%d"),
        "TITLE": config.get("title", ""),
        "SUBTITLE": config.get("subtitle", ""),
        "SERIES": config.get("series", ""),
        "DESCRIPTION": config.get("description", ""),
        "FONT": config["pdf"]["font_family"],
    }
    # Merge section-specific variables (allow overriding)
    extra = section.get("variables", {})
    if extra:
        vars_dict.update(extra)
    return vars_dict


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="XiaomeiTech PDF generation tool — compile markdown + templates into PDF"
    )
    parser.add_argument(
        "-c", "--config", required=True, help="Path to YAML config file"
    )
    parser.add_argument(
        "-o", "--output", help="Override output PDF path"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug output (all libraries)"
    )
    parser.add_argument(
        "-q", "--quiet", action="store_true", help="Only show errors and warnings"
    )
    args = parser.parse_args()

    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    elif args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        for _name in ("weasyprint", "fontTools", "PIL", "cssselect2", "tinycss2"):
            logging.getLogger(_name).setLevel(logging.DEBUG)

    config = load_config(args.config)
    if args.output:
        config["output"] = args.output

    log.info("Generating: %s", config.get("title", config.get("_config_name")))
    generate_pdf(config)


if __name__ == "__main__":
    main()
