"use client";
import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react";
import {
  type ArticleFormat,
  formatText,
  matchingFormat,
  plainFormat,
} from "@/modules/media/article-format";

function toDocument(blocks: ArticleFormat): JSONContent {
  const document: JSONContent = {
    type: "doc",
    content: blocks.length
      ? blocks.map((b) => {
          const paragraph: JSONContent = {
            type: b.kind.startsWith("heading") ? "heading" : "paragraph",
            ...(b.kind.startsWith("heading")
              ? { attrs: { level: b.kind === "heading2" ? 2 : 3 } }
              : {}),
            content: b.runs.flatMap((r) =>
              r.text.split("\n").flatMap((text, i) => [
                ...(i ? [{ type: "hardBreak" }] : []),
                ...(text
                  ? [
                      {
                        type: "text",
                        text,
                        marks: [
                          ...(r.bold ? [{ type: "bold" }] : []),
                          ...(r.italic ? [{ type: "italic" }] : []),
                          ...(r.underline ? [{ type: "underline" }] : []),
                          ...(r.color
                            ? [
                                {
                                  type: "textStyle",
                                  attrs: { color: r.color },
                                },
                              ]
                            : []),
                        ],
                      },
                    ]
                  : []),
              ]),
            ),
          };
          if (b.kind === "quote")
            return { type: "blockquote", content: [paragraph] };
          if (b.kind === "bullet" || b.kind === "number")
            return {
              type: b.kind === "bullet" ? "bulletList" : "orderedList",
              content: [{ type: "listItem", content: [paragraph] }],
            };
          return paragraph;
        })
      : [{ type: "paragraph" }],
  };
  const merged: JSONContent[] = [];
  for (const node of document.content || []) {
    const previous = merged.at(-1);
    if (
      (node.type === "bulletList" || node.type === "orderedList") &&
      previous?.type === node.type
    ) {
      previous.content!.push(...(node.content || []));
    } else merged.push(node);
  }
  return { ...document, content: merged };
}
function fromDocument(doc: JSONContent): ArticleFormat {
  const blocks: ArticleFormat = [];
  const visit = (node: JSONContent, kind?: "bullet" | "number" | "quote") => {
    if (node.type === "paragraph" || node.type === "heading") {
      blocks.push({
        kind:
          kind ||
          (node.type === "heading"
            ? node.attrs?.level === 2
              ? "heading2"
              : "heading3"
            : "paragraph"),
        runs: (node.content || []).map((n) => {
          const marks = n.marks || [];
          const color = marks.find((m) => m.type === "textStyle")?.attrs?.color;
          return {
            text: n.type === "hardBreak" ? "\n" : n.text || "",
            bold: marks.some((m) => m.type === "bold"),
            italic: marks.some((m) => m.type === "italic"),
            underline: marks.some((m) => m.type === "underline"),
            ...(/^#[0-9a-f]{6}$/i.test(color || "") ? { color } : {}),
          };
        }),
      });
    } else
      for (const child of node.content || [])
        visit(
          child,
          node.type === "bulletList"
            ? "bullet"
            : node.type === "orderedList"
              ? "number"
              : node.type === "blockquote"
                ? "quote"
                : kind,
        );
  };
  visit(doc);
  return blocks;
}
export function ArticleBodyEditor({
  text,
  format,
  disabled,
  onChange,
}: {
  text: string;
  format?: ArticleFormat;
  disabled: boolean;
  onChange: (text: string, format: ArticleFormat) => void;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const lastText = useRef(text);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        trailingNode: false,
      }),
      TextStyle,
      Color,
    ],
    content: toDocument(matchingFormat(text, format) || plainFormat(text)),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Full article text",
        "aria-multiline": "true",
        class: "article-rich-content",
      },
    },
    onUpdate: ({ editor }) => {
      const value = fromDocument(editor.getJSON());
      const plain = formatText(value);
      lastText.current = plain;
      callback.current(plain, value);
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  useEffect(() => {
    if (editor && text !== lastText.current) {
      editor.commands.setContent(
        toDocument(matchingFormat(text, format) || plainFormat(text)),
        { emitUpdate: false },
      );
      lastText.current = text;
    }
  }, [editor, text, format]);
  if (!editor) return <p>Loading article editor...</p>;
  const actions = [
    {
      label: "Bold",
      icon: Bold,
      active: "bold",
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: "italic",
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: Underline,
      active: "underline",
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: "bulletList",
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: "orderedList",
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Clear formatting",
      icon: RemoveFormatting,
      run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
    {
      label: "Undo",
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "Redo",
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  return (
    <div className="article-rich-editor">
      <div
        className="article-rich-toolbar"
        role="group"
        aria-label="Article formatting"
      >
        <select
          aria-label="Text style"
          disabled={disabled}
          value={
            editor.isActive("heading", { level: 2 })
              ? "2"
              : editor.isActive("heading", { level: 3 })
                ? "3"
                : "paragraph"
          }
          onChange={(e) =>
            e.target.value === "paragraph"
              ? editor.chain().focus().setParagraph().run()
              : editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(e.target.value) as 2 | 3 })
                  .run()
          }
        >
          <option value="paragraph">Paragraph</option>
          <option value="2">Heading</option>
          <option value="3">Subheading</option>
        </select>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            title={a.label}
            aria-label={a.label}
            aria-pressed={a.active ? editor.isActive(a.active) : undefined}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={a.run}
          >
            <a.icon size={17} />
          </button>
        ))}
        <label className="article-color">
          Color
          <input
            type="color"
            aria-label="Text color"
            disabled={disabled}
            value={editor.getAttributes("textStyle").color || "#172033"}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
          />
        </label>
      </div>
      <EditorContent editor={editor} />
      <p className="article-editor-help">
        Select text to format it. Keep the abstract, authors and date in their
        separate fields.
      </p>
    </div>
  );
}
