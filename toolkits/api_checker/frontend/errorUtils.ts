const REQUEST_FAILED_PATTERN = /^Request failed \((\d{3})\):\s*(.*)$/s

function extractDetail(value: unknown): string | null {
  if (value == null) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const detail = extractDetail(entry)
      if (detail) {
        return detail
      }
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const priorityKeys = ['detail', 'message', 'msg', 'error', 'title'] as const

    for (const key of priorityKeys) {
      if (key in record) {
        const detail = extractDetail(record[key])
        if (detail) {
          return detail
        }
      }
    }

    for (const nested of Object.values(record)) {
      const detail = extractDetail(nested)
      if (detail) {
        return detail
      }
    }
  }

  return null
}

function fallbackMessageForStatus(statusCode?: number): string {
  if (typeof statusCode !== 'number') {
    return 'Request failed. Try again in a moment.'
  }
  if (statusCode >= 500) {
    return 'Server returned an unexpected error. Retry or check toolbox logs.'
  }
  if (statusCode === 404) {
    return 'Requested resource was not found. Confirm the URL and try again.'
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'You do not have permission to perform that request.'
  }
  return 'Request was rejected. Review the input and try again.'
}

function formatRequestFailedError(message: string): { statusCode?: number; message: string } {
  const match = REQUEST_FAILED_PATTERN.exec(message)
  if (!match) {
    return { message }
  }

  const statusCode = Number.parseInt(match[1], 10)
  const body = match[2].trim()

  if (!body) {
    return {
      statusCode,
      message: fallbackMessageForStatus(statusCode),
    }
  }

  let extracted: string | null = null

  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      const parsed = JSON.parse(body)
      extracted = extractDetail(parsed)
    } catch (err) {
      extracted = body
    }
  } else {
    extracted = body
  }

  const detail = extracted ?? fallbackMessageForStatus(statusCode)
  const prefix = Number.isFinite(statusCode) ? `HTTP ${statusCode}` : 'Request failed'

  return {
    statusCode,
    message: detail ? `${prefix}: ${detail}` : fallbackMessageForStatus(statusCode),
  }
}

export function formatApiError(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim() || 'An unexpected error occurred. Check the console for details.'
  }

  if (error instanceof TypeError) {
    const lowerMessage = error.message.toLowerCase()
    if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network')) {
      return 'Network request failed. Check your connection or proxy settings and try again.'
    }
  }

  if (error instanceof Error) {
    return formatRequestFailedError(error.message).message
  }

  return 'An unexpected error occurred. Check the console for details.'
}
