"use client";

import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

type DebouncedSearchInputProps = {
  clearLabel: string;
  isCommittable?: (value: string) => boolean;
  label: string;
  onClear: () => void;
  onSearch: (value: string) => void;
  placeholder: string;
  value: string;
};

export function DebouncedSearchInput({
  clearLabel,
  isCommittable = defaultIsCommittable,
  label,
  onClear,
  onSearch,
  placeholder,
  value,
}: DebouncedSearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [lastSent, setLastSent] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== lastSent) {
      setDraft(value);
      setLastSent(value);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), [value]);

  function commit(next: string) {
    const normalized = normalizeQuery(next);
    const query = isCommittable(normalized) ? normalized : "";
    if (query === lastSent) return;
    setLastSent(query);
    onSearch(query);
  }

  function handleChange(next: string) {
    setDraft(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    clearTimeout(timerRef.current);
    setLastSent("");
    setDraft("");
    onClear();
  }

  return (
    <div className="relative flex items-center">
      <UiIcon
        aria-hidden
        className="pointer-events-none absolute left-3 text-muted-foreground"
        name="search"
        size={18}
      />
      <input
        aria-label={label}
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        enterKeyHint="search"
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={draft}
      />
      {draft.length > 0 ? (
        <button
          aria-label={clearLabel}
          className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={handleClear}
          type="button"
        >
          <UiIcon name="x" size={16} />
        </button>
      ) : null}
    </div>
  );
}

function defaultIsCommittable(value: string): boolean {
  return value.length === 0 || value.length >= SEARCH_MIN_LENGTH;
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
