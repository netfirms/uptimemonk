import pkg from "../../package.json";

export const FRONTEND_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || pkg.version || "0.1.0";
