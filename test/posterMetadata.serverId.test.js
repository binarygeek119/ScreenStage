const fs = require("fs");
const os = require("os");
const path = require("path");

describe("posterMetadata server_id", () => {
  let tmp;
  let origCwd;
  let posterMetadata;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "posterr-msid-"));
    fs.mkdirSync(path.join(tmp, "config", "cache", "imagecache"), {
      recursive: true,
    });
    origCwd = process.cwd;
    process.cwd = () => tmp;
    jest.resetModules();
    posterMetadata = require("../classes/core/posterMetadataDb");
    await posterMetadata.initPosterMetadataDb();
  });

  afterEach(() => {
    process.cwd = origCwd;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (e) {
      /* ignore */
    }
  });

  test("register and lookup by server_id does not collide across servers", () => {
    const cacheA = "srvA-item1.jpg";
    const cacheB = "srvB-item1.jpg";
    fs.writeFileSync(
      path.join(tmp, "config", "cache", "imagecache", cacheA),
      Buffer.alloc(512, 1)
    );
    fs.writeFileSync(
      path.join(tmp, "config", "cache", "imagecache", cacheB),
      Buffer.alloc(512, 2)
    );

    const cardA = {
      title: "Title A",
      posterURL: "/imagecache/" + cacheA,
      posterApiItemId: "item1",
      posterServerId: "srvA",
      mediaType: "movie",
    };
    const cardB = {
      title: "Title B",
      posterURL: "/imagecache/" + cacheB,
      posterApiItemId: "item1",
      posterServerId: "srvB",
      mediaType: "movie",
    };

    posterMetadata.registerFromMediaServerCards([], [cardA], "plex", "srvA");
    posterMetadata.registerFromMediaServerCards([], [cardB], "plex", "srvB");

    const a = posterMetadata.getEntryByServerAndApiItemId("plex", "item1", "srvA");
    const b = posterMetadata.getEntryByServerAndApiItemId("plex", "item1", "srvB");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a.title).toBe("Title A");
    expect(b.title).toBe("Title B");
    expect(a.serverId).toBe("srvA");
    expect(b.serverId).toBe("srvB");
  });

  test("buildFallbackMediaCards filters by serverIds", () => {
    const cacheA = "srvA-item2.jpg";
    fs.writeFileSync(
      path.join(tmp, "config", "cache", "imagecache", cacheA),
      Buffer.alloc(512, 1)
    );
    posterMetadata.registerFromMediaServerCards(
      [],
      [
        {
          title: "Only A",
          posterURL: "/imagecache/" + cacheA,
          posterApiItemId: "item2",
          posterServerId: "srvA",
          mediaType: "movie",
        },
      ],
      "plex",
      "srvA"
    );
    const cards = posterMetadata.buildFallbackMediaCards(10, null, [], ["srvA"]);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.posterServerId === "srvA")).toBe(true);
  });

  test("clearCacheForServerId removes only that server", () => {
    const cacheA = "srvA-item3.jpg";
    const cacheB = "srvB-item3.jpg";
    fs.writeFileSync(
      path.join(tmp, "config", "cache", "imagecache", cacheA),
      Buffer.alloc(512, 1)
    );
    fs.writeFileSync(
      path.join(tmp, "config", "cache", "imagecache", cacheB),
      Buffer.alloc(512, 2)
    );
    posterMetadata.registerFromMediaServerCards(
      [],
      [
        {
          title: "A3",
          posterURL: "/imagecache/" + cacheA,
          posterApiItemId: "item3",
          mediaType: "movie",
        },
      ],
      "plex",
      "srvA"
    );
    posterMetadata.registerFromMediaServerCards(
      [],
      [
        {
          title: "B3",
          posterURL: "/imagecache/" + cacheB,
          posterApiItemId: "item3",
          mediaType: "movie",
        },
      ],
      "plex",
      "srvB"
    );
    const r = posterMetadata.clearCacheForServerId("srvA");
    expect(r.removedRows).toBeGreaterThan(0);
    const a = posterMetadata.getEntryByServerAndApiItemId("plex", "item3", "srvA");
    const b = posterMetadata.getEntryByServerAndApiItemId("plex", "item3", "srvB");
    expect(a).toBeNull();
    expect(b).toBeTruthy();
  });
});
