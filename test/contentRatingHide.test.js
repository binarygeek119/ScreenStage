const util = require("../classes/core/utility");

describe("content rating hide matching", () => {
  test("normalizeContentRating handles common variants", () => {
    expect(util.normalizeContentRating("R")).toBe("r");
    expect(util.normalizeContentRating("Rated R")).toBe("r");
    expect(util.normalizeContentRating("us:R")).toBe("r");
    expect(util.normalizeContentRating("R - Restricted")).toBe("r");
    expect(util.normalizeContentRating("PG-13")).toBe("pg-13");
    expect(util.normalizeContentRating("NR")).toBe("nr");
  });

  test("contentRatingIsHidden matches r against R variants", () => {
    const hide = util.parseHideContentRatings("r,nc-17");
    expect(util.contentRatingIsHidden("R", hide)).toBe(true);
    expect(util.contentRatingIsHidden("Rated R", hide)).toBe(true);
    expect(util.contentRatingIsHidden("PG-13", hide)).toBe(false);
    expect(util.contentRatingIsHidden("NR", hide)).toBe(false);
    expect(util.contentRatingIsHidden("NC-17", hide)).toBe(true);
  });
});
