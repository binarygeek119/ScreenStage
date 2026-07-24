const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const axios = require("axios");
const sizeOf = require("image-size");

/**
 * @desc Used to communicate with Sonarr to obtain a list of future releases
 * @param sonarrUrl
 * @param sonarrToken
 */
class Sonarr {
  constructor(sonarrUrl, sonarrToken) {
    this.sonarrUrl = sonarrUrl;
    this.sonarrToken = sonarrToken;
  }

  /**
   * @desc Gets the tv titles that fall within the range specified
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @returns {Promise<object>} json results - results of search
   */
  async GetComingSoonRawData(startDate, endDate) {
    let response;

// console.log(          this.sonarrUrl + 
//   "/api/v3/calendar?apikey=" + 
//   this.sonarrToken + 
//   "&start=" + 
//   startDate + 
//   "&end=" + endDate
// );

    // call sonarr API and return results
    try {
      response = await axios
        .get(
          this.sonarrUrl + 
            "/api/v3/calendar?apikey=" + 
            this.sonarrToken + 
            "&start=" + 
            startDate + 
            "&end=" + endDate
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      // displpay error if call failed
      let d = new Date();
      console.log(
        d.toLocaleString() + " *Sonarr - Get calendar data:",
        err.message
      );
      throw err;
    }
    return await response;
  }

  /**
   * @desc Gets the tv titles that fall within the range specified
   * @param {object} calendarEpisode - calendar instance of episode
   * @returns {Promise<object>} json results - results of search
   */
  async GetSeriesRawData(seriesID) {
    let response;

    // call sonarr API and return results
    try {
      response = await axios
        .get(
          this.sonarrUrl +
            "/api/v3/series/" + 
            seriesID + 
            "?apikey=" +
            this.sonarrToken
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      // displpay error if call failed
      let d = new Date();
      console.log(
        d.toLocaleString() + " *Sonarr - Get episode data:",
        err.message
      );
      throw err;
    }
    return await response;
  }

  /**
   * @desc Get TV coming soon data and formats into mediaCard array
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @param {string} premieres - boolean (string format) to show only season premieres
   * @returns {Promise<object>} mediaCards array - results of search
   */
  async GetComingSoon(startDate, endDate, premieres, playThemes, hasArt) {
    let csCards = [];
    // get raw data first
    let raw;
    try {
      raw = await this.GetComingSoonRawData(startDate, endDate);
    } catch (err) {
      let d = new Date();
      console.log(d.toLocaleString() + " *Sonarr - Get raw data: " + err);
      throw err;
    }
    // reutrn an empty array if no results
    if (raw != null) {
      // move through results and populate media cards
      await raw.data.reduce(async (memo, md) => {
        await memo;

        // get series raw data
        let rawSeries;
        try {
          rawSeries = await this.GetSeriesRawData(md.seriesId);
        } catch (err) {
          let d = new Date();
          console.log(d.toLocaleString() + " *Sonarr - Get series raw data: " + err);
          throw err;
        }
    

        // populate cards
        const medCard = new mediaCard();

        medCard.tagLine =
          "Season " +
          md.seasonNumber +
          ", Episode " +
          md.episodeNumber +
          " - '" +
          md.title +
          "' (" +
          md.airDate +
          ")";
        medCard.title = md.title;
        medCard.DBID = rawSeries.data.tvdbId;
        medCard.year = md.airDate;
        medCard.runTime = rawSeries.data.runtime;
        medCard.genre = rawSeries.data.genres;
        medCard.summary = await util.emptyIfNull(rawSeries.data.overview);
        medCard.mediaType = "episode";
        medCard.cardType = cType.CardTypeEnum.ComingSoon;
        medCard.network = rawSeries.data.network;

        let fileName;
        // dont bother to download if only looking for premiers
        if (premieres == "true" && md.episodeNumber != 1) {
          // dont get cached files
        } else {
          // only downlad mp3 if playThemes enabled
          if (playThemes == "true") {
            // cache mp3 file
            let mp3 = rawSeries.data.tvdbId + ".mp3";
            await core.CacheMP3(mp3);
            medCard.theme = "/mp3cache/" + mp3;
          }

          let url;
          // Prefer *arr art over any existing media-server cache file for the same id.
          fileName = "arr-sonarr-" + rawSeries.data.tvdbId + ".jpg";
          // check art exists
          rawSeries.data.images.forEach(i => {
            if(i.coverType == "poster"){
              url = i.remoteUrl;
            }
          });
          if (url !== undefined) {
            await core.CacheArrImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;
          } else {
            medCard.posterURL = "/images/no-poster-available.png";
          }

          // cache art image
          if(hasArt=='true'){
            fileName = "arr-sonarr-" + rawSeries.data.tvdbId + "-art.jpg";
            // check art exists
            rawSeries.data.images.forEach(i => {
              if(i.coverType == "fanart"){
                url = i.remoteUrl;
              }
            });
            if (url !== undefined) {
              await core.CacheArrImage(url, fileName);
              medCard.posterArtURL = "/imagecache/" + fileName;
            }
          }
        }

        // content rating and colour
        let contentRating = "NR";
        if (!(await util.isEmpty(rawSeries.data.certification))) {
          contentRating = rawSeries.data.certification;
        }
        medCard.contentRating = contentRating;

        // set colours for rating badges
        let ratingColour = "";
        switch (contentRating.toLowerCase()) {
          case "nr":
            ratingColour = "badge-dark";
            break;
          case "unrated":
            ratingColour = "badge-dark";
            contentRating = "NR";
            break;
          case "g":
            ratingColour = "badge-success";
            break;
          case "g":
            ratingColour = "badge-success";
            break;
          case "tv-g":
            ratingColour = "badge-success";
            break;
          case "tv-y":
            ratingColour = "badge-success";
            break;
          case "pg":
            ratingColour = "badge-info";
            break;
          case "tv-pg":
            ratingColour = "badge-info";
            break;
          case "tv-y7":
            ratingColour = "badge-info";
            break;
          case "pg-13":
            ratingColour = "badge-warning";
            break;
          case "tv-14":
            ratingColour = "badge-warning";
            break;
          case "tv-ma":
            ratingColour = "badge-danger";
            break;
          case "r":
            ratingColour = "badge-danger";
            break;
          default:
            ratingColour = "badge-dark";
            break;
        }
        medCard.ratingColour = ratingColour;

        medCard.posterAR = 1.47;

        // add media card to array (taking into account premieres option).
        // premieres is a string ("true"/"false") — must compare explicitly; "false" is truthy in JS.
        const premieresOnly = premieres == "true";
        if (md.hasFile == false && premieresOnly && md.episodeNumber == 1) {
          csCards.push(medCard);
        } else if (md.hasFile == false && !premieresOnly) {
          csCards.push(medCard);
        }
      }, undefined);
    }
    let now = new Date();
    if (csCards.length == 0) {
      console.log(now.toLocaleString() + " No Coming soon 'tv' titles found");
    } else {
      console.log(now.toLocaleString() + " Coming soon 'tv' titles refreshed");
    }
    return csCards;
  }

  /**
   * Series with episode imports in the last N days (history downloadFolderImported).
   * Uses *arr artwork (not media-server poster cache).
   */
  async GetRecentlyAdded(days, playThemes, hasArt) {
    const cards = [];
    const dayCount = Math.max(0, Number(days) || 0);
    if (dayCount <= 0) return cards;

    const from = new Date();
    from.setDate(from.getDate() - dayCount);
    from.setHours(0, 0, 0, 0);

    let hist;
    try {
      hist = await axios.get(
        this.sonarrUrl +
          "/api/v3/history?page=1&pageSize=250&sortKey=date&sortDirection=descending" +
          "&eventType=3&includeSeries=true&includeEpisode=true&apikey=" +
          this.sonarrToken
      );
    } catch (err) {
      const d = new Date();
      console.log(
        d.toLocaleString() + " *Sonarr - Get recently added history:",
        err.message
      );
      throw err;
    }

    const records =
      hist && hist.data && Array.isArray(hist.data.records)
        ? hist.data.records
        : Array.isArray(hist.data)
          ? hist.data
          : [];

    const bySeries = new Map();
    for (const rec of records) {
      if (!rec) continue;
      const when = rec.date ? new Date(rec.date) : null;
      if (!when || Number.isNaN(when.getTime()) || when < from) continue;
      const series = rec.series || {};
      const seriesId = series.id || rec.seriesId;
      if (!seriesId) continue;
      const key = String(seriesId);
      const prev = bySeries.get(key);
      if (!prev || when > prev.when) {
        bySeries.set(key, { when, series, episode: rec.episode || {} });
      }
    }

    for (const { when, series, episode } of bySeries.values()) {
      let rawSeries = { data: series };
      if (!series.images || !series.tvdbId) {
        try {
          rawSeries = await this.GetSeriesRawData(series.id || series.Id);
        } catch (e) {
          continue;
        }
      }
      const sd = rawSeries.data || series;
      const tvdbId = sd.tvdbId || sd.TvdbId;
      if (!tvdbId) continue;

      const medCard = new mediaCard();
      const addedDay = when.toISOString().split("T")[0];
      const epLabel =
        episode && episode.seasonNumber != null && episode.episodeNumber != null
          ? "S" +
            String(episode.seasonNumber).padStart(2, "0") +
            "E" +
            String(episode.episodeNumber).padStart(2, "0")
          : "";
      medCard.tagLine =
        (sd.title || series.title || "") +
        (epLabel ? " — " + epLabel : "") +
        " (" +
        addedDay +
        ")";
      medCard.title = episode.title || sd.title || series.title || "";
      medCard.DBID = tvdbId;
      medCard.year = addedDay;
      medCard.runTime = sd.runtime;
      medCard.genre = sd.genres;
      medCard.summary = await util.emptyIfNull(sd.overview);
      medCard.mediaType = "episode";
      medCard.cardType = cType.CardTypeEnum.RecentlyAdded;
      medCard.network = sd.network || "";
      medCard.posterAR = 1.47;

      let contentRating = "NR";
      if (!(await util.isEmpty(sd.certification))) {
        contentRating = sd.certification;
      }
      medCard.contentRating = contentRating;
      medCard.ratingColour = "badge-dark";

      if (playThemes == "true") {
        const mp3 = tvdbId + ".mp3";
        await core.CacheMP3(mp3);
        medCard.theme = "/mp3cache/" + mp3;
      }

      let posterUrl;
      const images = Array.isArray(sd.images) ? sd.images : [];
      images.forEach((i) => {
        if (i.coverType === "poster") posterUrl = i.remoteUrl;
      });
      const fileName = "arr-sonarr-ra-" + tvdbId + ".jpg";
      if (posterUrl) {
        await core.CacheArrImage(posterUrl, fileName);
        medCard.posterURL = "/imagecache/" + fileName;
      } else {
        medCard.posterURL = "/images/no-poster-available.png";
      }

      if (hasArt == "true") {
        let fanUrl;
        images.forEach((i) => {
          if (i.coverType === "fanart") fanUrl = i.remoteUrl;
        });
        if (fanUrl) {
          const artName = "arr-sonarr-ra-" + tvdbId + "-art.jpg";
          await core.CacheArrImage(fanUrl, artName);
          medCard.posterArtURL = "/imagecache/" + artName;
        }
      }

      cards.push(medCard);
    }

    const now = new Date();
    console.log(
      now.toLocaleString() +
        " *Sonarr — Recently added last " +
        dayCount +
        " day(s): " +
        cards.length +
        " series import(s)"
    );
    return cards;
  }
}

module.exports = Sonarr;
