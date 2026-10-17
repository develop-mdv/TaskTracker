"use client";

import type { CSSProperties } from "react";

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const MARKDOWN_OR_URL_PATTERN = /\[([^\]\r\n]+)\]\(((?:https?:\/\/|www\.)[^\s<]+?)\)|((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]]+$/;

type TextPart =
    | { type: "text"; value: string }
    | { type: "link"; value: string; href: string };

export function LinkifiedText({
    text,
    linkClassName,
    linkStyle,
    parseMarkdownLinks = false,
}: {
    text: string;
    linkClassName?: string;
    linkStyle?: CSSProperties;
    parseMarkdownLinks?: boolean;
}) {
    const parts = linkify(text, parseMarkdownLinks);

    return (
        <>
            {parts.map((part, index) => {
                if (part.type === "text") {
                    return <span key={index}>{part.value}</span>;
                }

                return (
                    <a
                        key={index}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClassName ?? "font-medium text-indigo-300 underline decoration-indigo-400/50 underline-offset-2 hover:text-indigo-200"}
                        style={linkStyle}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {part.value}
                    </a>
                );
            })}
        </>
    );
}

function linkify(text: string, parseMarkdownLinks: boolean): TextPart[] {
    const parts: TextPart[] = [];
    let lastIndex = 0;

    const pattern = parseMarkdownLinks ? MARKDOWN_OR_URL_PATTERN : URL_PATTERN;
    for (const match of text.matchAll(pattern)) {
        const rawValue = match[0];
        const markdownUrl = parseMarkdownLinks && match[2];
        const index = match.index ?? 0;

        if (index > lastIndex) {
            parts.push({ type: "text", value: text.slice(lastIndex, index) });
        }

        const trailing = markdownUrl
            ? ""
            : rawValue.match(TRAILING_PUNCTUATION)?.[0] ?? "";
        const value = markdownUrl
            ? match[1]
            : trailing ? rawValue.slice(0, -trailing.length) : rawValue;
        const url = markdownUrl || value;

        parts.push({
            type: "link",
            value,
            href: /^www\./i.test(url) ? `https://${url}` : url,
        });

        if (trailing) {
            parts.push({ type: "text", value: trailing });
        }

        lastIndex = index + rawValue.length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: "text", value: text.slice(lastIndex) });
    }

    return parts;
}
