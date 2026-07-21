/**
 * Mirror of index.js interleaveFeatureCardsThroughLibrary for unit testing.
 */
function interleaveFeatureCardsThroughLibrary(libraryCards, featureCards) {
  const lib = Array.isArray(libraryCards) ? libraryCards.slice() : [];
  const feat = Array.isArray(featureCards) ? featureCards.slice() : [];
  if (!feat.length) return lib;
  if (!lib.length) return feat;
  const out = [];
  const step = Math.max(1, Math.ceil(lib.length / (feat.length + 1)));
  let fi = 0;
  for (let i = 0; i < lib.length; i++) {
    out.push(lib[i]);
    if ((i + 1) % step === 0 && fi < feat.length) {
      out.push(feat[fi++]);
    }
  }
  while (fi < feat.length) out.push(feat[fi++]);
  return out;
}

describe("interleaveFeatureCardsThroughLibrary", () => {
  test("keeps Coming Soon from sitting only at the end of a large library deck", () => {
    const lib = Array.from({ length: 12 }, (_, i) => "L" + i);
    const feat = ["CS1", "CS2", "CS3"];
    const out = interleaveFeatureCardsThroughLibrary(lib, feat);
    expect(out).toHaveLength(15);
    expect(out.filter((x) => String(x).startsWith("CS"))).toEqual([
      "CS1",
      "CS2",
      "CS3",
    ]);
    // First feature card should appear before the last library card
    expect(out.indexOf("CS1")).toBeLessThan(out.indexOf("L11"));
  });

  test("returns features alone when library is empty", () => {
    expect(interleaveFeatureCardsThroughLibrary([], ["A", "B"])).toEqual([
      "A",
      "B",
    ]);
  });
});
