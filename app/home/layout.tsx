import React  from 'react'
import { AppSidebar } from "@/components/app-sidebar"
 
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

interface Props {
  children: React.ReactNode
}

export default async function Layout({ children }: Props) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return (
      <div>
        <h1>Not authenticated</h1>
      </div>
    )
  }
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className='overflow-hidden'>
        {children}
      </SidebarInset>
    </SidebarProvider>

  )
}
