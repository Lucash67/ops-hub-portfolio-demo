"use client";

import { useState } from "react";

interface ComposeBarProps {
  onCreate: (seed?: { title?: string; body?: string }) => Promise<unknown> | unknown;
}

/** Composer central estilo Keep. */
export function ComposeBar({ onCreate }: ComposeBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setExpanded(false);
  };

  const submit = async () => {
    if (!title.trim() && !body.trim()) {
      reset();
      return;
    }
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), body: body.trim() });
      reset();
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mx-auto flex w-full max-w-[600px] items-center rounded-lg border border-[#5f6368]/45 bg-[#202124] px-4 py-3.5 text-left text-[15px] text-[#e8eaed]/55 shadow-[0_1px_3px_rgba(0,0,0,0.45)] transition hover:bg-[#28292c]"
      >
        Tirar uma nota...
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-lg border border-[#5f6368]/45 bg-[#202124] shadow-[0_4px_16px_rgba(0,0,0,0.45)]">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Título"
        className="w-full bg-transparent px-4 pt-4 text-[16px] font-medium text-[#e8eaed] placeholder:text-[#e8eaed]/40 focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Anotar..."
        rows={3}
        className="w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed text-[#e8eaed]/90 placeholder:text-[#e8eaed]/35 focus:outline-none"
      />
      <div className="flex justify-end px-2 pb-2">
        <button
          type="button"
          disabled={busy}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void submit()}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[#e8eaed]/85 hover:bg-white/10 disabled:opacity-50"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
