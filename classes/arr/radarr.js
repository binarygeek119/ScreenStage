const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const axios = require("axios");
const { cache } = require("ejs");
const sizeOf = require('image-size');

/**
 * @desc Used to communicate with Radarr to obtain a list of future releases
 * @param radarrUrl
 * @param radarrToken
 */
class Radarr {
  constructor(radarrUrl, radarrToken) {
    this.radarrUrl = radarrUrl;
    this.radarrToken = radarrToken;
  }

  /**
   * @desc Gets the movie titles that fall within the range specified
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @returns {Promise<object>} json results - results of search
   */
  async GetComingSoonRawData(startDate, endDate) {
    let response;
    try {
      //console.log(this.radarrUrl + "/api/v3/calendar?unmonitored=false&apikey=" + this.radarrToken + "&start=" + startDate + "&end=" + endDate);
      response = await axios
        .get(
          this.radarrUrl +
            "/api/v3/calendar?unmonitored=false&apikey=" +
            this.radarrToken +
            "&start=" +
            startDate +
            "&end=" +
            endDate
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      let d = new Date();
      console.log(d.toLocaleString() + " *Radarr - Get calendar data:", err.message);
      throw err;
    }
    return response;
  }


  /**
   * @desc Get Movie coming soon data and formats into mediaCard array
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @returns {Promise<object>} mediaCards array - results of search
   */
  async GetComingSoon(startDate, endDate, playGenenericThemes, hasArt) {
    let csrCards = [];
    let raw;
    // get raw data first
    try{
      raw = await this.GetComingSoonRawData(startDate, endDate);
    }
    catch(err){
      let d = new Date();
      console.log(d.toLocaleString() + " *Radarr - Get Raw Data: " + err);
      throw err;
    }

    // reutrn an empty array if no results
    if (raw != null) {
      // move through results and populate media cards
      await raw.data.reduce(async (memo, md) => {
        await memo;
        const medCard = new mediaCard();
        // Prefer digital, then physical, then theatrical — calendar already scoped the window.
        let releaseDate = "No release date";
        let hasReleaseDate = false;
        let releaseCandidate = null;
        if (!(await util.isEmpty(md.digitalRelease))) {
          releaseCandidate = md.digitalRelease;
        } else if (!(await util.isEmpty(md.physicalRelease))) {
          releaseCandidate = md.physicalRelease;
        } else if (!(await util.isEmpty(md.inCinemas))) {
          releaseCandidate = md.inCinemas;
        }
        if (releaseCandidate) {
          try {
            releaseDate = new Date(releaseCandidate).toISOString().split("T")[0];
            hasReleaseDate = true;
          } catch (e) {
            releaseDate = String(releaseCandidate);
            hasReleaseDate = true;
          }
        }
        medCard.tagLine =
          md.title + " (" + releaseDate + ")";
        medCard.title = md.title;
        medCard.DBID = md.tmdbId;
        medCard.runTime = md.runtime;
        medCard.genre = md.genres;
        medCard.summary = await util.emptyIfNull(md.overview);
        medCard.mediaType = "movie";
        medCard.cardType = cType.CardTypeEnum.ComingSoon;
        medCard.studio = md.studio;

        medCard.theme = "";

      // Prefer *arr art over any existing media-server cache file for the same id.
      let fileName;
      let url;
      fileName = "arr-radarr-" + md.tmdbId + ".jpg";
      // check art exists
      md.images.forEach(i => {
        if(i.coverType == "poster"){
          url = i.remoteUrl;
        }
      });

      if (url !== undefined) {
        await core.CacheArrImage(url, fileName);
        medCard.posterURL = "/imagecache/" + fileName;
      } else {
        // if no poster available, use the generic one
        medCard.posterURL = "/images/no-poster-available.png";
      }

      // cache art image
      if(hasArt=='true'){
        fileName = "arr-radarr-" + md.tmdbId + "-art.jpg";
        // check art exists
        md.images.forEach(i => {
          if(i.coverType == "fanart"){
            url = i.remoteUrl;
          }
        });
        if (url !== undefined) {
          await core.CacheArrImage(url, fileName);
          medCard.posterArtURL = "/imagecache/" + fileName;
        }
      }


        medCard.posterAR = 1.47;

        // content rating and colour
        let contentRating = "NR";
        if (!(await util.isEmpty(md.certification))) {
          contentRating = md.certification;
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
        
        // add generic random theme if applicable

        // if (playGenenericThemes == 'true') {
        //   medCard.theme = "/randomthemes/" + (await core.GetRandomMP3(csrCards));
        //   if(medCard.theme.includes("undefined")) medCard.theme="";
        // }

        // Include upcoming movies not yet downloaded. Require some release date
        // (digital/physical/theatrical) so taglines are useful; do not require digital-only.
        if (md.hasFile == false && hasReleaseDate) {
          csrCards.push(medCard);
        }

      }, undefined);
    }
    let now = new Date();
    if (csrCards.length == 0) {
      console.log(
        now.toLocaleString() + " No Coming soon 'movie' titles found"
      );
    } else {
      console.log(
        now.toLocaleString() + " Coming soon 'movie' titles refreshed"
      );
    }

    return csrCards;
  }

  /**
   * Movies imported/added in the last N days (movieFile.dateAdded, else movie.added).
   * Uses *arr artwork (not media-server poster cache).
   */
  async GetRecentlyAdded(days, hasArt) {
    const cards = [];
    const dayCount = Math.max(0, Number(days) || 0);
    if (dayCount <= 0) return cards;

    const from = new Date();
    from.setDate(from.getDate() - dayCount);
    from.setHours(0, 0, 0, 0);

    let raw;
    try {
      raw = await axios.get(
        this.radarrUrl + "/api/v3/movie?apikey=" + this.radarrToken
      );
    } catch (err) {
      const d = new Date();
      console.log(
        d.toLocaleString() + " *Radarr - Get recently added:",
        err.message
      );
      throw err;
    }

    const movies = Array.isArray(raw.data) ? raw.data : [];
    for (const md of movies) {
      if (!md || md.hasFile !== true) continue;
      const addedRaw =
        (md.movieFile && (md.movieFile.dateAdded || md.movieFile.DateAdded)) ||
        md.added ||
        md.Added ||
        "";
      if (!addedRaw) continue;
      const added = new Date(addedRaw);
      if (Number.isNaN(added.getTime()) || added < from) continue;

      const medCard = new mediaCard();
      const addedDay = added.toISOString().split("T")[0];
      medCard.tagLine = md.title + " (" + addedDay + ")";
      medCard.title = md.title;
      medCard.DBID = md.tmdbId;
      medCard.runTime = md.runtime;
      medCard.genre = md.genres;
      medCard.summary = await util.emptyIfNull(md.overview);
      medCard.mediaType = "movie";
      medCard.cardType = cType.CardTypeEnum.RecentlyAdded;
      medCard.studio = md.studio || "";
      medCard.theme = "";
      medCard.posterAR = 1.47;

      let contentRating = "NR";
      if (!(await util.isEmpty(md.certification))) {
        contentRating = md.certification;
      }
      medCard.contentRating = contentRating;
      medCard.ratingColour = "badge-dark";
      const cr = String(contentRating).toLowerCase();
      if (cr === "g" || cr === "tv-g" || cr === "tv-y") medCard.ratingColour = "badge-success";
      else if (cr === "pg" || cr === "tv-pg" || cr === "tv-y7") medCard.ratingColour = "badge-info";
      else if (cr === "pg-13" || cr === "tv-14") medCard.ratingColour = "badge-warning";
      else if (cr === "r" || cr === "nc-17" || cr === "tv-ma") medCard.ratingColour = "badge-danger";

      let posterUrl;
      const images = Array.isArray(md.images) ? md.images : [];
      images.forEach((i) => {
        if (i.coverType === "poster") posterUrl = i.remoteUrl;
      });
      const fileName = "arr-radarr-ra-" + md.tmdbId + ".jpg";
      if (posterUrl) {
        await core.CacheArrImage(posterUrl, fileName);
        medCard.posterURL = "/imagecache/" + fileName;
      } else {
        medCard.posterURL = "/images/no-poster-available.png";
      }

      if (hasArt === "true") {
        let fanUrl;
        images.forEach((i) => {
          if (i.coverType === "fanart") fanUrl = i.remoteUrl;
        });
        if (fanUrl) {
          const artName = "arr-radarr-ra-" + md.tmdbId + "-art.jpg";
          await core.CacheArrImage(fanUrl, artName);
          medCard.posterArtURL = "/imagecache/" + artName;
        }
      }

      cards.push(medCard);
    }

    const now = new Date();
    console.log(
      now.toLocaleString() +
        " *Radarr — Recently added last " +
        dayCount +
        " day(s): " +
        cards.length +
        " movie(s)"
    );
    return cards;
  }
}

module.exports = Radarr;
