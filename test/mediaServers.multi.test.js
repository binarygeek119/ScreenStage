const mediaServersUtil = require("../classes/core/mediaServers");

describe("mediaServers util", () => {
  test("migrateLegacyToMediaServers builds one entry from flat plex* fields", () => {
    const list = mediaServersUtil.migrateLegacyToMediaServers({
      mediaServerType: "jellyfin",
      plexIP: "192.168.1.10",
      plexPort: 8096,
      plexToken: "abc",
      plexHTTPS: "true",
      onDemandLibraries: "Movies,TV",
      onDemand3dLibraries: "3D",
      enableNS: "true",
      enableOD: "true",
    });
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("jellyfin");
    expect(list[0].host).toBe("192.168.1.10");
    expect(list[0].port).toBe(8096);
    expect(list[0].token).toBe("abc");
    expect(list[0].https).toBe("true");
    expect(list[0].libraries).toBe("Movies,TV");
    expect(list[0].libraries3d).toBe("3D");
    expect(list[0].enabled).toBe("true");
    expect(list[0].display).toBe("true");
    expect(list[0].id).toBeTruthy();
  });

  test("migrateLegacy returns empty when no plexIP", () => {
    expect(mediaServersUtil.migrateLegacyToMediaServers({})).toEqual([]);
  });

  test("normalizeMediaServersArray caps at 10 per type", () => {
    const many = [];
    for (let i = 0; i < 12; i++) {
      many.push({
        type: "plex",
        host: "h" + i,
        port: 32400,
        token: "t" + i,
        enabled: "true",
      });
    }
    const out = mediaServersUtil.normalizeMediaServersArray(many);
    expect(out.filter((s) => s.type === "plex")).toHaveLength(10);
  });

  test("validateMediaServersForSave allows empty list", () => {
    const v = mediaServersUtil.validateMediaServersForSave([]);
    expect(v.ok).toBe(true);
    expect(v.mediaServers).toEqual([]);
  });

  test("validateMediaServersForSave rejects missing token for plex", () => {
    const v = mediaServersUtil.validateMediaServersForSave([
      { type: "plex", host: "x", port: 32400, token: "", enabled: "true" },
    ]);
    expect(v.ok).toBe(false);
  });

  test("validateMediaServersForSave allows kodi without token", () => {
    const v = mediaServersUtil.validateMediaServersForSave([
      { type: "kodi", host: "x", port: 8080, token: "", enabled: "true" },
    ]);
    expect(v.ok).toBe(true);
  });

  test("listDisplayServerIds includes enabled display servers and arr", () => {
    const settings = {
      mediaServers: [
        {
          id: "a",
          type: "plex",
          host: "1.1.1.1",
          port: 32400,
          token: "t",
          enabled: "true",
          display: "true",
        },
        {
          id: "b",
          type: "jellyfin",
          host: "2.2.2.2",
          port: 8096,
          token: "t",
          enabled: "true",
          display: "false",
        },
      ],
      enableSonarr: "true",
      sonarrURL: "http://s",
      sonarrToken: "st",
    };
    const ids = mediaServersUtil.listDisplayServerIds(settings);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
    expect(ids).toContain(mediaServersUtil.ARR_SERVER_IDS.sonarr);
  });

  test("listNowPlayingMediaServers respects enableNowPlaying", () => {
    const settings = {
      mediaServers: [
        {
          id: "a",
          type: "plex",
          host: "1.1.1.1",
          port: 32400,
          token: "t",
          enabled: "true",
          enableNowPlaying: "true",
        },
        {
          id: "b",
          type: "plex",
          host: "2.2.2.2",
          port: 32400,
          token: "t",
          enabled: "true",
          enableNowPlaying: "false",
        },
      ],
    };
    const list = mediaServersUtil.listNowPlayingMediaServers(settings);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("a");
  });

  test("syncLegacyFlatFromMediaServers updates plex* from primary", () => {
    const s = {
      mediaServers: [
        {
          id: "x",
          type: "emby",
          host: "10.0.0.5",
          port: 8096,
          token: "tok",
          https: "true",
          enabled: "true",
        },
      ],
    };
    mediaServersUtil.syncLegacyFlatFromMediaServers(s);
    expect(s.mediaServerType).toBe("emby");
    expect(s.plexIP).toBe("10.0.0.5");
    expect(s.plexToken).toBe("tok");
    expect(s.plexHTTPS).toBe("true");
  });

  test("createMediaServerClient builds instance", () => {
    const client = mediaServersUtil.createMediaServerClient({
      type: "plex",
      host: "127.0.0.1",
      port: 32400,
      token: "x",
    });
    expect(client).toBeTruthy();
    expect(typeof client.GetNowScreening).toBe("function");
  });
});
