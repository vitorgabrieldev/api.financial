import { NextResponse } from 'next/server'
import { coreFetch } from '@/lib/core-api'
import { readSessionFromRequest } from '@/lib/session'

export const dynamic = 'force-dynamic'

const readOptionalBody = async (request) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined
  }

  try {
    return await request.json()
  } catch {
    return undefined
  }
}

const proxy = async (request, context) => {
  const params = await context.params
  const pathParts = params?.path ?? []
  const upstreamPath = `/api/${pathParts.join('/')}`
  const body = await readOptionalBody(request)
  const session = readSessionFromRequest(request)

  const result = await coreFetch({
    path: upstreamPath,
    method: request.method,
    body,
    token: session.accessToken || undefined,
    searchParams: request.nextUrl.searchParams,
  })

  if (typeof result.payload === 'string') {
    return new NextResponse(result.payload, {
      status: result.status,
      headers: {
        'Content-Type': result.contentType || 'text/plain; charset=utf-8',
      },
    })
  }

  return NextResponse.json(result.payload, { status: result.status })
}

export async function GET(request, context) {
  return proxy(request, context)
}

export async function POST(request, context) {
  return proxy(request, context)
}

export async function PATCH(request, context) {
  return proxy(request, context)
}

export async function PUT(request, context) {
  return proxy(request, context)
}

export async function DELETE(request, context) {
  return proxy(request, context)
}
