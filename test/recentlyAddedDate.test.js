/**
 * Library date-added helper (mirrors embyJellyfinBase itemLibraryAddedDate).
 */
function itemLibraryAddedDate(m) {
  if (!m || typeof m !== "object") return null;
  const raw =
    m.DateCreated ||
    m.dateCreated ||
    m.DateLastSaved ||
    m.dateLastSaved ||
    "";
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function filterRecentlyAdded(items, days) {
  const from = new Date();
  from.setDate(from.getDate() - Number(days));
  from.setHours(0, 0, 0, 0);
  return items.filter((m) => {
    const added = itemLibraryAddedDate(m);
    return added && added >= from;
  });
}

describe("recently-added uses library DateCreated not cache time", () => {
  test("keeps titles added inside the window", () => {
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const items = [
      { Name: "New", DateCreated: threeDaysAgo.toISOString() },
      { Name: "Old", DateCreated: tenDaysAgo.toISOString() },
      { Name: "NoDate" },
    ];
    const out = filterRecentlyAdded(items, 6);
    expect(out.map((x) => x.Name)).toEqual(["New"]);
  });

  test("does not use PremiereDate", () => {
    const now = new Date();
    const items = [
      {
        Name: "OldPremiereNewFile",
        PremiereDate: "1999-01-01",
        DateCreated: now.toISOString(),
      },
    ];
    expect(filterRecentlyAdded(items, 6)).toHaveLength(1);
  });
});
