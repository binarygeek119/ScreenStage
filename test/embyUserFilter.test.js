const EmbyJellyfinBase = require("../classes/mediaservers/embyJellyfinBase");

describe("Emby/Jellyfin now-playing user filter helpers", () => {
  test("parseIncludeFilterList trims and allows spaces in names", () => {
    expect(
      EmbyJellyfinBase.parseIncludeFilterList(" Matt , Mother In Law ,fred")
    ).toEqual(["matt", "mother in law", "fred"]);
  });

  test("sessionMatchesUserFilter matches UserName case-insensitively", () => {
    const session = { UserName: "Matt", UserId: "abc-123" };
    expect(
      EmbyJellyfinBase.sessionMatchesUserFilter(session, ["matt"])
    ).toBe(true);
    expect(
      EmbyJellyfinBase.sessionMatchesUserFilter(session, ["mother"])
    ).toBe(false);
  });

  test("sessionMatchesUserFilter can match UserId GUID", () => {
    const session = { UserName: "Matt", UserId: "a490a918d5234bc990088cfee3c4e245" };
    expect(
      EmbyJellyfinBase.sessionMatchesUserFilter(session, [
        "a490a918d5234bc990088cfee3c4e245",
      ])
    ).toBe(true);
  });

  test("empty filter list allows all sessions", () => {
    expect(
      EmbyJellyfinBase.sessionMatchesUserFilter({ UserName: "Anyone" }, [])
    ).toBe(true);
  });
});
