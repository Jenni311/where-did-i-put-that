import { createClient } from '@supabase/supabase-js'

// Publishable connection details, deliberately safe to include in a web build.
// Database passwords, service-role keys and Google secrets never belong here.
export const supabase = createClient(
  'https://yscqxlcrceomonfibpsw.supabase.co',
  'sb_publishable_D3tPRcnHN9mQK3acbC2ctA_SzGD1yvg',
  {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    global: {
      fetch: async (input, init) => {
        const controller = new AbortController()
        const abort = () => controller.abort()
        const signal = init?.signal
        if (signal?.aborted) abort()
        else signal?.addEventListener('abort', abort, { once: true })
        const upload = String(input).includes('/storage/') && init?.method === 'POST'
        const timeout = setTimeout(abort, upload ? 120_000 : 30_000)
        try { return await fetch(input, { ...init, signal: controller.signal }) }
        finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
      },
    },
  },
)

export const productionUrl = 'https://jenni311.github.io/where-did-i-put-that/'
