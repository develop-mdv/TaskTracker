"use client";

import type { CSSProperties } from "react";

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]]+$/;

type TextPart =
    | { type: "text"; value: string }
    | { type: "link"; value: string; href: string };

export function LinkifiedText({
    text,
    linkClassName,
    linkStyle,
}: {
    text: string;
    linkClassName?: string;
    linkStyle?: CSSProperties;
}) {
    const parts = linkify(text);

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

function linkify(text: string): TextPart[] {
    const parts: TextPart[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(URL_PATTERN)) {
        const rawValue = match[0];
        const index = match.index ?? 0;

        if (index > lastIndex) {
            parts.push({ type: "text", value: text.slice(lastIndex, index) });
        }

        const trailing = rawValue.match(TRAILING_PUNCTUATION)?.[0] ?? "";
        const value = trailing ? rawValue.slice(0, -trailing.length) : rawValue;

        parts.push({
            type: "link",
            value,
            href: value.startsWith("www.") ? `https://${value}` : value,
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
