import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, oAuthProxy, oneTap } from "better-auth/plugins"
import { magicLink, openAPI } from "better-auth/plugins";
import { sendMagicLinkEmail } from "./Mails/MagicLinks";
import { prisma } from "./prisma";
import { nextCookies } from "better-auth/next-js";


export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL!,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    rateLimit: {
        window: 10,
        max: 100
    },
    plugins: [
        magicLink({

            sendMagicLink: async ({ email, token, url }) => {
                await sendMagicLinkEmail({ email, token, url })
            },


        }),
        openAPI(),
        admin(),
        oneTap(),
        oAuthProxy(),
        nextCookies(),

    ],
    socialProviders: {
        google: {
            enabled: true,
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!

        },

    },
    onAPIError: {
        onError(e) {
            if (e instanceof Error) {
                console.log(e.stack)
            }
            console.log(e)
        }
    }
    ,
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google"]
        }
    }

});