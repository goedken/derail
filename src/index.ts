import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import axios, { AxiosError, AxiosResponse } from "axios";
import qs from "qs";
import { RedisClientType, createClient } from "redis";
import { HttpClient } from "./helpers/http-client";

dotenv.config();

const apiClient = new HttpClient(getAuthorizationToken);

const SPOTIFY_BASE_URL = "https://api.spotify.com/v1";
const PORT = process.env.PORT || 3000;

const app: Express = express();

let redisClient: RedisClientType;
(async () => {
  redisClient = createClient();

  redisClient.on("error", (err) => console.error(`Redis Error : ${err}`));

  await redisClient.connect();
})();

app.get("/", async (_req: Request, res: Response) => {
  res.send("Derail");
});

// https://open.spotify.com/playlist/6lUCjbghGlDPSG6tYak7Op?si=6ce173f7a5284f7e

app.get("/derail", async (req: Request, res: Response) => {
  const { playlistId } = req.query;
  console.log("about to fetch ", playlistId);
  const playlistResponse: AxiosResponse<SpotifyApi.PlaylistTrackResponse> =
    await apiClient
      .get(`${SPOTIFY_BASE_URL}/playlists/${playlistId}/tracks`)
      .catch((error) => {
        console.log(JSON.stringify(error));
        res.send(500);
      });
  const playlistTracks = playlistResponse.data.items;
  const derailed = await Promise.all(await derail(playlistTracks));
  // const derailed = await Promise.all(
  //   playlistTracks.map(async (playlistTrack) => {
  //     const track = playlistTrack.track;
  //     return track ? (await getNextTrackOffAlbum(track))?.name : null;
  //   })
  // );
  const names = derailed.map((d, index) => {
    if (!d) {
      const oldSong = playlistTracks[index].track?.name;
      return "BAD TRACK DERAILING FROM " + oldSong;
    }
    return d.name;
  });
  res.json(names);
});

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});

async function getAuthorizationToken(breakCache?: boolean): Promise<string> {
  const cachedToken = await redisClient.get("token");
  if (cachedToken && !breakCache) {
    return cachedToken;
  }
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    qs.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_SECRET,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  const accessToken = response.data.access_token;
  await redisClient.set("token", accessToken);
  return accessToken || "";
}

// Only fetch each album once
// Maintain track order
async function derail(
  playlistTracks: SpotifyApi.PlaylistTrackObject[]
): Promise<Promise<SpotifyApi.TrackObjectSimplified | null | undefined>[]> {
  const albumPromises = playlistTracks.reduce((albumLinks, playlistTrack) => {
    if (!playlistTrack.track || !playlistTrack.track.album) {
      return albumLinks;
    }
    const albumHref = playlistTrack.track.album.href;
    if (!albumLinks[albumHref]) {
      albumLinks[albumHref] = apiClient.get(`${albumHref}/tracks`);
    }

    return albumLinks;
  }, {} as Record<string, Promise<AxiosResponse<SpotifyApi.AlbumTracksResponse>>>);

  return playlistTracks.map(async (playlistTrack, index) => {
    const { track } = playlistTrack;
    if (!track || !track.album) {
      console.log("messed up track at ", index);
      return null;
    }

    const albumTracks = (await albumPromises[track.album.href]).data.items;
    if (track.track_number > albumTracks.length) {
      return albumTracks[0];
    }

    return albumTracks.find(
      (albumTrack) => albumTrack.track_number === track.track_number + 1
    );
  });
}

async function getNextTrackOffAlbum(
  track: SpotifyApi.TrackObjectFull
): Promise<SpotifyApi.TrackObjectSimplified | undefined> {
  const albumHref = track.album.href;
  const trackNumber = track.track_number;
  const token = await getAuthorizationToken();
  const albumResponse: AxiosResponse<SpotifyApi.AlbumTracksResponse> =
    await axios.get(`${albumHref}/tracks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  const albumTracks = albumResponse.data.items;
  if (trackNumber > albumTracks.length) {
    return albumTracks[0];
  }

  return albumTracks.find(
    (track: any) => track.track_number === trackNumber + 1
  );
}
