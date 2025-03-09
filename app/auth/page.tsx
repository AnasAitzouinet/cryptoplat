"use client"
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import React from 'react'

export default function Auth() {
    const signIn = async () => {
         await authClient.signIn.social({
            provider: "google"
        })
    }

    return (
        <div className='w-screen h-screen justify-center items-center'>
            <h1 className='text-4xl font-bold text-center'>
                Auth Page
            </h1>

            <Button
                onClick={signIn}
                className='mt-4'
            >
                Google
            </Button>
        </div>
    )
}
