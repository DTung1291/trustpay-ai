import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ContractProvider } from '@/hooks/useContract'
import { WalletProvider } from '@/hooks/useWallet'
import { TransactionsProvider } from '@/hooks/useTransactions'
import { Header } from '@/components/Header'
import { Gate } from '@/components/Gate'
import { TxPanel } from '@/components/TxPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Spinner } from '@/components/ui'

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const CreateAgreement = lazy(() => import('@/pages/CreateAgreement').then((m) => ({ default: m.CreateAgreement })))
const AgreementDetail = lazy(() => import('@/pages/AgreementDetail').then((m) => ({ default: m.AgreementDetail })))
const VerificationResults = lazy(() =>
  import('@/pages/VerificationResults').then((m) => ({ default: m.VerificationResults })),
)

const Loading = () => (
  <div className="flex items-center gap-2 text-slate-400">
    <Spinner /> Loading...
  </div>
)

export default function App() {
  return (
    <ContractProvider>
      <WalletProvider>
        <TransactionsProvider>
          <HashRouter>
            <div className="min-h-dvh pb-28">
              <Header />
              <main className="mx-auto max-w-6xl px-4 py-8">
                <ErrorBoundary>
                  <Gate>
                    <Suspense fallback={<Loading />}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/create" element={<CreateAgreement />} />
                        <Route path="/agreements/:id" element={<AgreementDetail />} />
                        <Route
                          path="/agreements/:id/milestones/:index/verification"
                          element={<VerificationResults />}
                        />
                        <Route path="*" element={<Dashboard />} />
                      </Routes>
                    </Suspense>
                  </Gate>
                </ErrorBoundary>
              </main>
              <TxPanel />
            </div>
          </HashRouter>
        </TransactionsProvider>
      </WalletProvider>
    </ContractProvider>
  )
}
