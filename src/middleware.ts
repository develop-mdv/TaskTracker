import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/login",
    },
});

export const config = {
    matcher: [
        // Protect all routes except:
        // - /login
        // - /api/auth (NextAuth)
        // - /api/cron (cron endpoints have own auth)
        // - /api/health
        // - /_next (static files)
        // - /favicon.ico
        "/((?!login|api/auth|api/cron|api/health|_next|favicon.ico).*)",
    ],
};
