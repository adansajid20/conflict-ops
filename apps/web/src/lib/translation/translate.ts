import { createServiceClient } from '@/lib/supabase/server'

type EventForTranslation = {
  id: string
  description?: string | null
  description_original?: string | null
  description_lang?: string | null
  description_translated?: string | null
}

type TranslateResult = {
  translated: boolean
  description_translated: string | null
}

async function translateText(text: string): Promise<string | null> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey || !text.trim()) return null

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Translate user-provided event text into concise, neutral English. Return only the translated text.' },
          { role: 'user', content: `Translate to English:\n\n${text.substring(0, 4000)}` },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    })

    if (!response.ok) return null
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content?.trim() ?? null
    return content && content.length > 0 ? content : null
  } catch {
    return null
  }
}

export async function translateEvent(event: EventForTranslation): Promise<TranslateResult> {
  if (!event.id) return { translated: false, description_translated: null }
  if (!event.description_lang || event.description_lang === 'en' || event.description_translated) {
    return { translated: false, description_translated: event.description_translated ?? null }
  }

  const sourceText = event.description_original ?? event.description ?? ''
  const translated = await translateText(sourceText)
  if (!translated) {
    return { translated: false, description_translated: null }
  }

  try {
    const supabase = createServiceClient()
    await supabase
      .from('events')
      .update({
        description_translated: translated,
        translation_confidence: 0.85,
        language_detector_version: 'gpt-4o-mini-v1',
      })
      .eq('id', event.id)
  } catch {
    return { translated: false, description_translated: null }
  }

  return { translated: true, description_translated: translated }
}
