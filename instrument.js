import * as Sentry from "@sentry/node"

Sentry.init({
    dsn: "https://473601ab15552de9667a7ae01de158b1@o4509260580257792.ingest.us.sentry.io/4509260583665664",
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
});