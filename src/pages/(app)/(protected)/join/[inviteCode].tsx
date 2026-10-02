import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { callAction } from '@/lib/trip-client'

export default function JoinTripPage() {
  const { inviteCode = '' } = useParams()
  const navigate = useNavigate()
  const attempted = useRef(false)
  const [message, setMessage] = useState('Joining the planning board…')

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    void callAction<{ tripId: string }>('joinTrip', { inviteCode }).then((result) => {
      if (result.success) {
        setMessage('You’re in. Opening the board…')
        window.setTimeout(() => navigate(`/home?trip=${result.data.tripId}`, { replace: true }), 450)
      } else setMessage(result.error)
    })
  }, [inviteCode, navigate])

  const joined = message.startsWith('You’re in')
  return <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-6"><div className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,.22)]">{joined ? <CheckCircle2 className="mx-auto h-10 w-10 text-success" /> : <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-primary" />}<h1 className="mt-5 text-xl font-semibold">Roam Consensus</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></div>
}
