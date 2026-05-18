"use client";

import { useRef, KeyboardEvent, ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInput({ length = 6, value, onChange, disabled }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").split("").slice(0, length);

  function updateAt(index: number, char: string) {
    const arr = digits.map((d) => (d === " " ? "" : d));
    arr[index] = char;
    onChange(arr.join("").replace(/\s/g, "").slice(0, length));
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) inputs.current[index + 1]?.focus();
  }

  function onInput(index: number, char: string) {
    if (!/^\d?$/.test(char)) return;
    updateAt(index, char);
    if (char && index < length - 1) inputs.current[index + 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    const next = Math.min(pasted.length, length - 1);
    inputs.current[next]?.focus();
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i]?.trim() ?? ""}
          onChange={(e) => onInput(i, e.target.value.slice(-1))}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className={cn(
            "h-12 w-10 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] text-center text-lg font-semibold tabular-nums",
            "focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 sm:h-14 sm:w-12"
          )}
        />
      ))}
    </div>
  );
}
