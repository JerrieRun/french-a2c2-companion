#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用微软开源工具 MarkItDown 把 PDF 教材转成 Markdown。

用途：大体积 PDF（如 145MB 教材）在浏览器内转换较慢时，
可在本地用官方工具转换，再把生成的 .md 导入到应用「Markdown 精读」页。

安装（任选其一）：
    pip install "markitdown[pdf]"
    # 或： uv add "markitdown[pdf]"

用法：
    python scripts/pdf_to_markdown.py <输入.pdf> [输出.md]

示例：
    python scripts/pdf_to_markdown.py ~/Downloads/Edito_B2.pdf ~/Downloads/Edito_B2.md

说明：
    MarkItDown 是微软开源项目（https://github.com/microsoft/markitdown），
    会把标题、段落、列表、表格等结构尽量还原为 Markdown，专为 LLM 使用设计。
    注意：MarkItDown 的输出面向文本提取/AI 识别，不追求像素级排版还原。
"""
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src.rsplit(".", 1)[0] + ".md"

    try:
        from markitdown import MarkItDown
    except ImportError:
        print("未安装 markitdown，请先运行：pip install \"markitdown[pdf]\"", file=sys.stderr)
        return 1

    print(f"正在转换：{src}")
    md = MarkItDown()
    result = md.convert(src)
    text = result.text_content or ""

    with open(dst, "w", encoding="utf-8") as f:
        f.write(text)

    print(f"✅ 转换完成：{src} -> {dst}（{len(text)} 字符）")
    print("提示：在应用「教材中心 → Markdown 精读」页顶部点击「导入 .md」加载本文件。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
