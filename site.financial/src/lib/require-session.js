import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/session'

export const requireSession = async () => {
  const session = await getServerSession()

  if (!session.accessToken) {
    redirect('/')
  }

  return session
}
