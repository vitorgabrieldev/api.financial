import './globals.css'

export const metadata = {
  title: 'api.financial-core | site.financial',
  description: 'Frontend privado para organização financeira pessoal.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
