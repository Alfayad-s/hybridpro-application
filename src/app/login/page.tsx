import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

type LoginSearch = {
  welcome?: string
  checkout?: string
  reauth?: string
  email?: string
  error?: string
  message?: string
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearch>
}) {
  const params = await searchParams

  return (
    <LoginForm
      paidWelcome={params.welcome === '1'}
      checkoutPlan={params.checkout ?? null}
      reauth={params.reauth === '1'}
      presetEmail={params.email ?? null}
      authError={params.error ?? null}
      authMessage={params.message ?? null}
    />
  )
}
