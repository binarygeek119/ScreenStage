/**
 * Mirrors index.js helpers for *arr > cache > media-server ranking.
 */
function libraryCardsWithoutArrOverlap(libraryCards, arrCards) {
  const lib = Array.isArray(libraryCards) ? libraryCards : [];
  const arr = Array.isArray(arrCards) ? arrCards : [];
  if (!arr.length || !lib.length) return lib.slice();
  const keys = new Set();
  for (const c of arr) {
    const id = String((c && c.DBID) || "")
      .trim()
      .toLowerCase();
    if (id) keys.add("id:" + id);
    const title = String((c && c.title) || "")
      .trim()
      .toLowerCase();
    if (title) keys.add("t:" + title);
  }
  return lib.filter((c) => {
    const id = String((c && c.DBID) || "")
      .trim()
      .toLowerCase();
    if (id && keys.has("id:" + id)) return false;
    const title = String((c && c.title) || "")
      .trim()
      .toLowerCase();
    if (title && keys.has("t:" + title)) return false;
    return true;
  });
}

function assembleRankedHomeDeck(nsList, arrCards, libCards, extras, shuffle) {
  const ns = Array.isArray(nsList) ? nsList.slice() : [];
  const arr = Array.isArray(arrCards) ? arrCards.slice() : [];
  const lib = libraryCardsWithoutArrOverlap(libCards, arr);
  const ex = Array.isArray(extras) ? extras.slice() : [];
  const shuf = (a) => a.slice().sort(() => Math.random() - 0.5);
  if (shuffle) {
    return ns.concat(shuf(arr)).concat(shuf(lib)).concat(shuf(ex));
  }
  return ns.concat(arr).concat(lib).concat(ex);
}

describe("arr > cache > media-server ranking", () => {
  test("libraryCardsWithoutArrOverlap drops cache rows that match *arr DBID or title", () => {
    const arr = [{ DBID: "12345", title: "Dune" }];
    const lib = [
      { DBID: "12345", title: "Dune" },
      { DBID: "999", title: "Other" },
    ];
    expect(libraryCardsWithoutArrOverlap(lib, arr)).toEqual([
      { DBID: "999", title: "Other" },
    ]);
  });

  test("assembleRankedHomeDeck keeps *arr before library cards", () => {
    const out = assembleRankedHomeDeck(
      ["NS"],
      ["ARR1", "ARR2"],
      ["LIB1", "LIB2", "LIB3"],
      ["PIC"],
      false
    );
    expect(out).toEqual(["NS", "ARR1", "ARR2", "LIB1", "LIB2", "LIB3", "PIC"]);
  });
});
