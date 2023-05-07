import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import axios, { AxiosResponse } from "axios";
import qs from "qs";

const SPOTIFY_BASE_URL = "https://api.spotify.com/v1";

dotenv.config();
const app: Express = express();

const port = process.env.PORT;

app.get("/", async (_req: Request, res: Response) => {
  res.send("Derail");
});

app.get("/derail", async (req: Request, res: Response) => {
  const { playlistId } = req.query;
  const token = await getAuthorizationToken();
  const playlistResponse: AxiosResponse<SpotifyApi.PlaylistTrackResponse> = await axios.get(
    `${SPOTIFY_BASE_URL}/playlists/${playlistId}/tracks`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const tracks = playlistResponse.data;
  const firstTrack = tracks.items[0].track;
  if (!firstTrack) {
    return res.send('fuck :(')
  }
  const nextTrack = await getNextTrackOffAlbum(firstTrack, token);
  if (!nextTrack) {
    return res.send('fuckkkkkkkkk :((((((((')
  }
  res.send(`${firstTrack.name} was derailed to ${nextTrack.name}`);
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});

async function getAuthorizationToken() {
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
  return response.data.access_token;
}

async function getNextTrackOffAlbum(track: SpotifyApi.TrackObjectFull, token: string): Promise<SpotifyApi.TrackObjectSimplified | undefined> {
  const albumHref = track.album.href;
  const trackNumber = track.track_number;
  const albumResponse: AxiosResponse<SpotifyApi.AlbumTracksResponse> = await axios.get(`${albumHref}/tracks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const albumTracks = albumResponse.data.items;
  if (trackNumber > albumTracks.length) {
    return albumTracks[0];
  }

  return albumTracks.find((track: any) => track.track_number === trackNumber + 1)
}
