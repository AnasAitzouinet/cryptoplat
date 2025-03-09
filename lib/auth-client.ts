import { createAuthClient } from "better-auth/react"
import {
    emailOTPClient, magicLinkClient, oneTapClient,
    adminClient,

} from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL!,
    
    plugins: [
        magicLinkClient(),
        emailOTPClient(),
        oneTapClient({
            clientId: process.env.AUTH_GOOGLE_ID!
        }),
        adminClient(),
    ],
    fetchOptions: {
        onError(e) {
            if (e.error instanceof Error) {
                console.log(e.error.stack)
            }
        }
    },

})