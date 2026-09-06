import { describe, expect, it } from "vitest";

import {
  getLoanHistoryControllerDetailQueryKey,
  getLoanHistoryControllerListQueryKey,
  getLoanHistoryControllerOverviewQueryKey,
  getLoanHistoryControllerPeopleQueryKey,
  getLoansControllerListQueryKey,
  getLoansControllerSummaryQueryKey,
} from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys, matchesLoans } from "./loan-keys";

describe("matchesLoans", () => {
  it("matches the active loans keys", () => {
    expect(matchesLoans({ queryKey: getLoansControllerListQueryKey() })).toBe(true);
    expect(matchesLoans({ queryKey: getLoansControllerSummaryQueryKey() })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.list({ type: "borrowed_from_someone" }) })).toBe(true);
  });

  it("matches the history keys of the generated client", () => {
    expect(matchesLoans({ queryKey: getLoanHistoryControllerListQueryKey() })).toBe(true);
    expect(matchesLoans({ queryKey: getLoanHistoryControllerOverviewQueryKey() })).toBe(true);
    expect(matchesLoans({ queryKey: getLoanHistoryControllerPeopleQueryKey() })).toBe(true);
    expect(matchesLoans({ queryKey: getLoanHistoryControllerDetailQueryKey("loan-1") })).toBe(true);
  });

  it("matches the history keys this feature builds", () => {
    expect(matchesLoans({ queryKey: loanKeys.history.list({ result: "all" }) })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.history.overview({}) })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.history.people({}) })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.history.peoples })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.history.detail("loan-1") })).toBe(true);
  });

  it("matches the contact keys this feature builds", () => {
    expect(matchesLoans({ queryKey: loanKeys.contacts.all })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.contacts.detail("contact-1") })).toBe(true);
    expect(matchesLoans({ queryKey: loanKeys.contacts.search("") })).toBe(true);
  });

  it("prefixes every people key with the root a correction invalidates", () => {
    expect(loanKeys.history.people({ type: "lent_to_someone" }).slice(0, 2)).toEqual([
      ...loanKeys.history.peoples,
    ]);
  });

  it("ignores keys of other features", () => {
    expect(matchesLoans({ queryKey: ["/api/books", "list"] })).toBe(false);
    expect(matchesLoans({ queryKey: [] })).toBe(false);
  });
});
