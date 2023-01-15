import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import passport from "passport";
import { Profile, Strategy as SpotifyStrategy, VerifyCallback } from "passport-spotify";
import session from "express-session";
import SpotifyWebApi from "spotify-web-api-node";

dotenv.config();
const app: Express = express();

const port = process.env.PORT;

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_SECRET;
const authCallbackPath = "/auth/spotify/callback";

if (!clientId || !clientSecret) {
  console.log("No client id or client secret. Exiting...");
  process.exit();
}

passport.serializeUser((user: object, done: VerifyCallback) => {
  done(null, user);
});

passport.deserializeUser((obj: object, done: VerifyCallback) => {
  done(null, obj);
});

const spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
  redirectUri: 'http://localhost:3000/'
});

passport.use(
  new SpotifyStrategy(
    {
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: `http://localhost:${port}${authCallbackPath}`,
      passReqToCallback: true
    },
    async (
      req: Request,
      accessToken: string,
      refreshToken: string,
      expires_in: number,
      profile: Profile,
      done
    ) => {
      console.log(JSON.stringify(profile))
      process.nextTick(() => {
        spotifyApi.setAccessToken(accessToken)
        return done(null, profile);
      });
    }
  )
);

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
  passport.authenticate("spotify", { failureRedirect: "/oops", successMessage: true, failureMessage: true }),
  async (req: Request, res: Response) => {
    res.redirect("/yay");
  }
);

app.get('/yay', (req: Request, res: Response) => {
  res.send(":)");
});

app.get(
  "/me",
  ensureAuthenticated,
  async (req: Request, res: Response) => {
    console.log('we tryin this shit or what')
    const radioheadAlbums = await spotifyApi.getArtistAlbums(
      "4Z8W4fKeB5YxbusRsdQVPb"
    );
    res.send(JSON.stringify(radioheadAlbums));
    // const me = await spotifyApi.getMe();
    // console.log("ME", me)
    // res.send(JSON.stringify(me))
    //https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb?si=RzMU86GlTw-Su3-EAkamEA
  }
);

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});

async function ensureAuthenticated(req: Request, res: Response, done: VerifyCallback) {
  if (req.isAuthenticated()) {
    console.log('is authenticated')
    return done();
  }
  res.redirect("/oops");
}
