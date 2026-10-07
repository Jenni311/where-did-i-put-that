import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, productionUrl } from './supabase'
import { Repository, errorMessage } from './repository'
import App from './App'

export default function AccountApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [deletionMessage, setDeletionMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
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
  async function deleteAccount() {
    if (!session || deleting || working) return
    const confirmation = window.prompt(
      `Permanently delete the account ${session.user.email ?? ''} and all its cloud items and photos?\n\nThis cannot be undone. Save a backup first if you want to keep a copy. Files you downloaded and items saved only in a browser will remain there. Your Google account will not be deleted.\n\nType DELETE to confirm.`,
    )
    if (confirmation !== 'DELETE') return
    setDeleting(true); setWorking(true); setError('')
    setDeletionMessage('Deleting your account and cloud data…')
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE' } })
      if (error) {
        let message = 'Deletion could not finish. Open More… and use Delete my account and data again to retry.'
        if ('context' in error && error.context instanceof Response) {
          try { message = (await error.context.json()).message || message } catch { /* Preserve the useful fallback. */ }
        }
        throw new Error(message)
      }
      if (data?.pending) { setDeletionMessage(data.message); return }
      if (!data?.deleted) throw new Error('Deletion was not confirmed. Please retry.')
      await supabase.auth.signOut({ scope: 'local' })
      setSession(null)
      setEmail(''); setEmailSent(false)
      setDeletionMessage('Your account and cloud data have been deleted. Any browser-only items and downloaded backups are still on their devices.')
    } catch (error) {
      setDeletionMessage(''); setError(errorMessage(error))
    } finally { setDeleting(false); setWorking(false) }
  }
  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = email.trim()
    if (!address) return
    if (!window.confirm('Send a one-time sign-in link to this email address?')) return
    setWorking(true); setError(''); setEmailSent(false)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: productionUrl },
      })
      if (error) throw error
      setEmailSent(true)
    } catch (error) { setError(errorMessage(error)) }
    finally { setWorking(false) }
  }
  if (loading) return <main><p role="status">Opening your app…</p></main>
  const published = window.location.origin === new URL(productionUrl).origin
  return <App key={accountId ?? 'local'} repository={repository} accountControls={busy => <>
    {session ? <div className="account-heading">
      <p>Signed in as <strong>{session.user.email ?? 'Google user'}</strong></p>
      <button disabled={busy || working} onClick={signOut}>Sign out</button>
    </div> : published ? <div className="sign-in-options">
      <button disabled={busy || working} onClick={signIn}>{working ? 'Opening Google…' : 'Sign in with Google'}</button>
      <span>or</span>
      <form className="email-sign-in" onSubmit={signInWithEmail}>
        <label htmlFor="sign-in-email">Sign in with email</label>
        <div className="email-sign-in-row">
          <input id="sign-in-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required disabled={busy || working} />
          <button type="submit" disabled={busy || working}>{working ? 'Sending…' : 'Email me a link'}</button>
        </div>
        {emailSent && <p className="email-sent" role="status">Check your email for the sign-in link.</p>}
      </form>
    </div> :
      <p>To sign in, open the <a href={productionUrl} target="_blank" rel="noreferrer">published app</a>. Preview items stay in this preview browser.</p>}
    {session && <button type="button" disabled={busy || working} onClick={deleteAccount}
      style={{ color: '#9a2525', borderColor: '#9a2525', minHeight: 44 }}>
      {deleting ? 'Deleting account…' : 'Delete my account and data'}
    </button>}
    {deletionMessage && <p role="status">{deletionMessage}</p>}
    {error && <p role="alert">{error}</p>}
  </>} />
}
