import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import passport from "passport";
import { Profile, Strategy } from "passport-spotify";
import session from "express-session";
import SpotifyWebApi from "spotify-web-api-node";

dotenv.config();

const port = process.env.PORT;

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_SECRET;
const authCallbackPath = "/auth/spotify/callback";

if (!clientId || !clientSecret) {
  console.log("No client id or client secret. Exiting...");
  process.exit();
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj: any, done) => {
  done(null, obj);
});

const spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
});

passport.use(
  new Strategy(
    {
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: `http://localhost:${port}${authCallbackPath}`,
    },
    (
      accessToken: string,
      refreshToken: string,
      expires_in: number,
      profile: Profile,
      done
    ) => {
      return done(null, profile);
    }
  )
);

const app: Express = express();

app.use(
  session({ secret: "keyboard cat", resave: true, saveUninitialized: true })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.get("/oops", (req: Request, res: Response) => {
  res.send("FUCK");
});

app.get(
  "/auth/spotify",
  passport.authenticate("spotify", {
    scope: ["user-read-email", "user-read-private"],
  })
);

app.get(
  authCallbackPath,
  passport.authenticate("spotify", { failureRedirect: "/oops" }),
  async (req: Request, res: Response) => {
    res.redirect("/");
  }
);

app.get(
  "/radiohead",
  ensureAuthenticated,
  async (req: Request, res: Response) => {
    const radioheadAlbums = await spotifyApi.getArtistAlbums(
      "4Z8W4fKeB5YxbusRsdQVPb"
    );
    res.send(JSON.stringify(radioheadAlbums));
    //https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb?si=RzMU86GlTw-Su3-EAkamEA
  }
);

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});

async function ensureAuthenticated(req: Request, res: Response) {
  if (req.isAuthenticated()) {
    return;
  }
  res.redirect("/");
}
