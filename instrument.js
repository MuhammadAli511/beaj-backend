import * as Sentry from "@sentry/node";

Sentry.init({
    dsn: "https://e348721bdec5ca74b4136fef91ef1924@o4509260481560576.ingest.us.sentry.io/4509260487000064",
    sendDefaultPii: true,
});