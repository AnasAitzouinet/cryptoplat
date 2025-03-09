"use server"
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'


export const    getUserWallet = async () => {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session || !session.user.id) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: {
            id: session.user.id
        },
        include: {
            wallet: true
        }
    })

    if (!user?.wallet?.walletPublicKey) {
        return {
            walletPublicKey: null,
            data: "No wallet found"
        }
    }

    return {
        walletPublicKey: user.wallet.walletPublicKey,
        publicKey: user.wallet.publicKey,
        privateKey: user.wallet.secretKey,
        data: "Wallet found"
    }

}


interface CreateWalletProps {
    walletPublicKey: string
    phantomWalletPK: string
    WalletSecretKey: string
}
export const createWallet = async ({
    walletPublicKey,
    phantomWalletPK,
    WalletSecretKey
}:CreateWalletProps) => {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session || !session.user.id) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: {
            id: session.user.id
        },
        include: {
            wallet: true
        }
    })

    if (user?.wallet?.walletPublicKey) {
        return {
            walletPublicKey: user.wallet.walletPublicKey,
            publicKey: user.wallet.publicKey,
            data: "Wallet already exists"
        }
    }
    const wallet = await prisma.userWallet.create({
        data: {
            walletPublicKey: phantomWalletPK,
            secretKey: WalletSecretKey,
            publicKey: walletPublicKey,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
                connect: {
                    id: session.user.id
                }
            }
        }
    })

    return {
        walletPublicKey: wallet.publicKey,
        data: "Wallet created"
    }
}