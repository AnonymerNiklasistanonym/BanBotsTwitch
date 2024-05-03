// Package imports
import http from "http";
// Type imports
import type {Server} from "http";

/**
 * Web status code for not found.
 */
export const NOT_FOUND_STATUS_CODE = 404;
/**
 * Web status code for OK.
 */
export const OK_STATUS_CODE = 200;
/**
 * Web status code for forbidden.
 */
export const FORBIDDEN_STATUS_CODE = 403;

export const generateOAuthCodeGrant = (
    baseUrl: string,
    clientId: string,
    redirectUri: string,
    scopes: ReadonlyArray<string>
  ): string =>
    baseUrl +
    "/authorize" +
    "?response_type=code" +
    "&redirect_uri=" +
    encodeURIComponent(redirectUri) +
    "&client_id=" +
    encodeURIComponent(clientId) +
    "&scope=" +
    encodeURIComponent(scopes.join(' '));

const HTML_CODE_FORWARD_CURRENT_MODIFIED_LOCATION =
  "<html><body></body><script>" +
  "alert(window.location.href.replace('#', '?'));" +
  "window.location = window.location.href.replace('#', '?');" +
  "</script></html>";


const generateHtmlCodeRefreshTokenGrantBad = (apiName: string, error: Readonly<Error>) =>
  "<html><body>" +
  `${apiName} API connection was not successful: ${error.message}` +
  "</body></html>";

export const oAuthRefreshTokenGrantServer = (
    apiName: string,
    callbackCode: (err: Error | null, code: string) => void,
): Server => {
  const server = http.createServer((req, res) => {
    console.debug(
      `${apiName} API redirect was detected ${JSON.stringify({
        host: req.headers.host,
        location: req.headers.location,
        method: req.method,
        referer: req.headers.referer,
        url: req.url,
      })}`
    );
    if (req.url && req.headers.host) {
      if (req.url.endsWith("/")) {
        res.writeHead(OK_STATUS_CODE);
        res.end(HTML_CODE_FORWARD_CURRENT_MODIFIED_LOCATION);
      } else {
        const url = new URL(req.headers.host + req.url);
        const codeToken = url.searchParams.get("code");
        if (codeToken != null) {
          console.debug(`${apiName} API redirect contained code token`);
          callbackCode(null, codeToken);
          server.close();
        } else {
          res.writeHead(FORBIDDEN_STATUS_CODE);
          const error = Error("Code was not found!");
          callbackCode(error, error.message);
          res.end(generateHtmlCodeRefreshTokenGrantBad(apiName, error));
          server.close();
          throw error;
        }
      }
    } else {
      // Unsupported path
      const error = Error(
        `${apiName} API authentication server encountered request with no url and host`
      );
      console.error(error);
      res.writeHead(FORBIDDEN_STATUS_CODE);
      res.end(error.message);
    }
  });
  return server;
};
