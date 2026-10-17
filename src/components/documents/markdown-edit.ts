/**
 * Markdown 编辑器的选区工具(纯函数,便于单测)。
 * 编辑器工具栏与快捷键共用,负责"把光标/选区套上标记"这类文本变换。
 */

export interface EditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

/** 用 prefix/suffix 包裹选区;无选区时插入占位文字并选中它 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder: string
): EditResult {
  const selected = value.slice(start, end)
  const inner = selected || placeholder
  const next = value.slice(0, start) + prefix + inner + suffix + value.slice(end)
  const innerStart = start + prefix.length
  return { value: next, selectionStart: innerStart, selectionEnd: innerStart + inner.length }
}

/** 对选区覆盖的每一行加/去行首前缀(列表、引用、标题等) */
export function toggleLinePrefix(value: string, start: number, end: number, prefix: string): EditResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
  let lineEnd = value.indexOf("\n", end)
  if (lineEnd === -1) lineEnd = value.length

  const block = value.slice(lineStart, lineEnd)
  const lines = block.split("\n")
  const allPrefixed = lines.every((line) => line.startsWith(prefix))
  const next = lines.map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line)).join("\n")

  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + next.length,
  }
}

/** 在光标处插入块级内容(代码块/表格/公式),可指定块内要选中的占位文字 */
export function insertBlock(value: string, pos: number, block: string, select?: string): EditResult {
  const before = value.slice(0, pos)
  const after = value.slice(pos)
  const lead = before && !before.endsWith("\n") ? "\n" : ""
  const tail = after && !after.startsWith("\n") ? "\n" : ""
  const next = before + lead + block + tail + after

  let selectionStart = before.length + lead.length
  let selectionEnd = selectionStart + block.length
  if (select) {
    const idx = block.indexOf(select)
    if (idx >= 0) {
      selectionStart = before.length + lead.length + idx
      selectionEnd = selectionStart + select.length
    }
  }
  return { value: next, selectionStart, selectionEnd }
}

/** 插入行内链接:选中文字作为链接文字,选区落在待填写的地址上 */
export function insertLink(value: string, start: number, end: number, placeholder = "链接文字"): EditResult {
  const selected = value.slice(start, end)
  const text = selected || placeholder
  const url = "https://"
  const next = `${value.slice(0, start)}[${text}](${url})${value.slice(end)}`
  const urlStart = start + text.length + 3
  return { value: next, selectionStart: urlStart, selectionEnd: urlStart + url.length }
}

const LIST_ITEM = /^([ \t]*)([-*+]|\d+[.)])([ \t]+)(.*)$/

/** 在光标处换行;位于列表条目内时自动续上标记与序号(空条目则退出列表) */
export function continueList(value: string, pos: number): EditResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1
  const lineEnd = value.indexOf("\n", pos)
  const end = lineEnd === -1 ? value.length : lineEnd
  const line = value.slice(lineStart, end)
  const match = LIST_ITEM.exec(line)

  if (!match) {
    const next = `${value.slice(0, pos)}\n${value.slice(pos)}`
    return { value: next, selectionStart: pos + 1, selectionEnd: pos + 1 }
  }

  const [, indent, marker, , rest] = match
  // 条目已空(如 "- " 后再回车):去掉标记,退出列表,避免套娃
  const beforeCursor = value.slice(lineStart, pos)
  if (!rest.trim() && /^[ \t]*(?:[-*+]|\d+[.)])[ \t]*$/.test(beforeCursor)) {
    const next = value.slice(0, lineStart) + indent + value.slice(end)
    const caret = lineStart + indent.length
    return { value: next, selectionStart: caret, selectionEnd: caret }
  }

  const ordered = /^(\d+)([.)])$/.exec(marker)
  const nextMarker = ordered ? `${Number(ordered[1]) + 1}${ordered[2]}` : marker
  const insertion = `\n${indent}${nextMarker} `
  const next = value.slice(0, pos) + insertion + value.slice(pos)
  return { value: next, selectionStart: pos + insertion.length, selectionEnd: pos + insertion.length }
}

/** Tab 缩进:光标处插入两个空格;多行选区给每一行加缩进 */
export function indentSelection(value: string, start: number, end: number, indent = "  "): EditResult {
  if (start === end) {
    const next = value.slice(0, start) + indent + value.slice(start)
    return { value: next, selectionStart: start + indent.length, selectionEnd: start + indent.length }
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
  let lineEnd = value.indexOf("\n", end)
  if (lineEnd === -1) lineEnd = value.length
  const block = value.slice(lineStart, lineEnd)
  const next = block
    .split("\n")
    .map((line) => (line ? indent + line : line))
    .join("\n")

  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    selectionStart: start + indent.length,
    selectionEnd: end + indent.length,
  }
}
