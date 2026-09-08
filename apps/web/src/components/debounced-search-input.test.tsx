import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { render, screen, userEvent, waitFor } from "@/test-utils";

import { DebouncedSearchInput } from "./debounced-search-input";

const CLEAR_LABEL = "Очистити пошук";
const LABEL = "Пошук цитат";

function activeQuery(): string {
  return screen.getByRole("status").textContent ?? "";
}

function SearchHarness({
  isCommittable,
  onQuery,
}: {
  isCommittable?: (value: string) => boolean;
  onQuery: (value: string) => void;
}) {
  const [query, setQuery] = useState("");

  function handleSearch(next: string) {
    setQuery(next);
    onQuery(next);
  }

  return (
    <>
      <DebouncedSearchInput
        clearLabel={CLEAR_LABEL}
        {...(isCommittable === undefined ? {} : { isCommittable })}
        label={LABEL}
        onClear={() => handleSearch("")}
        onSearch={handleSearch}
        placeholder="Пошук"
        value={query}
      />
      <output>{query}</output>
    </>
  );
}

function searchInput(): HTMLElement {
  return screen.getByRole("textbox", { name: LABEL });
}

describe("DebouncedSearchInput", () => {
  it("searches once the draft is long enough", async () => {
    const onQuery = vi.fn();
    render(<SearchHarness onQuery={onQuery} />);

    await userEvent.type(searchInput(), "книга");

    await waitFor(() => expect(onQuery).toHaveBeenCalledWith("книга"));
    expect(activeQuery()).toBe("книга");
  });

  it("stays quiet while the draft is a single character", async () => {
    const onQuery = vi.fn();
    render(<SearchHarness onQuery={onQuery} />);

    await userEvent.type(searchInput(), "к");

    await waitFor(() => expect(searchInput()).toHaveValue("к"));
    expect(onQuery).not.toHaveBeenCalled();
    expect(activeQuery()).toBe("");
  });

  it("drops the previous search when the draft shrinks to a single character", async () => {
    const onQuery = vi.fn();
    render(<SearchHarness onQuery={onQuery} />);

    await userEvent.type(searchInput(), "книга");
    await waitFor(() => expect(activeQuery()).toBe("книга"));

    await userEvent.type(searchInput(), "{Backspace}{Backspace}{Backspace}{Backspace}");

    await waitFor(() => expect(activeQuery()).toBe(""));
    expect(onQuery).toHaveBeenLastCalledWith("");
    expect(searchInput()).toHaveValue("к");
  });

  it("searches again as soon as the draft grows back", async () => {
    const onQuery = vi.fn();
    render(<SearchHarness onQuery={onQuery} />);

    await userEvent.type(searchInput(), "книга");
    await waitFor(() => expect(activeQuery()).toBe("книга"));
    await userEvent.type(searchInput(), "{Backspace}{Backspace}{Backspace}{Backspace}");
    await waitFor(() => expect(activeQuery()).toBe(""));

    await userEvent.type(searchInput(), "іт");

    await waitFor(() => expect(activeQuery()).toBe("кіт"));
  });

  it("clears both the draft and the search from the clear button", async () => {
    const onQuery = vi.fn();
    render(<SearchHarness onQuery={onQuery} />);

    await userEvent.type(searchInput(), "книга");
    await waitFor(() => expect(activeQuery()).toBe("книга"));

    await userEvent.click(screen.getByRole("button", { name: CLEAR_LABEL }));

    expect(searchInput()).toHaveValue("");
    expect(activeQuery()).toBe("");
  });

  it("lets a feature search from the very first character", async () => {
    const onQuery = vi.fn();
    render(<SearchHarness isCommittable={() => true} onQuery={onQuery} />);

    await userEvent.type(searchInput(), "к");

    await waitFor(() => expect(activeQuery()).toBe("к"));
  });
});
