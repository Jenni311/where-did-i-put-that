import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, productionUrl } from './supabase'
import { Repository, errorMessage } from './repository'
import App from './App'

export default function AccountApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  useEffect(() => {
    let active = true
    let authEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      authEvent = true
      if (active) { setSession(next); setLoading(false) }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setError(errorMessage(error))
      if (!authEvent) setSession(data.session)
      setLoading(false)
    }).catch(error => {
      if (active) { setError(errorMessage(error)); setLoading(false) }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const accountId = session?.user.id ?? null
  const repository = useMemo(() => new Repository(accountId), [accountId])
  async function signIn() {
    if (!window.confirm('Continue to Google? Any unsaved form will be closed. Your saved local items will stay in this browser.')) return
    setWorking(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: productionUrl, queryParams: { prompt: 'select_account' },
      } })
      if (error) throw error
    } catch (error) { setError(errorMessage(error)); setWorking(false) }
  }
  async function signOut() {
    if (!window.confirm('Sign out? Any unsaved form will be closed. Saved account items will stay in your account.')) return
    setWorking(true); setError('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    } catch (error) { setError(errorMessage(error)) }
    finally { setWorking(false) }
  }
  if (loading) return <main><p role="status">Opening your app…</p></main>
  const published = window.location.origin === new URL(productionUrl).origin
  return <App key={accountId ?? 'local'} repository={repository} accountControls={busy => <>
    {session ? <div className="account-heading">
      <p>Signed in as <strong>{session.user.email ?? 'Google user'}</strong></p>
      <button disabled={busy || working} onClick={signOut}>Sign out</button>
    </div> : published ?
      <button disabled={busy || working} onClick={signIn}>{working ? 'Opening Google…' : 'Sign in with Google'}</button> :
      <p>To sign in, open the <a href={productionUrl} target="_blank" rel="noreferrer">published app</a>. Preview items stay in this preview browser.</p>}
    {error && <p role="alert">{error}</p>}
  </>} />
}
