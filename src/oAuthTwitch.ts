import axios from 'axios';
import { ApiClient } from "@twurple/api";
import { generateOAuthCodeGrant, oAuthRefreshTokenGrantServer } from "./oAuth";
import { exchangeCode, RefreshingAuthProvider } from "@twurple/auth";
import fs from "fs/promises";
import {existsSync} from "fs";
import path from "path";
// Type imports
import { AccessToken } from "@twurple/auth";

const redirectUrl = 'http://localhost';

const oAuthProviderName = 'Twitch';

const tokenLocation = path.join(process.cwd(), "token.json");

export const oAuthTwitchGetFirstToken = async (clientId: string, clientSecret: string, scopes: ReadonlyArray<string>, redirectPort: number): Promise<AccessToken> => {
  const redirectUri = `${redirectUrl}:${redirectPort}`;

  // > Start server to catch authentication URL
  const code = await new Promise<string>(async (resolve, reject) => {
    const server = oAuthRefreshTokenGrantServer(
      oAuthProviderName,
      (error, code) => {
        if (error !== null) {
          reject(error);
        } else {
          resolve(code);
        }
      }
    );
    await new Promise<void>(async (resolveServerStarted) => {
      server.listen(redirectPort, undefined, () => {
        console.info(`OAuth ${oAuthProviderName} server started on port ${redirectPort}`);
        resolveServerStarted();
      });
    });
    // > Open authentication URL
    const response = await axios.get(generateOAuthCodeGrant('https://id.twitch.tv/oauth2', clientId, redirectUri, scopes));
    if (response.status === 200) {
      if (response?.request?.res?.responseUrl === undefined) {
        reject(new Error("Code grant response URL was undefined"))
      } else {
        console.info(
          `Grant the ${oAuthProviderName} API refresh token using the following URL: ${response.request.res.responseUrl}`
        );
        //const open = (url: string) => import('open').then(({default: open}) => open(url));
        const open = await (eval('import("open")') as Promise<typeof import("open")>);
        await open.default(response.request.res.responseUrl);
      }
    }

    // > Wait until server is closed
    await new Promise<void>((resolveServerClosed) => {
      server.on("close", () => {
        console.info("Server closed");
        resolveServerClosed();
      });
    });
  });

  const initialTokenData = await exchangeCode(clientId, clientSecret, code, redirectUri);

  if (initialTokenData.refreshToken === null) {
    throw new Error('Failed to exchange refreshToken');
  }
  await fs.writeFile(tokenLocation, JSON.stringify(initialTokenData, null, 4), 'utf-8');

  return initialTokenData;
}

export const oAuthTwitch = async (clientId: string, clientSecret: string, scopes: ReadonlyArray<string>, redirectPort: number): Promise<RefreshingAuthProvider> => {

  const token = existsSync(tokenLocation)
  ? JSON.parse(await fs.readFile(tokenLocation, 'utf-8')) as AccessToken
  : await oAuthTwitchGetFirstToken(clientId, clientSecret, scopes, redirectPort);

  const authProvider = new RefreshingAuthProvider(
    {
      clientId,
      clientSecret
    }
  );
  await authProvider.addUserForToken({...token}, [...scopes]);
  authProvider.onRefresh(async (userId, newTokenData) => await fs.writeFile(tokenLocation, JSON.stringify(newTokenData, null, 4), 'utf-8'));

  return authProvider;
}

export const getApiClientTwitch = async (clientId: string, clientSecret: string, scopes: ReadonlyArray<string>, redirectPort: number) => {
  const authProvider = await oAuthTwitch(clientId, clientSecret, scopes, redirectPort);
  const apiClient = new ApiClient({ authProvider });
  return apiClient;
}
