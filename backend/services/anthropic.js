const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un analista financiero experto. Recibes datos financieros de una empresa de
panificación y pastelerías y generas informes ejecutivos claros, concisos y accionables en español.
Responde siempre en texto plano estructurado, sin markdown.`;

async function generateReport(data, prompt) {
  const userMessage = prompt
    ? `${prompt}\n\nDatos:\n${JSON.stringify(data, null, 2)}`
    : `Genera un informe ejecutivo basado en los siguientes datos financieros:\n\n${JSON.stringify(data, null, 2)}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0]?.type === 'text' ? message.content[0].text : '';
}

module.exports = { generateReport };
